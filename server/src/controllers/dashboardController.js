const dashboardService = require('../services/dashboardService');

class DashboardController {
  async getSummary(req, res, next) {
    try {
      const clinicId = req.user && req.user.clinicId;
      if (!clinicId) {
        return res.status(403).json({ detail: 'Clinic association required. Authenticated user must belong to a valid clinic.' });
      }

      const summary = await dashboardService.getSummary(clinicId);

      res.status(200).json({
        success: true,
        patientCount: summary.patientCount,
        totalPatients: summary.totalPatients,
        diagnosisCount: summary.diagnosisCount,
        totalDiagnoses: summary.totalDiagnoses,
        mappingCount: summary.mappingCount,
        totalMappings: summary.totalMappings,
        mappedCount: summary.mappedCount,
        confirmedMappings: summary.confirmedMappings,
        suggestedMappings: summary.suggestedMappings,
        unmappedCount: summary.unmappedCount,
        unmappedMappings: summary.unmappedMappings,
        mappingRate: summary.mappingRate,
        recentPatients: summary.recentPatients,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
