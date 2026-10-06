const mongoose = require('mongoose');

const mappingSchema = new mongoose.Schema(
  {
    searchTerm: {
      type: String,
      required: true,
      trim: true
    },
    namasteCode: {
      type: String,
      required: true,
      trim: true
    },
    icd11Tm2Code: {
      type: String,
      required: true,
      trim: true
    },
    icd11BioCode: {
      type: String,
      trim: true,
      default: ''
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 90
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true
    },
    status: {
      type: String,
      enum: ['confirmed', 'suggested', 'unmapped', 'rejected'],
      default: 'confirmed'
    },
    confirmedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

mappingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

mappingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Mapping', mappingSchema);
