const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const auditService = require('./auditService');

class PatientService {
  async getPatients({ clinicId, search = '', status = '', page = 1, limit = 10 }) {
    if (!clinicId) {
      return { patients: [], total: 0, page: 1, totalPages: 1 };
    }

    const query = {
      clinicId,
      isDeleted: false,
      isArchived: false
    };

    if (status && status !== 'All Status') {
      const normalizedStatus = status.toLowerCase() === 'under review' ? 'review' : status.toLowerCase();
      query.status = normalizedStatus;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { patientCode: { $regex: term, $options: 'i' } },
        { diagnosisLabel: { $regex: term, $options: 'i' } },
        { namasteCode: { $regex: term, $options: 'i' } },
        { icd11Tm2Code: { $regex: term, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const [patients, total] = await Promise.all([
      Patient.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Patient.countDocuments(query)
    ]);

    return {
      patients,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    };
  }

  async getRecentPatients(clinicId, limit = 3) {
    if (!clinicId) return [];
    return Patient.find({ clinicId, isDeleted: false, isArchived: false })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10) || 3);
  }

  async getPatientById(id, clinicId) {
    if (!id) {
      throw { status: 400, message: 'Patient ID is required.' };
    }
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      isDeleted: false,
      ...(isObjectId ? { $or: [{ _id: id }, { patientCode: id }] } : { patientCode: id })
    };

    const patient = await Patient.findOne(query);

    if (!patient) {
      throw { status: 404, message: 'Patient not found.' };
    }

    // Verify clinic isolation
    if (clinicId && patient.clinicId && patient.clinicId.toString() !== clinicId.toString()) {
      throw { status: 403, message: 'Forbidden: You do not have permission to access patient records from another clinic.' };
    }

    return patient;
  }

  async createPatient(data, user) {
    if (!user || !user.clinicId) {
      throw { status: 403, message: 'Authenticated user must belong to a valid clinic.' };
    }

    let patientCode = data.patientCode;
    if (!patientCode) {
      const count = await Patient.countDocuments({ clinicId: user.clinicId });
      patientCode = `P${String(count + 1).padStart(3, '0')}`;
    }

    // Never trust frontend for clinicId, createdBy, or updatedBy
    const safeData = { ...data };
    delete safeData.clinicId;
    delete safeData.createdBy;
    delete safeData.updatedBy;

    const patient = new Patient({
      ...safeData,
      patientCode,
      clinicId: user.clinicId,
      createdBy: user._id || user.id,
      updatedBy: user._id || user.id
    });

    await patient.save();

    await auditService.log({
      userId: user._id || user.id,
      clinicId: user.clinicId,
      action: 'CREATE_PATIENT',
      entityType: 'Patient',
      entityId: patient._id.toString(),
      details: { patientCode: patient.patientCode, name: patient.name }
    });

    return patient;
  }

  async updatePatient(id, data, user) {
    const patient = await this.getPatientById(id, user.clinicId);

    const safeData = { ...data };
    delete safeData.clinicId;
    delete safeData.createdBy;
    safeData.updatedBy = user._id || user.id;

    Object.assign(patient, safeData);
    await patient.save();

    await auditService.log({
      userId: user._id || user.id,
      clinicId: user.clinicId,
      action: 'UPDATE_PATIENT',
      entityType: 'Patient',
      entityId: patient._id.toString()
    });

    return patient;
  }

  async deletePatient(id, user) {
    const patient = await this.getPatientById(id, user.clinicId);
    patient.isDeleted = true;
    patient.updatedBy = user._id || user.id;
    await patient.save();

    await auditService.log({
      userId: user._id || user.id,
      clinicId: user.clinicId,
      action: 'DELETE_PATIENT',
      entityType: 'Patient',
      entityId: patient._id.toString()
    });

    return { success: true, message: 'Patient deleted successfully.' };
  }

  async countPatients(clinicId) {
    if (!clinicId) return 0;
    return Patient.countDocuments({ clinicId, isDeleted: false, isArchived: false });
  }
}

module.exports = new PatientService();
