const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    period: {
      type: String,
      required: true,
      trim: true
    },
    generatedOn: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['morbidity', 'claims', 'mapping-audit'],
      required: true
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

reportSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

reportSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Report', reportSchema);
