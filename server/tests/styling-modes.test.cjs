const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {itemInput,occasionInput}=require('../services/wardrobeValidation');
const {itemColours,NO_OCCASION}=require('../services/clothingSuitability');
const {occasionRating,matchRating,assessSelection,recommendationFor,garmentColourPair,stylePair}=require('../services/outfitMatching');
const {memoryModel}=require('./helpers/memoryModels');
const {createWardrobeRouter}=require('../routes/wardrobeRoutes');
const {singaporeToday}=require('../communityValidation');
const weather={available:true,temperature:31,rainChance:80,tags:['Warm','Rainy']};
const item=(extra={})=>({name:'Fixture shirt',category:'Tops',colour:'White',material:'Linen',style:['Minimalist'],...extra});
test('occasion points use style 40, colour 10 and material 10 without category influence',()=>{
 const rating=occasionRating(item(),'Presentation');assert.deepEqual(rating.components.map(c=>[c.label,c.weight]),[['Style',40],['Colour',10],['Material',10]]);assert.equal(rating.earned,42);
 for(const category of ['Tops','Bottoms','Shoes','Jackets','Dresses','Accessories']){
   assert.deepEqual(occasionRating(item({category}),'Presentation'),rating);
   assert.equal(matchRating([item({category})],'Presentation',[],weather).matchScore,matchRating([item()],'Presentation',[],weather).matchScore);
 }
 assert.equal(occasionRating(item({style:['Classic']}),'Presentation').earned,50);
 assert.ok(occasionRating(item({style:['Streetwear'],colour:'Red',material:'Fleece'}),'Presentation').earned>0);
});
test('every real garment colour contributes equally and garment pairs keep equal weight',()=>{
 const multi=item({colour:'Black',colours:['Black','Red']}),blue=item({name:'Blue trousers',category:'Bottoms',colour:'Blue'});
 const pair=garmentColourPair(multi,blue,{});assert.equal(pair.comparisons.length,2);assert.equal(pair.points,1.8);
 const scored=matchRating([multi,blue],'Presentation',[],{available:false});assert.equal(scored.scoreDetails.components[1].earned,15);
 const reverse=matchRating([{...multi,colours:['Red','Black']},blue],'Presentation',[],{available:false});assert.equal(reverse.matchScore,scored.matchScore);
 assert.equal(occasionRating(multi,'Presentation').components.find(c=>c.label==='Colour').earned,6.5);
 assert.deepEqual(itemColours({source:'store',colour:'Blue',colours:['Red','Blue']}),['Blue']);
 const three=[multi,blue,item({name:'White shoes',category:'Shoes'})];
 assert.equal(matchRating(three,'Presentation',[],{available:false}).scoreDetails.colourDetails.length,3);
 assert.deepEqual(itemColours({colour:'Multicolour'}),[]);
 assert.equal(garmentColourPair(item({colour:'Multicolour'}),blue).points,0);
});
test('no-occasion scoring compares colours and actual style tags, independently of weather, category or preferences',()=>{
 assert.equal(occasionInput(NO_OCCASION),NO_OCCASION);
 const top=item(),bottom=item({name:'Trousers',category:'Bottoms',colour:'Black'});
 const rating=matchRating([top,bottom],NO_OCCASION,[],weather);
 assert.equal(rating.matchScore,100);assert.equal(rating.scoreDetails.mode,'styling');assert.deepEqual(rating.scoreDetails.components.map(c=>[c.label,c.weight]),[['Colour coordination',50],['Style harmony',50]]);
 assert.deepEqual(matchRating([top,bottom],NO_OCCASION,['Y2K'],{available:false}),rating);
 assert.equal(matchRating([top,{...bottom,style:['Classic']}],NO_OCCASION,[],weather).matchScore,85);
 assert.equal(matchRating([top,{...bottom,style:['Streetwear']}],NO_OCCASION,[],weather).matchScore,65);
 assert.equal(matchRating([{...top,category:'Accessories',material:'Fleece'},{...bottom,material:'Rubber'}],NO_OCCASION,[],weather).matchScore,100);
 assert.equal(rating.scoreDetails.itemDetails.length,0);assert.equal(rating.scoreDetails.weatherDetails.length,0);
 assert.equal(stylePair(top,{...bottom,style:['Unknown']}),null);
 assert.equal(recommendationFor(top,{occasion:NO_OCCASION,styles:['Minimalist']}).kind,'style');
 assert.equal(recommendationFor(top,{occasion:NO_OCCASION,styles:['Streetwear']}).kind,null);
 assert.ok(!assessSelection([top,{...bottom,style:['Streetwear']}],NO_OCCASION,[],weather).comments.some(c=>c.kind==='warning'));
 const single=assessSelection([top],NO_OCCASION,[],weather);assert.equal(single.matchScore,5);assert.equal(single.scoreDetails.provisional,true);assert.match(single.comments[0].text,/another piece/);
 assert.equal(matchRating([],NO_OCCASION,[],weather).matchScore,null);
 assert.equal(matchRating([item({colour:'Multicolour',style:[]})],NO_OCCASION,[],weather).matchScore,5);
});
test('colour arrays validate strictly while old single-colour records and checkout stay compatible',()=>{
 const input=itemInput(item({colours:['Black','Red'],colour:'forged'}),false);assert.deepEqual(input.colours,['Black','Red']);assert.equal(input.colour,'Black');
 for(const colours of [[],['Multicolour'],['Invisible'],['White',null],'White',null,Array(15).fill('Black')])assert.throws(()=>itemInput(item({colours}),false));
 assert.deepEqual(itemInput(item({colour:'Blue'}),false).colours,['Blue']);
 assert.deepEqual(itemColours({colour:'Blue'}),['Blue']);
 assert.deepEqual(itemInput(item({colour:'Not specified'}),false,{allowUnknownColour:true}).colours,[]);
 assert.deepEqual(itemInput(item({colours:['Red','Red','Black']}),false).colours,['Red','Black']);
 assert.throws(()=>occasionInput('Not a real occasion'));
});
test('multi-colour CRUD, palette requests, no-occasion save/edit and private ownership work over HTTP',async t=>{
 const models=Object.fromEntries([['Item','WardrobeItem'],['Outfit','SavedOutfit'],['Product','Product']].map(([key,name])=>[key,memoryModel(require('../models/'+name))]));
 const paletteCalls=[],app=express();app.use(express.json());app.use((req,res,next)=>{if(req.get('x-fixture-owner'))req.user={id:req.get('x-fixture-owner'),role:'consumer',preferredStyles:['Minimalist']};next();});
 app.use('/api/wardrobe',createWardrobeRouter(models,async()=>weather,async colours=>{paletteCalls.push(colours);return {};}));
 const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function api(path,method='GET',body,owner='alice'){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/wardrobe${path}`,{method,headers:{'Content-Type':'application/json',...(owner?{'x-fixture-owner':owner}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};
 }
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const created=await api('/items','POST',{...item(),colours:['Black','Red'],photo:png});assert.equal(created.status,201);const top=created.body.item;assert.deepEqual(top.colours,['Black','Red']);
 assert.deepEqual((await api('/items/'+top.itemId)).body.item.colours,['Black','Red']);
 assert.equal((await api('/items/'+top.itemId,'PUT',{...item(),colours:['Blue','White']},'bob')).status,404);
 const updated=await api('/items/'+top.itemId,'PUT',{...item(),colours:['Blue','White']});assert.equal(updated.status,200);assert.deepEqual(updated.body.item.colours,['Blue','White']);
 const bottom=(await api('/items','POST',{...item({category:'Bottoms',name:'Trousers'}),colours:['Black'],photo:png})).body.item;
 const shoes=(await api('/items','POST',{...item({category:'Shoes',name:'Shoes'}),colours:['Black'],photo:png})).body.item;
 const body={occasion:NO_OCCASION,date:singaporeToday(),itemIds:[top.itemId,bottom.itemId,shoes.itemId],products:[]};
 const selected=await api('/selection','POST',body);assert.equal(selected.status,200);assert.equal(selected.body.selection.complete,true);assert.deepEqual(paletteCalls.at(-1),['Blue','White','Black','Black']);
 const saved=await api('/outfits','POST',{...body,name:'Free styling'});assert.equal(saved.status,201);const id=saved.body.outfitId;
 const read=await api('/outfits/'+id);assert.equal(read.body.outfit.occasion,NO_OCCASION);assert.deepEqual(read.body.outfit.pieces[0].colours,['Blue','White']);
 assert.equal((await api('/outfits/'+id,'PUT',{...body,name:'Edited styling',occasion:'Presentation'})).status,200);assert.equal(models.Outfit.rows.length,1);
 assert.equal((await api('/outfits/'+id,'GET',null,'bob')).status,404);
 assert.equal((await api('/selection','POST',{...body,itemIds:[top.itemId]},'bob')).status,400);
 assert.equal((await api('/items','GET',null,null)).status,401);
 const product=await models.Product.create({businessId:'shop',businessName:'Shop',name:'Store trousers',category:'Bottoms',style:'Minimalist',material:'Cotton',colours:['Red','Blue'],price:20,stock:4,sizes:['M'],description:'Fixture',photo:{data:Buffer.from('test'),contentType:'image/png'}});
 const store=await api('/selection','POST',{...body,itemIds:[shoes.itemId],products:[{productId:String(product._id),colour:'Blue',size:'M'}]});assert.equal(store.status,200);assert.deepEqual(paletteCalls.at(-1),['Black','Blue']);
 assert.deepEqual(store.body.selection.pieces.find(p=>p.source==='store').colours,['Blue']);
 const recommended=await api('/recommendations','POST',{...body,style:'Minimalist'});assert.equal(recommended.status,200);assert.ok(recommended.body.items.every(p=>p.recommendation.kind==='style'));
 assert.equal((await api('/outfits','POST',{...body,name:'Invalid',itemIds:[top.itemId]})).status,400);
});
