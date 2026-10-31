const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { defaultModels, createBusinessRouter, createCatalogRouter } = require('../routes/business');
const { createWardrobeRouter } = require('../routes/wardrobeRoutes');
const { requireAuth } = require('../middleware/authentication');
const { memoryModel } = require('./helpers/memoryModels');
const Product = require('../models/Product');
const { productInput } = require('../businessValidation');
const { listedColours } = require('../services/listedColours');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const details = { name: 'Everyday shirt', price: 38, category: 'Tops', style: 'Minimalist', colours: ['White', 'Black'], material: '  Linen  ',
  stock: 3, occasions: ['Presentation'], sizes: ['M'], description: 'Pair with blue jeans.', photo: png };

test('product metadata is required and validated with the wardrobe colour palette and material limit', async () => {
  assert.equal(productInput(details, { photoRequired: true }).material, 'Linen');
  for (const changes of [{ colours: undefined }, { colours: [] }, { colours: 'White' }, { colours: ['Invisible'] }, { colours: ['White', null] }, { material: undefined }, { material: '   ' }, { material: 'a'.repeat(51) }])
    assert.throws(() => productInput({ ...details, ...changes }, { photoRequired: true }));
  const legacy = new Product({ businessId: 'shop', businessName: 'Shop', ...productInput(details, { photoRequired: true }) });
  legacy.colours = undefined; legacy.colour = undefined; legacy.material = undefined;
  await legacy.validate(); // Old records remain usable without inventing metadata.
  legacy.colour = 'Invisible';
  await assert.rejects(legacy.validate(), /colour/);
  assert.deepEqual(listedColours({ ...details, description: 'Available in Blue and Black.' }), ['White', 'Black']);
  assert.deepEqual(productInput({ ...details, colours: ['White', 'White'] }, { photoRequired: true }).colours, ['White']);
  assert.deepEqual(productInput({ ...details, colours: undefined, colour: 'Beige' }, { photoRequired: true }).colours, ['Beige']);
  assert.deepEqual(listedColours({ colours: [], colour: 'Beige' }), ['Beige']);
});

test('business product create/edit persists metadata, keeps photos and passes trusted data into catalogue and planner', async t => {
  const models = Object.fromEntries(Object.entries({ ...defaultModels,
    Item: require('../models/WardrobeItem'), Outfit: require('../models/SavedOutfit') }).map(([key, model]) => [key, memoryModel(model)]));
  const actors = { shop: { id: '000000000000000000000001', name: 'Seller', role: 'business' },
    other: { id: '000000000000000000000002', name: 'Other', role: 'business' },
    customer: { id: '000000000000000000000003', name: 'Customer', role: 'consumer' } };
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => { req.user = actors[req.get('x-test-user')]; next(); });
  app.use('/api', requireAuth);
  app.use('/api/business', createBusinessRouter(models));
  app.use('/api/catalog', createCatalogRouter(models));
  app.use('/api/wardrobe', createWardrobeRouter(models, async () => ({ available: true, tags: ['Warm'], temperature: 31 })));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(path, method = 'GET', body, user = 'shop') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  for (const user of ['shop', 'other']) assert.equal((await api('/business/profile', 'PUT', {
    businessName: user, description: 'Clothing shop', styles: ['Minimalist'], contact: 'shop@example.test' }, user)).status, 201);
  assert.equal((await api('/business/products', 'POST', { ...details, colours: [] })).status, 400);
  const created = await api('/business/products', 'POST', details);
  assert.equal(created.status, 201);
  const id = created.body.product.productId;
  assert.equal(created.body.product.colour, null);
  assert.deepEqual(created.body.product.colours, ['White', 'Black']);
  assert.equal(created.body.product.material, 'Linen');
  assert.deepEqual(created.body.product.availableColours, ['White', 'Black']);
  assert.equal((await models.Product.findById(id)).material, 'Linen');
  const edit = { ...details, colours: ['Black', 'Navy'], material: 'Cotton' }; delete edit.photo;
  assert.equal((await api(`/business/products/${id}`, 'PUT', edit, 'other')).status, 404);
  const edited = await api(`/business/products/${id}`, 'PUT', edit);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.product.colour, null);
  assert.deepEqual(edited.body.product.colours, ['Black', 'Navy']);
  assert.equal((await models.Product.findById(id)).colour, undefined);
  assert.equal(edited.body.product.material, 'Cotton');
  assert.ok((await models.Product.findById(id)).photo.data.length);
  const catalogue = await api(`/catalog/products/${id}`, 'GET', null, 'customer');
  assert.deepEqual(catalogue.body.product.availableColours, ['Black', 'Navy']);
  assert.equal(catalogue.body.product.material, 'Cotton');
  const selected = await api('/wardrobe/selection', 'POST', { occasion: 'Presentation', itemIds: [], productId: id,
    product: { colour: 'Red', material: 'Fleece' } }, 'customer');
  assert.equal(selected.status, 200);
  assert.equal(selected.body.selection.pieces[0].material, 'Cotton');
  assert.equal(selected.body.selection.pieces[0].colour, '');
  assert.equal(selected.body.selection.scoreDetails.itemDetails[0].earned, 32);
  const variant = await api('/wardrobe/selection', 'POST', { occasion: 'Presentation', itemIds: [], productId: id, productColour: 'Navy' }, 'customer');
  assert.equal(variant.status, 200);
  assert.equal(variant.body.selection.pieces[0].colour, 'Navy');
  assert.equal(variant.body.selection.scoreDetails.itemDetails[0].earned, 42);
  for (const productColour of ['Red', ['Black', 'Navy']])
    assert.equal((await api('/wardrobe/selection', 'POST', { occasion: 'Presentation', itemIds: [], productId: id, productColour }, 'customer')).status, 400);
  const legacy = await models.Product.create({ ...productInput(details, { photoRequired: true }), businessId: String(models.Business.rows[0]._id), businessName: 'shop' });
  legacy.colours = undefined; legacy.colour = 'White'; legacy.material = undefined; await legacy.save();
  const old = await api(`/catalog/products/${legacy._id}`, 'GET', null, 'customer');
  assert.equal(old.status, 200);
  assert.equal(old.body.product.colour, 'White');
  assert.deepEqual(old.body.product.availableColours, ['White']);
  assert.equal(old.body.product.material, null);
  assert.equal((await api(`/business/products/${legacy._id}/boost`, 'POST', {})).status, 200);
});
