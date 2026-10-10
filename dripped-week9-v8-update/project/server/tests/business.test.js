// Run from server/: TEST_MONGODB_URI=mongodb://127.0.0.1:27017/wardrobe_test node --test tests/business.test.js
// Uses a real (throwaway) MongoDB database because coins, the dashboard and the catalogue rely on real queries.
// Skips itself when TEST_MONGODB_URI is not set. NEVER point it at your shared team database: it wipes the test DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { createBusinessRouter, createCatalogRouter, defaultModels } = require('../routes/business');
const png = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}`;
const product = (changes = {}) => ({ name: 'Beige structured blazer', price: 38, style: 'Minimalist', category: 'Jackets',
  occasions: ['Presentation', 'Interview'], sizes: ['S', 'M', 'L'], stock: 12, description: 'Light, smart-casual blazer.', photo: png, ...changes });

test('Business portal', { skip: !process.env.TEST_MONGODB_URI && 'set TEST_MONGODB_URI to run' }, async t => {
  await mongoose.connect(process.env.TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
  const users = {
    shop: { id: '000000000000000000000001', name: 'Minimalist Studio', role: 'business' },
    rival: { id: '000000000000000000000002', name: 'Clean Lines', role: 'business' },
    alex: { id: '000000000000000000000003', name: 'Alex', role: 'consumer' },
  };
  const app = express();
  // Stand-in for Person 5's loadUser/requireAuth: the test picks the user with a header.
  app.use((req, res, next) => { req.user = users[req.get('x-test-user')]; next(); });
  app.use('/api/business', express.json({ limit: '8mb' }), createBusinessRouter());
  app.use('/api/catalog', express.json(), createCatalogRouter());
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { await new Promise(r => server.close(r)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(user, method, path, body) {
    const response = await fetch(base + path, { method, headers: { 'x-test-user': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
    return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? await response.json() : null };
  }

  await t.test('only business accounts can use the portal, and a profile comes first', async () => {
    assert.equal((await api('alex', 'GET', '/business/profile')).status, 403);
    assert.equal((await api('shop', 'GET', '/business/products')).status, 409);
    const profile = { businessName: 'Minimalist Studio', description: 'Clean everyday pieces.', styles: ['Minimalist', 'Formal'], contact: 'hello@studio.sg', logo: png };
    const created = await api('shop', 'PUT', '/business/profile', profile);
    assert.equal(created.status, 201);
    assert.equal(created.body.business.coins, 100);
    assert.ok(created.body.business.logoURL);
    const edited = await api('shop', 'PUT', '/business/profile', { ...profile, logo: undefined, description: 'Updated.' });
    assert.equal(edited.status, 200);
    assert.ok(edited.body.business.logoURL, 'editing without a new logo keeps the old one');
    assert.equal((await api('shop', 'PUT', '/business/profile', { ...profile, styles: ['Gothic'] })).status, 400);
    await api('rival', 'PUT', '/business/profile', { ...profile, businessName: 'Clean Lines', styles: ['Minimalist'] });
  });

  let blazerId;
  await t.test('product CRUD, and the product appears in the store catalogue', async () => {
    const created = await api('shop', 'POST', '/business/products', product());
    assert.equal(created.status, 201);
    blazerId = created.body.product.productId;
    assert.equal((await api('shop', 'POST', '/business/products', product({ photo: undefined }))).status, 400);
    assert.equal((await api('shop', 'POST', '/business/products', product({ stock: 1.5 }))).status, 400);
    const updated = await api('shop', 'PUT', `/business/products/${blazerId}`, product({ photo: undefined, price: 35 }));
    assert.equal(updated.body.product.price, 35);
    assert.equal((await api('rival', 'PUT', `/business/products/${blazerId}`, product())).status, 404, 'cannot edit another shop’s product');
    const store = await api('alex', 'GET', '/catalog/products?style=Minimalist&maxPrice=40&occasion=presentation');
    assert.deepEqual(store.body.products.map(p => p.productId), [blazerId]);
    const image = await fetch(`${base}/catalog/products/${blazerId}/image`, { headers: { 'x-test-user': 'alex' } });
    assert.equal(image.headers.get('content-type'), 'image/png');
  });

  await t.test('views count shopper visits only', async () => {
    await api('alex', 'GET', `/catalog/products/${blazerId}`);
    await api('alex', 'GET', `/catalog/products/${blazerId}`);
    await api('shop', 'GET', `/catalog/products/${blazerId}`);
    const mine = await api('shop', 'GET', `/business/products/${blazerId}`);
    assert.equal(mine.body.product.views, 2);
  });

  await t.test('coins: free listings, extra listing cost, buying, boosting, and not overspending', async () => {
    for (let i = 0; i < 4; i++) await api('shop', 'POST', '/business/products', product({ name: `Tee ${i}`, style: 'Formal', price: 20 }));
    let wallet = await api('shop', 'GET', '/business/coins');
    assert.equal(wallet.body.coins, 100, 'first 5 listings are free');
    const sixth = await api('shop', 'POST', '/business/products', product({ name: 'Sixth' }));
    assert.equal(sixth.body.coins, 90);
    const boosted = await api('shop', 'POST', `/business/products/${sixth.body.product.productId}/boost`);
    assert.equal(boosted.body.coins, 70);
    assert.equal(boosted.body.product.boosted, true);
    const premium = await api('shop', 'POST', `/business/products/${blazerId}/premium`);
    assert.equal(premium.body.coins, 40);
    const store = await api('alex', 'GET', '/catalog/products');
    assert.equal(store.body.products[0].productId, blazerId, 'premium first');
    assert.equal(store.body.products[1].productId, sixth.body.product.productId, 'boosted next');
    assert.equal((await api('shop', 'POST', '/business/coins/purchase', { coins: 7 })).status, 400);
    assert.equal((await api('shop', 'POST', '/business/coins/purchase', { coins: 100 })).body.coins, 140);
    // Spend down to 0 with simultaneous boosts; the wallet must never go negative.
    const results = await Promise.all(Array.from({ length: 10 }, () => api('shop', 'POST', `/business/products/${blazerId}/boost`)));
    assert.equal(results.filter(r => r.status === 200).length, 7);
    assert.equal(results.filter(r => r.status === 409).length, 3);
    wallet = await api('shop', 'GET', '/business/coins');
    assert.equal(wallet.body.coins, 0);
    assert.equal(wallet.body.transactions.reduce((sum, row) => sum + row.amount, 0), 0, 'history adds up to the balance');
    // An expired boost switches itself off.
    await defaultModels.Product.updateOne({ _id: sixth.body.product.productId }, { boostedUntil: new Date(Date.now() - 1000) });
    const after = await api('shop', 'GET', `/business/products/${sixth.body.product.productId}`);
    assert.equal((await api('shop', 'GET', '/business/products')).body.products.find(p => p.productId === sixth.body.product.productId).boosted, false);
    assert.ok(after.status === 200);
  });

  let requestId;
  await t.test('request board: see open requests and reply with a product', async () => {
    const { Request, Response } = defaultModels;
    const open = await Request.create({ consumerId: users.alex.id, consumerName: 'Alex', title: 'Smart casual jacket', occasion: 'Presentation',
      description: 'Size M', budget: 40, preferredStyle: 'Minimalist', deadline: '2099-01-01', clientRequestId: 'a' });
    await Request.create({ consumerId: users.alex.id, consumerName: 'Alex', title: 'Old', occasion: 'Date', description: 'x', budget: 30,
      preferredStyle: 'Streetwear', deadline: '2000-01-01', clientRequestId: 'b' });
    await Request.create({ consumerId: users.alex.id, consumerName: 'Alex', title: 'Hoodie', occasion: 'Casual outing', description: 'x', budget: 50,
      preferredStyle: 'Streetwear', deadline: '2099-01-01', clientRequestId: 'c' });
    requestId = String(open._id);
    const board = await api('shop', 'GET', '/business/requests');
    assert.equal(board.body.total, 2, 'past deadlines are hidden');
    assert.equal((await api('shop', 'GET', '/business/requests?myStyles=true')).body.total, 1);
    const reply = await api('shop', 'POST', `/business/requests/${requestId}/responses`, { productId: blazerId, message: 'This would suit your presentation.' });
    assert.equal(reply.status, 201);
    assert.equal((await api('shop', 'POST', `/business/requests/${requestId}/responses`, { productId: blazerId, message: 'Again' })).status, 409);
    const rivalProduct = (await api('rival', 'POST', '/business/products', product({ name: 'Rival coat' }))).body.product.productId;
    assert.equal((await api('shop', 'POST', `/business/requests/${requestId}/responses`, { productId: rivalProduct, message: 'Not mine' })).status, 400);
    const saved = await Response.findOne({ requestId });
    assert.equal(saved.productName, 'Beige structured blazer');
    assert.equal(saved.businessName, 'Minimalist Studio');
    const after = await api('shop', 'GET', '/business/requests');
    assert.equal(after.body.requests.find(r => r.requestId === requestId).myResponses.length, 1);
  });

  await t.test('dashboard combines views, skip feedback, demand and competition', async () => {
    const { SkipFeedback, Business } = defaultModels;
    const shop = await Business.findOne({ ownerId: users.shop.id });
    for (const reason of ['Too expensive', 'Too expensive', 'Not my style']) {
      await SkipFeedback.create({ userId: users.alex.id, productId: blazerId, businessId: String(shop._id), reason });
    }
    const dash = await api('shop', 'GET', '/business/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.totals.views, 2);
    assert.equal(dash.body.totals.skips, 3);
    assert.deepEqual(dash.body.skipReasons[0], { label: 'Too expensive', count: 2, percent: 66.7 });
    const blazer = dash.body.productPerformance.find(p => p.productId === blazerId);
    assert.equal(blazer.topSkipReason, 'Too expensive');
    assert.equal(dash.body.demand.requestsLast30Days, 3);
    assert.equal(dash.body.demand.unmetCount, 1, 'the hoodie request has no replies yet');
    const minimalist = dash.body.competition.find(c => c.style === 'Minimalist');
    assert.equal(minimalist.businessesInStyle, 2);
    assert.equal(minimalist.rank, 1);
  });

  await t.test('"For you" ranks by the shopper survey, explains why, and hides skipped items', async () => {
    const { User, Product } = defaultModels;
    await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(users.alex.id), name: 'Alex', email: 'alex@x.sg', passwordHash: 'x', role: 'consumer',
      preferredStyles: ['Formal'], activities: ['Presentation'], budget: 25, surveyCompleted: true });
    await Product.updateMany({}, { $set: { premium: false, boosted: false } });
    const feed = await api('alex', 'GET', '/catalog/products?forYou=true');
    assert.equal(feed.body.personalised, true);
    const top = feed.body.products[0];
    assert.equal(top.style, 'Formal');
    assert.ok(top.price <= 25);
    assert.deepEqual(top.reasons, ['Matches your formal style', 'Good for presentation', 'Within your S$25 budget']);
    assert.equal((await api('alex', 'POST', `/catalog/products/${top.productId}/skip`, { reason: 'Wrong colour' })).status, 201);
    assert.equal((await api('alex', 'POST', `/catalog/products/${top.productId}/skip`, { reason: 'Meh' })).status, 400);
    assert.equal((await api('shop', 'POST', `/catalog/products/${top.productId}/skip`, { reason: 'Wrong colour' })).status, 403);
    const after = await api('alex', 'GET', '/catalog/products?forYou=true');
    assert.ok(!after.body.products.some(p => p.productId === top.productId), 'skipped item is hidden from For you');
    assert.equal(after.body.total, feed.body.total - 1);
    const detail = await api('alex', 'GET', `/catalog/products/${blazerId}`);
    assert.equal(detail.body.business.businessName, 'Minimalist Studio');
  });

  await t.test('delete', async () => {
    assert.equal((await api('shop', 'DELETE', `/business/products/${blazerId}`)).status, 200);
    assert.equal((await api('alex', 'GET', `/catalog/products/${blazerId}`)).status, 404);
  });
});
