// Tests the existing business reply routes together with Community request controls.
// Uses memory-only records and real model validation; never connects to MongoDB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { requireAuth } = require('../middleware/authentication');
const { createCommunityRouter } = require('../routes/community');
const { createBusinessRouter } = require('../routes/business');
const { memoryModels, memoryModel } = require('./helpers/memoryModels');
const businessRules = require('../businessValidation');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('Community and the latest business portal share requests and replies', async t => {
  const models = { ...memoryModels(),
    Business: memoryModel(require('../models/Business')),
    Product: memoryModel(require('../models/Product')) };
  const customer = await models.User.create({ name: 'Alex', email: 'alex@example.test', passwordHash: 'test-only', role: 'consumer' });
  const owner = await models.User.create({ name: 'Studio owner', email: 'studio@example.test', passwordHash: 'test-only', role: 'business' });
  const business = await models.Business.create({ ownerId: String(owner._id), ...businessRules.profileInput({
    businessName: 'Minimalist Studio', description: 'Everyday clothing', styles: ['Minimalist'], contact: 'studio@example.test', logo: png }) });
  const product = await models.Product.create({ businessId: String(business._id), businessName: business.businessName,
    ...businessRules.productInput({ name: 'Beige jacket', category: 'Jackets', style: 'Minimalist', price: 38,
      stock: 3, occasions: ['Presentation'], sizes: ['M'], description: 'Light jacket.', photo: png }, { photoRequired: true }) });
  const app = express();
  const actors = { customer, business: owner };
  app.use(express.json());
  app.use((req, res, next) => {
    const user = actors[req.get('X-Test-Actor')];
    if (user) req.user = { id: String(user._id), name: user.name, role: user.role };
    next();
  });
  app.use('/api', requireAuth);
  app.use('/api/community', createCommunityRouter(models));
  app.use('/api/business', createBusinessRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(path, actor = 'customer', method = 'GET', body) {
    const response = await fetch(base + path, { method,
      headers: { 'Content-Type': 'application/json', 'X-Test-Actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  let requestId;
  await t.test('Customer posts, business responds, and the customer sees the saved suggestion', async () => {
    const created = await api('/community/requests', 'customer', 'POST', {
      title: 'Jacket for my presentation', occasion: 'Presentation', description: 'Size M please.',
      budget: 40, preferredStyle: 'Minimalist', deadline: '2099-10-15', clientRequestId: randomUUID() });
    assert.equal(created.status, 201); requestId = created.body.request.requestId;
    const board = await api('/business/requests', 'business');
    assert.equal(board.body.requests[0].requestId, requestId);
    assert.equal((await api(`/business/requests/${requestId}/responses`, 'customer', 'POST', { productId: String(product._id), message: 'Test' })).status, 403);
    const reply = await api(`/business/requests/${requestId}/responses`, 'business', 'POST', { productId: String(product._id), message: 'This fits your budget.' });
    assert.equal(reply.status, 201);
    const customerView = await api(`/community/requests/${requestId}`);
    assert.equal(customerView.body.responses[0].businessName, 'Minimalist Studio');
    assert.equal(customerView.body.responses[0].productId, String(product._id));
    assert.equal(customerView.body.responses[0].productPrice, 38);
    assert.equal((await api('/business/requests', 'business')).body.requests[0].myResponses.length, 1);
  });
  await t.test('Closing hides the request from active business work and prevents another reply', async () => {
    const closed = await api(`/community/requests/${requestId}/status`, 'customer', 'PATCH', { status: 'closed' });
    assert.equal(closed.body.request.status, 'closed');
    assert.equal((await api('/business/requests', 'business')).body.total, 0);
    const reply = await api(`/business/requests/${requestId}/responses`, 'business', 'POST', { productId: String(product._id), message: 'Another suggestion.' });
    assert.equal(reply.status, 400); assert.match(reply.body.message, /no longer open/);
    assert.equal((await api(`/community/requests/${requestId}`)).body.responses.length, 1);
    const history = await api(`/community/members/${customer._id}`, 'business');
    assert.equal(history.body.requests[0].status, 'closed');
    assert.deepEqual(Object.keys(history.body.member).sort(), ['id', 'name', 'role']);
  });
  await t.test('Reopening restores the same request and preserves its earlier business reply', async () => {
    assert.equal((await api(`/community/requests/${requestId}/status`, 'customer', 'PATCH', { status: 'open' })).status, 200);
    const board = await api('/business/requests', 'business');
    assert.equal(board.body.requests[0].requestId, requestId);
    assert.equal(board.body.requests[0].myResponses.length, 1);
    assert.equal((await api(`/business/requests/${requestId}/responses`, 'business', 'POST', { productId: String(product._id), message: 'Duplicate' })).status, 409);
  });
});
