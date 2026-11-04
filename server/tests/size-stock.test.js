// Person 4: stock per size. Run from the project root: node --test server/tests/size-stock.test.js
// Uses the in-memory test models, so no database is needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { createCommunityRouter } = require('../routes/community');
const { createBusinessRouter } = require('../routes/business');
const { requireAuth } = require('../middleware/authentication');
const { memoryModels, memoryModel, memoryTransactions } = require('./helpers/memoryModels');
const { sizeStockInput } = require('../businessValidation');
const { takeStock, returnStock, stockForSize, upgradeOldListings } = require('../services/sizeStock');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('size stock form input is checked', () => {
  assert.deepEqual(sizeStockInput({ S: 2, M: 0, L: 5 }), {
    sizes: ['S', 'M', 'L'], stock: 7,
    sizeStock: [{ size: 'S', stock: 2 }, { size: 'M', stock: 0 }, { size: 'L', stock: 5 }],
  });
  assert.equal(sizeStockInput([{ size: ' XL ', stock: 3 }]).sizes[0], 'XL');
  assert.throws(() => sizeStockInput([{ size: 'M', stock: 1 }, { size: 'm', stock: 2 }]), /listed twice/);
  assert.throws(() => sizeStockInput({ M: -1 }), /whole number/);
  assert.throws(() => sizeStockInput({ M: 1.5 }), /whole number/);
  assert.throws(() => sizeStockInput({}), /between 1 and 12/);
});

test('buying a size only reduces that size', async () => {
  const Product = memoryModel(require('../models/Product'));
  const product = await Product.create({ businessId: 'b1', businessName: 'Shop', name: 'Tee', price: 10, style: 'Minimalist', category: 'Tops',
    occasions: ['University'], sizes: ['S', 'M', 'L'], sizeStock: [{ size: 'S', stock: 1 }, { size: 'M', stock: 3 }, { size: 'L', stock: 0 }],
    stock: 4, description: 'A tee.', photo: { data: Buffer.from('x'), contentType: 'image/png' } });
  const take = (size, qty) => { const t = takeStock(product, size, qty); return Product.findOneAndUpdate({ _id: product._id, ...t.filter }, t.update); };
  const after = await take('M', 2);
  assert.equal(stockForSize(after, 'M'), 1);
  assert.equal(stockForSize(after, 'S'), 1, 'other sizes are untouched');
  assert.equal(after.stock, 2, 'total follows the sizes');
  assert.equal(await take('L', 1), null, 'a sold-out size cannot be bought even though the item has stock');
  assert.equal(await take('M', 2), null, 'cannot buy more than that size has');
  const back = returnStock(after, 'M', 2);
  const restored = await Product.findOneAndUpdate({ _id: product._id, ...back.filter }, back.update);
  assert.equal(stockForSize(restored, 'M'), 3); assert.equal(restored.stock, 4);
});

test('older listings without stock per size still share one stock', () => {
  const legacy = { sizes: ['S', 'M'], stock: 5 };
  assert.equal(stockForSize(legacy, 'S'), 5);
  assert.deepEqual(takeStock(legacy, 'S', 2), { filter: { stock: { $gte: 2 } }, update: { $inc: { stock: -2 } } });
});

