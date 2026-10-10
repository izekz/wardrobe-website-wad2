const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../models/User');
const Session = require('../models/AuthSession');
const { hashPassword } = require('../services/passwords');
const { loadUser } = require('../middleware/authentication');
const authRoutes = require('../routes/authRoutes');

test('login, session restoration, expiry, logout and rejected requests', async t => {
  const user = { _id: '507f1f77bcf86cd799439011', name: 'Alex', email: 'alex@example.test', role: 'consumer', suspended: false, passwordHash: await hashPassword('long-test-password') };
  const sessions = [];
  User.findOne = ({ email }) => ({ select: async () => email === user.email ? user : null });
  User.findById = async id => String(id) === user._id ? user : null;
  Session.create = async data => { sessions.push(data); return data; };
  Session.findOne = async query => sessions.find(s => s.tokenHash === query.tokenHash && s.expiresAt > query.expiresAt.$gt) || null;
  Session.deleteOne = async query => { const i = sessions.findIndex(s => s.tokenHash === query.tokenHash); if (i >= 0) sessions.splice(i, 1); };
  const app = express();
  app.use(express.json(), loadUser);
  app.use('/api/auth', authRoutes);
  app.get('/identity', (req, res) => res.json({ user: req.user || null }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, cookie, origin) {
    return fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
  }
  try {
    await t.test('wrong passwords and unknown emails receive the same message', async () => {
      for (const data of [{ email: user.email, password: 'wrong' }, { email: 'missing@example.test', password: 'wrong' }]) {
        const r = await post('/api/auth/login', data); assert.equal(r.status, 401); assert.deepEqual(await r.json(), { message: 'Email or password is incorrect.' }); assert.equal(r.headers.get('set-cookie'), null);
      }
    });
    await t.test('invalid body and untrusted browser origin are rejected', async () => {
      assert.equal((await post('/api/auth/login', { email: user.email, password: { bad: true } })).status, 400);
      assert.equal((await post('/api/auth/login', { email: user.email, password: 'long-test-password' }, null, 'https://untrusted.example')).status, 403);
    });
    let cookie;
    await t.test('successful login normalises email and restores verified identity', async () => {
      const r = await post('/api/auth/login', { email: ' ALEX@EXAMPLE.TEST ', password: 'long-test-password', remember: true });
      assert.equal(r.status, 200);
      const body = await r.json(); assert.equal(body.user.name, 'Alex'); assert.equal(body.user.passwordHash, undefined);
      const header = r.headers.get('set-cookie'); assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=Lax/i); assert.match(header, /Max-Age=2592000/i);
      assert.ok(Math.abs(sessions[0].expiresAt.getTime() - Date.now() - 30 * 24 * 60 * 60 * 1000) < 5000);
      cookie = header.split(';')[0]; assert.notEqual(sessions[0].tokenHash, cookie.split('=')[1]);
      const restored = await fetch(url + '/identity', { headers: { Cookie: cookie } }); assert.equal((await restored.json()).user.role, 'consumer');
    });
    await t.test('expired and suspended accounts cannot restore a session', async () => {
      user.suspended = true;
      let r = await fetch(url + '/api/auth/session', { headers: { Cookie: cookie } }); assert.equal((await r.json()).user, null);
      assert.equal((await post('/api/auth/login', { email: user.email, password: 'long-test-password' })).status, 401);
      user.suspended = false;
      sessions[0].expiresAt = new Date(0);
      r = await fetch(url + '/api/auth/session', { headers: { Cookie: cookie } }); assert.equal((await r.json()).user, null);
    });
    await t.test('logout invalidates the session; unchecked remember has no persistent cookie', async () => {
      const r = await post('/api/auth/login', { email: user.email, password: 'long-test-password', remember: false }, cookie);
      assert.equal(r.status, 200); const header = r.headers.get('set-cookie'); assert.doesNotMatch(header, /Max-Age=|Expires=/i);
      assert.ok(Math.abs(sessions.at(-1).expiresAt.getTime() - Date.now() - 12 * 60 * 60 * 1000) < 5000);
      cookie = header.split(';')[0];
      assert.equal((await post('/api/auth/logout', {}, cookie)).status, 200);
      const session = await fetch(url + '/api/auth/session', { headers: { Cookie: cookie } }); assert.equal((await session.json()).user, null);
    });
    await t.test('repeated failed logins are limited', async () => {
      let r;
      for (let i = 0; i < 11; i++) r = await post('/api/auth/login', { email: user.email, password: 'wrong' });
      assert.equal(r.status, 429);
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
