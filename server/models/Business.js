const mongoose = require('mongoose');
const { STYLES } = require('../communityValidation');

// Person 4: one business profile per business-role user account.
const schema = new mongoose.Schema({
  ownerId: { type: String, required: true, unique: true, maxlength: 100 },
  businessName: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  styles: { type: [{ type: String, enum: STYLES }], validate: value => value.length > 0 },
  contact: { type: String, required: true, trim: true, maxlength: 120 },
  // Every new business starts with 100 coins.
  coins: { type: Number, default: 100, min: 0 },
  logo: {
    data: { type: Buffer, select: false },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] }
  }
}, { timestamps: true, collection: 'businesses' });
module.exports = mongoose.models.Business || mongoose.model('Business', schema);
