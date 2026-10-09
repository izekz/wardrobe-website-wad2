const User = require('../models/User');
const Session = require('../models/AuthSession');
const { readToken, digest, publicUser } = require('../services/authSession');

async function loadUser(req, res, next) {
  try {
    const token = readToken(req);
    if (token) {
      const session = await Session.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
      if (session) {
        const user = await User.findById(session.userId);
        if (user && !user.suspended) req.user = publicUser(user);
      }
    }
    next();
  } catch (error) { next(error); }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Please log in to continue.' });
  next();
}

function trustedBrowser(req, res, next) {
  const origin = req.get('Origin');
  const allowed = new Set([process.env.CLIENT_ORIGIN || 'http://localhost:5173']);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:5173');
  }
  if (origin && !allowed.has(origin)) return res.status(403).json({ message: 'This request is not allowed.' });
  next();
}

module.exports = { loadUser, requireAuth, trustedBrowser };
