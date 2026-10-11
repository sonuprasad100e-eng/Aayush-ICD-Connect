const mongoose = require('mongoose');

const mappingEvidenceSchema = new mongoose.Schema(
  {
    queryTerm: { type: String, trim: true },
    namcId: { type: String, trim: true },
    namcCode: { type: String, trim: true },
    namcTerm: { type: String, trim: true },

    candidateIcd11Tm2Code: { type: String, trim: true },
    candidateIcd11Term: { type: String, trim: true },
    whoEntityUri: { type: String, trim: true },
    whoRelease: { type: String, trim: true },

    matchedSynonyms: [{ type: String, trim: true }],

    retrievalMethod: {
      type: String,
      enum: ['bm25', 'semantic', 'hybrid']
    },
    retrievalScore: { type: Number },

    evidenceSource: {
      type: String,
      enum: ['NAMC', 'WHO_FOUNDATION', 'WHO_MMS', 'CURATED']
    },

    status: {
      type: String,
      enum: ['candidate', 'confirmed', 'rejected'],
      default: 'candidate'
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

mappingEvidenceSchema.index({ namcCode: 1 });
mappingEvidenceSchema.index({ candidateIcd11Tm2Code: 1 });
mappingEvidenceSchema.index({ status: 1 });

mappingEvidenceSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

mappingEvidenceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('MappingEvidence', mappingEvidenceSchema);
