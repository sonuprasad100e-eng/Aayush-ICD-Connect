const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Counter = require('../models/Counter');
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

  /**
   * Scans existing patient records to find the highest numerical suffix in P-style patientCodes (e.g. P001, P050 -> 50).
   * Returns 0 if no P-style records exist.
   */
  async getHighestExistingPatientNumber() {
    const patients = await Patient.find(
      { patientCode: /^P\d+$/i },
      { patientCode: 1 }
    ).lean();

    let maxNum = 0;
    for (const p of patients) {
      const match = p.patientCode.match(/^P(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    return maxNum;
  }

  /**
   * Concurrency-safe atomic generation of the next unique patientCode.
   * Uses an atomic MongoDB Counter collection ($inc).
   * Ensures counter is initialized safely to at least the highest existing patient number.
   * If a candidate patientCode already exists in Patient collection, advances until an available code is found.
   */
  async generateNextPatientCode() {
    // 1. Ensure counter document exists and is synchronized with any existing patient records
    const existingCounter = await Counter.findById('patientCode');
    if (!existingCounter) {
      const highestExisting = await this.getHighestExistingPatientNumber();
      await Counter.findOneAndUpdate(
        { _id: 'patientCode' },
        { $max: { seq: highestExisting } },
        { upsert: true, new: true }
      );
    }

    // 2. Atomically increment the sequence
    let counterDoc = await Counter.findByIdAndUpdate(
      'patientCode',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    let candidateCode = `P${String(counterDoc.seq).padStart(3, '0')}`;

    // 3. Ensure candidate is not already present in Patient collection (e.g., out-of-band inserts)
    while (await Patient.exists({ patientCode: candidateCode })) {
      counterDoc = await Counter.findByIdAndUpdate(
        'patientCode',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      candidateCode = `P${String(counterDoc.seq).padStart(3, '0')}`;
    }

    return candidateCode;
  }

  async createPatient(data, user) {
    if (!user || !user.clinicId) {
      throw { status: 403, message: 'Authenticated user must belong to a valid clinic.' };
    }

    const TerminologyCrosswalk = require('../models/TerminologyCrosswalk');

    // 1. Verify dual codes match an officially verified crosswalk
    if (data.namasteCode || data.icd11Tm2Code) {
      const namcVal = (data.namasteCode || '').trim();
      const icdVal = (data.icd11Tm2Code || '').trim();
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      let isVerified = await TerminologyCrosswalk.exists({
        $or: [
          { namcCode: namcVal },
          { namcCode: new RegExp(`\\(${escapeRegex(namcVal)}\\)`, 'i') },
          { namcCode: new RegExp(`^${escapeRegex(namcVal)}\\(`, 'i') }
        ],
        icd11Tm2Code: new RegExp(`^${escapeRegex(icdVal)}$`, 'i'),
        verified: true
      });

      // If not yet in MongoDB collection, verify against authoritative terminology index
      if (!isVerified) {
        try {
          const terminologyIndex = require('./terminologyIndex');
          const lookup = terminologyIndex.lookupByCode(namcVal, 'NAMC');
          if (lookup && lookup.found && lookup.verified) {
            const matchesIcd = (lookup.icd11Tm2Code || '').toUpperCase() === icdVal.toUpperCase() ||
              (lookup.matches && lookup.matches.some(m => (m.icd11Tm2Code || '').toUpperCase() === icdVal.toUpperCase()));
            if (matchesIcd) {
              isVerified = true;
            }
          }
        } catch (e) {
          // ignore index error
        }
      }

      if (!isVerified) {
        throw {
          status: 400,
          message: `The provided NAMASTE (${data.namasteCode}) and ICD-11 TM2 (${data.icd11Tm2Code}) codes do not match an officially verified terminology crosswalk. A doctor must first verify this disease mapping in the Disease Mapping module before patient registration.`
        };
      }
    }

    // 2. Prepare sanitized patient data
    const safeData = { ...data };
    delete safeData.clinicId;
    delete safeData.createdBy;
    delete safeData.updatedBy;
    delete safeData.patientCode; // Always manage patientCode explicitly

    const isCustomCode = Boolean(data.patientCode && data.patientCode.trim());
    if (isCustomCode) {
      const customCode = data.patientCode.trim();
      const existing = await Patient.exists({ patientCode: customCode });
      if (existing) {
        throw {
          status: 409,
          message: `A patient with code "${customCode}" already exists. Patient codes must be unique.`
        };
      }
    }

    // 3. Concurrency-safe creation with duplicate key handling
    let savedPatient = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!savedPatient && attempts < maxAttempts) {
      attempts++;
      const patientCode = isCustomCode
        ? data.patientCode.trim()
        : await this.generateNextPatientCode();

      const patient = new Patient({
        ...safeData,
        patientCode,
        clinicId: user.clinicId,
        createdBy: user._id || user.id,
        updatedBy: user._id || user.id
      });

      try {
        await patient.save();
        savedPatient = patient;
      } catch (err) {
        // Handle MongoDB E11000 duplicate key error
        if (err.code === 11000 && err.keyPattern && err.keyPattern.patientCode) {
          if (isCustomCode) {
            throw {
              status: 409,
              message: `A patient with code "${data.patientCode.trim()}" already exists. Patient codes must be unique.`
            };
          }
          console.warn(`[patientService] Auto-generated code "${patientCode}" collided on attempt ${attempts}. Retrying...`);
          if (attempts >= maxAttempts) {
            throw {
              status: 409,
              message: `Unable to allocate a unique patient code after ${maxAttempts} attempts due to high concurrency. Please try again.`
            };
          }
        } else {
          throw err;
        }
      }
    }

    await auditService.log({
      userId: user._id || user.id,
      clinicId: user.clinicId,
      action: 'CREATE_PATIENT',
      entityType: 'Patient',
      entityId: savedPatient._id.toString(),
      details: { patientCode: savedPatient.patientCode, name: savedPatient.name }
    });

    return savedPatient;
  }

  async updatePatient(id, data, user) {
    const patient = await this.getPatientById(id, user.clinicId);

    const safeData = { ...data };
    delete safeData.clinicId;
    delete safeData.createdBy;
    delete safeData.patientCode; // patientCode is immutable via update
    safeData.updatedBy = user._id || user.id;

    const newNamc = safeData.namasteCode !== undefined ? safeData.namasteCode : patient.namasteCode;
    const newIcd = safeData.icd11Tm2Code !== undefined ? safeData.icd11Tm2Code : patient.icd11Tm2Code;

    // Verify dual codes match an officially verified crosswalk if they are changing
    if (newNamc !== patient.namasteCode || newIcd !== patient.icd11Tm2Code) {
      const TerminologyCrosswalk = require('../models/TerminologyCrosswalk');
      const namcVal = (newNamc || '').trim();
      const icdVal = (newIcd || '').trim();
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const isVerified = await TerminologyCrosswalk.exists({
        $or: [
          { namcCode: namcVal },
          { namcCode: new RegExp(`\\(${escapeRegex(namcVal)}\\)`, 'i') },
          { namcCode: new RegExp(`^${escapeRegex(namcVal)}\\(`, 'i') }
        ],
        icd11Tm2Code: new RegExp(`^${escapeRegex(icdVal)}$`, 'i'),
        verified: true
      });

      if (!isVerified) {
        throw {
          status: 400,
          message: `The provided NAMASTE (${newNamc}) and ICD-11 TM2 (${newIcd}) codes do not match an officially verified terminology crosswalk. A doctor must first verify this disease mapping in the Disease Mapping module before patient registration.`
        };
      }
    }

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

  async countDiagnoses(clinicId) {
    if (!clinicId) return 0;
    return Patient.countDocuments({
      clinicId,
      isDeleted: false,
      isArchived: false,
      $or: [
        { namasteCode: { $exists: true, $ne: '' } },
        { diagnosisLabel: { $exists: true, $ne: '' } }
      ]
    });
  }
}

module.exports = new PatientService();
