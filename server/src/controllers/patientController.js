const patientService = require('../services/patientService');
const fhirService = require('../services/fhirService');

class PatientController {
  async getPatients(req, res, next) {
    try {
      const { search, status, page, limit } = req.query;
      const result = await patientService.getPatients({
        clinicId: req.user.clinicId,
        search,
        status,
        page,
        limit
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPatientById(req, res, next) {
    try {
      const patient = await patientService.getPatientById(req.params.id, req.user.clinicId);
      res.status(200).json(patient);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async createPatient(req, res, next) {
    try {
      const patient = await patientService.createPatient(req.body, req.user);
      res.status(201).json(patient);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async updatePatient(req, res, next) {
    try {
      const patient = await patientService.updatePatient(req.params.id, req.body, req.user);
      res.status(200).json(patient);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async deletePatient(req, res, next) {
    try {
      const result = await patientService.deletePatient(req.params.id, req.user);
      res.status(200).json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }

  async getFhirResource(req, res, next) {
    try {
      const patient = await patientService.getPatientById(req.params.id, req.user.clinicId);
      const condition = fhirService.buildConditionResource(patient);
      res.status(200).json(condition);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message });
      }
      next(err);
    }
  }
}

module.exports = new PatientController();
