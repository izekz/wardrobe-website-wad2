const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../models/User');
const Session = require('../models/AuthSession');
const { verifyPassword } = require('../services/passwords');
const { loadUser, requireAuth } = require('../middleware/authentication');
const routes = require('../routes/authRoutes');

test('registration and protected API access', async t => {
  const users = [], sessions = [];
  User.exists = async ({ email }) => users.some(u => u.email === email);
  User.create = async data => {
    if (users.some(u => u.email === data.email)) { const error = new Error('duplicate'); error.code = 11000; throw error; }
    const user = { ...data, _id: String(users.length + 1).padStart(24, '0'), suspended: false };
    users.push(user); return user;
  };
  User.findOne = ({ email }) => ({ select: async () => users.find(u => u.email === email) || null });
  User.findById = async id => users.find(u => u._id === String(id)) || null;
  Session.create = async data => { sessions.push(data); return data; };
  Session.findOne = async q => sessions.find(s => s.tokenHash === q.tokenHash && s.expiresAt > q.expiresAt.$gt) || null;
  Session.deleteOne = async q => { const i = sessions.findIndex(s => s.tokenHash === q.tokenHash); if (i >= 0) sessions.splice(i, 1); };
  const app = express();
  app.use(express.json(), loadUser);
  app.use('/api/auth', routes);
  app.use('/api', requireAuth);
  app.get('/api/community/listings', (req, res) => res.json({ user: req.user }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const base = { name: ' Alex Tan ', email: ' ALEX@EXAMPLE.TEST ', password: 'a-long-test-password', confirmPassword: 'a-long-test-password', role: 'consumer' };
  const post = (path, data, cookie) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) });
  let cookie;
  try {
    await t.test('guest API access denied even if local demo mode is configured', async () => {
      process.env.COMMUNITY_DEMO_MODE = 'true';
      const r = await fetch(url + '/api/community/listings'); assert.equal(r.status, 401);
    });
    await t.test('admin registration, short passwords and mismatched passwords rejected', async () => {
      for (const data of [{ ...base, role: 'admin' }, { ...base, password: 'short', confirmPassword: 'short' }, { ...base, confirmPassword: 'different-password' }, { ...base, name: '' }, { ...base, email: { $ne: null } }]) assert.equal((await post('/api/auth/register', data)).status, 400);
      assert.equal(users.length, 0);
    });
    await t.test('customer registration hashes the password and signs in immediately', async () => {
      const r = await post('/api/auth/register', base); assert.equal(r.status, 201);
      const result = await r.json(); assert.equal(result.user.name, 'Alex Tan'); assert.equal(result.user.email, 'alex@example.test'); assert.equal(result.user.passwordHash, undefined);
      assert.notEqual(users[0].passwordHash, base.password); assert.ok(await verifyPassword(base.password, users[0].passwordHash));
      cookie = r.headers.get('set-cookie').split(';')[0];
      const protectedResult = await fetch(url + '/api/community/listings', { headers: { Cookie: cookie } });
      assert.equal(protectedResult.status, 200); assert.equal((await protectedResult.json()).user.role, 'consumer');
    });
    await t.test('duplicate email cannot overwrite an account', async () => {
      assert.equal((await post('/api/auth/register', base)).status, 409); assert.equal(users.length, 1);
    });
    await t.test('business account can register; role is taken from allowed server values', async () => {
      const r = await post('/api/auth/register', { ...base, email: 'store@example.test', role: 'business', ownerId: 'fake' });
      assert.equal(r.status, 201); assert.equal((await r.json()).user.role, 'business'); assert.equal(users[1].ownerId, undefined);
    });
    await t.test('expired session and logout both block protected APIs', async () => {
      sessions[0].expiresAt = new Date(0);
      assert.equal((await fetch(url + '/api/community/listings', { headers: { Cookie: cookie } })).status, 401);
      const r = await post('/api/auth/login', { email: 'alex@example.test', password: base.password }); assert.equal(r.status, 200);
      cookie = r.headers.get('set-cookie').split(';')[0];
      assert.equal((await post('/api/auth/logout', {}, cookie)).status, 200);
      assert.equal((await fetch(url + '/api/community/listings', { headers: { Cookie: cookie } })).status, 401);
    });
  } finally { delete process.env.COMMUNITY_DEMO_MODE; await new Promise(resolve => server.close(resolve)); }
});

test('frontend guard only allows login and registration without a session', async () => {
  const { createAuthGuard } = await import('../../src/router/routeAccess.mjs');
  let calls = 0;
  const guestGuard = createAuthGuard(async () => { calls++; return null; });
  assert.equal(await guestGuard({ path: '/login', meta: { public: true } }), true);
  assert.equal(await guestGuard({ path: '/register', meta: { public: true } }), true);
  assert.equal(calls, 0);
  assert.deepEqual(await guestGuard({ path: '/community', meta: {} }), { name: 'login', replace: true });
  assert.deepEqual(await guestGuard({ path: '/future-page', meta: {} }), { name: 'login', replace: true });
  assert.equal(await createAuthGuard(async () => ({ id: 'user' }))({ meta: {} }), true);
  let failure;
  const unavailable = createAuthGuard(async () => { throw new Error('Server unavailable'); }, error => { failure = error.message; });
  assert.deepEqual(await unavailable({ meta: {} }), { name: 'login', replace: true });
  assert.equal(failure, 'Server unavailable');
});
