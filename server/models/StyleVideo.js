const mongoose = require('mongoose');

// A promotional video always belongs to an existing business product.
// Video bytes live in MongoDB, not a third-party hosting service, for this project.
const schema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  caption: { type: String, required: true, trim: true, maxlength: 200 },
  video: {
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, required: true, enum: ['video/mp4', 'video/webm'] }
  },
  boostedUntil: { type: Date, default: null },
  boostPausedAt: { type: Date, default: null },
  // Snapshot at the latest boost purchase for transparent before/after statistics.
  boostStartedAt: { type: Date, default: null },
  boostBaseline: {
    views: { type: Number, default: 0 }, likes: { type: Number, default: 0 },
    productClicks: { type: Number, default: 0 }, storeClicks: { type: Number, default: 0 },
    sponsoredImpressions: { type: Number, default: 0 }, uniqueReach: { type: Number, default: 0 }
  },
  likesBy: { type: [String], default: [], select: false },
  // Per-account counts cap genuine rewatches and repeat sponsored exposures at 10.
  viewedBy: { type: [new mongoose.Schema({ userId: String, count: { type: Number, min: 0, max: 10 } }, { _id: false })], default: [], select: false },
  boostImpressionsBy: { type: [new mongoose.Schema({ userId: String, count: { type: Number, min: 0, max: 10 } }, { _id: false })], default: [], select: false },
  sponsoredSeenBy: { type: [String], default: [], select: false },
  // Per-boost campaign reach: separate from all-time unique sponsored viewers.
  boostSeenBy: { type: [String], default: [], select: false },
  boostUniqueReach: { type: Number, default: 0, min: 0 },
  likes: { type: Number, default: 0, min: 0 },
  views: { type: Number, default: 0, min: 0 },
  sponsoredImpressions: { type: Number, default: 0, min: 0 },
  uniqueReach: { type: Number, default: 0, min: 0 },
  productClicks: { type: Number, default: 0, min: 0 },
  storeClicks: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: 'style_videos' });
schema.index({ businessId: 1, createdAt: -1 });
module.exports = mongoose.models.StyleVideo || mongoose.model('StyleVideo', schema);
