const mongoose = require('mongoose');

// A promotional video always belongs to an existing business product.
// Video bytes live in MongoDB, not a third-party hosting service, for the class demo.
const schema = new mongoose.Schema({
  businessId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  caption: { type: String, required: true, trim: true, maxlength: 200 },
  video: {
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, required: true, enum: ['video/mp4', 'video/webm'] }
  },
  boostedUntil: { type: Date, default: null },
  likesBy: { type: [String], default: [], select: false },
  sponsoredSeenBy: { type: [String], default: [], select: false },
  likes: { type: Number, default: 0, min: 0 },
  views: { type: Number, default: 0, min: 0 },
  sponsoredImpressions: { type: Number, default: 0, min: 0 },
  uniqueReach: { type: Number, default: 0, min: 0 },
  productClicks: { type: Number, default: 0, min: 0 },
  storeClicks: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: 'style_videos' });
schema.index({ businessId: 1, createdAt: -1 });
module.exports = mongoose.models.StyleVideo || mongoose.model('StyleVideo', schema);
