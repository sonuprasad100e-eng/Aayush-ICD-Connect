const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const Mapping = require('../models/Mapping');
const Report = require('../models/Report');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshot');
const Clinic = require('../models/Clinic');
const TerminologyCrosswalk = require('../models/TerminologyCrosswalk');
const Counter = require('../models/Counter');
const patientService = require('../services/patientService');

async function seedDemoData() {
  console.log('[Seed] Checking existing data...');

  // 1. Create or retrieve the demo CareSync clinic first
  let clinic = await Clinic.findOne({ email: 'doctor@caresync.in' });
  if (!clinic) {
    clinic = await Clinic.findOne({ clinicName: 'CareSync Ayush Wellness Center' });
  }
  if (!clinic) {
    clinic = await Clinic.findOne();
  }

  if (!clinic) {
    clinic = new Clinic({
      clinicName: 'CareSync Ayush Wellness Center',
      doctorName: 'Dr. Sonu',
      email: 'doctor@caresync.in',
      phone: '+91 98765 43210',
      abhaId: '12-3456-7890-1234',
      address: '42 Health Park, Sector 5',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      specialization: 'Ayurveda Physician'
    });
    await clinic.save();
    console.log('[Seed] Created default CareSync clinic.');
  }

  // 2. Create or retrieve demo doctor accounts and associate with clinic
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('password123', salt);

  let doctor = await User.findOne({ email: 'sonu@caresync.in' });
  if (!doctor) {
    doctor = new User({
      name: 'Dr. Sonu',
      email: 'sonu@caresync.in',
      passwordHash,
      abhaId: '12-3456-7890-1234',
      specialization: 'Ayurveda Physician',
      phone: '+91 98765 43210',
      clinicName: clinic.clinicName,
      clinicAddress: clinic.address,
      city: clinic.city,
      state: clinic.state,
      pincode: clinic.pincode,
      clinicId: clinic._id,
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80',
      role: 'doctor',
      twoFactorEnabled: false,
      preferences: {
        language: 'English',
        defaultAyushSystem: 'Ayurveda',
        darkMode: false
      },
      notificationSettings: {
        criticalAlerts: true,
        claimUpdates: true,
        weeklySummary: false
      },
      passwordChangedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 3 months ago
    });
    await doctor.save();
    console.log('[Seed] Created doctor user: sonu@caresync.in');
  } else if (!doctor.clinicId) {
    doctor.clinicId = clinic._id;
    doctor.clinicName = clinic.clinicName;
    await doctor.save();
  }

  let doctorAlias = await User.findOne({ email: 'doctor@caresync.in' });
  if (!doctorAlias) {
    doctorAlias = new User({
      name: 'Dr. Sonu',
      email: 'doctor@caresync.in',
      passwordHash,
      abhaId: '98-7654-3210-4321',
      specialization: 'Ayurveda Physician',
      phone: '+91 98765 43210',
      clinicName: clinic.clinicName,
      clinicAddress: clinic.address,
      city: clinic.city,
      state: clinic.state,
      pincode: clinic.pincode,
      clinicId: clinic._id,
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80',
      role: 'doctor'
    });
    await doctorAlias.save();
    console.log('[Seed] Created doctor alias: doctor@caresync.in');
  } else if (!doctorAlias.clinicId) {
    doctorAlias.clinicId = clinic._id;
    doctorAlias.clinicName = clinic.clinicName;
    await doctorAlias.save();
  }

  // Ensure clinic references primary doctor if not yet set
  if (!clinic.userId) {
    clinic.userId = doctor._id;
    await clinic.save();
  }

  // 3. Seed Patients with clinicId, createdBy, and updatedBy
  const patientsData = [
    {
      patientCode: 'P001',
      name: 'Snehan Naicker',
      age: 20,
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80',
      diagnosisLabel: 'Cancer',
      namasteCode: 'AYU-1187',
      icd11Tm2Code: '2A00',
      icd11BioCode: '2A00',
      status: 'critical',
      clinicId: clinic._id,
      createdBy: doctor._id,
      updatedBy: doctor._id
    },
    {
      patientCode: 'P002',
      name: 'Anuj Nadar',
      age: 22,
      avatarUrl: 'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=100&q=80',
      diagnosisLabel: 'Diabetes (Prameha)',
      namasteCode: 'AYU-0568',
      icd11Tm2Code: '5A11',
      icd11BioCode: '5A11',
      status: 'stable',
      clinicId: clinic._id,
      createdBy: doctor._id,
      updatedBy: doctor._id
    },
    {
      patientCode: 'P003',
      name: 'Arjun Patil',
      age: 42,
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80',
      diagnosisLabel: 'Prameha',
      namasteCode: 'AYU-0042',
      icd11Tm2Code: 'SP70',
      icd11BioCode: '5A11',
      status: 'stable',
      clinicId: clinic._id,
      createdBy: doctor._id,
      updatedBy: doctor._id
    },
    {
      patientCode: 'P004',
      name: 'Rekha Sharma',
      age: 35,
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=100&q=80',
      diagnosisLabel: 'Vata Imbalance',
      namasteCode: 'AYU-0117',
      icd11Tm2Code: 'SP71',
      icd11BioCode: '6C20',
      status: 'review',
      clinicId: clinic._id,
      createdBy: doctor._id,
      updatedBy: doctor._id
    },
    {
      patientCode: 'P005',
      name: 'Divya Nair',
      age: 29,
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=100&q=80',
      diagnosisLabel: 'Pitta Excess',
      namasteCode: 'AYU-0093',
      icd11Tm2Code: 'SP72',
      icd11BioCode: '6C20',
      status: 'stable',
      clinicId: clinic._id,
      createdBy: doctor._id,
      updatedBy: doctor._id
    }
  ];

  let seededPatientsCount = 0;
  for (const patient of patientsData) {
    const existing = await Patient.findOne({ patientCode: patient.patientCode });
    if (!existing) {
      await Patient.create(patient);
      seededPatientsCount++;
    } else {
      let needsSave = false;
      if (!existing.clinicId) {
        existing.clinicId = clinic._id;
        needsSave = true;
      }
      if (!existing.createdBy) {
        existing.createdBy = doctor._id;
        needsSave = true;
      }
      if (!existing.updatedBy) {
        existing.updatedBy = doctor._id;
        needsSave = true;
      }
      if (needsSave) {
        await existing.save();
      }
    }
  }
  if (seededPatientsCount > 0) {
    console.log(`[Seed] Seeded ${seededPatientsCount} patients.`);
  }

  // Synchronize Counter with the highest existing numerical patientCode suffix
  const maxPatientNum = await patientService.getHighestExistingPatientNumber();
  if (maxPatientNum > 0) {
    await Counter.findOneAndUpdate(
      { _id: 'patientCode' },
      { $max: { seq: maxPatientNum } },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Patient code counter synchronized to at least: ${maxPatientNum}`);
  }

  // 4. Seed Diagnoses
  const diagnosesData = [
    {
      name: 'Jwara',
      subtitle: '(Fever)',
      description: 'Elevated body temperature caused by dosha imbalance, commonly Pitta-driven.',
      system: 'ayurveda',
      namasteCode: 'AYU-0011',
      icd11Tm2Code: 'MG26',
      icd11BioCode: 'MG26',
      fhirStatus: 'full'
    },
    {
      name: 'Kasa',
      subtitle: '(Cough)',
      description: 'Respiratory disorder linked to Vata-Kapha aggravation in the chest region.',
      system: 'ayurveda',
      namasteCode: 'AYU-0034',
      icd11Tm2Code: 'MD12',
      icd11BioCode: 'MD12',
      fhirStatus: 'full'
    },
    {
      name: 'Prameha',
      subtitle: '(Diabetes)',
      description: 'Metabolic disorder characterized by excessive urination and Kapha imbalance.',
      system: 'ayurveda',
      namasteCode: 'AYU-0042',
      icd11Tm2Code: '5A11',
      icd11BioCode: '5A11',
      fhirStatus: 'full'
    },
    {
      name: 'Vata Dosha',
      subtitle: 'Imbalance',
      description: 'Functional nervous system disorder linked to irregular movement and anxiety.',
      system: 'yoga',
      namasteCode: 'AYU-0117',
      icd11Tm2Code: 'SP70',
      icd11BioCode: '6C20',
      fhirStatus: 'full'
    },
    {
      name: 'Su-e-Mizaj',
      subtitle: '(Temperament Disorder)',
      description: 'Imbalance of the four humors affecting overall bodily temperament.',
      system: 'unani',
      namasteCode: 'AYU-0205',
      icd11Tm2Code: 'SP80',
      icd11BioCode: '6C20',
      fhirStatus: 'partial'
    },
    {
      name: 'Vali Noi',
      subtitle: '(Aging Disorders)',
      description: 'Degenerative condition linked to imbalance of the three humors (Mukkutram).',
      system: 'siddha',
      namasteCode: 'AYU-0261',
      icd11Tm2Code: 'SP85',
      icd11BioCode: '6C20',
      fhirStatus: 'full'
    }
  ];

  let seededDiagnosesCount = 0;
  for (const diagnosis of diagnosesData) {
    const existing = await Diagnosis.findOne({ namasteCode: diagnosis.namasteCode });
    if (!existing) {
      await Diagnosis.create(diagnosis);
      seededDiagnosesCount++;
    }
  }
  if (seededDiagnosesCount > 0) {
    console.log(`[Seed] Seeded ${seededDiagnosesCount} diagnoses.`);
  }

  // 5. Seed Recently Mapped
  const mappingsData = [
    {
      searchTerm: 'Jwara (Fever)',
      namasteCode: 'AYU-0011',
      icd11Tm2Code: 'MG26',
      icd11BioCode: 'MG26',
      confidenceScore: 98,
      status: 'confirmed',
      confirmedBy: doctor._id,
      clinicId: clinic._id,
      confirmedAt: new Date()
    },
    {
      searchTerm: 'Kasa (Cough)',
      namasteCode: 'AYU-0034',
      icd11Tm2Code: 'MD12',
      icd11BioCode: 'MD12',
      confidenceScore: 95,
      status: 'confirmed',
      confirmedBy: doctor._id,
      clinicId: clinic._id,
      confirmedAt: new Date(Date.now() - 3600000)
    },
    {
      searchTerm: 'Prameha',
      namasteCode: 'AYU-0042',
      icd11Tm2Code: '5A11',
      icd11BioCode: '5A11',
      confidenceScore: 82,
      status: 'confirmed',
      confirmedBy: doctor._id,
      clinicId: clinic._id,
      confirmedAt: new Date(Date.now() - 7200000)
    },
    {
      searchTerm: 'Pitta Excess',
      namasteCode: 'AYU-0093',
      icd11Tm2Code: 'SP72',
      icd11BioCode: '6C20',
      confidenceScore: 91,
      status: 'confirmed',
      confirmedBy: doctor._id,
      clinicId: clinic._id,
      confirmedAt: new Date(Date.now() - 10800000)
    },
    {
      searchTerm: 'Ama (Toxin Buildup)',
      namasteCode: 'AYU-0107',
      icd11Tm2Code: 'SP73',
      icd11BioCode: '6C20',
      confidenceScore: 64,
      status: 'confirmed',
      confirmedBy: doctor._id,
      clinicId: clinic._id,
      confirmedAt: new Date(Date.now() - 14400000)
    }
  ];

  let seededMappingsCount = 0;
  for (const mapping of mappingsData) {
    const existing = await Mapping.findOne({
      searchTerm: mapping.searchTerm,
      clinicId: clinic._id
    });
    if (!existing) {
      await Mapping.create(mapping);
      seededMappingsCount++;
    }
  }
  if (seededMappingsCount > 0) {
    console.log(`[Seed] Seeded ${seededMappingsCount} mappings.`);
  }

  // 6. Seed Reports
  const reportsData = [
    {
      name: 'Morbidity Analytics Summary',
      period: 'Aug 2026',
      generatedOn: '16 Aug 2026',
      fileUrl: '/reports/morbidity-analytics-summary-aug-2026.pdf',
      type: 'morbidity',
      clinicId: clinic._id,
      createdBy: doctor._id
    },
    {
      name: 'Insurance Claims Report',
      period: 'Q2 2026',
      generatedOn: '02 Jul 2026',
      fileUrl: '/reports/insurance-claims-q2-2026.pdf',
      type: 'claims',
      clinicId: clinic._id,
      createdBy: doctor._id
    },
    {
      name: 'NAMASTE-ICD Mapping Audit',
      period: 'Jun 2026',
      generatedOn: '30 Jun 2026',
      fileUrl: '/reports/mapping-audit-jun-2026.pdf',
      type: 'mapping-audit',
      clinicId: clinic._id,
      createdBy: doctor._id
    }
  ];

  let seededReportsCount = 0;
  for (const report of reportsData) {
    const existing = await Report.findOne({
      name: report.name,
      clinicId: clinic._id
    });
    if (!existing) {
      await Report.create(report);
      seededReportsCount++;
    }
  }
  if (seededReportsCount > 0) {
    console.log(`[Seed] Seeded ${seededReportsCount} reports.`);
  }

  // 7. Seed AnalyticsSnapshot
  const existingSnapshot = await AnalyticsSnapshot.findOne({ month: 'Aug 2026' });
  if (!existingSnapshot) {
    const snapshot = new AnalyticsSnapshot({
      month: 'Aug 2026',
      totalDiagnoses: 2856,
      claimsApproved: 96,
      claimsRejected: 4.2,
      codesMappedYtd: 1024,
      systemBreakdown: {
        ayurveda: 75.6,
        homeopathy: 40.0,
        yoga: 40.0,
        unani: 11.1,
        siddha: 11.1
      }
    });

    await snapshot.save();
    console.log('[Seed] Seeded analytics snapshot.');
  }

  // 8. Seed Authoritative Terminology Crosswalks (Idempotent)
  await seedAuthoritativeCrosswalks({
    clinicId: clinic ? clinic._id : undefined,
    doctorId: doctor ? doctor._id : undefined
  });

  console.log('[Seed] Demo data check and seeding complete!');
}

/**
 * Idempotently seeds verified and candidate terminology crosswalks
 * from the authoritative dataset into TerminologyCrosswalk collection.
 *
 * Safety guarantees:
 * - Upsert/exists check prevents duplicates.
 * - Never overwrites an existing verified crosswalk.
 * - Never degrades verified status to unverified.
 * - Leaves existing patient records completely untouched.
 */
async function seedAuthoritativeCrosswalks(options = {}) {
  const crosswalkFilePath = options.filePath || path.resolve(__dirname, '../../data/mappings/namaste_icd11_tm2_crosswalk.json');

  if (!fs.existsSync(crosswalkFilePath)) {
    console.warn(`[Crosswalk Seed] Dataset file not found at ${crosswalkFilePath}`);
    return { seeded: 0, existing: 0, skipped: 0 };
  }

  let items = [];
  try {
    const raw = fs.readFileSync(crosswalkFilePath, 'utf8');
    items = JSON.parse(raw);
  } catch (err) {
    console.error(`[Crosswalk Seed] Error reading crosswalk dataset:`, err);
    return { seeded: 0, existing: 0, skipped: 0, error: err.message };
  }

  let seededCount = 0;
  let existingCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (!item.namcCode || !item.icd11Tm2Code) {
      skippedCount++;
      continue;
    }

    const namcCodeTrimmed = item.namcCode.trim();
    const icdTrimmed = item.icd11Tm2Code.trim();

    // Check for exact crosswalk pairing
    const existing = await TerminologyCrosswalk.findOne({
      namcCode: namcCodeTrimmed,
      icd11Tm2Code: icdTrimmed
    });

    if (existing) {
      existingCount++;
      // If already exists, do not overwrite or modify doctor verification
      continue;
    }

    // If incoming record is verified, check if there is an existing conflicting verified record
    if (item.verified === true) {
      const conflict = await TerminologyCrosswalk.findOne({
        $or: [
          { namcCode: namcCodeTrimmed, verified: true },
          { icd11Tm2Code: icdTrimmed, verified: true }
        ]
      });

      if (conflict) {
        console.warn(`[Crosswalk Seed] Skipping conflicting verified crosswalk: ${namcCodeTrimmed} <-> ${icdTrimmed} (already mapped to ${conflict.namcCode} <-> ${conflict.icd11Tm2Code})`);
        skippedCount++;
        continue;
      }
    }

    // Create the crosswalk entry
    const isVerified = item.verified === true;
    const docData = {
      namcCode: namcCodeTrimmed,
      namcId: item.namcId ? String(item.namcId).trim() : undefined,
      ayushTerm: item.ayushTerm || 'AYUSH Diagnosis',
      system: item.system || 'Ayurveda',
      icd11Tm2Code: icdTrimmed,
      icd11Term: item.icd11Term || 'Traditional Medicine Disorder',
      whoEntityUri: item.whoEntityUri || undefined,
      whoParentUri: item.whoParentUri || undefined,
      whoRelease: item.whoRelease || '2026-01',
      whoSynonyms: Array.isArray(item.whoSynonyms) ? item.whoSynonyms : [],
      source: item.source || (isVerified ? 'Ministry of Ayush & WHO ICD-11 TM2' : 'Unverified AYUSH Clinical Catalog'),
      relationshipType: item.relationshipType || (isVerified ? 'equivalent' : 'related'),
      verified: isVerified,
      verificationMethod: isVerified ? (item.verificationMethod || 'official_crosswalk') : undefined,
      verifiedAt: isVerified ? (item.verifiedAt || new Date()) : undefined
    };

    if (options.doctorId && isVerified) {
      docData.verifiedBy = options.doctorId;
    }

    await TerminologyCrosswalk.create(docData);
    seededCount++;

    // Synchronize verified crosswalks into Mapping for the clinic if clinicId is provided
    if (isVerified && options.clinicId) {
      const existingMapping = await Mapping.findOne({
        clinicId: options.clinicId,
        namasteCode: namcCodeTrimmed,
        icd11Tm2Code: icdTrimmed
      });

      if (!existingMapping) {
        await Mapping.create({
          searchTerm: `${docData.ayushTerm} (${docData.icd11Term})`,
          namasteCode: namcCodeTrimmed,
          icd11Tm2Code: icdTrimmed,
          icd11BioCode: '',
          confidenceScore: 98,
          confirmedBy: options.doctorId,
          clinicId: options.clinicId,
          status: 'confirmed',
          confirmedAt: new Date()
        });
      }
    }
  }

  if (seededCount > 0) {
    console.log(`[Crosswalk Seed] Successfully initialized ${seededCount} terminology crosswalks (${existingCount} existed).`);
  }

  return { seeded: seededCount, existing: existingCount, skipped: skippedCount };
}

// Standalone CLI execution
if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  (async () => {
    try {
      await connectDB();
      await seedDemoData();
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error]', err);
      process.exit(1);
    }
  })();
}

seedDemoData.seedAuthoritativeCrosswalks = seedAuthoritativeCrosswalks;
module.exports = seedDemoData;
