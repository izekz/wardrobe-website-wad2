const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { memoryModel } = require('./helpers/memoryModels');
const { createWardrobeRouter } = require('../routes/wardrobeRoutes');
const User = require('../models/User'), Product = require('../models/Product');
const Item = require('../models/WardrobeItem'), Outfit = require('../models/SavedOutfit');
const { singaporeToday } = require('../communityValidation');
const { publicUser } = require('../services/authSession');
test('planner references are private account data', () => {
  assert.equal(User.schema.path('plannerProducts').options.select, false);
  const user = new User({ name: 'Fixture', email: 'fixture@example.invalid', passwordHash: 'unused', plannerProducts: [{ productId: '507f1f77bcf86cd799439099', colour: 'Black', size: 'M' }] });
  assert.equal(user.plannerProducts.length, 1);
  // Sessions use an explicit public projection; planner data is not a session field.
  if (publicUser) assert.equal(publicUser(user).plannerProducts, undefined);
});
test('private multi-store planner HTTP flows use in-memory fixtures only', async t => {
  const models = { User: memoryModel(User), Product: memoryModel(Product), Item: memoryModel(Item), Outfit: memoryModel(Outfit) };
  const a = await models.User.create({ name: 'A', email: 'a@example.invalid', passwordHash: 'unused' });
  const b = await models.User.create({ name: 'B', email: 'b@example.invalid', passwordHash: 'unused' });
  const app = express(); app.use(express.json());
  app.use((req,res,next) => { const user = req.get('x-fixture-user'); if (user) req.user = { id: user, role: req.get('x-fixture-role') || 'consumer', preferredStyles: ['Minimalist'] }; next(); });
  app.use('/api/wardrobe', createWardrobeRouter(models, async () => ({ available: false }), async () => ({})));
  app.use((error,req,res,next) => res.status(error.status || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const server = app.listen(0,'127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/wardrobe`;
  async function api(path, method = 'GET', body, user = String(a._id), headers = {}) {
    const response = await fetch(base+path,{ method, headers: { 'Content-Type':'application/json', ...(user ? {'x-fixture-user':user} : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  async function product(category, name, businessId, extra = {}) {
    return models.Product.create({ name, businessId, businessName: businessId+' store', category, style:'Minimalist', colours:['Black','White'], material:'Cotton', price:25, stock:5, sizes:['M','L'], sizeStock:[{size:'M',stock:3},{size:'L',stock:2}], description:'Offline fixture', photo:{data:Buffer.from('fixture'),contentType:'image/png'}, ...extra });
  }
  const shirt = await product('Tops','Store shirt','shop-a'), pants = await product('Bottoms','Store trousers','shop-b'), shoes = await product('Shoes','Store shoes','shop-c');
  const ref = (doc, colour='Black', size='M') => ({ productId:String(doc._id), colour, size });
  const key = value => `${value.productId}:${value.colour}:${value.size}`;
  const refs = [shirt,pants,shoes].map(doc=>ref(doc));
  const input = { occasion:'Presentation', date:singaporeToday(), itemIds:[], products:refs };
  await t.test('guest/role/stale-account writes are blocked and do not change data',async()=>{
    assert.equal((await api('/planner-products','GET',undefined,null)).status,401);
    assert.equal((await api('/planner-products','POST',refs[0],String(a._id),{'x-fixture-role':'business'})).status,403);
    const stale=await api('/planner-products','POST',refs[0],String(b._id),{'X-Planner-User':String(a._id)});
    assert.equal(stale.status,409);assert.equal(stale.body.code,'ACCOUNT_CHANGED');
    assert.equal((await api('/planner-products')).body.products.length,0);
  });
  await t.test('collects multiple stores, ignores forged metadata, persists and isolates accounts',async()=>{
    for (const r of refs) { const result=await api('/planner-products','POST',{...r, userId:String(b._id), price:0, name:'forged'});assert.equal(result.status,200,JSON.stringify(result)); }
    assert.equal((await api('/planner-products')).body.products.length,3);
    assert.equal((await api('/planner-products','GET',undefined,String(b._id))).body.products.length,0);
    const list=(await api('/planner-products')).body.products;
    assert.deepEqual(list.map(p=>p.businessName),['shop-a store','shop-b store','shop-c store']);
    assert.equal(list[0].price,25); assert.equal(list[0].name,'Store shirt');assert.equal(list[0].size,'M');
    await api('/planner-products','POST',refs[0]);assert.equal((await api('/planner-products')).body.products.length,3);
    await api('/planner-products','POST',ref(shirt,'White','L'));assert.equal((await api('/planner-products')).body.products.length,4);
    assert.equal((await api('/planner-products','POST',{...refs[0],colour:'Red'})).status,400);
    assert.equal((await api('/planner-products','POST',{...refs[0],size:'XL'})).status,400);
    assert.equal((await api('/planner-products','POST',{...refs[0],size:''})).status,400);
    assert.equal((await api('/planner-products','POST',{...refs[0],colour:''})).status,400);
  });
  await t.test('candidate recommendations do not select products, selection scores each trusted piece',async()=>{
    const result=await api('/recommendations','POST',input);assert.equal(result.status,200);
    assert.equal(result.body.product,null);assert.equal(result.body.products.length,3);
    const selection=await api('/selection','POST',input);assert.equal(selection.status,200,JSON.stringify(selection));
    assert.equal(selection.body.selection.complete,true);assert.equal(selection.body.selection.pieces.length,3);
    assert.equal(selection.body.selection.scoreDetails.itemDetails.length,3);
    assert.ok(selection.body.selection.matchScore>0);
    assert.equal((await api('/selection','POST',{...input,products:[]})).body.selection,null);
    assert.equal((await api('/selection','POST',{...input,products:null})).status,400);
    assert.equal((await api('/selection','POST',{...input,products:[refs[0],refs[0]]})).status,400);
    assert.equal((await api('/selection','POST',{...input,products:[refs[0],ref(shirt,'White','L')]})).status,400);
  });
  let savedId;
  await t.test('saves and updates the same outfit with several store snapshots and size/colour',async()=>{
    const result=await api('/outfits','POST',{...input,name:'Three stores'});assert.equal(result.status,201,JSON.stringify(result));savedId=result.body.outfitId;
    const saved=(await api('/outfits/'+savedId)).body.outfit;
    assert.equal(saved.pieces.length,3); assert.equal(saved.pieces[1].businessName,'shop-b store');assert.equal(saved.pieces[0].size,'M');
    const updated=await api('/outfits/'+savedId,'PUT',{...input,name:'Updated',products:[ref(shirt,'White','L'),...refs.slice(1)]});
    assert.equal(updated.status,200);assert.equal(updated.body.outfitId,savedId);assert.equal(models.Outfit.rows.length,1);
    const edited=(await api('/outfits/'+savedId)).body.outfit;assert.equal(edited.pieces[0].colour,'White');assert.equal(edited.pieces[0].size,'L');
    assert.equal((await api('/outfits/'+savedId,'GET',undefined,String(b._id))).status,404);
    assert.equal((await api('/outfits','POST',{...input,name:'Empty',products:[]})).status,400);
  });
  await t.test('unavailable variants remain removable, other candidates still work and saving rejects them',async()=>{
    await models.Product.findOneAndUpdate({_id:shirt._id},{$set:{sizeStock:[{size:'M',stock:0},{size:'L',stock:2}],stock:2}});
    const list=(await api('/planner-products')).body.products;assert.equal(list[0].missing,true);assert.equal(list[3].missing,false);
    const plan=await api('/recommendations','POST',input);assert.equal(plan.status,200);assert.equal(plan.body.products.length,2);assert.equal(plan.body.unavailableProducts.length,1);
    assert.equal((await api('/selection','POST',input)).status,400);
    assert.equal((await api('/outfits','POST',{...input,name:'Sold out'})).status,400);
    const removed=await api('/planner-products/'+encodeURIComponent(key(refs[0])),'DELETE');assert.equal(removed.status,200);assert.equal(removed.body.products.length,3);
    await models.Product.findOneAndDelete({_id:shoes._id});
    assert.equal((await api('/outfits/'+savedId)).body.outfit.pieces.find(piece=>piece.productId===String(shoes._id)).missing,true);
    const deleted=await api('/planner-products/'+encodeURIComponent(key(refs[2])),'DELETE');assert.equal(deleted.status,200);assert.equal(deleted.body.products.length,2);
    assert.equal((await api('/planner-products','POST',refs[2])).status,404);
  });
  await t.test('mixed wardrobe/store category rules and dress replacement remain enforced',async()=>{
    const shoe=await models.Item.create({userId:String(a._id),name:'Owned shoes',category:'Shoes',colour:'Black',style:['Classic'],material:'Leather',photo:{data:Buffer.from('fixture'),contentType:'image/png'}});
    const dress=await product('Dresses','Dress','shop-b'), jacket=await product('Jackets','Jacket','shop-a'), accessory=await product('Accessories','Bag','shop-c');
    const mixed={...input,itemIds:[String(shoe._id)],products:[ref(dress),ref(jacket),ref(accessory)]};
    assert.equal((await api('/selection','POST',mixed)).body.selection.complete,true);
    assert.equal((await api('/outfits','POST',{...mixed,name:'Mixed'})).status,201);
    assert.equal((await api('/selection','POST',{...mixed,products:[...mixed.products,refs[1]]})).status,400);
    assert.equal((await api('/selection','POST',{...mixed,itemIds:['507f1f77bcf86cd799439099']})).status,400);
    const legacy=await api('/recommendations','POST',{occasion:'Presentation',date:singaporeToday(),productId:String(pants._id),productColour:'White'});
    assert.equal(legacy.status,200);assert.equal(legacy.body.product.colour,'White');
  });
  await t.test('collection cap prevents unbounded account storage',async()=>{
    const rows=Array.from({length:30},(_,i)=>({productId:String(pants._id),colour:'Black',size:String(i)}));
    await models.User.findOneAndUpdate({_id:b._id},{$set:{plannerProducts:rows}});
    const capped=await api('/planner-products','POST',ref(pants,'White','M'),String(b._id));assert.equal(capped.status,400);assert.match(capped.body.message,/30/);
    assert.equal((await api('/planner-products')).body.products.length,2);
  });
});


function frontendFixture(store = new Map([['A', []], ['B', []]])) {
  const { reactive, watch } = require('vue'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const authState = reactive({ user: null }), stops=[], events=[], calls=[];
  let cookie=null, hook=null;
  const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>JSON.parse(JSON.stringify(data))});
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/services/wardrobeService.js'),'utf8')
    .replace(/^import[^\r\n]*(?:\r?\n|$)/gm,'').replace(/\bexport\s+/g,'')+
    '\nthis.api={plannerProductsState,hydratePlannerProducts,addPlannerProduct,removePlannerProduct};';
  const sandbox=vm.createContext({reactive,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop;},authState,setTimeout,clearTimeout,AbortController,Event,
    window:{dispatchEvent:event=>events.push(event.type)},fetch:async(url,options)=>{
      calls.push({url,options});const id=cookie;
      if(hook){const result=await hook(url,options,id);if(result)return result;}
      if(!id)return response(401,{});
      if(options.headers['X-Planner-User']!==id)return response(409,{code:'ACCOUNT_CHANGED'});
      let products=store.get(id);
      if(options.method==='POST'){
        const piece=JSON.parse(options.body),key=`${piece.productId}:${piece.colour}:${piece.size}`;
        if(!products.some(item=>item.key===key))products=[...products,{...piece,key,available:true}];store.set(id,products);
      }else if(options.method==='DELETE'){products=products.filter(piece=>piece.key!==decodeURIComponent(url.split('/').at(-1)));store.set(id,products);}
      return response(200,{userId:id,products});
    }});
  new vm.Script(source).runInContext(sandbox);
  return {...sandbox.api,store,calls,authState,events,response,hook:fn=>hook=fn,cookie:id=>cookie=id,
    login(id){cookie=id;authState.user=id?{id,role:'consumer'}:null;},dispose(){stops.forEach(stop=>stop());}};
}
test('planner client persists and guards private state across refresh, account switches and late responses',async t=>{
  const product={productId:'507f1f77bcf86cd799439099'},variant={colour:'Black',size:'M'};
  await t.test('rapid adds serialize, duplicate variants are idempotent and refresh restores only the owner',async()=>{
    const f=frontendFixture();f.login('A');await Promise.all([f.addPlannerProduct(product,variant),f.addPlannerProduct(product,variant)]);
    assert.equal(f.plannerProductsState.products.length,1);assert.equal(f.plannerProductsState.pending,0);
    const reload=frontendFixture(f.store);reload.login('A');await reload.hydratePlannerProducts();assert.equal(reload.plannerProductsState.products.length,1);
    reload.login('B');assert.equal(reload.plannerProductsState.products.length,0);await reload.hydratePlannerProducts();assert.equal(reload.plannerProductsState.products.length,0);
    reload.login('A');await reload.hydratePlannerProducts();await reload.removePlannerProduct(reload.plannerProductsState.products[0].key);assert.equal(reload.plannerProductsState.products.length,0);
    f.dispose();reload.dispose();
  });
  await t.test('stale loads and queued mutations cannot populate or write to a different account',async()=>{
    const f=frontendFixture();f.login('A');let release;
    f.hook((url,options,id)=>id==='A'?new Promise(resolve=>release=()=>resolve(f.response(200,{userId:'A',products:[{...product,...variant}]}))):null);
    const old=f.hydratePlannerProducts().catch(error=>error);
    const queued=f.addPlannerProduct(product,variant).catch(error=>error);
    f.login('B');await f.hydratePlannerProducts();release();
    assert.equal((await old).code,'ACCOUNT_CHANGED');assert.equal((await queued).code,'ACCOUNT_CHANGED');assert.equal(f.plannerProductsState.products.length,0);
    assert.equal(f.calls.filter(call=>call.options.method==='POST').length,0);f.dispose();
  });
  await t.test('expired or switched cookies clear data and failed saves never claim success',async()=>{
    for(const cookie of [null,'B']){
      const f=frontendFixture();f.login('A');await f.addPlannerProduct(product,variant);f.cookie(cookie);
      await assert.rejects(f.hydratePlannerProducts(true));assert.equal(f.authState.user,null);assert.equal(f.plannerProductsState.products.length,0);assert.ok(f.events.includes('auth:expired'));f.dispose();
    }
    const f=frontendFixture();f.login('A');await f.hydratePlannerProducts();f.hook((url,options)=>options.method==='POST'?f.response(503,{message:'Offline fixture failure'}):null);
    await assert.rejects(f.addPlannerProduct(product,variant),/Offline fixture failure/);assert.equal(f.plannerProductsState.products.length,0);assert.equal(f.plannerProductsState.pending,0);f.dispose();
  });
});

