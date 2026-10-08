const mongoose = require('mongoose');
const { STYLES } = require('../communityValidation');
const schema = new mongoose.Schema({
  consumerId: { type: String, required: true, maxlength: 100 },
  consumerName: { type: String, required: true, maxlength: 100 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  occasion: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  budget: { type: Number, required: true, min: 0, max: 100000 },
  preferredStyle: { type: String, required: true, enum: STYLES },
  deadline: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  clientRequestId: { type: String, required: true }
}, { timestamps: true, collection: 'outfit_requests' });
schema.index({ consumerId: 1, clientRequestId: 1 }, { unique: true });
schema.index({ createdAt: -1 });
module.exports = mongoose.models.OutfitRequest || mongoose.model('OutfitRequest', schema);
