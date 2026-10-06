const Diagnosis = require('../models/Diagnosis');

class DiagnosisService {
  async getDiagnoses({ system = '', search = '' }) {
    const query = {};

    if (system && system !== 'All Systems' && system.toLowerCase() !== 'all') {
      const normalized = system.toLowerCase().includes('yoga') ? 'yoga' : system.toLowerCase();
      query.system = normalized;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { subtitle: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { namasteCode: { $regex: term, $options: 'i' } },
        { icd11Tm2Code: { $regex: term, $options: 'i' } }
      ];
    }

    return Diagnosis.find(query).sort({ createdAt: 1 });
  }

  async getDiagnosisById(id) {
    const diag = await Diagnosis.findById(id);
    if (!diag) {
      throw { status: 404, message: 'Diagnosis not found.' };
    }
    return diag;
  }

  async createDiagnosis(data) {
    const diag = new Diagnosis(data);
    await diag.save();
    return diag;
  }

  async updateDiagnosis(id, data) {
    const diag = await Diagnosis.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    if (!diag) {
      throw { status: 404, message: 'Diagnosis not found.' };
    }
    return diag;
  }

  async deleteDiagnosis(id) {
    const diag = await Diagnosis.findByIdAndDelete(id);
    if (!diag) {
      throw { status: 404, message: 'Diagnosis not found.' };
    }
    return { success: true, message: 'Diagnosis removed successfully.' };
  }

  async countDiagnoses() {
    return Diagnosis.countDocuments();
  }
}

module.exports = new DiagnosisService();
