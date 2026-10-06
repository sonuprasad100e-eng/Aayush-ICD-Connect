const authService = require('../services/authService');

class AuthController {
  async login(req, res, next) {
    try {
      const { identifier, password, remember_me } = req.body;
      const result = await authService.login({ identifier, password, remember_me });
      res.status(200).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async register(req, res, next) {
    try {
      const result = await authService.registerClinic(req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message, message: err.message });
      }
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      res.status(200).json({ message: 'Logged out successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
