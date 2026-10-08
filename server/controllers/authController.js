const User = require('../models/User');
const { verifyPassword, hashPassword } = require('../services/passwords');
const { createSession, destroySession, publicUser } = require('../services/authSession');

const registrationAttempts = new Map();
// A fixed hash makes invalid-email login checks perform the same password work.
const dummyHash = hashPassword('not-an-account-password');
const attempts = new Map();

function getSession(req, res) {
  res.json({ user: req.user || null });
}

async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024 || (req.body.remember !== undefined && typeof req.body.remember !== 'boolean')) {
    return res.status(400).json({ message: 'Enter a valid email address and password.' });
  }
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
  const key = req.ip;
  let attempt = attempts.get(key);
  if (attempt?.count >= 10) return res.status(429).json({ message: 'Too many attempts. Try again in 15 minutes.' });
  if (!attempt) { attempt = { count: 0, until: now + 15 * 60 * 1000 }; attempts.set(key, attempt); }
  attempt.count++;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await verifyPassword(password, user?.passwordHash || await dummyHash);
  if (!user || !valid || user.suspended) return res.status(401).json({ message: 'Email or password is incorrect.' });
  await createSession(req, res, user, req.body.remember === true);
  attempts.delete(key);
  res.json({ user: publicUser(user) });
}

async function register(req, res) {
  const now = Date.now();
  for (const [key, item] of registrationAttempts) if (item.until <= now) registrationAttempts.delete(key);
  let attempt = registrationAttempts.get(req.ip);
  if (attempt?.count >= 15) return res.status(429).json({ message: 'Too many registrations. Try again in 15 minutes.' });
  if (!attempt) { attempt = { count: 0, until: now + 15 * 60 * 1000 }; registrationAttempts.set(req.ip, attempt); }
  attempt.count++;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password, confirmPassword, role } = req.body || {};
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !['consumer', 'business'].includes(role)) {
    return res.status(400).json({ message: 'Enter your name, a valid email, and a customer or business account type.' });
  }
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 1024) {
    return res.status(400).json({ message: 'Use a password with at least 12 characters.' });
  }
  if (password !== confirmPassword) return res.status(400).json({ message: 'Your passwords do not match.' });
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
  let user;
  try {
    user = await User.create({ name, email, role, passwordHash: await hashPassword(password) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    throw error;
  }
  await createSession(req, res, user, false);
  res.status(201).json({ user: publicUser(user) });
}

async function logout(req, res) {
  await destroySession(req, res);
  res.json({ message: 'Signed out.' });
}

module.exports = { getSession, login, register, logout };
