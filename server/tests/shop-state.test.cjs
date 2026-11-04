const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const { reactive, computed, watch } = require('vue');
const { createCommerceRouter } = require('../routes/commerceRoutes');
const User = require('../models/User');
const { publicUser } = require('../services/authSession');

const A = '507f1f77bcf86cd799439011', B = '507f1f77bcf86cd799439012';
const P = '507f1f77bcf86cd799439021', Q = '507f1f77bcf86cd799439022';
const product = { _id: P, productId: P, name: 'Linen shirt', businessName: 'Shop', price: 39, stock: 8, status: 'active', sizes: ['M', 'L'], colours: ['Black', 'White'], imageURL: '/photo' };
const cartLine = (changes = {}) => ({ productId: P, size: 'M', colour: 'Black', quantity: 2, ...changes });
const clone = value => JSON.parse(JSON.stringify(value));
function models() {
  const users = new Map([A, B].map(_id => [_id, { _id, role: 'consumer', likedProducts: [], cartItems: [] }]));
  const products = new Map([[P, clone(product)], [Q, { ...clone(product), _id: Q, name: 'Another shirt' }]]);
  const matches = (row, query) => row && Object.entries(query).every(([key, value]) => key === 'suspended' ? !row.suspended : String(row[key]) === String(value));
  return { users, products, User: {
    findOne(query) { return { select: async fields => { assert.match(fields, /\+likedProducts/); return matches(users.get(String(query._id)), query) ? clone(users.get(String(query._id))) : null; } }; },
    async findOneAndUpdate(query, update, options) {
      assert.equal(options.runValidators, true);
      const row = users.get(String(query._id));if (!matches(row, query)) return null;
      if (update.$addToSet && !row.likedProducts.includes(update.$addToSet.likedProducts)) row.likedProducts.push(update.$addToSet.likedProducts);
      if (update.$pull) row.likedProducts = row.likedProducts.filter(id => id !== update.$pull.likedProducts);
      if (update.$set) Object.assign(row, clone(update.$set));
      return clone(row);
    },
  }, Product: {
    async findOne(query) { const row = products.get(String(query._id));return row && row.status === query.status ? clone(row) : null; },
    find(query) { return { select: async fields => { assert.ok(!fields.includes('photo.data'));return query._id.$in.map(id => products.get(String(id))).filter(Boolean).map(clone); } }; },
  } };
}

