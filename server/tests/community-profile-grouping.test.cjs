const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { createCommunityRouter } = require('../routes/community');
const { memoryModels } = require('./helpers/memoryModels');
const { requireAuth } = require('../middleware/authentication');

function fakeAggregate(rows, pipeline) {
  const match = pipeline.find(step => step.$match).$match;
  const facet = pipeline.find(step => step.$facet).$facet;
  const skip = facet.profiles.find(step => '$skip' in step).$skip;
  const limit = facet.profiles.find(step => '$limit' in step).$limit;
  let candidates = rows.filter(row => !row.deletedAt && (!match.status || row.status === match.status));
  if (match.$or) {
    const regex = new RegExp(match.$or[0].consumerName.$regex, 'i');
    candidates = candidates.filter(row => regex.test(row.consumerName) || regex.test(row.title));
  }
  candidates.sort((a,b) => b.createdAt - a.createdAt);
  const profiles = new Map();
  for (const row of candidates) {
    if (!profiles.has(row.consumerId)) profiles.set(row.consumerId, {
      _id: row.consumerId, consumerName: row.consumerName, requestCount: 0,
      openCount: 0, closedCount: 0, latestTitle: row.title, latestRequestAt: row.createdAt
    });
    const profile = profiles.get(row.consumerId);
    profile.requestCount++;
    if (row.status === 'open') profile.openCount++;
    if (row.status === 'closed') profile.closedCount++;
  }
  const sorted = [...profiles.values()].sort((a,b) => a.consumerName.localeCompare(b.consumerName) || a._id.localeCompare(b._id));
  return [{ metadata: sorted.length ? [{total:sorted.length}] : [], profiles:sorted.slice(skip,skip+limit) }];
}

test('Community Requests groups by profile without altering the business inbox', async t => {
  const models = memoryModels();
  const customer = await models.User.create({ name:'Alex', email:'alex-profile@example.test', role:'consumer', passwordHash:'test' });
  const customer2 = await models.User.create({ name:'Bella', email:'bella-profile@example.test', role:'consumer', passwordHash:'test' });
  const owner = await models.User.create({ name:'Business', email:'business-profile@example.test', role:'business', passwordHash:'test' });
  const date = '2099-10-15';
  const base = (person,title,status,extra={}) => ({consumerId:String(person._id),consumerName:person.name,
    title,occasion:'Presentation',description:'Need a jacket.',budget:40,preferredStyle:'Classic',deadline:date,
    clientRequestId:randomUUID(),status,...extra});
  await models.Request.create(base(customer,'Alex open','open'));
  await models.Request.create(base(customer,'Alex closed','closed',{closedByCustomer:true}));
  await models.Request.create(base(customer2,'Bella closed','closed',{closedByCustomer:true}));
  await models.Request.create(base(customer2,'Deleted','closed',{deletedAt:new Date()}));
  const aggregations=[];
  models.Request.aggregate = async pipeline => { aggregations.push(pipeline); return fakeAggregate(models.Request.rows,pipeline); };
  const app=express();
  app.use((req,res,next)=>{ const role=req.get('X-Test-Role'); if(role==='business') req.user={id:String(owner._id),name:owner.name,role:'business'};
    else if(role==='customer') req.user={id:String(customer._id),name:customer.name,role:'consumer'}; next(); });
  app.use('/api',requireAuth);
  app.use('/api/community',createCommunityRouter(models));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}/api/community`;
  async function get(path,role='business') {const r=await fetch(origin+path,{headers:{'X-Test-Role':role}});return {status:r.status,body:await r.json()};}
  const all=await get('/requests/profiles');
  assert.equal(all.status,200,JSON.stringify(all.body));
  assert.equal(all.body.total,2,'two customers rather than three request cards');
  assert.deepEqual(all.body.profiles.map(x=>x.consumerName),['Alex','Bella'],'sorted by customer name');
  assert.equal(all.body.profiles[0].requestCount,2);
  assert.equal(all.body.profiles[0].openCount,1);
  assert.equal(all.body.profiles[0].closedCount,1);
  assert.equal(all.body.profiles[1].requestCount,1,'deleted requests are excluded');
  assert.equal((await get('/requests/profiles?status=open')).body.total,1);
  assert.equal((await get('/requests/profiles?status=closed')).body.total,2);
  assert.equal((await get('/requests/profiles?search=Alex')).body.total,1);
  assert.equal((await get('/requests/profiles','customer')).status,403,'customers must not browse other profiles');
  assert.equal((await get('/requests/profiles','none')).status,401);
  assert.ok(aggregations.every(p=>p.some(step=>step.$group?._id==='$consumerId')));
  assert.ok(aggregations.every(p=>p.some(step=>step.$facet?.profiles)),'paginate after grouping');
  const detail=await get(`/members/${customer._id}`);
  assert.equal(detail.body.requestTotal,2,'business can open a profile to see all requests');
});
