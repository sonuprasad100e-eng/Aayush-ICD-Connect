const Patient = require('../models/Patient');
const Mapping = require('../models/Mapping');

class DashboardService {
  async getSummary(clinicId) {
    if (!clinicId) {
      return {
        patientCount: 0,
        totalPatients: 0,
        diagnosisCount: 0,
        totalDiagnoses: 0,
        mappingCount: 0,
        totalMappings: 0,
        mappedCount: 0,
        confirmedMappings: 0,
        suggestedMappings: 0,
        unmappedCount: 0,
        unmappedMappings: 0,
        mappingRate: 0,
        recentPatients: []
      };
    }

    const [
      patientCount,
      diagnosisCount,
      recentPatients,
      totalMappings,
      confirmedMappings,
      suggestedMappings,
      unmappedMappings
    ] = await Promise.all([
      Patient.countDocuments({ clinicId, isDeleted: false, isArchived: false }),
      Patient.countDocuments({ clinicId, namasteCode: { $exists: true, $ne: '' }, isDeleted: false, isArchived: false }),
      Patient.find({ clinicId, isDeleted: false, isArchived: false })
        .sort({ createdAt: -1 })
        .limit(3),
      Mapping.countDocuments({ clinicId }),
      Mapping.countDocuments({ clinicId, status: { $in: ['confirmed', undefined] } }),
      Mapping.countDocuments({ clinicId, status: 'suggested' }),
      Mapping.countDocuments({ clinicId, status: 'unmapped' })
    ]);

    const totalCalculated = confirmedMappings + unmappedMappings;
    const mappingRate = totalCalculated > 0 ? Math.round((confirmedMappings / totalCalculated) * 100) : (totalMappings > 0 ? 100 : 0);

    return {
      patientCount,
      totalPatients: patientCount,
      diagnosisCount,
      totalDiagnoses: diagnosisCount,
      mappingCount: totalMappings,
      totalMappings,
      mappedCount: confirmedMappings,
      confirmedMappings,
      suggestedMappings,
      unmappedCount: unmappedMappings,
      unmappedMappings,
      mappingRate,
      recentPatients
    };
  }
}

module.exports = new DashboardService();
