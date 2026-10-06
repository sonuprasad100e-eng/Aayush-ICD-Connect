const settingsService = require('../services/settingsService');

class SettingsController {
  async getSettings(req, res, next) {
    try {
      const settings = await settingsService.getSettings(req.user.id);
      res.status(200).json(settings);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const user = await settingsService.updateProfile(req.user.id, req.body);
      res.status(200).json({
        message: 'Profile updated successfully',
        profile: {
          name: user.name,
          specialization: user.specialization,
          email: user.email,
          abhaId: user.abhaId,
          photoUrl: user.photoUrl
        }
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async uploadPhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ detail: 'Please upload an image file (JPG or PNG, max 2MB).' });
      }

      const photoUrl = `/uploads/${req.file.filename}`;
      await settingsService.updatePhoto(req.user.id, photoUrl);

      res.status(200).json({
        message: 'Profile photo updated successfully',
        photoUrl
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSecurity(req, res, next) {
    try {
      const user = await settingsService.updateSecurity(req.user.id, req.body);
      res.status(200).json({
        message: 'Security settings updated',
        twoFactorEnabled: user.twoFactorEnabled
      });
    } catch (err) {
      next(err);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const prefs = await settingsService.updatePreferences(req.user.id, req.body);
      res.status(200).json({
        message: 'Preferences updated',
        preferences: prefs
      });
    } catch (err) {
      next(err);
    }
  }

  async updateNotifications(req, res, next) {
    try {
      const notifs = await settingsService.updateNotifications(req.user.id, req.body);
      res.status(200).json({
        message: 'Notification settings updated',
        notifications: notifs
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SettingsController();
