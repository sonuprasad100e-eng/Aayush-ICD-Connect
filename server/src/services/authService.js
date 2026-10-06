const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const auditService = require('./auditService');

class AuthService {
  async login({ identifier, password, remember_me }) {
    if (!identifier || !password) {
      throw { status: 400, message: 'Invalid Email/ABHA ID or Password.' };
    }

    const trimmed = identifier.trim().toLowerCase();

    // Query user by email (lowercase) or abhaId
    const user = await User.findOne({
      $or: [{ email: trimmed }, { abhaId: identifier.trim() }]
    }).select('+passwordHash');

    if (!user) {
      throw { status: 401, message: 'Invalid Email/ABHA ID or Password.' };
    }

    if (user.isActive === false) {
      throw { status: 403, message: 'User account is deactivated. Please contact administrator.' };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid Email/ABHA ID or Password.' };
    }

    // Ensure user has an associated clinicId
    if (!user.clinicId) {
      let clinic = await Clinic.findOne({ email: user.email });
      if (!clinic) {
        clinic = await Clinic.findOne({ userId: user._id });
      }
      if (!clinic) {
        clinic = await Clinic.findOne({ email: 'doctor@caresync.in' }) || await Clinic.findOne();
      }
      if (clinic) {
        user.clinicId = clinic._id;
        user.clinicName = clinic.clinicName;
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    const expiresIn = remember_me ? env.JWT_EXPIRES_REMEMBER : env.JWT_EXPIRES_DEFAULT;
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        id: user._id.toString(),
        role: user.role,
        clinicId: user.clinicId ? user.clinicId.toString() : null,
        email: user.email
      },
      env.JWT_SECRET,
      { expiresIn }
    );

    // Audit log
    await auditService.log({
      userId: user._id,
      clinicId: user.clinicId,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user._id.toString()
    });

    return {
      access_token: token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId ? user.clinicId.toString() : null,
        clinicName: user.clinicName || '',
        specialization: user.specialization,
        abhaId: user.abhaId,
        photoUrl: user.photoUrl,
        profilePhotoUrl: user.photoUrl,
        isActive: user.isActive !== false
      }
    };
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId ? user.clinicId.toString() : null,
      clinicName: user.clinicName || '',
      specialization: user.specialization,
      abhaId: user.abhaId,
      phone: user.phone || '',
      clinicAddress: user.clinicAddress || '',
      city: user.city || '',
      state: user.state || '',
      pincode: user.pincode || '',
      photoUrl: user.photoUrl,
      profilePhotoUrl: user.photoUrl,
      isActive: user.isActive !== false,
      lastLoginAt: user.lastLoginAt,
      preferences: user.preferences,
      notificationSettings: user.notificationSettings
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw { status: 400, message: 'Current password does not match.' };
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();

    return { success: true, message: 'Password updated successfully.' };
  }

  async registerClinic(data) {
    const {
      clinicName,
      doctorName,
      name,
      email,
      phone,
      abhaId,
      address,
      clinicAddress,
      city,
      state,
      pincode,
      specialization,
      password
    } = data;

    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) {
      throw { status: 400, message: 'Valid email is required.' };
    }

    if (!password || password.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long.' };
    }

    // Check duplicate email in User or Clinic
    const [existingUser, existingClinic] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      Clinic.findOne({ email: normalizedEmail })
    ]);

    if (existingUser || existingClinic) {
      throw { status: 400, message: 'An account with this email address already exists.' };
    }

    // Check duplicate ABHA ID if provided
    const trimmedAbha = (abhaId || '').trim();
    if (trimmedAbha) {
      const [abhaUser, abhaClinic] = await Promise.all([
        User.findOne({ abhaId: trimmedAbha }),
        Clinic.findOne({ abhaId: trimmedAbha })
      ]);

      if (abhaUser || abhaClinic) {
        throw { status: 400, message: 'An account with this ABHA ID is already registered.' };
      }
    }

    // Hash password using bcrypt with cost 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const docName = (doctorName || name || 'Doctor').trim();
    const finalClinicName = (clinicName || `${docName}'s Clinic`).trim();
    const finalAddress = (address || clinicAddress || '').trim();
    const finalSpecialization = (specialization || 'Ayurveda Physician').trim();

    // Create User record in MongoDB Atlas
    const user = new User({
      name: docName,
      email: normalizedEmail,
      passwordHash,
      abhaId: trimmedAbha || '',
      specialization: finalSpecialization,
      phone: (phone || '').trim(),
      clinicName: finalClinicName,
      clinicAddress: finalAddress,
      city: (city || '').trim(),
      state: (state || '').trim(),
      pincode: (pincode || '').trim(),
      role: 'doctor'
    });

    await user.save();

    // Create Clinic record in MongoDB Atlas
    const clinic = new Clinic({
      clinicName: finalClinicName,
      doctorName: docName,
      email: normalizedEmail,
      phone: (phone || '').trim(),
      abhaId: trimmedAbha || '',
      address: finalAddress,
      city: (city || '').trim(),
      state: (state || '').trim(),
      pincode: (pincode || '').trim(),
      specialization: finalSpecialization,
      userId: user._id
    });

    await clinic.save();

    // Associate clinic with user
    user.clinicId = clinic._id;
    await user.save();

    // Return safe response without password or passwordHash
    return {
      success: true,
      message: 'Clinic registered successfully. You may now sign in.',
      clinic: {
        id: clinic._id.toString(),
        clinicName: clinic.clinicName,
        doctorName: clinic.doctorName,
        email: clinic.email,
        phone: clinic.phone,
        city: clinic.city,
        state: clinic.state,
        specialization: clinic.specialization
      }
    };
  }

  async registerUser(userData) {
    return this.registerClinic(userData);
  }
}

module.exports = new AuthService();
