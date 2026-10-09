// Run from server/: node --test tests/community.test.js
// These HTTP tests use real Mongoose validation with in-memory storage.
// They do NOT prove that your MongoDB connection works; use the manual checklist too.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { createCommunityRouter, actorFor } = require('../routes/community');
const { listingInput, outfitRequestInput } = require('../communityValidation');
const { memoryModels } = require('./helpers/memoryModels');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const listing = (changes = {}) => ({ name: 'Linen jacket [M]', category: 'Jackets', style: 'Minimalist',
  size: 'M', condition: 'Good', description: 'Light jacket for presentations.', listingType: 'sell',
  price: 25, photo: `data:image/png;base64,${png.toString('base64')}`, clientRequestId: randomUUID(), ...changes });
const outfit = (changes = {}) => ({ title: 'Smart-casual jacket', occasion: 'Presentation', budget: 40,
  preferredStyle: 'Minimalist', deadline: '2099-10-15', description: 'Size M, neutral colours.',
  clientRequestId: randomUUID(), ...changes });

test('Community workflows and failure handling', async t => {
  const previous = { demo: process.env.COMMUNITY_DEMO_MODE, node: process.env.NODE_ENV };
  process.env.COMMUNITY_DEMO_MODE = 'true'; process.env.NODE_ENV = 'test';
  const models = memoryModels();
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use('/api/community', createCommunityRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previous.demo === undefined) delete process.env.COMMUNITY_DEMO_MODE; else process.env.COMMUNITY_DEMO_MODE = previous.demo;
    if (previous.node === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.node;
  });
  const base = `http://127.0.0.1:${server.address().port}/api/community`;
  async function api(path, body) {
    const response = await fetch(base + path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  let sale;
  await t.test('post, read, photo retrieval, and retry without a duplicate', async () => {
    const input = listing({ ownerId: 'spoofed-id', status: 'unavailable' });
    const saved = await api('/listings', input); assert.equal(saved.status, 201);
    sale = saved.body.listing;
    assert.notEqual(sale.ownerId, 'spoofed-id'); assert.equal(sale.status, 'available');
    assert.equal(sale.photo, undefined); assert.equal(sale.clientRequestId, undefined);
    assert.deepEqual((await api(`/listings/${sale.listingId}`)).body.listing, sale);
    const image = await fetch(`http://127.0.0.1:${server.address().port}${sale.imageURL}`);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    const retried = await api('/listings', input);
    assert.equal(retried.status, 200); assert.equal(retried.body.listing.listingId, sale.listingId);
    assert.equal(models.Listing.rows.length, 1);
  });
  await t.test('simultaneous submissions with the same key create one record', async () => {
    const input = listing({ name: 'Concurrent retry' });
    const responses = await Promise.all([api('/listings', input), api('/listings', input)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
    assert.equal(responses[0].body.listing.listingId, responses[1].body.listing.listingId);
  });
  await t.test('rental pricing, literal search, combined filters, and pagination', async () => {
    const rent = await api('/listings', listing({ name: 'Rental dress', category: 'Dresses', listingType: 'rent', rentalPrice: 8 }));
    assert.equal(rent.status, 201); assert.equal(rent.body.listing.price, undefined);
    assert.equal(rent.body.listing.rentalPrice, 8);
    const filtered = await api('/listings?listingType=rent&maxPrice=10&style=Minimalist&size=M&category=Dresses');
    assert.equal(filtered.body.total, 1);
    const literal = await api('/listings?search=%5BM%5D'); assert.equal(literal.body.total, 1);
    assert.equal((await api('/listings?search=%2E%2A')).body.total, 0);
    for (let i = 0; i < 11; i++) await models.Listing.create({ ...listingInput(listing()), ownerId: 'test', ownerName: 'Test' });
    const first = await api('/listings'), second = await api('/listings?page=2');
    assert.equal(first.body.listings.length, 12); assert.equal(second.body.listings.length, 2);
    assert.ok(second.body.listings.every(item => !first.body.listings.some(other => other.listingId === item.listingId)));
    assert.equal((await api('/listings?page=0')).status, 400);
  });
  await t.test('invalid prices, photos, dates, and malformed payloads are rejected', async () => {
    for (const price of [-1, 1.001, null, '', '25', true]) assert.equal((await api('/listings', listing({ price }))).status, 400);
    assert.equal((await api('/listings', listing({ photo: 'data:image/png;base64,aGVsbG8=' }))).status, 400);
    assert.equal((await api('/listings', listing({ name: ' ' }))).status, 400);
    assert.equal((await api('/requests', outfit({ deadline: '2000-01-01' }))).status, 400);
    assert.equal((await api('/requests', outfit({ deadline: '2099-02-30' }))).status, 400);
    for (const validate of [listingInput, outfitRequestInput]) {
      for (const body of [null, [], 'bad']) assert.throws(() => validate(body), { status: 400 });
    }
  });
  await t.test('post/read a request and display only its stored business responses', async () => {
    const input = outfit({ consumerId: 'spoofed-id' });
    const saved = await api('/requests', input); assert.equal(saved.status, 201);
    const id = saved.body.request.requestId;
    assert.notEqual(saved.body.request.consumerId, 'spoofed-id');
    assert.deepEqual((await api(`/requests/${id}`)).body.responses, []);
    assert.equal((await api('/requests', input)).status, 200); assert.equal(models.Request.rows.length, 1);
    await models.Response.create({ requestId: id, businessId: 'test-business', businessName: 'Test Studio',
      productId: 'test-product', productName: 'Structured jacket', productPrice: 38, message: 'This matches your budget.' });
    const detail = (await api(`/requests/${id}`)).body;
    assert.equal(detail.responses.length, 1); assert.equal(detail.responses[0].productPrice, 38);
    assert.equal((await api('/requests?openOnly=true&style=Minimalist')).body.total, 1);
  });
  await t.test('missing records return 404 and database failures return a safe error', async () => {
    assert.equal((await api('/listings/not-an-id')).status, 404);
    assert.equal((await api('/requests/000000000000000000000000')).status, 404);
    const original = models.Listing.countDocuments;
    models.Listing.countDocuments = async () => { throw new Error('private connection details'); };
    const failure = await api('/listings');
    assert.equal(failure.status, 500); assert.ok(!JSON.stringify(failure.body).includes('private connection'));
    models.Listing.countDocuments = original;
  });
  await t.test('posting needs a customer identity; demo identity stays local', async () => {
    assert.equal(actorFor({ socket: { remoteAddress: '192.0.2.10' } }), null);
    process.env.NODE_ENV = 'production';
    assert.equal(actorFor({ socket: { remoteAddress: '127.0.0.1' } }), null);
    process.env.NODE_ENV = 'test'; process.env.COMMUNITY_DEMO_MODE = 'false';
    assert.equal((await api('/listings', listing())).status, 401);
    const actor = actorFor({ user: { id: 'real-user', name: 'Javier', role: 'consumer' }, socket: {} });
    assert.equal(actor.mode, 'account'); assert.equal(actor.id, 'real-user');
    process.env.COMMUNITY_DEMO_MODE = 'true';
  });
});
