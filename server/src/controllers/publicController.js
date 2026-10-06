const publicService = require('../services/publicService');

class PublicController {
  async getStats(req, res, next) {
    try {
      const stats = await publicService.getStats();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicController();
