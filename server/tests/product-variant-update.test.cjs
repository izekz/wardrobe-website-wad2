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
  await t.test('an unavailable old size can be repaired, without blocking on another unavailable cart line',async()=>{
    await seed([ref()],[ref(),{...ref(),productId:String(other._id)}]);
    await models.Product.findOneAndUpdate({_id:product._id},{$set:{sizeStock:[{size:'M',stock:0},{size:'L',stock:8}],stock:8}});
    await models.Product.findOneAndUpdate({_id:other._id},{$set:{status:'hidden'}});
    assert.equal((await putPlanner(ref(),ref('White','L'))).status,200);
    assert.equal((await putCart(ref(),ref('White','L'))).status,200);
    const lines=await cart();assert.equal(lines.length,2);assert.equal(lines[0].available,true);assert.equal(lines[1].available,false);
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
