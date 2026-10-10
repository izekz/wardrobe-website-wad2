// Real Express routes and Mongoose validation; memory-only data, never your group database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { requireAuth } = require('../middleware/authentication');
const { createCommunityRouter } = require('../routes/community');
const { memoryModels } = require('./helpers/memoryModels');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const input = (change = {}) => ({ name: 'My jacket', category: 'Jackets', style: 'Minimalist', size: 'M', condition: 'Good', description: 'Presentation jacket.', listingType: 'sell', price: 30, photo: `data:image/png;base64,${png}`, clientRequestId: randomUUID(), ...change });
const requestInput = (change = {}) => ({ title: 'A jacket please', occasion: 'Presentation', description: 'Size M, neutral colours.', budget: 40, preferredStyle: 'Minimalist', deadline: '2099-10-15', clientRequestId: randomUUID(), ...change });

test('Signed-in Community ownership and request history', async t => {
  const models = memoryModels();
  const alice = await models.User.create({ name: 'Alice', email: 'alice@example.test', passwordHash: 'test-only-hash', role: 'consumer' });
  const bob = await models.User.create({ name: 'Bob', email: 'bob@example.test', passwordHash: 'test-only-hash', role: 'consumer' });
  const business = await models.User.create({ name: 'Demo Studio', email: 'studio@example.test', passwordHash: 'test-only-hash', role: 'business' });
  const identities = { alice, bob, business };
  const app = express();
  app.use(express.json());
  // Test-only identity adapter. Production identity comes from the verified session cookie.
  app.use((req, res, next) => { const user = identities[req.get('X-Test-Actor')]; if (user) req.user = { id: String(user._id), name: user.name, role: user.role }; next(); });
  app.use('/api/community', requireAuth, createCommunityRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(path, { method = 'GET', body, actor = 'alice', origin } = {}) {
    const response = await fetch(base + '/api/community' + path, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Test-Actor': actor } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  let sale, request;
  await t.test('My Listings uses the verified owner and is isolated between accounts', async () => {
    sale = (await api('/listings', { method: 'POST', body: input({ ownerId: String(bob._id) }) })).body.listing;
    assert.equal(sale.ownerId, String(alice._id));
    await api('/listings', { method: 'POST', body: input({ name: 'Bob’s dress' }), actor: 'bob' });
    const mine = await api(`/my/listings?ownerId=${bob._id}`);
    assert.equal(mine.body.total, 1); assert.equal(mine.body.listings[0].listingId, sale.listingId);
    assert.equal((await api('/my/listings', { actor: 'bob' })).body.total, 1);
    assert.equal((await api('/my/listings', { actor: null })).status, 401);
    assert.equal((await api('/my/listings', { actor: 'business' })).status, 403);
  });
  await t.test('Edit keeps the photo, changes prices correctly, and cannot transfer ownership', async () => {
    const body = input({ name: 'Updated jacket', listingType: 'rent', rentalPrice: 7, ownerId: String(bob._id), status: 'unavailable' });
    delete body.photo; delete body.clientRequestId;
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'PUT', body, actor: 'bob' })).status, 404);
    const result = await api(`/listings/${sale.listingId}`, { method: 'PUT', body });
    assert.equal(result.status, 200); assert.equal(result.body.listing.rentalPrice, 7);
    assert.equal(result.body.listing.price, undefined); assert.equal(result.body.listing.ownerId, String(alice._id));
    assert.equal(result.body.listing.status, 'available');
    const image = await fetch(base + result.body.listing.imageURL, { headers: { 'X-Test-Actor': 'alice' } });
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(png, 'base64'));
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'PUT', body: { ...body, rentalPrice: -1 } })).status, 400);
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'PUT', body: { ...body, photo: 'bad-photo' } })).status, 400);
  });
  await t.test('Availability hides a listing from the feed but keeps it on the owner profile', async () => {
    assert.equal((await api(`/listings/${sale.listingId}/status`, { method: 'PATCH', body: { status: 'unavailable' }, actor: 'bob' })).status, 404);
    assert.equal((await api(`/listings/${sale.listingId}/status`, { method: 'PATCH', body: { status: 'unavailable' } })).status, 200);
    assert.ok(!(await api('/listings')).body.listings.some(item => item.listingId === sale.listingId));
    assert.equal((await api('/my/listings?status=unavailable')).body.total, 1);
    const profile = (await api(`/members/${alice._id}`, { actor: 'bob' })).body;
    assert.equal(profile.listings[0].status, 'unavailable');
    assert.deepEqual(Object.keys(profile.member).sort(), ['id', 'name', 'role']);
    assert.ok(!JSON.stringify(profile).includes('alice@example.test'));
  });
  await t.test('Only the request owner can close/reopen; closing retains suggestions', async () => {
    request = (await api('/requests', { method: 'POST', body: requestInput() })).body.request;
    await models.Response.create({ requestId: request.requestId, businessId: String(business._id), businessName: business.name, productId: 'demo-product', productName: 'Jacket', productPrice: 38, message: 'A prior suggestion.' });
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'closed' }, actor: 'bob' })).status, 404);
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'closed' }, actor: 'business' })).status, 403);
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'closed' } })).body.request.status, 'closed');
    assert.equal((await api(`/requests/${request.requestId}`)).body.responses.length, 1);
    assert.equal((await api('/requests?openOnly=true')).body.total, 0);
    assert.equal((await api(`/members/${alice._id}`)).body.requests[0].status, 'closed');
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'open' } })).body.request.status, 'open');
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'unknown' } })).status, 400);
  });
  await t.test('All requests sorts every open result ahead of closed results across pages and profiles', async () => {
    await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'closed' } });
    for (let i = 0; i < 13; i++) await api('/requests', { method: 'POST', body: requestInput({ title: `Older open request ${i}` }) });
    const closed = models.Request.rows.find(row => String(row._id) === request.requestId);
    closed.createdAt = new Date('2100-01-01');
    const first = (await api('/requests')).body.requests, second = (await api('/requests?page=2')).body.requests;
    assert.equal(first.length, 12); assert.ok(first.every(item => item.status === 'open'));
    assert.deepEqual(second.map(item => item.status), ['open', 'closed']);
    const profile = (await api(`/members/${alice._id}?requestsPage=2`)).body;
    assert.deepEqual(profile.requests.map(item => item.status), ['open', 'closed']);
    closed.deadline = '2000-01-01';
    assert.equal((await api(`/requests/${request.requestId}/status`, { method: 'PATCH', body: { status: 'open' } })).status, 400);
    assert.equal((await api(`/requests/${request.requestId}`)).body.request.status, 'closed');
  });
  await t.test('Deletes, invalid origins and business/customer permissions are enforced on the server', async () => {
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'DELETE', actor: null })).status, 401);
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'DELETE', actor: 'bob' })).status, 404);
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'DELETE', actor: 'business' })).status, 403);
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'DELETE', origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await api(`/listings/${sale.listingId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await api(`/listings/${sale.listingId}`)).status, 404);
    assert.equal((await api(`/members/${alice._id}`)).body.listingTotal, 0);
    assert.equal((await api('/listings', { method: 'POST', body: input(), actor: 'business' })).status, 403);
    assert.equal((await api('/requests', { method: 'POST', body: requestInput(), actor: 'business' })).status, 403);
    assert.equal((await api('/requests', { actor: 'business' })).status, 200);
    assert.equal((await api('/my/listings?page=0')).status, 400);
  });
});
