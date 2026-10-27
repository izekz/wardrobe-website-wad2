const mongoose = require('mongoose');
// Demonstration checkout only: no card, payment gateway or real charge.
const schema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'OutfitRequest', required: true, unique: true },
  responseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RequestResponse', required: true },
  consumerId: { type: String, required: true },
  businessId: { type: String, required: true },
  businessName: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  size: { type: String, required: true, maxlength: 20 },
  colour: { type: String, required: true, maxlength: 30 },
  material: { type: String, required: true, maxlength: 50 },
  wardrobeItemId: { type: String, required: true },
  mode: { type: String, enum: ['demo'], default: 'demo' },
}, { timestamps: true, collection: 'request_purchases' });
schema.index({ consumerId: 1, createdAt: -1 });
module.exports = mongoose.models.RequestPurchase || mongoose.model('RequestPurchase', schema);
