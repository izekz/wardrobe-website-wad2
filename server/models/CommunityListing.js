const mongoose = require('mongoose');
const { CATEGORIES, STYLES, CONDITIONS, MAX_PHOTO_BYTES } = require('../communityValidation');

// The item and photo are saved together in one MongoDB document.
const schema = new mongoose.Schema({
  ownerId: { type: String, required: true, maxlength: 100 },
  ownerName: { type: String, required: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, enum: CATEGORIES, required: true },
  style: { type: String, enum: STYLES, required: true },
  size: { type: String, required: true, trim: true, maxlength: 20 },
  condition: { type: String, enum: CONDITIONS, required: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  listingType: { type: String, enum: ['sell', 'rent'], required: true },
  price: { type: Number, min: 0, max: 100000, required() { return this.listingType === 'sell'; } },
  rentalPrice: { type: Number, min: 0, max: 100000, required() { return this.listingType === 'rent'; } },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  clientRequestId: { type: String, required: true },
  photo: {
    // Normal feed queries omit the bytes. A separate image URL returns them.
    data: { type: Buffer, required: true, select: false, validate: value => value.length <= MAX_PHOTO_BYTES },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true }
  }
}, { timestamps: true, collection: 'community_listings' });
schema.index({ ownerId: 1, clientRequestId: 1 }, { unique: true });
schema.index({ createdAt: -1 });
module.exports = mongoose.models.CommunityListing || mongoose.model('CommunityListing', schema);
