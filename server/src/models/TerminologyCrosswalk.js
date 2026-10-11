const mongoose = require('mongoose');

const terminologyCrosswalkSchema = new mongoose.Schema(
  {
    namcCode: {
      type: String,
      trim: true,
      default: ''
    },
    namcId: {
      type: String,
      trim: true
    },
    ayushTerm: {
      type: String,
      required: true,
      trim: true
    },
    system: {
      type: String,
      required: true,
      enum: ['Ayurveda', 'Yoga', 'Unani', 'Siddha', 'Homeopathy'],
      trim: true
    },
    icd11Tm2Code: {
      type: String,
      trim: true
    },
    icd11Term: {
      type: String,
      required: true,
      trim: true
    },
    whoEntityUri: { type: String, trim: true },
    whoParentUri: { type: String, trim: true },
    whoRelease: { type: String, trim: true },
    whoSynonyms: [{ type: String, trim: true }],
    source: {
      type: String,
      trim: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: { type: Date },
    verificationMethod: {
      type: String,
      enum: ['manual', 'official_crosswalk', 'curated_dataset', 'WHO_ICD11_CODING_TOOL_DOCTOR_REVIEW']
    },
    relationshipType: {
      type: String,
      enum: ['equivalent', 'broader', 'narrower', 'related']
    },
    confidenceScore: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

terminologyCrosswalkSchema.index({ ayushTerm: 'text' });
terminologyCrosswalkSchema.index({ namcCode: 1 });
terminologyCrosswalkSchema.index({ icd11Tm2Code: 1 });
terminologyCrosswalkSchema.index({ system: 1 });

terminologyCrosswalkSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

terminologyCrosswalkSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('TerminologyCrosswalk', terminologyCrosswalkSchema);
