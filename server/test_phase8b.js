require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://127.0.0.1:8000/api';

const User = require('./src/models/User');
const Clinic = require('./src/models/Clinic');
const Patient = require('./src/models/Patient');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');

let clinicA, clinicB, clinicZero;
let doctorA, doctorB, doctorZero, doctorNoClinic;
let tokenA, tokenB, tokenZero, tokenNoClinic;

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aayush_icd_connect');
  console.log('[Phase 8B Test] Connected to MongoDB');

  // Clean test data
  await Patient.deleteMany({ patientCode: { $regex: /^PHASE8B_/ } });
  await User.deleteMany({ email: { $regex: /@phase8b\.test$/ } });
  await Clinic.deleteMany({ email: { $regex: /@phase8b\.test$/ } });

  // 1. Create Clinics
  clinicA = await Clinic.create({
    clinicName: 'Phase8B Clinic Alpha',
    doctorName: 'Dr. Alpha',
    email: 'clinicA@phase8b.test',
    phone: '1111111111',
    address: '100 Alpha St',
    city: 'Alpha City',
    state: 'State',
    pincode: '111111'
  });

  clinicB = await Clinic.create({
    clinicName: 'Phase8B Clinic Beta',
    doctorName: 'Dr. Beta',
    email: 'clinicB@phase8b.test',
    phone: '2222222222',
    address: '200 Beta St',
    city: 'Beta City',
    state: 'State',
    pincode: '222222'
  });

  clinicZero = await Clinic.create({
    clinicName: 'Phase8B Clinic Zero',
    doctorName: 'Dr. Zero',
    email: 'clinicZero@phase8b.test',
    phone: '3333333333',
    address: '300 Zero St',
    city: 'Zero City',
    state: 'State',
    pincode: '333333'
  });

  // 2. Create Doctors
  doctorA = await User.create({
    name: 'Dr. Alpha',
    email: 'docA@phase8b.test',
    passwordHash: 'dummy',
    role: 'doctor',
    clinicId: clinicA._id,
    isActive: true
  });

  doctorB = await User.create({
    name: 'Dr. Beta',
    email: 'docB@phase8b.test',
    passwordHash: 'dummy',
    role: 'doctor',
    clinicId: clinicB._id,
    isActive: true
  });

  doctorZero = await User.create({
    name: 'Dr. Zero',
    email: 'docZero@phase8b.test',
    passwordHash: 'dummy',
    role: 'doctor',
    clinicId: clinicZero._id,
    isActive: true
  });

  doctorNoClinic = await User.create({
    name: 'Dr. NoClinic',
    email: 'docNoClinic@phase8b.test',
    passwordHash: 'dummy',
    role: 'doctor',
    isActive: true
  });

  // 3. Tokens
  tokenA = jwt.sign({ id: doctorA._id, role: 'doctor', clinicId: clinicA._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  tokenB = jwt.sign({ id: doctorB._id, role: 'doctor', clinicId: clinicB._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  tokenZero = jwt.sign({ id: doctorZero._id, role: 'doctor', clinicId: clinicZero._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  tokenNoClinic = jwt.sign({ id: doctorNoClinic._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 4. Seed Clinic A Patients (2 patients)
  await Patient.create([
    {
      patientCode: 'PHASE8B_A01',
      name: 'Alice Alpha',
      age: 28,
      diagnosisLabel: 'Jvara',
      namasteCode: 'AYU-0011',
      icd11Tm2Code: 'MG26',
      status: 'stable',
      clinicId: clinicA._id,
      createdBy: doctorA._id,
      updatedBy: doctorA._id
    },
    {
      patientCode: 'PHASE8B_A02',
      name: 'Aaron Alpha',
      age: 35,
      diagnosisLabel: 'Kasa',
      namasteCode: 'AYU-0034',
      icd11Tm2Code: 'MD12',
      status: 'critical',
      clinicId: clinicA._id,
      createdBy: doctorA._id,
      updatedBy: doctorA._id
    }
  ]);

  // 5. Seed Clinic B Patients (1 patient)
  await Patient.create([
    {
      patientCode: 'PHASE8B_B01',
      name: 'Bob Beta',
      age: 44,
      diagnosisLabel: 'Prameha',
      namasteCode: 'AYU-0042',
      icd11Tm2Code: '5A11',
      status: 'stable',
      clinicId: clinicB._id,
      createdBy: doctorB._id,
      updatedBy: doctorB._id
    }
  ]);

  // Clinic Zero has 0 patients!
}

async function cleanup() {
  await Patient.deleteMany({ patientCode: { $regex: /^PHASE8B_/ } });
  await User.deleteMany({ email: { $regex: /@phase8b\.test$/ } });
  await Clinic.deleteMany({ email: { $regex: /@phase8b\.test$/ } });
  await mongoose.disconnect();
  console.log('[Phase 8B Test] Cleaned up and disconnected from MongoDB');
}

async function apiRequest(endpoint, token, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

async function runPhase8BTests() {
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName, extraInfo = '') {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
    }
  }

  try {
    await setup();

    console.log('\n--- Running Phase 8B Clinic Isolation & Real DB Data Test Suite ---\n');

    // Test A: Authenticated clinic A sees only clinic A patients
    const resPatientsA = await apiRequest('/patients', tokenA);
    assert(resPatientsA.status === 200, 'Test A1: Clinic A GET /patients returns 200');
    assert(resPatientsA.data.patients && resPatientsA.data.patients.length === 2, 'Test A2: Clinic A sees exactly 2 patients', `found ${resPatientsA.data.patients?.length}`);
    const allA = resPatientsA.data.patients.every(p => p.patientCode.startsWith('PHASE8B_A'));
    assert(allA, 'Test A3: All returned patients belong to Clinic A');

    // Test B: Authenticated clinic B sees only clinic B patients
    const resPatientsB = await apiRequest('/patients', tokenB);
    assert(resPatientsB.status === 200, 'Test B1: Clinic B GET /patients returns 200');
    assert(resPatientsB.data.patients && resPatientsB.data.patients.length === 1, 'Test B2: Clinic B sees exactly 1 patient', `found ${resPatientsB.data.patients?.length}`);
    assert(resPatientsB.data.patients[0].patientCode === 'PHASE8B_B01', 'Test B3: Returned patient is Bob Beta from Clinic B');

    // Test C: Dashboard clinic A count excludes clinic B
    const resDashA = await apiRequest('/dashboard/summary', tokenA);
    assert(resDashA.status === 200, 'Test C1: Clinic A GET /dashboard/summary returns 200');
    assert(resDashA.data.patientCount === 2, 'Test C2: Clinic A dashboard patientCount is 2 (excludes Clinic B)', `got ${resDashA.data.patientCount}`);
    assert(resDashA.data.diagnosisCount === 2, 'Test C3: Clinic A dashboard diagnosisCount is 2', `got ${resDashA.data.diagnosisCount}`);

    const resDashB = await apiRequest('/dashboard/summary', tokenB);
    assert(resDashB.status === 200, 'Test C4: Clinic B GET /dashboard/summary returns 200');
    assert(resDashB.data.patientCount === 1, 'Test C5: Clinic B dashboard patientCount is 1 (excludes Clinic A)', `got ${resDashB.data.patientCount}`);
    assert(resDashB.data.diagnosisCount === 1, 'Test C6: Clinic B dashboard diagnosisCount is 1', `got ${resDashB.data.diagnosisCount}`);

    // Test D: Dashboard recent patients excludes clinic B
    const recentA = resDashA.data.recentPatients || [];
    assert(recentA.length === 2, 'Test D1: Clinic A recentPatients count is 2');
    const recentNoB = recentA.every(p => p.patientCode.startsWith('PHASE8B_A'));
    assert(recentNoB, 'Test D2: Clinic A recentPatients does not contain Clinic B patient');

    const recentB = resDashB.data.recentPatients || [];
    assert(recentB.length === 1, 'Test D3: Clinic B recentPatients count is 1');
    assert(recentB[0].patientCode === 'PHASE8B_B01', 'Test D4: Clinic B recentPatients contains only Clinic B patient');

    // Test E: Patients search cannot return clinic B records
    const resSearchAforBob = await apiRequest('/patients?search=Bob', tokenA);
    assert(resSearchAforBob.data.patients.length === 0, 'Test E1: Searching for "Bob" from Clinic A returns 0 results');
    const resSearchAforAlice = await apiRequest('/patients?search=Alice', tokenA);
    assert(resSearchAforAlice.data.patients.length === 1, 'Test E2: Searching for "Alice" from Clinic A returns 1 result');
    const resSearchBforAlice = await apiRequest('/patients?search=Alice', tokenB);
    assert(resSearchBforAlice.data.patients.length === 0, 'Test E3: Searching for "Alice" from Clinic B returns 0 results');

    // Test F: Patients status filter cannot return clinic B records
    const resFilterCriticalA = await apiRequest('/patients?status=critical', tokenA);
    assert(resFilterCriticalA.data.patients.length === 1, 'Test F1: Status "critical" filter for Clinic A returns 1 patient (Aaron)');
    assert(resFilterCriticalA.data.patients[0].name === 'Aaron Alpha', 'Test F2: Critical patient is Aaron Alpha');
    const resFilterCriticalB = await apiRequest('/patients?status=critical', tokenB);
    assert(resFilterCriticalB.data.patients.length === 0, 'Test F3: Status "critical" filter for Clinic B returns 0 patients');

    // Test G: Missing clinicId is rejected
    const resNoClinicDash = await apiRequest('/dashboard/summary', tokenNoClinic);
    assert(resNoClinicDash.status === 403, 'Test G1: Dashboard request without clinicId returns 403 Forbidden', `got ${resNoClinicDash.status}`);
    const resNoClinicPatients = await apiRequest('/patients', tokenNoClinic);
    assert(resNoClinicPatients.status === 403, 'Test G2: Patients request without clinicId returns 403 Forbidden', `got ${resNoClinicPatients.status}`);

    // Test H: Zero patients returns 0, NOT 1245
    const resDashZero = await apiRequest('/dashboard/summary', tokenZero);
    assert(resDashZero.status === 200, 'Test H1: Clinic Zero GET /dashboard/summary returns 200');
    assert(resDashZero.data.patientCount === 0, 'Test H2: Clinic Zero patientCount is strictly 0 (NOT 1245)', `got ${resDashZero.data.patientCount}`);
    assert(resDashZero.data.patientCount !== 1245, 'Test H3: Clinic Zero patientCount !== 1245');

    // Test I: Zero diagnoses returns 0, NOT 2856
    assert(resDashZero.data.diagnosisCount === 0, 'Test I1: Clinic Zero diagnosisCount is strictly 0 (NOT 2856)', `got ${resDashZero.data.diagnosisCount}`);
    assert(resDashZero.data.diagnosisCount !== 2856, 'Test I2: Clinic Zero diagnosisCount !== 2856');

    // Test J: No fake/random dashboard numbers are generated
    assert(resDashZero.data.recentPatients && resDashZero.data.recentPatients.length === 0, 'Test J1: Clinic Zero recentPatients is empty array []');
    assert(resDashZero.data.mappingCount === 0, 'Test J2: Clinic Zero mappingCount is strictly 0');
    assert(resDashZero.data.mappedCount === 0, 'Test J3: Clinic Zero mappedCount is strictly 0');
    assert(resDashZero.data.unmappedCount === 0, 'Test J4: Clinic Zero unmappedCount is strictly 0');

    // Test Zero Patients on Patients endpoint
    const resPatientsZero = await apiRequest('/patients', tokenZero);
    assert(resPatientsZero.status === 200, 'Test Zero1: Clinic Zero GET /patients returns 200');
    assert(resPatientsZero.data.patients.length === 0, 'Test Zero2: Clinic Zero patients list is empty []');
    assert(resPatientsZero.data.total === 0, 'Test Zero3: Clinic Zero total is 0');

    console.log(`\n=========================================`);
    console.log(`Phase 8B Test Suite Results: ${passedCount}/${totalCount} tests passed`);
    console.log(`=========================================\n`);

    if (passedCount !== totalCount) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test suite error:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

runPhase8BTests();
