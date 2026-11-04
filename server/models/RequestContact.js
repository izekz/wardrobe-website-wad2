const mongoose = require('mongoose');
// In-app, request-specific business/customer conversation. Never exposes email/phone.
const schema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'OutfitRequest', required: true },
  customerId: { type: String, required: true },
  businessId: { type: String, required: true },
  businessName: { type: String, required: true, maxlength: 100 },
  senderRole: { type: String, enum: ['business', 'customer'], required: true },
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: 600 }
}, { timestamps: true, collection: 'request_contacts' });
schema.index({ requestId: 1, businessId: 1, createdAt: 1 });
module.exports = mongoose.models.RequestContact || mongoose.model('RequestContact', schema);