test('business sets stock per size and a request purchase takes from the chosen size', async t => {
  const models = { ...memoryModels(), Business: memoryModel(require('../models/Business')), CoinTransaction: memoryModel(require('../models/CoinTransaction')),
    SkipFeedback: memoryModel(require('../models/SkipFeedback')), Outfit: memoryModel(require('../models/SavedOutfit')) };
  const transact = memoryTransactions(models);
  const alice = await models.User.create({ name: 'Alex', email: 'alex@example.test', passwordHash: 'test-only', role: 'consumer' });
  const seller = await models.User.create({ name: 'Studio owner', email: 'studio@example.test', passwordHash: 'test-only', role: 'business' });
  const actors = { alice, seller };
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => { const a = actors[req.get('X-Test-Actor')]; if (a) req.user = { id: String(a._id), name: a.name, role: a.role }; next(); });
  app.use('/api', requireAuth);
  app.use('/api/community', createCommunityRouter(models, transact));
  app.use('/api/business', createBusinessRouter(models));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (path, actor, method = 'GET', body) => {
    const r = await fetch(base + path, { method, headers: { 'X-Test-Actor': actor, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  assert.equal((await api('/business/profile', 'seller', 'PUT', { businessName: 'Minimalist Studio', description: 'Everyday pieces.', styles: ['Minimalist'], contact: 'studio@example.test', logo: png })).status, 201);
  const listing = { name: 'Beige Jacket', price: 38, category: 'Jackets', style: 'Minimalist', colours: ['Beige'], material: 'Cotton', occasions: ['Presentation'],
    sizeStock: [{ size: 'S', stock: 0 }, { size: 'M', stock: 1 }, { size: 'L', stock: 2 }], description: 'A light jacket.', photo: png };
  const created = await api('/business/products', 'seller', 'POST', listing);
  assert.equal(created.status, 201);
  const productId = created.body.product.productId;
  assert.deepEqual(created.body.product.sizeStock, { S: 0, M: 1, L: 2 });
  assert.deepEqual(created.body.product.sizes, ['S', 'M', 'L']);
  assert.equal(created.body.product.stock, 3);

  const request = await api('/community/requests', 'alice', 'POST', { title: 'Presentation jacket', occasion: 'Presentation', description: 'Neutral jacket.',
    budget: 40, preferredStyle: 'Minimalist', deadline: '2099-10-15', clientRequestId: randomUUID() });
  const requestId = request.body.request.requestId;
  const reply = await api(`/business/requests/${requestId}/responses`, 'seller', 'POST', { productId, message: 'This fits.' });
  const path = `/community/requests/${requestId}/responses/${reply.body.response.responseId}`;
  const detail = await api(`/community/requests/${requestId}`, 'alice');
  assert.deepEqual(detail.body.responses[0].product.sizeStock, { S: 0, M: 1, L: 2 }, 'customers see stock per size');
  assert.equal((await api(path + '/accept', 'alice', 'POST', {})).status, 200);

  const soldOut = await api(path + '/purchase', 'alice', 'POST', { size: 'S', colour: 'Beige', expectedPrice: 38 });
  assert.equal(soldOut.status, 409);
  assert.match(soldOut.body.message, /Size S is sold out/);
  assert.equal((await api(path + '/purchase', 'alice', 'POST', { size: 'M', colour: 'Beige', expectedPrice: 38 })).status, 201);
  const after = (await api(`/business/products/${productId}`, 'seller')).body.product;
  assert.deepEqual(after.sizeStock, { S: 0, M: 0, L: 2 }, 'only size M went down');
  assert.equal(after.stock, 2);

  // Restocking one size through the edit form.
  const edited = await api(`/business/products/${productId}`, 'seller', 'PUT', { ...listing, photo: undefined, sizeStock: { S: 4, M: 0, L: 2 } });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.body.product.sizeStock, { S: 4, M: 0, L: 2 });
  assert.equal(edited.body.product.stock, 6);
});

test('older products get their old stock in every size, once', async () => {
  const Product = memoryModel(require('../models/Product'));
  const base = { businessId: 'b1', businessName: 'Shop', price: 10, style: 'Minimalist', category: 'Tops', occasions: ['University'],
    description: 'A tee.', photo: { data: Buffer.from('x'), contentType: 'image/png' } };
  const old = await Product.create({ ...base, name: 'Old tee', sizes: ['S', 'M', 'L', 'XL'], stock: 40 });
  const soldOut = await Product.create({ ...base, name: 'Old sold out', sizes: ['M'], stock: 0 });
  const current = await Product.create({ ...base, name: 'New tee', sizes: ['S'], sizeStock: [{ size: 'S', stock: 3 }], stock: 3 });
  assert.equal(await upgradeOldListings(Product), 2);
  const after = await Product.findById(old._id);
  assert.deepEqual(after.sizeStock.map(r => [r.size, r.stock]), [['S', 40], ['M', 40], ['L', 40], ['XL', 40]]);
  assert.equal(after.stock, 160);
  assert.equal((await Product.findById(soldOut._id)).stock, 0);
  assert.equal((await Product.findById(current._id)).stock, 3, 'products that already have stock per size are left alone');
  assert.equal(await upgradeOldListings(Product), 0, 'running again changes nothing');
});
