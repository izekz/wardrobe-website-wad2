const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['consumer', 'business', 'admin'], default: 'consumer' },
  suspended: { type: Boolean, default: false }
}, { timestamps: true, collection: 'users' });
module.exports = mongoose.models.User || mongoose.model('User', schema);
