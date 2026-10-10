const mongoose = require('mongoose');
const { CATEGORIES, STYLES, MAX_PHOTO_BYTES } = require('../communityValidation');

// Person 4 writes store products. Person 1's Store and Product Detail pages read them.
const schema = new mongoose.Schema({
  businessId: { type: String, required: true, maxlength: 100 },
  businessName: { type: String, required: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  price: { type: Number, required: true, min: 0, max: 100000 },
  style: { type: String, enum: STYLES, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  occasions: [{ type: String, trim: true, maxlength: 40 }],
  sizes: [{ type: String, trim: true, maxlength: 20 }],
  stock: { type: Number, required: true, min: 0, max: 100000 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  // Paid placements. The *Until dates let promotions expire after 7 days.
  boosted: { type: Boolean, default: false },
  boostedUntil: Date,
  premium: { type: Boolean, default: false },
  premiumUntil: Date,
  views: { type: Number, default: 0, min: 0 },
  photo: {
    data: { type: Buffer, required: true, select: false, validate: value => value.length <= MAX_PHOTO_BYTES },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true }
  }
}, { timestamps: true, collection: 'products' });
schema.index({ businessId: 1, createdAt: -1 });
schema.index({ status: 1, premium: -1, boosted: -1, createdAt: -1 });
module.exports = mongoose.models.Product || mongoose.model('Product', schema);
