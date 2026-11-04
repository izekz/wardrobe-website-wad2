const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['consumer', 'business', 'admin'], default: 'consumer' },
  suspended: { type: Boolean, default: false },
  preferredStyles: [{ type: String, enum: ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Preppy', 'Classic', 'Romantic', 'Formal', 'Casual'] }],
  activities: [{ type: String, enum: ['University', 'Presentation', 'Interview', 'Date', 'Internship / work', 'Casual outings', 'Formal events'] }],
  budget: { type: Number, min: 10, max: 100, default: 40 },
  // Private account-owned shopping state. Never included in publicUser/session JSON.
  likedProducts: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [], select: false },
  cartItems: { type: [new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    size: { type: String, default: '', maxlength: 20 },
    colour: { type: String, default: '', maxlength: 20 },
    quantity: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger }
  }, { _id: false })], default: [], select: false },
  // Account-owned products collected for outfit planning; separate from the shopping cart.
  plannerProducts: { type: [new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    colour: { type: String, default: '', maxlength: 20 },
    size: { type: String, default: '', maxlength: 20 }
  }, { _id: false })], default: [], select: false },
  surveyCompleted: { type: Boolean, default: false }
}, { timestamps: true, collection: 'users' });
module.exports = mongoose.models.User || mongoose.model('User', schema);
