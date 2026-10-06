const mappingService = require('../services/mappingService');

class MappingController {
  async search(req, res, next) {
    try {
      const { term } = req.query;
      const result = await mappingService.searchAyush(term);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async confirm(req, res, next) {
    try {
      const mapping = await mappingService.confirmMapping(req.body, req.user?.id);
      res.status(201).json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async getRecent(req, res, next) {
    try {
      const { limit } = req.query;
      const recent = await mappingService.getRecentMappings(limit);
      res.status(200).json(recent);
    } catch (err) {
      next(err);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await mappingService.getStats();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  }

  async bulkUpload(req, res, next) {
    try {
      const result = await mappingService.processBulkUpload(req.file);
      res.status(200).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }
}

module.exports = new MappingController();
