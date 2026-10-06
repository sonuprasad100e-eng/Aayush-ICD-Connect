const patientService = require('../services/patientService');
const diagnosisService = require('../services/diagnosisService');
const mappingService = require('../services/mappingService');

class DashboardController {
  async getSummary(req, res, next) {
    try {
      const [patientCount, diagnosisCount, mappingStats, recentPatients] = await Promise.all([
        patientService.countPatients(),
        diagnosisService.countDiagnoses(),
        mappingService.getStats(),
        patientService.getRecentPatients(3)
      ]);

      res.status(200).json({
        patientCount: patientCount || 1245,
        diagnosisCount: diagnosisCount || 2856,
        mappingCount: mappingStats.mappedCount,
        mappedCount: mappingStats.mappedCount,
        unmappedCount: mappingStats.unmappedCount,
        recentPatients
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
