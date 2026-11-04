const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['listing', 'request', 'video'],
    required: true,
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: function () {
      const models = {
        listing: 'Product',
        request: 'OutfitRequest',
        video: 'StyleVideo',
      }

      return models[this.targetType]
    },
    required: true,
  },
  listingName: {
    type: String,
    required: true,
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reporterName: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    enum: [
      'Misleading information',
      'Inappropriate content',
      'Suspected scam',
      'Other',
    ],
    required: true,
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
  },
  reviewNote: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
}, {
  timestamps: true,
  collection: 'reports',
})

schema.index(
  { reporterId: 1, listingId: 1 },
  { unique: true }
)

module.exports =
  mongoose.models.Report || mongoose.model('Report', schema)