const User = require('../models/User');

class SettingsService {
  async getSettings(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }

    return {
      profile: {
        name: user.name,
        specialization: user.specialization,
        email: user.email,
        abhaId: user.abhaId,
        photoUrl: user.photoUrl
      },
      security: {
        passwordLastChanged: user.passwordChangedAt,
        abhaConnected: true,
        twoFactorEnabled: user.twoFactorEnabled
      },
      preferences: {
        language: user.preferences?.language || 'English',
        defaultAyushSystem: user.preferences?.defaultAyushSystem || 'Ayurveda',
        darkMode: user.preferences?.darkMode || false
      },
      notifications: {
        criticalAlerts: user.notificationSettings?.criticalAlerts ?? true,
        claimUpdates: user.notificationSettings?.claimUpdates ?? true,
        weeklySummary: user.notificationSettings?.weeklySummary ?? false
      }
    };
  }

  async updateProfile(userId, data) {
    const { name, specialization, email, abhaId } = data;
    const update = {};
    if (name) update.name = name;
    if (specialization) update.specialization = specialization;
    if (email) update.email = email.toLowerCase().trim();
    if (abhaId) update.abhaId = abhaId;

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return user;
  }

  async updatePhoto(userId, photoUrl) {
    const user = await User.findByIdAndUpdate(userId, { $set: { photoUrl } }, { new: true });
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return user;
  }

  async updateSecurity(userId, data) {
    const { twoFactorEnabled } = data;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { twoFactorEnabled: Boolean(twoFactorEnabled) } },
      { new: true }
    );
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return user;
  }

  async updatePreferences(userId, data) {
    const { language, defaultAyushSystem, darkMode } = data;
    const update = {};
    if (language !== undefined) update['preferences.language'] = language;
    if (defaultAyushSystem !== undefined) update['preferences.defaultAyushSystem'] = defaultAyushSystem;
    if (darkMode !== undefined) update['preferences.darkMode'] = Boolean(darkMode);

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return user.preferences;
  }

  async updateNotifications(userId, data) {
    const { criticalAlerts, claimUpdates, weeklySummary } = data;
    const update = {};
    if (criticalAlerts !== undefined) update['notificationSettings.criticalAlerts'] = Boolean(criticalAlerts);
    if (claimUpdates !== undefined) update['notificationSettings.claimUpdates'] = Boolean(claimUpdates);
    if (weeklySummary !== undefined) update['notificationSettings.weeklySummary'] = Boolean(weeklySummary);

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!user) {
      throw { status: 404, message: 'User not found.' };
    }
    return user.notificationSettings;
  }
}

module.exports = new SettingsService();
