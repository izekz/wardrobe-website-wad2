const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomUUID } = require('crypto');
const { createCommunityRouter } = require('../routes/community');
const { memoryModels } = require('./helpers/memoryModels');
const { requireAuth } = require('../middleware/authentication');

const requestData = (actor, title, deadline = '2099-11-30') => ({
  consumerId: String(actor._id), consumerName: actor.name, title, occasion: 'Presentation',
  description: 'Need a smart-casual jacket.', budget: 45, preferredStyle: 'Classic',
  deadline, status: 'open', clientRequestId: randomUUID(),
});

test('Business community profiles and after-expiry contact are role-scoped, useful and private', async t => {
  const models = memoryModels();
  const customer = await models.User.create({ name: 'Alex', email: 'alex@example.test', passwordHash: 'test-only', role: 'consumer' });
  const otherCustomer = await models.User.create({ name: 'Morgan', email: 'morgan@example.test', passwordHash: 'test-only', role: 'consumer' });
  const businessOwner = await models.User.create({ name: 'Owner', email: 'owner@example.test', passwordHash: 'test-only', role: 'business' });
  const anotherOwner = await models.User.create({ name: 'Other owner', email: 'otherowner@example.test', passwordHash: 'test-only', role: 'business' });
  const business = await models.Business.create({ ownerId: String(businessOwner._id), businessName: 'Jacket Studio', description: 'Clothing', styles: ['Classic'], contact: 'shop@example.test' });
  const anotherBusiness = await models.Business.create({ ownerId: String(anotherOwner._id), businessName: 'Another Studio', description: 'Clothing', styles: ['Classic'], contact: 'other@example.test' });
  const active = await models.Request.create(requestData(customer, 'Active jacket'));
  const expired = await models.Request.create(requestData(customer, 'Expired jacket', '2000-01-01'));
  const manuallyClosed = await models.Request.create({ ...requestData(customer, 'Already closed'), status: 'closed', closedByCustomer: true });
  const deleted = await models.Request.create({ ...requestData(customer, 'Deleted request'), status: 'closed', deletedAt: new Date() });
  const actors = { customer, otherCustomer, businessOwner, anotherOwner };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const actor = actors[req.get('X-Test-Actor')];
    if (actor) req.user = { id: String(actor._id), name: actor.name, role: actor.role };
    next();
  });
  app.use('/api', requireAuth);
  app.use('/api/community', createCommunityRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/community`;
  async function fetchAs(url, actor='businessOwner', method='GET', body) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Test-Actor': actor }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  await t.test('businesses can browse open, expired and closed, but not deleted or other customers private history', async () => {
    const all = await fetchAs('/requests');
    assert.equal(all.status, 200);
    assert.equal(all.data.total, 3);
    assert.equal(all.data.requests.find(x => x.title === 'Expired jacket').expired, true);
    assert.equal((await fetchAs('/requests?status=open')).data.total, 1);
    assert.equal((await fetchAs('/requests?status=closed')).data.total, 2);
    const profile = await fetchAs(`/members/${customer._id}`);
    assert.equal(profile.data.requestTotal, 3);
    assert.equal(profile.data.requests.length, 3);
    assert.ok(!JSON.stringify(profile.data).includes('alex@example.test'));
    assert.equal((await fetchAs('/requests', 'otherCustomer')).data.total, 0);
    assert.equal((await fetchAs(`/members/${customer._id}`, 'otherCustomer')).data.requestTotal, 0);
    assert.equal((await fetchAs(`/requests/${expired._id}`, 'otherCustomer')).status, 404);
    assert.equal((await fetchAs(`/requests/${deleted._id}`)).status, 404);
  });
  await t.test('business can contact after expiry without reopening or sending a product suggestion', async () => {
    const first = await fetchAs(`/requests/${expired._id}/contacts`, 'businessOwner', 'POST', { text: 'Are you still looking for a jacket?' });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const body = (await fetchAs(`/requests/${expired._id}`, 'customer')).data;
    assert.equal(body.request.status, 'closed'); assert.equal(body.responses.length, 0);
    const listing = (await fetchAs('/requests', 'customer')).data.requests.find(x => x.requestId === String(expired._id));
    assert.equal(listing.messageCount, 1, 'customer request list should indicate incoming contact');
    const conversation = (await fetchAs(`/requests/${expired._id}/contacts`, 'customer')).data.threads;
    assert.equal(conversation[0].messages[0].text, 'Are you still looking for a jacket?');
    assert.equal((await fetchAs(`/requests/${expired._id}/contacts`, 'businessOwner', 'POST', { text: 'Spam another message' })).status, 409);
    assert.equal((await fetchAs(`/requests/${expired._id}/contacts`, 'otherCustomer')).status, 404);
    assert.equal((await fetchAs(`/requests/${expired._id}/contacts`, 'customer', 'POST', { text: 'Hi', businessId: String(anotherBusiness._id) })).status, 404);
    assert.equal((await fetchAs(`/requests/${expired._id}/contacts`, 'customer', 'POST', { text: 'Yes please', businessId: String(business._id) })).status, 201);
    assert.equal((await fetchAs(`/requests/${expired._id}/contacts`, 'businessOwner', 'POST', { text: 'We have a suitable product in stock.' })).status, 201);
    const privateToOther = (await fetchAs(`/requests/${expired._id}/contacts`, 'anotherOwner')).data;
    assert.deepEqual(privateToOther.threads, []);
  });
  await t.test('closing requests deliberately keeps profile history and deleted requests cannot be contacted', async () => {
    const closedNote = await fetchAs(`/requests/${manuallyClosed._id}/contacts`, 'businessOwner', 'POST', { text: 'If you still need help, reply here.' });
    assert.equal(closedNote.status, 201);
    assert.equal((await fetchAs(`/requests/${deleted._id}/contacts`, 'businessOwner', 'POST', { text: 'Contact' })).status, 404);
    const result = await fetchAs(`/requests/${active._id}/contacts`, 'anotherOwner', 'POST', { text: 'Hello' });
    assert.equal(result.status, 201);
  });
});
