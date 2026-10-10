const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const { createCommunityRouter, defaultModels } = require('../routes/community');
const { createBusinessRouter } = require('../routes/business');
const { createWardrobeRouter } = require('../routes/wardrobeRoutes');
const { requireAuth } = require('../middleware/authentication');
const { memoryModels, memoryModel, memoryTransactions } = require('./helpers/memoryModels');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

// Optional real transaction run. This guard refuses every shared/remote database.
// REQUEST_PURCHASE_TEST_URI=mongodb://127.0.0.1:27088/dripped_test_purchase?replicaSet=drippedTest
const testUri = process.env.REQUEST_PURCHASE_TEST_URI;
test('Request suggestions, owner controls and demo checkout', async t => {
  const extra = { Business: require('../models/Business'), CoinTransaction: require('../models/CoinTransaction'),
    SkipFeedback: require('../models/SkipFeedback'), Outfit: require('../models/SavedOutfit') };
  let models, transact;
  if (testUri) {
    const url = new URL(testUri);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/dripped_test_[a-z0-9_]+$/.test(url.pathname), 'Only a disposable local dripped_test_ database is allowed');
    await mongoose.connect(testUri);
    await mongoose.connection.dropDatabase();
    models = { ...defaultModels, ...extra };
    await Promise.all(Object.values(models).map(model => model.init()));
  } else {
    models = { ...memoryModels(), ...Object.fromEntries(Object.entries(extra).map(([name, model]) => [name, memoryModel(model)])) };
    transact = memoryTransactions(models);
  }
  const alice = await models.User.create({ name: 'Alex', email: 'alex@example.test', passwordHash: 'test-only', role: 'consumer' });
  const bob = await models.User.create({ name: 'Jamie', email: 'jamie@example.test', passwordHash: 'test-only', role: 'consumer' });
  const seller = await models.User.create({ name: 'Studio owner', email: 'studio@example.test', passwordHash: 'test-only', role: 'business' });
  const actors = { alice, bob, seller };
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => { const actor = actors[req.get('X-Test-Actor')]; if (actor) req.user = { id: String(actor._id), name: actor.name, role: actor.role }; next(); });
  app.use('/api', requireAuth);
  app.use('/api/community', createCommunityRouter(models, transact));
  app.use('/api/business', createBusinessRouter(models));
  app.use('/api/wardrobe', createWardrobeRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); if (testUri) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(path, actor = 'alice', method = 'GET', body, extraHeaders = {}) {
    const result = await fetch(base + path, { method, headers: { 'X-Test-Actor': actor, 'Content-Type': 'application/json', ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: result.status, body: result.headers.get('content-type')?.includes('json') ? await result.json() : await result.arrayBuffer() };
  }
  const postRequest = async (actor = 'alice', title = 'Presentation jacket') => {
    const created = await api('/community/requests', actor, 'POST', { title, occasion: 'Presentation', description: 'A size M neutral jacket.',
      budget: 40, preferredStyle: 'Minimalist', deadline: '2099-10-15', clientRequestId: randomUUID() });
    assert.equal(created.status, 201); return created.body.request.requestId;
  };
  let productId, requestId, responseId, receipt;
  const responsePath = () => `/community/requests/${requestId}/responses/${responseId}`;
  const checkout = { size: 'M', colour: 'Beige', material: 'Cotton', expectedPrice: 38 };

  await t.test('Business creates a product; customer posts; business replies with a clickable product and counted suggestion', async () => {
    const profile = await api('/business/profile', 'seller', 'PUT', { businessName: 'Minimalist Studio', description: 'Everyday pieces.', styles: ['Minimalist'], contact: 'studio@example.test', logo: png });
    assert.equal(profile.status, 201);
    const product = await api('/business/products', 'seller', 'POST', { name: 'Structured Beige Jacket', price: 38, category: 'Jackets', style: 'Minimalist', stock: 3,
      occasions: ['Presentation'], sizes: ['S', 'M', 'L'], description: 'A light cotton jacket.', photo: png });
    assert.equal(product.status, 201); productId = product.body.product.productId;
    requestId = await postRequest();
    const reply = await api(`/business/requests/${requestId}/responses`, 'seller', 'POST', { productId, message: 'This fits your presentation and budget.' });
    assert.equal(reply.status, 201); responseId = reply.body.response.responseId;
    const board = await api('/community/requests');
    assert.equal(board.body.requests.find(row => row.requestId === requestId).suggestionCount, 1);
    const detail = await api(`/community/requests/${requestId}`);
    assert.equal(detail.body.responses[0].product.productId, productId);
    assert.match(detail.body.responses[0].product.imageURL, /\/api\/catalog\/products\/.+\/image/);
    assert.equal(detail.body.responses[0].product.style, 'Minimalist');
    assert.deepEqual(detail.body.responses[0].product.sizes, ['S', 'M', 'L']);
  });
  await t.test('My requests and status filters are applied in the database with suggestion counts', async () => {
    const bobs = await postRequest('bob', 'Jamie request');
    const closed = await postRequest('alice', 'Closed history');
    await api(`/community/requests/${closed}/status`, 'alice', 'PATCH', { status: 'closed' });
    const mine = await api('/community/requests?mine=true');
    assert.ok(mine.body.requests.every(row => row.consumerId === String(alice._id)));
    assert.ok(!mine.body.requests.some(row => row.requestId === bobs));
    assert.equal(mine.body.requests.at(-1).status, 'closed');
    const history = await api('/community/requests?mine=true&status=closed');
    assert.equal(history.body.requests.length, 1); assert.equal(history.body.requests[0].requestId, closed);
    const member = await api(`/community/members/${alice._id}`, 'bob');
    assert.equal(member.body.requests.find(row => row.requestId === requestId).suggestionCount, 1);
    assert.deepEqual(Object.keys(member.body.member).sort(), ['id', 'name', 'role']);
  });
  await t.test('Only the request owner can accept or purchase; a suggestion must belong to that request', async () => {
    assert.equal((await api(responsePath() + '/accept', 'guest', 'POST', {})).status, 401);
    assert.equal((await api(responsePath() + '/accept', 'seller', 'POST', {})).status, 403);
    assert.equal((await api(responsePath() + '/accept', 'bob', 'POST', {})).status, 404);
    assert.equal((await api(responsePath() + '/purchase', 'alice', 'POST', checkout)).status, 409);
    const other = await postRequest();
    assert.equal((await api(`/community/requests/${other}/responses/${responseId}/accept`, 'alice', 'POST', {})).status, 404);
    assert.equal((await api(responsePath() + '/accept', 'alice', 'POST', {}, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await api(responsePath() + '/accept', 'alice', 'POST', {})).status, 200);
  });
  await t.test('Validation and price changes never reduce stock or create wardrobe items', async () => {
    for (const body of [{ ...checkout, size: 'XXL' }, { ...checkout, colour: 'Made up' }, { ...checkout, expectedPrice: 1 }]) {
      const failed = await api(responsePath() + '/purchase', 'alice', 'POST', body);
      assert.ok([400, 409].includes(failed.status));
    }
    assert.equal((await models.Product.findById(productId)).stock, 3);
    assert.equal(await models.Item.countDocuments({ userId: String(alice._id) }), 0);
  });
  await t.test('A failure while creating the wardrobe item rolls back stock and request closure', async () => {
    const create = models.Item.create;
    models.Item.create = async () => { throw new Error('Simulated wardrobe storage failure'); };
    try { assert.equal((await api(responsePath() + '/purchase', 'alice', 'POST', checkout)).status, 500); }
    finally { models.Item.create = create; }
    assert.equal((await models.Product.findById(productId)).stock, 3);
    assert.equal((await models.Request.findById(requestId)).status, 'open');
    assert.equal(await models.Purchase.countDocuments({ requestId }), 0);
  });
  await t.test('Concurrent repeated checkout produces one receipt, one stock deduction and one wardrobe item', async () => {
    const attempts = await Promise.all([api(responsePath() + '/purchase', 'alice', 'POST', checkout), api(responsePath() + '/purchase', 'alice', 'POST', checkout)]);
    assert.deepEqual(attempts.map(x => x.status).sort(), [200, 201]);
    assert.equal(attempts[0].body.purchase.purchaseId, attempts[1].body.purchase.purchaseId);
    receipt = attempts[0].body.purchase;
    assert.equal((await models.Product.findById(productId)).stock, 2);
    assert.equal(await models.Purchase.countDocuments({ requestId }), 1);
    assert.equal(await models.Item.countDocuments({ userId: String(alice._id) }), 1);
    const wardrobe = await api('/wardrobe/items');
    assert.equal(wardrobe.body.items[0].itemId, receipt.wardrobeItemId);
    assert.equal(wardrobe.body.items[0].colour, 'Beige');
    assert.equal(wardrobe.body.items[0].size, 'M');
    assert.equal((await api(`/wardrobe/items/${receipt.wardrobeItemId}/image`)).status, 200);
    assert.equal((await api(`/wardrobe/items/${receipt.wardrobeItemId}/image`, 'bob')).status, 404);
  });
  await t.test('Completed requests and receipts survive reload and remain in history, with private purchase records', async () => {
    const detail = await api(`/community/requests/${requestId}`);
    assert.equal(detail.body.request.status, 'closed'); assert.equal(detail.body.request.fulfilled, true);
    assert.equal(detail.body.request.acceptedResponseId, responseId);
    assert.equal((await api(`/community/requests/${requestId}/purchase`)).body.purchase.purchaseId, receipt.purchaseId);
    assert.equal((await api(`/community/requests/${requestId}/purchase`, 'bob')).status, 404);
    assert.equal((await api(`/community/requests/${requestId}/status`, 'alice', 'PATCH', { status: 'open' })).status, 409);
    assert.ok(!(await api('/business/requests', 'seller')).body.requests.some(row => row.requestId === requestId));
    assert.ok((await api('/community/requests?mine=true&status=closed')).body.requests.some(row => row.requestId === requestId));
  });
  await t.test('Two different requests cannot buy the final piece twice', async () => {
    await models.Product.findOneAndUpdate({ _id: productId }, { $set: { stock: 1 } });
    const orders = [];
    for (const actor of ['alice', 'bob']) {
      const id = await postRequest(actor);
      const reply = await api(`/business/requests/${id}/responses`, 'seller', 'POST', { productId, message: 'Last piece.' });
      const path = `/community/requests/${id}/responses/${reply.body.response.responseId}`;
      assert.equal((await api(path + '/accept', actor, 'POST', {})).status, 200);
      orders.push({ actor, path });
    }
    const results = await Promise.all(orders.map(order => api(order.path + '/purchase', order.actor, 'POST', checkout)));
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    assert.equal((await models.Product.findById(productId)).stock, 0);
  });
  await t.test('Deleting a business product retains the copied wardrobe photo and historical response', async () => {
    await models.Product.deleteOne({ _id: productId });
    assert.equal((await api(`/wardrobe/items/${receipt.wardrobeItemId}/image`)).status, 200);
    const request = await api(`/community/requests/${requestId}`);
    assert.equal(request.body.responses[0].product, null);
    assert.equal(request.body.responses[0].productName, 'Structured Beige Jacket');
  });
});
