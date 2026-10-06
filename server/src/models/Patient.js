const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    patientCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      required: true
    },
    avatarUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80'
    },
    diagnosisLabel: {
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
    status: {
      type: String,
      enum: ['stable', 'critical', 'review'],
      default: 'stable'
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

patientSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

patientSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Patient', patientSchema);
