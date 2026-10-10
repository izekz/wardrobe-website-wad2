const mongoose = require('mongoose');
// Contract for Person 4. This update reads replies; their business handler writes them.
const schema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'OutfitRequest', required: true },
  businessId: { type: String, required: true },
  businessName: { type: String, required: true, maxlength: 100 },
  productId: { type: String, required: true },
  productName: { type: String, required: true, maxlength: 100 },
  productPrice: { type: Number, required: true, min: 0 },
  message: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true, collection: 'request_responses' });
schema.index({ requestId: 1, createdAt: -1 });
module.exports = mongoose.models.RequestResponse || mongoose.model('RequestResponse', schema);
