// Person 4: guards for the business portal. loadUser (Person 5) has already set req.user.
function requireBusiness(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Please log in to continue.' });
  if (req.user.role !== 'business') return res.status(403).json({ message: 'A business account is required for this page.' });
  next();
}

function handleBusinessError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if ([400, 403, 404, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
  if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the required fields and try again.' });
  console.error('Business request failed:', error.name);
  res.status(500).json({ message: 'We could not complete that request. Please try again.' });
}

module.exports = { requireBusiness, handleBusinessError };
