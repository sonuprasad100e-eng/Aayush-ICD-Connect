const mongoose = require('mongoose');

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      trim: true
    },
    totalDiagnoses: {
      type: Number,
      required: true,
      default: 2856
    },
    claimsApproved: {
      type: Number,
      required: true,
      default: 96
    },
    claimsRejected: {
      type: Number,
      required: true,
      default: 4.2
    },
    codesMappedYtd: {
      type: Number,
      required: true,
      default: 1024
    },
    systemBreakdown: {
      ayurveda: { type: Number, default: 75.6 },
      yoga: { type: Number, default: 40.0 },
      unani: { type: Number, default: 11.1 },
      siddha: { type: Number, default: 11.1 },
      homeopathy: { type: Number, default: 40.0 }
    }
  },
  {
    timestamps: true
  }
);

analyticsSnapshotSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

analyticsSnapshotSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);
