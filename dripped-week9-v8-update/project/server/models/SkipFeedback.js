const mongoose = require('mongoose');
// Shared contract: Person 1's "Why did you skip?" popup writes these,
// Person 4's business dashboard reads them. If Person 1 already made this model, keep theirs.
const SKIP_REASONS = ['Not my style', 'Too expensive', 'Wrong colour', 'Wrong fit',
  'Not suitable for occasion', 'Already own something similar', 'Other'];
const schema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  businessId: { type: String, required: true },
  reason: { type: String, enum: SKIP_REASONS, required: true }
}, { timestamps: { createdAt: 'timestamp', updatedAt: false }, collection: 'skip_feedback' });
schema.index({ businessId: 1, timestamp: -1 });
const SkipFeedback = mongoose.models.SkipFeedback || mongoose.model('SkipFeedback', schema);
SkipFeedback.SKIP_REASONS = SKIP_REASONS;
module.exports = SkipFeedback;
