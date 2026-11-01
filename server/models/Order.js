const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true, unique: true },
  items: [{ productId: String, businessId: String, name: String, price: Number, quantity: Number, size: String, colour: String }],
  subtotal: { type: Number, required: true, min: 0 },
  delivery: { name: String, email: String, address: String, postal: String },
  payment: { method: { type: String, default: 'demo-card' }, last4: String, cardholder: String },
  status: { type: String, enum: ['paid', 'cancelled'], default: 'paid' }
}, { timestamps: true, collection: 'orders' });
module.exports = mongoose.models.Order || mongoose.model('Order', schema);
