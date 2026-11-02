// End-to-end HTTP regressions using in-memory Mongoose facsimiles (never shared Atlas data).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const { createCommunityRouter } = require('../routes/community');
const { memoryModels, memoryTransactions } = require('./helpers/memoryModels');
const { requireAuth } = require('../middleware/authentication');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test('Personal history, expiry, recovery, and late checkout have consistent server rules', async t => {
  const models = memoryModels();
  const a = await models.User.create({ name: 'A', email: 'a@example.test', passwordHash: 'x', role: 'consumer' });
  const b = await models.User.create({ name: 'B', email: 'b@example.test', passwordHash: 'x', role: 'consumer' });
  const seller = await models.User.create({ name: 'Shop', email: 'shop@example.test', passwordHash: 'x', role: 'business' });
  const business = await models.Business.create({ ownerId: String(seller._id), businessName: 'Shop', styles: ['Minimalist'], description: 'Outfits', contact: 'shop@example.test' });
  const actors = { a, b, seller };
  const products = [];
  for (const [name, colour, stock] of [['Black Jumper', 'Black', 1], ['Navy Jumper', 'Navy', 2], ['Plain Jumper', null, 1]]) {
    products.push(await models.Product.create({ businessId: String(business._id), businessName: 'Shop', name, price: 30, style: 'Minimalist', category: 'Tops',
      ...(colour ? { colours: [colour] } : {}), material: 'Cotton', occasions: ['University'], sizes: ['M'], stock,
      description: 'For university.', photo: { data: png, contentType: 'image/png' } }));
  }
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const actor = actors[req.get('x-test-actor')]; if (actor) req.user = { id: String(actor._id), role: actor.role, name: actor.name }; next(); });
  app.use('/api', requireAuth);
  app.use('/api/community', createCommunityRouter(models, memoryTransactions(models)));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/community`;
  async function req(path, actor = 'a', method = 'GET', data) {
    const response = await fetch(base + path, { method, headers: { 'x-test-actor': actor, ...(data ? { 'content-type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}) });
    const json = await response.json().catch(() => null);
    return { status: response.status, body: json };
  }
  const r = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'Presentation shirt', occasion: 'University',
    description: 'Neutral shirt.', budget: 60, preferredStyle: 'Minimalist', deadline: '2099-11-30', clientRequestId: randomUUID() });
  const replies = [];
  for (const product of products) replies.push(await models.Response.create({ requestId: r._id, businessId: String(business._id), businessName: 'Shop',
    productId: String(product._id), productName: product.name, productPrice: 30, message: 'A matching item.' }));
  const id = String(r._id);
  const path = response => `/requests/${id}/responses/${response._id}`;
  await t.test('Customer list and member-profile history never leak to another customer or unrelated account', async () => {
    assert.equal((await req('/requests', 'b')).body.total, 0);
    assert.equal((await req(`/requests/${id}`, 'b')).status, 404);
    assert.equal((await req(`/members/${a._id}`, 'b')).body.requestTotal, 0);
    assert.equal((await req('/requests', 'a')).body.total, 1);
    const listing = await req('/requests', 'seller');
    assert.equal(listing.status, 200);
    assert.equal(listing.body.total, 1, 'businesses may discover open requests');
    assert.equal((await req('/requests?status=closed', 'seller')).status, 403);
  });
  await t.test('After acceptance, customers may switch away from sold-out product and complete checkout after original deadline', async () => {
    assert.equal((await req(path(replies[0]) + '/accept', 'a', 'POST', {})).status, 200);
    const oldProduct = products[0]; oldProduct.stock = 0;
    await oldProduct.save();
    const acceptedRequest = await models.Request.findOne({ _id: r._id });
    acceptedRequest.deadline = '2000-01-01'; await acceptedRequest.save();
    assert.equal((await req(path(replies[0]) + '/purchase', 'a', 'POST', { size: 'M', colour: 'Black', expectedPrice: 30 })).status, 409);
    assert.equal((await req(path(replies[1]) + '/accept', 'a', 'POST', {})).status, 200);
    const after = await req(`/requests/${id}`);
    assert.equal(after.body.request.acceptedResponseId, String(replies[1]._id));
    assert.equal(after.body.request.expired, false);
    const payment = await req(path(replies[1]) + '/purchase', 'a', 'POST', { size: 'M', colour: 'Navy', expectedPrice: 30 });
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    assert.equal(payment.body.purchase.colour, 'Navy');
    assert.equal((await req(`/requests/${id}/acceptance`, 'a', 'DELETE')).status, 409, 'completed purchases cannot be undone');
    assert.equal((await req(`/requests/${id}`, 'seller')).body.responses.length, 3, 'replied business can see its own suggestions');
  });
  await t.test('After expiry, cancelling acceptance must not trap customers with no way to choose an earlier suggestion', async () => {
    const late = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'Late delivery choice', occasion: 'University',
      description: 'Need an outfit.', budget: 60, preferredStyle: 'Minimalist', deadline: '2099-11-30', clientRequestId: randomUUID() });
    const r1 = await models.Response.create({ requestId: late._id, businessId: String(business._id), businessName: 'Shop',
      productId: String(products[1]._id), productName: products[1].name, productPrice: 30, message: 'Offer 1' });
    const r2 = await models.Response.create({ requestId: late._id, businessId: String(business._id), businessName: 'Shop',
      productId: String(products[2]._id), productName: products[2].name, productPrice: 30, message: 'Offer 2' });
    const selected = `/requests/${late._id}/responses/${r1._id}/accept`;
    assert.equal((await req(selected, 'a', 'POST', {})).status, 200);
    const acceptedLate = await models.Request.findOne({ _id: late._id });
    acceptedLate.deadline = '2000-01-01'; await acceptedLate.save();
    assert.equal((await req(`/requests/${late._id}/acceptance`, 'a', 'DELETE')).status, 200);
    const cancelled = await req(`/requests/${late._id}`, 'a');
    assert.equal(cancelled.body.request.expired, true);
    assert.equal(cancelled.body.request.acceptedResponseId, null);
    const pickedAgain = await req(`/requests/${late._id}/responses/${r2._id}/accept`, 'a', 'POST', {});
    assert.equal(pickedAgain.status, 200, JSON.stringify(pickedAgain.body));
    assert.equal((await req(`/requests/${late._id}`, 'a')).body.request.acceptedResponseId, String(r2._id));
  });
  await t.test('Unaccepted requests expire into customer History and disappear from business Open', async () => {
    const overdue = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'Old request', occasion: 'University',
      description: 'Old shirt.', budget: 30, preferredStyle: 'Minimalist', deadline: '2000-01-01', clientRequestId: randomUUID() });
    const mine = await req('/requests', 'a');
    assert.equal(mine.status, 200);
    const row = mine.body.requests.find(item => item.requestId === String(overdue._id));
    assert.equal(row.status, 'closed'); assert.equal(row.expired, true);
    const other = await req('/requests', 'seller');
    assert.equal(other.body.requests.some(item => item.requestId === String(overdue._id)), false);
    assert.equal((await req(`/requests/${overdue._id}`, 'seller')).status, 404);
  });
  await t.test('Manually closing a request stops new replies but does not void earlier suggestions', async () => {
    const closed = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'Graduation outfit',
      occasion: 'Graduation', description: 'Shirt requested.', budget: 45, preferredStyle: 'Minimalist',
      deadline: '2099-12-31', clientRequestId: randomUUID() });
    const suggested = await models.Response.create({ requestId: closed._id, businessId: String(business._id),
      businessName: 'Shop', productId: String(products[2]._id), productName: products[2].name,
      productPrice: 30, message: 'Suggested before customer closed the request.' });
    const closeResult = await req(`/requests/${closed._id}/status`, 'a', 'PATCH', { status: 'closed' });
    assert.equal(closeResult.status, 200);
    const record = await models.Request.findOne({ _id: closed._id });
    record.deadline = '2000-01-01'; await record.save();
    const response = await req(`/requests/${closed._id}/responses/${suggested._id}/accept`, 'a', 'POST', {});
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const detail = await req(`/requests/${closed._id}`, 'a');
    assert.equal(detail.body.request.acceptedResponseId, String(suggested._id));
  });
  await t.test('Cancelling an acceptance preserves an earlier manual closure, even before the deadline', async () => {
    const closed = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'Closed by customer',
      occasion: 'University', description: 'An earlier request.', budget: 50, preferredStyle: 'Minimalist',
      deadline: '2099-12-31', clientRequestId: randomUUID() });
    const reply = await models.Response.create({ requestId: closed._id, businessId: String(business._id),
      businessName: 'Shop', productId: String(products[1]._id), productName: products[1].name,
      productPrice: 30, message: 'Suggested before closure.' });
    const root = `/requests/${closed._id}`;
    assert.equal((await req(root + '/status', 'a', 'PATCH', { status: 'closed' })).status, 200);
    assert.equal((await req(root, 'a')).body.request.closedByCustomer, true);
    assert.equal((await req(root + `/responses/${reply._id}/accept`, 'a', 'POST', {})).status, 200);
    assert.equal((await req(root + '/acceptance', 'a', 'DELETE')).status, 200);
    const after = await req(root, 'a');
    assert.equal(after.body.request.status, 'closed');
    assert.equal(after.body.request.closedByCustomer, true);
    assert.equal(after.body.request.acceptedResponseId, null);
    assert.equal((await req(root + `/responses/${reply._id}/accept`, 'a', 'POST', {})).status, 200,
      'the customer can still choose the earlier offer without reopening the board');
  });
  await t.test('Unknown listing colour is recorded as unknown, not as an invented clothing variant', async () => {
    const fresh = await models.Request.create({ consumerId: String(a._id), consumerName: 'A', title: 'No colour provided', occasion: 'University',
      description: 'Plain shirt.', budget: 40, preferredStyle: 'Minimalist', deadline: '2099-12-01', clientRequestId: randomUUID() });
    const reply = await models.Response.create({ requestId: fresh._id, businessId: String(business._id), businessName: 'Shop',
      productId: String(products[2]._id), productName: products[2].name, productPrice: 30, message: 'This is available.' });
    const url = `/requests/${fresh._id}/responses/${reply._id}`;
    assert.equal((await req(url + '/accept', 'a', 'POST', {})).status, 200);
    assert.equal((await req(url + '/purchase', 'a', 'POST', { size: 'M', colour: 'Red', expectedPrice: 30 })).status, 400);
    const payment = await req(url + '/purchase', 'a', 'POST', { size: 'M', colour: 'Not specified', expectedPrice: 30 });
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    assert.equal(payment.body.purchase.colour, 'Not specified');
  });
});
