const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const Mapping = require('../models/Mapping');
const Report = require('../models/Report');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshot');
const Clinic = require('../models/Clinic');

async function seedDemoData() {
  console.log('[Seed] Checking existing data...');

  // Ensure default clinic exists even if users already exist
  const clinicCount = await Clinic.countDocuments();
  if (clinicCount === 0) {
    const doctor = (await User.findOne({ email: 'doctor@caresync.in' })) || (await User.findOne());
    const defaultClinic = new Clinic({
      clinicName: 'CareSync Ayush Wellness Center',
      doctorName: doctor ? doctor.name : 'Dr. Sonu',
      email: doctor ? doctor.email : 'doctor@caresync.in',
      phone: '+91 98765 43210',
      abhaId: doctor ? (doctor.abhaId || '12-3456-7890-1234') : '12-3456-7890-1234',
      address: '42 Health Park, Sector 5',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      specialization: doctor ? doctor.specialization : 'Ayurveda Physician',
      userId: doctor ? doctor._id : null
    });
    await defaultClinic.save();
    if (doctor) {
      doctor.clinicName = defaultClinic.clinicName;
      doctor.clinicId = defaultClinic._id;
      await doctor.save();
    }
    console.log('[Seed] Initial CareSync clinic seeded successfully.');
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log('[Seed] Database already contains users. Skipping demo seeding.');
    return;
  }

  console.log('[Seed] Seeding Care Sync demo data...');

  // 1. Seed Doctor Account
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('password123', salt);

  const doctor = new User({
    name: 'Dr. Sonu',
    email: 'sonu@caresync.in',
    passwordHash,
    abhaId: '12-3456-7890-1234',
    specialization: 'Ayurveda Physician',
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

  // Also support doctor@caresync.in login if used
  const doctorAlias = new User({
    name: 'Dr. Sonu',
    email: 'doctor@caresync.in',
    passwordHash,
    abhaId: '98-7654-3210-4321',
    specialization: 'Ayurveda Physician',
    photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&q=80',
    role: 'doctor'
  });

  await Promise.all([doctor.save(), doctorAlias.save()]);
  console.log('[Seed] Created doctor user: sonu@caresync.in / doctor@caresync.in (Password: password123)');

  // 2. Seed Patients
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
      createdBy: doctor._id
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
      createdBy: doctor._id
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
      createdBy: doctor._id
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
      createdBy: doctor._id
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
      createdBy: doctor._id
    }
  ];

  await Patient.insertMany(patientsData);
  console.log(`[Seed] Seeded ${patientsData.length} patients.`);

  // 3. Seed Diagnoses
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

  await Diagnosis.insertMany(diagnosesData);
  console.log(`[Seed] Seeded ${diagnosesData.length} diagnoses.`);

  // 4. Seed Recently Mapped
  const mappingsData = [
    {
      searchTerm: 'Jwara (Fever)',
      namasteCode: 'AYU-0011',
      icd11Tm2Code: 'MG26',
      icd11BioCode: 'MG26',
      confidenceScore: 98,
      confirmedBy: doctor._id,
      confirmedAt: new Date()
    },
    {
      searchTerm: 'Kasa (Cough)',
      namasteCode: 'AYU-0034',
      icd11Tm2Code: 'MD12',
      icd11BioCode: 'MD12',
      confidenceScore: 95,
      confirmedBy: doctor._id,
      confirmedAt: new Date(Date.now() - 3600000)
    },
    {
      searchTerm: 'Prameha',
      namasteCode: 'AYU-0042',
      icd11Tm2Code: '5A11',
      icd11BioCode: '5A11',
      confidenceScore: 82,
      confirmedBy: doctor._id,
      confirmedAt: new Date(Date.now() - 7200000)
    },
    {
      searchTerm: 'Pitta Excess',
      namasteCode: 'AYU-0093',
      icd11Tm2Code: 'SP72',
      icd11BioCode: '6C20',
      confidenceScore: 91,
      confirmedBy: doctor._id,
      confirmedAt: new Date(Date.now() - 10800000)
    },
    {
      searchTerm: 'Ama (Toxin Buildup)',
      namasteCode: 'AYU-0107',
      icd11Tm2Code: 'SP73',
      icd11BioCode: '6C20',
      confidenceScore: 64,
      confirmedBy: doctor._id,
      confirmedAt: new Date(Date.now() - 14400000)
    }
  ];

  await Mapping.insertMany(mappingsData);
  console.log(`[Seed] Seeded ${mappingsData.length} mappings.`);

  // 5. Seed Reports
  const reportsData = [
    {
      name: 'Morbidity Analytics Summary',
      period: 'Aug 2026',
      generatedOn: '16 Aug 2026',
      fileUrl: '/reports/morbidity-analytics-summary-aug-2026.pdf',
      type: 'morbidity'
    },
    {
      name: 'Insurance Claims Report',
      period: 'Q2 2026',
      generatedOn: '02 Jul 2026',
      fileUrl: '/reports/insurance-claims-q2-2026.pdf',
      type: 'claims'
    },
    {
      name: 'NAMASTE-ICD Mapping Audit',
      period: 'Jun 2026',
      generatedOn: '30 Jun 2026',
      fileUrl: '/reports/mapping-audit-jun-2026.pdf',
      type: 'mapping-audit'
    }
  ];

  await Report.insertMany(reportsData);
  console.log(`[Seed] Seeded ${reportsData.length} reports.`);

  // 6. Seed AnalyticsSnapshot
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
  console.log('[Seed] Demo data seeding complete!');
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

module.exports = seedDemoData;
