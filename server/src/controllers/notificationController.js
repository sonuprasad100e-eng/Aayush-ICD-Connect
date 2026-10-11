const notificationService = require('../services/notificationService');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const data = await notificationService.getNotifications(req.user);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(req.params.id, req.user);
      res.status(200).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
