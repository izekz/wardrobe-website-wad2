const mongoose = require('mongoose');
// Wallet history. amount is positive for coins in and negative for coins spent.
const schema = new mongoose.Schema({
  businessId: { type: String, required: true },
  type: { type: String, enum: ['starting', 'purchase', 'boost', 'premium', 'extra-listing'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  productId: String,
  note: { type: String, maxlength: 200 }
}, { timestamps: { createdAt: 'timestamp', updatedAt: false }, collection: 'coin_transactions' });
schema.index({ businessId: 1, timestamp: -1 });
module.exports = mongoose.models.CoinTransaction || mongoose.model('CoinTransaction', schema);
