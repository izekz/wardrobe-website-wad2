const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { memoryModel } = require('./helpers/memoryModels');
const { createWardrobeRouter } = require('../routes/wardrobeRoutes');
const { createCommerceRouter } = require('../routes/commerceRoutes');

test('editing planner and cart variants updates the source entry with private in-memory fixtures', async t => {
  const models = Object.fromEntries([['User','User'],['Product','Product'],['Item','WardrobeItem'],['Outfit','SavedOutfit']]
    .map(([key,name]) => [key,memoryModel(require('../models/'+name))]));
  const a = await models.User.create({name:'A',email:'a@example.invalid',passwordHash:'unused'});
  const b = await models.User.create({name:'B',email:'b@example.invalid',passwordHash:'unused'});
  const product = await models.Product.create({name:'Variant shirt',businessId:'shop',businessName:'Shop',category:'Tops',style:'Minimalist',
    colours:['Black','White'],material:'Cotton',description:'Offline fixture',price:25,stock:16,sizes:['M','L'],sizeStock:[{size:'M',stock:8},{size:'L',stock:8}],
    photo:{data:Buffer.from('fixture'),contentType:'image/png'}});
  const other = await models.Product.create({...product.toObject(),_id:undefined,name:'Other shirt'});
  const ref = (colour='Black',size='M',quantity=2) => ({productId:String(product._id),colour,size,quantity});
  const pkey = line => `${line.productId}:${line.colour}:${line.size}`;
  const ckey = line => `${line.productId}:${line.size}:${line.colour}`;
  const app=express();app.use(express.json(),(req,res,next)=>{
    if(req.get('x-fixture-user'))req.user={id:req.get('x-fixture-user'),role:req.get('x-fixture-role')||'consumer'};
    next();
  });
  app.use('/api/wardrobe',createWardrobeRouter(models,async()=>({available:false}),async()=>({})));
  app.use('/api/commerce',createCommerceRouter(models));
  app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  async function api(path,method='GET',body,user=String(a._id),headers={}){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api`+path,{method,headers:{'Content-Type':'application/json',
      ...(user?{'x-fixture-user':user}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  }
  const planner=async()=> (await api('/wardrobe/planner-products')).body.products;
  const cart=async()=> (await api('/commerce/shop')).body.cart;
  const putPlanner=(source,target,user,headers)=>api('/wardrobe/planner-products/'+encodeURIComponent(pkey(source)),'PUT',target,user,headers);
  const putCart=(source,target,user,headers)=>api('/commerce/cart/'+encodeURIComponent(ckey(source)),'PUT',target,user,headers);
  const seed=async(plannerProducts=[],cartItems=[])=>models.User.findOneAndUpdate({_id:a._id},{$set:{plannerProducts,cartItems}});

  await t.test('planner replaces colour and size, repeated updates persist without creating entries',async()=>{
    await seed([ref()],[ref()]);
    let result=await putPlanner(ref(),ref('White','L'));
    assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.key,pkey(ref('White','L')));
    assert.equal((await planner()).length,1);assert.equal((await planner())[0].key,pkey(ref('White','L')));
    result=await putPlanner(ref('White','L'),ref('Black','L'));assert.equal(result.status,200);
    assert.equal((await planner()).length,1);assert.equal((await cart())[0].key,ckey(ref()));
  });
  await t.test('planner collision collapses duplicate options and preserves other collected products',async()=>{
    await seed([ref(),ref('White','L'),{...ref(),productId:String(other._id)}]);
    assert.equal((await putPlanner(ref(),ref('White','L'))).status,200);
    const list=await planner();assert.equal(list.length,2);assert.equal(list[0].key,pkey(ref('White','L')));
    assert.equal(list[1].productId,String(other._id));
    assert.equal((await putPlanner(ref('White','L'),ref('White','L'))).status,200);assert.equal((await planner()).length,2);
  });
  await t.test('cart replaces its source with exact requested quantity and leaves planner untouched',async()=>{
    await seed([ref()],[ref(),{...ref(),productId:String(other._id)}]);
    let result=await putCart(ref(),ref('White','L',3));assert.equal(result.status,200,JSON.stringify(result));
    assert.equal(result.body.key,ckey(ref('White','L')));assert.equal((await cart()).length,2);
    assert.equal((await cart())[0].quantity,3);assert.equal((await cart())[1].productId,String(other._id));
    assert.equal((await planner())[0].key,pkey(ref()));
    result=await putCart(ref('White','L'),ref('White','L',3));assert.equal(result.status,200);assert.equal((await cart())[0].quantity,3);
  });
  await t.test('cart collisions merge quantities without dropping units or duplicating lines',async()=>{
    await seed([],[ref(),ref('White','L',3)]);
    const result=await putCart(ref(),ref('White','L',2));assert.equal(result.status,200,JSON.stringify(result));
    const lines=await cart();assert.equal(lines.length,1);assert.equal(lines[0].quantity,5);assert.equal(lines[0].key,ckey(ref('White','L')));
  });
  await t.test('invalid options, stock and merged limits fail without changing the existing entries',async()=>{
    await seed([ref()],[ref(),ref('White','L',7)]);
    assert.equal((await putCart(ref(),ref('White','L',2))).status,409); // Combined 9 > size stock 8.
    assert.equal((await putCart(ref(),ref('White','L',4))).status,409); // Combined 11 > per-line limit 10.
    assert.equal((await putCart(ref(),ref('Red'))).status,409);
    assert.equal((await putCart(ref(),ref('Black','XL'))).status,409);
    assert.equal((await putCart(ref(),ref('Black','M',0))).status,400);
    assert.equal((await putPlanner(ref(),ref('Red'))).status,400);
    assert.equal((await putPlanner(ref(),ref('Black','XL'))).status,400);
    assert.equal((await cart())[0].key,ckey(ref()));assert.equal((await cart())[0].quantity,2);
    assert.equal((await planner())[0].key,pkey(ref()));
  });
  await t.test('stale sources, different products, guests, roles and other accounts cannot edit or append',async()=>{
    await seed([ref()],[ref()]);
    for(const put of [putPlanner,putCart]){
      assert.equal((await put(ref('White','L'),ref())).status,409);
      assert.equal((await put(ref(),{...ref(),productId:String(other._id)})).status,400);
      assert.equal((await put(ref(),ref('White','L'),String(b._id))).status,409);
      assert.equal((await put(ref(),ref(),null)).status,401);
      assert.equal((await put(ref(),ref(),String(a._id),{'x-fixture-role':'business'})).status,403);
      assert.equal((await put(ref(),ref(),String(a._id),{Origin:'https://untrusted.example.invalid'})).status,403);
    }
    assert.equal((await putPlanner(ref(),ref(),String(b._id),{'X-Planner-User':String(a._id)})).status,409);
    assert.equal((await putCart(ref(),ref(),String(b._id),{'X-Shop-User':String(a._id)})).status,409);
    assert.equal((await planner()).length,1);assert.equal((await cart()).length,1);
  });
  await t.test('guarded first adds cannot create a second variant and preserve the current server cart',async()=>{
    await seed([],[{...ref(),productId:String(other._id)}]);
    const addPlanner=target=>api('/wardrobe/planner-products','POST',{...target,requireNewProduct:true});
    const addCart=target=>api('/commerce/cart','PUT',{cart:[target],newProductId:target.productId});
    assert.equal((await addPlanner(ref())).status,200);
    assert.equal((await addPlanner(ref('White','L'))).status,409);
    assert.equal((await planner()).length,1);
    assert.equal((await addCart(ref())).status,200);
    assert.equal((await addCart(ref('White','L'))).status,409);
    const lines=await cart();assert.equal(lines.length,2);assert.equal(lines[0].productId,String(other._id));
    assert.equal(lines[1].key,ckey(ref()));assert.equal(lines[1].quantity,2);
    assert.equal((await api('/commerce/cart','PUT',{cart:[ref()],newProductId:String(other._id)})).status,400);
    assert.equal((await api('/commerce/cart','PUT',{cart:[],newProductId:String(product._id)})).status,400);
  });
  await t.test('two stale first-add requests leave one entry per product instead of producing duplicate variants',async()=>{
    await seed();
    const original=models.User.findOneAndUpdate;
    let writes=Promise.resolve();
    // The in-memory adapter validates asynchronously; serialize writes like MongoDB's atomic update.
    models.User.findOneAndUpdate=function(...args){
      const result=writes.then(()=>original.apply(this,args));writes=result.catch(()=>{});return result;
    };
    try{
      const planners=await Promise.all([ref(),ref('White','L')].map(target=>api('/wardrobe/planner-products','POST',{...target,requireNewProduct:true})));
      assert.deepEqual(planners.map(result=>result.status).sort(),[200,409]);assert.equal((await planner()).length,1);
      const carts=await Promise.all([ref(),ref('White','L')].map(target=>api('/commerce/cart','PUT',{cart:[target],newProductId:target.productId})));
      assert.deepEqual(carts.map(result=>result.status).sort(),[200,409]);assert.equal((await cart()).length,1);
    }finally{models.User.findOneAndUpdate=original}
  });
  await t.test('an unavailable old size can be repaired, without blocking on another unavailable cart line',async()=>{
    await seed([ref()],[ref(),{...ref(),productId:String(other._id)}]);
    await models.Product.findOneAndUpdate({_id:product._id},{$set:{sizeStock:[{size:'M',stock:0},{size:'L',stock:8}],stock:8}});
    await models.Product.findOneAndUpdate({_id:other._id},{$set:{status:'hidden'}});
    assert.equal((await putPlanner(ref(),ref('White','L'))).status,200);
    assert.equal((await putCart(ref(),ref('White','L'))).status,200);
    const lines=await cart();assert.equal(lines.length,2);assert.equal(lines[0].available,true);assert.equal(lines[1].available,false);
  });
  await t.test('planner photos follow the chosen colour through collection, selection, refresh and variant editing',async()=>{
    await models.Product.findOneAndUpdate({_id:product._id},{$set:{colours:['Black','White','Grey'],colourPhotos:[
      {colour:'Black',contentType:'image/png'},
      {colour:'Grey',contentType:'image/png',data:Buffer.from('grey photo')}
    ]}});
    await seed([]);
    const grey=ref('Grey','L'), black=ref('Black','L'), white=ref('White','L');
    const greyImage=`/api/catalog/products/${product._id}/colour-image/Grey`;
    const added=await api('/wardrobe/planner-products','POST',grey);
    assert.equal(added.status,200);assert.equal(added.body.products[0].imageURL,greyImage);
    assert.equal((await planner())[0].imageURL,greyImage);
    for(const path of ['/wardrobe/recommendations','/wardrobe/selection']){
      const result=await api(path,'POST',{occasion:'Presentation',itemIds:[],products:[grey]});
      assert.equal(result.status,200,JSON.stringify(result));
      const piece=path.endsWith('/selection')?result.body.selection.pieces[0]:result.body.products[0];
      assert.equal(piece.imageURL,greyImage);assert.equal(piece.colour,'Grey');
    }
    const edited=await putPlanner(grey,black);assert.equal(edited.status,200);
    // A first-colour row uses the existing image endpoint's main-photo fallback.
    assert.equal(edited.body.products[0].imageURL,`/api/catalog/products/${product._id}/colour-image/Black`);
    assert.equal((await planner())[0].imageURL,edited.body.products[0].imageURL);
    const fallback=await putPlanner(black,white);assert.equal(fallback.status,200);
    assert.equal(fallback.body.products[0].imageURL,`/api/catalog/products/${product._id}/image`);
    assert.equal((await planner())[0].imageURL,fallback.body.products[0].imageURL);
  });
  await t.test('concurrent edits reject stale snapshots instead of overwriting another tab',async()=>{
    await seed([ref()],[ref()]);
    const original=models.User.findOneAndUpdate;
    models.User.findOneAndUpdate=async function(filter,update,...rest){
      if(Array.isArray(filter.plannerProducts)||Array.isArray(filter.cartItems)){
        const field=filter.plannerProducts?'plannerProducts':'cartItems';
        await original.call(this,{_id:a._id},{$set:{[field]:[]}});
      }
      return original.call(this,filter,update,...rest);
    };
    try{
      assert.equal((await putPlanner(ref('White','L'),ref())).status,409);
      // M currently sold out, use L as both the source and target for the snapshot check.
      await seed([ref('White','L')],[ref('White','L')]);
      assert.equal((await putPlanner(ref('White','L'),ref('Black','L'))).status,409);
      assert.equal((await putCart(ref('White','L'),ref('Black','L'))).status,409);
      assert.equal((await planner()).length,0);assert.equal((await cart()).length,0);
    }finally{models.User.findOneAndUpdate=original}
  });
});

test('planner product details keep cart updates available across planner edits and refresh',async()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../../src/view/discover/ProductDetail.vue'),'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','globalThis.component =');
  const id='507f1f77bcf86cd799439021';
  const line=(colour='Black',size='M',quantity=2)=>({productId:id,key:`${id}:${size}:${colour}`,colour,size,quantity});
  const store={ready:true,loading:false,pending:0,cart:[line()]};
  const planner={products:[],pending:0,ready:true,loading:false};
  const sandbox={shopState:store,plannerProductsState:planner,authState:{user:{id:'A',role:'consumer'}},
    CommunityIcon:{},RequestSuggestionAction:{},SkipFeedback:{},ReportDialog:{},money:x=>x,setTimeout,clearTimeout,
    hydrateShop:async()=>{},hydratePlannerProducts:async()=>{},storeVariantKey:p=>`${p.productId}:${p.colour}:${p.size}`,
    updatePlannerProduct:async(key,product,options)=>({key:`${id}:${options.colour}:${options.size}`,products:[]}),
    updateCartItem:async(key,product,options)=>{
      assert.equal(key,`${id}:M:Black`); // The planner may already have changed to White/L.
      store.cart=[line(options.colour,options.size,options.quantity)];return store.cart[0];
    },addToCart:async()=>{throw new Error('Must update the existing cart item')},toggleLike:async()=>{},isLiked:()=>false};
  vm.runInNewContext(source,sandbox);
  const component=sandbox.component,page=component.data();
  page.$route={params:{productId:id},query:{fromPlanner:'1',plannerKey:`${id}:Black:M`,colour:'Black',size:'M'}};
  page.$router={replace:async({query})=>{page.$route.query=query;page.restoreSelections()},getRoutes:()=>[]};
  for(const [key,method] of Object.entries(component.methods))page[key]=method.bind(page);
  for(const [key,get] of Object.entries(component.computed))Object.defineProperty(page,key,{get:()=>get.call(page)});
  page.product={productId:id,stock:10,sizes:['M','L'],colours:['Black','White'],sizeStock:{M:5,L:5}};
  page.restoreSelections();assert.equal(page.editingCart,true);assert.equal(page.quantity,2);
  assert.equal(page.cartSourceKey,`${id}:M:Black`);
  page.colour='White';page.size='L';await page.addToPlanner();
  assert.equal(page.$route.query.cartKey,`${id}:M:Black`);assert.equal(page.editingCart,true);
  page.restoreSelections();assert.equal(page.colour,'White');assert.equal(page.size,'L');assert.equal(page.quantity,2);
  await page.addCart();assert.equal(store.cart.length,1);assert.equal(page.$route.query.cartKey,`${id}:L:White`);
  assert.equal(page.$route.query.quantity,'2');assert.equal(page.toast,'Cart item updated.');
  // A second update uses the new cart key, and the planner source remains independently pinned.
  assert.equal(page.cartSourceKey,`${id}:L:White`);assert.equal(page.plannerSourceKey,`${id}:White:L`);
  page.$route.query={fromPlanner:'1',colour:'Black',size:'M'};store.cart=[line('White','L',3)];
  page.restoreSelections();assert.equal(page.cartSourceKey,`${id}:L:White`);assert.equal(page.quantity,3);
  // Ambiguous variants cannot silently create a new line or pick the wrong existing one.
  store.cart=[line('White','M'),line('White','L')];page.restoreSelections();
  assert.equal(page.editingCart,true);assert.equal(page.cartChoiceRequired,true);assert.equal(page.canCart,false);
  await page.chooseCartEntry({target:{value:`${id}:L:White`}});assert.equal(page.cartChoiceRequired,false);
  assert.equal(page.colour,'Black');assert.equal(page.size,'M');assert.equal(page.cartSourceKey,`${id}:L:White`);
  // No cart item: adding stays available. Ordinary product browsing also keeps its Add behaviour.
  page.$route.query={fromPlanner:'1',colour:'Black',size:'M'};store.cart=[];
  assert.equal(page.editingCart,false);assert.ok(page.canCart);
  store.cart=[line()];page.$route.query={};assert.equal(page.editingCart,true);
  page.$route.query={fromPlanner:'1',cartKey:`${id}:removed`,colour:'Black',size:'M'};
  assert.equal(page.editingCart,true);assert.equal(page.cartSourceKey,`${id}:removed`);
  clearTimeout(page.toastTimer);
});

test('product details resolve cart and planner independently for every entry path',async t=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../../src/view/discover/ProductDetail.vue'),'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','globalThis.component =');
  const id='507f1f77bcf86cd799439021',product={productId:id,stock:12,sizes:['M','L'],colours:['Black','White'],sizeStock:{M:6,L:6}};
  const ref=(colour='Black',size='M',quantity=2)=>({productId:id,colour,size,quantity});
  const ckey=entry=>`${entry.productId}:${entry.size}:${entry.colour}`,pkey=entry=>`${entry.productId}:${entry.colour}:${entry.size}`;
  function fixture(query,cart=[],products=[]){
    const shopping={ready:true,loading:false,pending:0,cart:cart.map(row=>({...row,key:ckey(row)}))};
    const planner={ready:true,loading:false,pending:0,products:products.map(row=>({...row,key:pkey(row),available:true}))};
    const writes=[];
    const sandbox={shopState:shopping,plannerProductsState:planner,authState:{user:{id:'A',role:'consumer'}},
      CommunityIcon:{},RequestSuggestionAction:{},SkipFeedback:{},ReportDialog:{},money:x=>x,setTimeout,clearTimeout,
      hydrateShop:async()=>{},hydratePlannerProducts:async()=>{},catalogApi:async()=>({product,business:{}}),storeVariantKey:pkey,
      updatePlannerProduct:async(key,item,options)=>{
        writes.push({kind:'planner',key,...options});
        const index=planner.products.findIndex(row=>pkey(row)===key);assert.ok(index>=0);
        planner.products[index]={...planner.products[index],...options};return {key:pkey(planner.products[index])};
      },updateCartItem:async(key,item,options)=>{
        writes.push({kind:'cart',key,...options});
        const index=shopping.cart.findIndex(row=>ckey(row)===key);assert.ok(index>=0);
        shopping.cart[index]={...shopping.cart[index],...options};shopping.cart[index].key=ckey(shopping.cart[index]);return shopping.cart[index];
      },addToCart:async()=>{throw new Error('Unexpected duplicate cart add')},addPlannerProduct:async()=>{throw new Error('Unexpected duplicate planner add')},toggleLike:async()=>{},isLiked:()=>false};
    vm.runInNewContext(source,sandbox);
    const component=sandbox.component,page=component.data();page.$route={params:{productId:id},query:{...query}};
    page.$router={replace:async({query})=>{page.$route.query=query;if(!page.loading)page.restoreSelections()},getRoutes:()=>[]};
    for(const [key,method] of Object.entries(component.methods))page[key]=method.bind(page);
    for(const [key,get] of Object.entries(component.computed))Object.defineProperty(page,key,{get:()=>get.call(page)});
    page.product=product;page.loading=false;
    return {page,shopping,planner,writes,sandbox,dispose:()=>clearTimeout(page.toastTimer)};
  }
  for(const origin of ['cart','planner','discover'])for(const first of ['cart','planner']){
    await t.test(`${origin} visit updates ${first} first, then the other entry, without adding duplicates`,async()=>{
      const query={...(origin==='cart'?{fromCart:'1',cartKey:ckey(ref())}:origin==='planner'?{fromPlanner:'1',plannerKey:pkey(ref('White','L'))}:{}),
        ...(origin==='discover'?{}:{colour:origin==='cart'?'Black':'White',size:origin==='cart'?'M':'L'})};
      const f=fixture(query,[ref()],[ref('White','L')]),p=f.page;
      try{
        await p.load();assert.equal(p.editingCart,true);assert.equal(p.editingPlanner,true);
        assert.equal(p.cartSourceKey,ckey(ref()));assert.equal(p.plannerSourceKey,pkey(ref('White','L')));
        assert.equal(p.quantity,2);p.colour='Black';p.size='L';
        if(first==='cart'){await p.addCart();await p.addToPlanner()}else{await p.addToPlanner();await p.addCart()}
        assert.equal(f.writes.length,2);assert.equal(f.shopping.cart.length,1);assert.equal(f.planner.products.length,1);
        assert.equal(p.cartSourceKey,ckey(ref('Black','L')));assert.equal(p.plannerSourceKey,pkey(ref('Black','L')));
        assert.equal(f.shopping.cart[0].quantity,2);
        p.restoreSelections();assert.equal(p.colour,'Black');assert.equal(p.size,'L');assert.equal(p.quantity,2);
      }finally{f.dispose()}
    });
  }
  await t.test('ambiguous legacy planner variants require choosing a source, not adding another variant',async()=>{
    const f=fixture({fromCart:'1',cartKey:ckey(ref()),colour:'Black',size:'M'},[ref()],[ref('White','M'),ref('White','L')]),p=f.page;
    try{
      await p.load();assert.equal(p.editingPlanner,true);assert.equal(p.plannerChoiceRequired,true);assert.equal(p.canPlan,false);
      await p.addToPlanner();assert.equal(f.writes.length,0);
      await p.choosePlannerEntry({target:{value:pkey(ref('White','L'))}});assert.equal(p.plannerChoiceRequired,false);
      assert.equal(p.cartSourceKey,ckey(ref()));assert.equal(p.colour,'Black');assert.equal(p.size,'M');
      await p.addToPlanner();assert.equal(f.writes[0].key,pkey(ref('White','L')));assert.equal(f.planner.products.length,2);
    }finally{f.dispose()}
  });
  await t.test('a pinned removed source never becomes an Add action, and failed hydration blocks changes',async()=>{
    const f=fixture({fromCart:'1',cartKey:ckey(ref()),plannerKey:pkey(ref('White','L')),colour:'Black',size:'M'},[],[]),p=f.page;
    try{
      await p.load();assert.equal(p.editingCart,true);assert.equal(p.editingPlanner,true);
      assert.equal(p.cartSourceKey,ckey(ref()));assert.equal(p.plannerSourceKey,pkey(ref('White','L')));
      f.sandbox.hydratePlannerProducts=async()=>{throw new Error('Offline')};await p.load();
      assert.ok(p.entryRefreshError);assert.equal(p.canPlan,false);assert.equal(p.canCart,false);
      f.sandbox.hydratePlannerProducts=async()=>{};await p.load();assert.equal(p.entryRefreshError,'');
      p.$route.query={requestId:'r',responseId:'s',fromCart:'1',fromPlanner:'1'};
      assert.equal(p.editingCart,false);assert.equal(p.editingPlanner,false);
    }finally{f.dispose()}
  });
});
