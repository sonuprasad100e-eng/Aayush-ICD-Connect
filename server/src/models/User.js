const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Dr. Sonu'
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    abhaId: {
      type: String,
      trim: true,
      default: ''
    },
    specialization: {
      type: String,
      trim: true,
      default: 'Ayurveda Physician'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    clinicName: {
      type: String,
      trim: true,
      default: ''
    },
    clinicAddress: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic'
    },
    photoUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80'
    },
    role: {
      type: String,
      enum: ['admin', 'doctor', 'staff'],
      default: 'doctor'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    preferences: {
      language: { type: String, default: 'English' },
      defaultAyushSystem: { type: String, default: 'Ayurveda' },
      darkMode: { type: Boolean, default: false }
    },
    notificationSettings: {
      criticalAlerts: { type: Boolean, default: true },
      claimUpdates: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false }
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Virtual for id
userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Virtual for profilePhotoUrl
userSchema.virtual('profilePhotoUrl').get(function () {
  return this.photoUrl;
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    ret.profilePhotoUrl = ret.photoUrl;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
