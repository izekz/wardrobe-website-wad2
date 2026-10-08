function actorFor(req) {
  // Person 5: verified login middleware sets req.user before this router runs.
  // An ownerId sent by the browser is NEVER used to establish identity.
  const user = req.user;
  if (user && (user.id || user._id || user.userId)) {
    return { id: String(user.id || user._id || user.userId), name: String(user.name || 'Community member').slice(0, 100), role: user.role, mode: 'account' };
  }
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (process.env.COMMUNITY_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production' && local) {
    return { id: process.env.COMMUNITY_DEMO_USER_ID || 'week9-demo-customer', name: 'Demo customer', role: 'consumer', mode: 'local-demo' };
  }
  return null;
}
function requireCustomer(req, res, next) {
  const actor = actorFor(req);
  if (!actor) return res.status(401).json({ message: 'Please sign in before posting.' });
  if (!['consumer', 'customer'].includes(actor.role)) return res.status(403).json({ message: 'A customer account is required to post here.' });
  req.communityActor = actor;
  next();
}
function handleCommunityError(error, req, res, next) {
    if (res.headersSent) return next(error);
    if (error.status === 400) return res.status(400).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the required fields and try again.' });
    console.error('Community request failed:', error.name);
    res.status(500).json({ message: 'We could not complete that request. Please try again.' });
}

module.exports = { actorFor, requireCustomer, handleCommunityError };
