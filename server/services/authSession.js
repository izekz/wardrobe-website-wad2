const { createHash, randomBytes } = require('node:crypto');
const Session = require('../models/AuthSession');
const COOKIE = 'wardrobe_session';
const digest = token => createHash('sha256').update(token).digest('hex');
function publicUser(user) { return { id: String(user._id), name: user.name, email: user.email, role: user.role }; }
function readToken(req) {
  const pair = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  const token = pair?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
function cookieOptions() { return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }; }
async function createSession(req, res, user, remember) {
  const old = readToken(req);
  if (old) await Session.deleteOne({ tokenHash: digest(old) });
  const token = randomBytes(32).toString('hex');
  const lifetime = (remember ? 30 * 24 : 12) * 60 * 60 * 1000;
  await Session.create({ tokenHash: digest(token), userId: user._id, expiresAt: new Date(Date.now() + lifetime) });
  res.cookie(COOKIE, token, { ...cookieOptions(), ...(remember ? { maxAge: lifetime } : {}) });
}
async function destroySession(req, res) {
  const token = readToken(req);
  if (token) await Session.deleteOne({ tokenHash: digest(token) });
  res.clearCookie(COOKIE, cookieOptions());
}
module.exports = { createSession, destroySession, publicUser, readToken, digest };