test('shopping API persists private state, validates cart input and scopes every write to the session owner', async t => {
  const db = models(), app = express();
  app.use(express.json(), (req, res, next) => { const id = req.get('X-Test-User');if (id) req.user = { id, role: req.get('X-Test-Role') || 'consumer' };next(); });
  app.use('/api/commerce', createCommerceRouter(db));
  const server = app.listen(0, '127.0.0.1');await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/commerce`;
  async function req(url, user = A, method = 'GET', body, headers = {}) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }
  try {
    await t.test('guests, other roles and stale account headers cannot read or write shopping state', async () => {
      assert.equal((await req('/shop', null)).status, 401);
      assert.equal((await req('/shop', A, 'GET', undefined, { 'X-Test-Role': 'business' })).status, 403);
      assert.equal((await req('/cart', B, 'PUT', { cart: [cartLine()] }, { 'X-Shop-User': A })).status, 409);
      assert.equal((await req(`/likes/${P}`, A, 'PUT', { liked: true }, { Origin: 'https://unexpected.example.invalid' })).status, 403);
      assert.equal(db.users.get(B).cartItems.length, 0);
    });
    await t.test('likes survive repeated reads and never appear on another account', async () => {
      assert.equal((await req(`/likes/${P}`, A, 'PUT', { liked: true, userId: B })).status, 200);
      await req(`/likes/${P}`, A, 'PUT', { liked: true });
      const first = await req('/shop');assert.deepEqual(first.body.liked, [P]);assert.match(first.cache, /private, no-store/);
      assert.deepEqual((await req('/shop')).body.liked, [P]);assert.deepEqual((await req('/shop', B)).body.liked, []);
      await req(`/likes/${Q}`, B, 'PUT', { liked: true });
      await req(`/likes/${P}`, A, 'PUT', { liked: false });
      assert.deepEqual((await req('/shop', B)).body.liked, [Q]);assert.deepEqual((await req('/shop')).body.liked, []);
    });
    await t.test('cart variants persist and server metadata replaces forged prices and names', async () => {
      const result = await req('/cart', A, 'PUT', { userId: B, cart: [cartLine({ price: 0.01, name: 'forged' }), cartLine({ colour: 'White', quantity: 1 })] });
      assert.equal(result.status, 200);assert.equal(result.body.cart.length, 2);assert.equal(result.body.cart[0].price, 39);assert.equal(result.body.cart[0].name, 'Linen shirt');
      assert.equal(result.body.cart[0].key, `${P}:M:Black`);
      assert.deepEqual((await req('/shop')).body.cart.map(line => line.quantity), [2, 1]);assert.deepEqual((await req('/shop', B)).body.cart, []);
      assert.deepEqual(Object.keys(db.users.get(A).cartItems[0]).sort(), ['colour', 'productId', 'quantity', 'size']);
    });
    await t.test('invalid variants, duplicates, malformed IDs, unavailable stock and invalid quantities do not alter saved data', async () => {
      const previous = clone(db.users.get(A).cartItems);
      for (const cart of [[cartLine({ productId: 'bad' })], [cartLine({ quantity: 0 })], [cartLine({ quantity: 1.5 })], [cartLine({ quantity: 11 })], [cartLine({ size: ['M'] })], [cartLine(), cartLine()], [cartLine({ colour: 'Red' })], [cartLine({ size: 'XL' })], [cartLine({ quantity: 9 })]]) {
        assert.ok((await req('/cart', A, 'PUT', { cart })).status >= 400);
        assert.deepEqual(db.users.get(A).cartItems, previous);
      }
      assert.equal((await req(`/likes/${P}`, A, 'PUT', { liked: 'true' })).status, 400);
    });
    await t.test('unavailable products can be removed without blocking other cart changes', async () => {
      db.products.get(P).status = 'hidden';
      assert.equal((await req('/shop')).body.cart[0].available, false);
      assert.equal((await req('/cart', A, 'PUT', { cart: [cartLine()] })).status, 200);
      assert.equal((await req('/cart', A, 'PUT', { cart: [] })).status, 200);
      assert.deepEqual((await req('/shop')).body.cart, []);
      assert.equal((await req('/cart', B, 'PUT', { cart: [cartLine()] })).status, 409);
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('User schema stores shopping references privately without changing public session data', async () => {
  assert.equal(User.schema.path('likedProducts').options.select, false);assert.equal(User.schema.path('cartItems').options.select, false);
  const user = new User({ name: 'Test', email: 'test@example.test', passwordHash: 'test-only-hash', likedProducts: [P], cartItems: [cartLine()] });
  await user.validate();assert.equal(user.cartItems[0]._id, undefined);
  assert.equal('likedProducts' in publicUser(user), false);assert.equal('cartItems' in publicUser(user), false);
  user.cartItems[0].quantity = 1.5;await assert.rejects(user.validate());
});

function frontendFixture(store = new Map([[A, { liked: [P], cart: [] }], [B, { liked: [], cart: [] }]])) {
  const authState = reactive({ user: null }), calls = [], stops = [], events = [];
  let serverUser = null, hook = null;
  const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => clone(body) });
  const fetchApi = async (url, options = {}) => {
    calls.push({ url, options });const id = serverUser;
    if (hook) { const custom = await hook(url, options, id);if (custom) return custom; }
    if (!id) return response(401, { message: 'Please log in.' });
    if (options.headers['X-Shop-User'] !== id) return response(409, { code: 'ACCOUNT_CHANGED' });
    const row = store.get(id), body = options.body ? JSON.parse(options.body) : {};
    if (url.endsWith('/shop')) return response(200, { userId: id, ...clone(row) });
    if (url.includes('/likes/')) {
      const productId = url.split('/').at(-1);
      row.liked = body.liked ? [...new Set([...row.liked, productId])] : row.liked.filter(value => value !== productId);
      return response(200, { userId: id, productId, liked: body.liked });
    }
    if (url.endsWith('/cart')) {
      row.cart = body.cart.map(line => ({ ...clone(product), ...line, key: `${line.productId}:${line.size}:${line.colour}`, available: true }));
      return response(200, { userId: id, cart: row.cart });
    }
    if (url.endsWith('/checkout')) return response(201, { order: { orderNumber: 'TEST', status: 'confirmed' } });
    throw new Error('Unexpected request: ' + url);
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/services/shopService.js'), 'utf8')
    .replace(/^import[^\r\n]*(?:\r?\n|$)/gm, '').replace(/\bexport\s+/g, '') +
    '\nthis.shop = { shopState, hydrateShop, toggleLike, addToCart, updateCartQuantity, removeFromCart, clearCart, likedCount, cartCount, checkoutOrder };';
  const sandbox = vm.createContext({ reactive, computed, watch: (...args) => { const stop = watch(...args);stops.push(stop);return stop; }, authState,
    restoreSession: async () => { authState.user = serverUser ? { id: serverUser, role: 'consumer' } : null; },
    fetch: fetchApi, setTimeout, clearTimeout, AbortController, Event, console,
    window: { addEventListener() {}, dispatchEvent: event => events.push(event.type) },
    localStorage: { getItem() { throw new Error('Old shared cache must never be used'); }, setItem() { throw new Error('Shopping data belongs in the database'); } } });
  new vm.Script(source).runInContext(sandbox);
  return { ...sandbox.shop, store, calls, events, authState, response,
    login(id, role = 'consumer') { serverUser = id;authState.user = id ? { id, role } : null; },
    cookie(id) { serverUser = id; }, hook(value) { hook = value; }, dispose() { stops.forEach(stop => stop()); } };
}

test('frontend restores account state and never leaks late or queued results between users', async t => {
  await t.test('delayed login restoration loads saved badges; a fresh module reloads the same account data', async () => {
    const f = frontendFixture();assert.equal(f.calls.length, 0);
    f.login(A);await f.hydrateShop();assert.equal(f.likedCount.value, 1);
    await f.addToCart(product, { size: 'M', colour: 'Black', quantity: 2 });assert.equal(f.cartCount.value, 2);
    const store = f.store;f.dispose();const reload = frontendFixture(store);reload.login(A);await reload.hydrateShop();
    assert.equal(reload.likedCount.value, 1);assert.equal(reload.cartCount.value, 2);reload.dispose();
  });
  await t.test('logout clears both badges immediately; account B stays separate and A comes back intact', async () => {
    const f = frontendFixture();f.login(A);await f.hydrateShop();await f.addToCart(product, { size: 'M', colour: 'Black' });
    f.login(null);assert.equal(f.likedCount.value, 0);assert.equal(f.cartCount.value, 0);
    f.login(B);assert.equal(f.likedCount.value, 0);await f.hydrateShop();assert.equal(f.cartCount.value, 0);
    await f.toggleLike(Q);await f.addToCart(product, { size: 'L', colour: 'White', quantity: 3 });
    f.login(A);await f.hydrateShop();assert.deepEqual([...f.shopState.liked], [P]);assert.equal(f.cartCount.value, 1);
    f.login(B);await f.hydrateShop();assert.deepEqual([...f.shopState.liked], [Q]);assert.equal(f.cartCount.value, 3);f.dispose();
  });
  await t.test('a delayed old account load cannot populate the new account', async () => {
    const f = frontendFixture();let release;
    f.hook((url, options, id) => url.endsWith('/shop') && id === A ? new Promise(resolve => { release = () => resolve(f.response(200, { userId: A, liked: [P], cart: [] })); }) : null);
    f.login(A);const old = f.hydrateShop().catch(e => e);f.login(B);await f.hydrateShop();release();await old;
    assert.equal(f.shopState.ownerId, B);assert.equal(f.likedCount.value, 0);assert.equal(f.shopState.error, '');f.dispose();
  });
  await t.test('in-flight and queued old-account actions cannot change B or send stale writes', async () => {
    const f = frontendFixture();f.login(A);await f.hydrateShop();let release;
    f.hook(url => url.includes('/likes/') ? new Promise(resolve => { release = () => resolve(f.response(200, { userId: A, productId: Q, liked: true })); }) : null);
    const inFlight = f.toggleLike(Q).catch(e => e);await new Promise(resolve => setImmediate(resolve));
    const queued = f.addToCart(product, { size: 'M', colour: 'Black' }).catch(e => e);
    f.login(B);await f.hydrateShop();release();
    assert.equal((await inFlight).code, 'ACCOUNT_CHANGED');assert.equal((await queued).code, 'ACCOUNT_CHANGED');
    assert.equal(f.cartCount.value, 0);assert.equal(f.likedCount.value, 0);assert.equal(f.calls.filter(call => call.url.endsWith('/cart')).length, 0);f.dispose();
  });
  await t.test('rapid mutations are serialized, updates/removals persist, and failed saves do not claim success', async () => {
    const f = frontendFixture();f.login(A);await f.hydrateShop();
    await Promise.all([f.addToCart(product, { size: 'M', colour: 'Black' }), f.addToCart(product, { size: 'M', colour: 'Black' })]);assert.equal(f.cartCount.value, 2);
    const key = f.shopState.cart[0].key;await f.updateCartQuantity(key, 4);assert.equal(f.store.get(A).cart[0].quantity, 4);
    f.hook(url => url.endsWith('/cart') ? f.response(503, { message: 'Temporarily unavailable' }) : null);
    await assert.rejects(f.removeFromCart(key), /Temporarily unavailable/);assert.equal(f.cartCount.value, 4);assert.match(f.shopState.error, /Temporarily unavailable/);
    f.hook(null);await f.removeFromCart(key);assert.equal(f.store.get(A).cart.length, 0);assert.equal(f.shopState.pending, 0);f.dispose();
  });
  await t.test('session expiry or a cookie changed in another tab clears private shopping data', async () => {
    for (const id of [null, B]) {
      const f = frontendFixture();f.login(A);await f.hydrateShop();f.cookie(id);
      await assert.rejects(f.toggleLike(Q));assert.equal(f.authState.user, null);assert.equal(f.likedCount.value, 0);assert.ok(f.events.includes('auth:expired'));f.dispose();
    }
  });
  await t.test('normal session refresh does not reset badges and checkout clearing survives a refresh', async () => {
    const f = frontendFixture();f.login(A);await f.hydrateShop();const reads = f.calls.length;
    f.login(A);await f.hydrateShop();assert.equal(f.calls.length, reads);assert.equal(f.likedCount.value, 1);
    await f.addToCart(product, { size: 'M', colour: 'Black' });await f.checkoutOrder({});await f.clearCart();
    await f.hydrateShop(true);assert.equal(f.cartCount.value, 0);assert.equal(f.likedCount.value, 1);f.dispose();
  });
});
