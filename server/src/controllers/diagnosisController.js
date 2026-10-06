const diagnosisService = require('../services/diagnosisService');

class DiagnosisController {
  async getDiagnoses(req, res, next) {
    try {
      const { system, search } = req.query;
      const diagnoses = await diagnosisService.getDiagnoses({ system, search });
      res.status(200).json(diagnoses);
    } catch (err) {
      next(err);
    }
  }

  async getDiagnosisById(req, res, next) {
    try {
      const diagnosis = await diagnosisService.getDiagnosisById(req.params.id);
      res.status(200).json(diagnosis);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async createDiagnosis(req, res, next) {
    try {
      const diagnosis = await diagnosisService.createDiagnosis(req.body);
      res.status(201).json(diagnosis);
    } catch (err) {
      next(err);
    }
  }

  async updateDiagnosis(req, res, next) {
    try {
      const diagnosis = await diagnosisService.updateDiagnosis(req.params.id, req.body);
      res.status(200).json(diagnosis);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async deleteDiagnosis(req, res, next) {
    try {
      const result = await diagnosisService.deleteDiagnosis(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }
}

module.exports = new DiagnosisController();
