const mappingService = require('../services/mappingService');

class MappingController {
  async lookup(req, res, next) {
    try {
      const { code, type } = req.query;
      const result = await mappingService.lookupCrosswalk(code, type);
      if (!result.found) {
        return res.status(404).json(result);
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async search(req, res, next) {
    try {
      const { term } = req.query;
      const result = await mappingService.searchTerminology(term);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getCandidates(req, res, next) {
    try {
      let { term } = req.query;
      
      if (term === undefined) {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'term' is required."
        });
      }
      
      term = term.trim();
      
      if (!term) {
        return res.status(400).json({
          success: false,
          message: "Query parameter 'term' cannot be empty."
        });
      }

      const result = await mappingService.findMappingCandidates(term);
      
      res.status(200).json({
        success: true,
        query: term,
        count: result.candidates.length,
        candidates: result.candidates
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyCandidate(req, res, next) {
    try {
      const { namcId, whoEntityUri, relationshipType } = req.body;
      const validRelationships = ['equivalent', 'broader', 'narrower', 'related'];

      if (!validRelationships.includes(relationshipType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid relationship type.'
        });
      }

      const userId = req.user?.id;
      const clinicId = req.user?.clinicId;
      const result = await mappingService.verifyMappingCandidate(
        { namcId, whoEntityUri, relationshipType, clinicId },
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Mapping verified successfully.',
        mapping: result
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async verifyOfficialCode(req, res, next) {
    try {
      const { namcId, whoEntityUri, icd11Tm2Code, relationshipType } = req.body;
      const validRelationships = ['equivalent', 'broader', 'narrower', 'related'];

      if (!validRelationships.includes(relationshipType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid relationship type.'
        });
      }

      const userId = req.user?.id;
      const clinicId = req.user?.clinicId;
      const result = await mappingService.verifyMappingWithOfficialCode(
        { namcId, whoEntityUri, icd11Tm2Code, relationshipType, clinicId },
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Official code confirmed and verified successfully.',
        mapping: result
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async confirm(req, res, next) {
    try {
      const mapping = await mappingService.confirmMapping(
        { ...req.body, clinicId: req.user?.clinicId },
        req.user?.id
      );
      res.status(201).json(mapping);
    } catch (err) {
      next(err);
    }
  }

  async getRecent(req, res, next) {
    try {
      const { limit } = req.query;
      const clinicId = req.user?.clinicId;
      const recent = await mappingService.getRecentMappings(limit, clinicId);
      res.status(200).json(recent);
    } catch (err) {
      next(err);
    }
  }

  async getStats(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const stats = await mappingService.getStats(clinicId);
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
