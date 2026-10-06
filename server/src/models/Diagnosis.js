const mongoose = require('mongoose');

const diagnosisSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    subtitle: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    system: {
      type: String,
      required: true,
      enum: ['ayurveda', 'yoga', 'unani', 'siddha', 'homeopathy'],
      lowercase: true,
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
    fhirStatus: {
      type: String,
      enum: ['full', 'partial'],
      default: 'full'
    }
  },
  {
    timestamps: true
  }
);

diagnosisSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

diagnosisSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Diagnosis', diagnosisSchema);
