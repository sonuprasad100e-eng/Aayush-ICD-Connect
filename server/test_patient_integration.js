require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Note: server.js exports the app or starts it directly. If it starts directly, we can just use node fetch to hit localhost.
const API_BASE = 'http://localhost:8000/api';

const User = require('./src/models/User');
const Clinic = require('./src/models/Clinic');
const Patient = require('./src/models/Patient');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');

let docToken = '';
let doctorUser = null;
let clinic = null;
let existingPatientId = null;

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[TEST] Connected to MongoDB');

  // Clean DB
  await Patient.deleteMany({ patientCode: { $regex: /^TEST_/ } });
  await TerminologyCrosswalk.deleteMany({ source: 'TEST' });
  await User.deleteMany({ email: { $in: ['integration_doc@caresync.com', 'doc2@c.com'] } });
  await Clinic.deleteMany({ email: { $in: ['integration@caresync.com', 'doc2@c.com'] }, clinicName: { $in: ['Integration Clinic', 'Other Clinic'] } });

  clinic = new Clinic({
    clinicName: 'Integration Clinic',
    doctorName: 'Int Doc',
    email: 'integration@caresync.com',
    phone: '1111111111',
    address: '123 Test',
    city: 'Test',
    state: 'Test',
    pincode: '123456'
  });
  await clinic.save();

  doctorUser = new User({
    name: 'Integration Doc',
    email: 'integration_doc@caresync.com',
    passwordHash: 'dummyhash',
    role: 'doctor',
    clinicId: clinic._id,
    isActive: true
  });
  await doctorUser.save();
  docToken = jwt.sign({ id: doctorUser._id, role: 'doctor', clinicId: clinic._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Create a verified crosswalk
  const crosswalk = new TerminologyCrosswalk({
    namcId: 'dummy_id_1',
    namcCode: 'SP51(EC-3)',
    ayushTerm: 'Jvara',
    system: 'Ayurveda',
    icd11Tm2Code: 'SP51',
    icd11Term: 'Fever disorder (TM2)',
    whoEntityUri: 'http://test.uri',
    source: 'TEST',
    relationshipType: 'equivalent',
    verified: true,
    verifiedBy: doctorUser._id,
    verifiedAt: new Date(),
    verificationMethod: 'manual'
  });
  await crosswalk.save();
}

async function cleanup() {
  await Patient.deleteMany({ patientCode: { $regex: /^TEST_/ } });
  await TerminologyCrosswalk.deleteMany({ source: 'TEST' });
  await User.deleteMany({ email: { $in: ['integration_doc@caresync.com', 'doc2@c.com'] } });
  await Clinic.deleteMany({ email: { $in: ['integration@caresync.com', 'doc2@c.com'] }, clinicName: { $in: ['Integration Clinic', 'Other Clinic'] } });
  await mongoose.disconnect();
  console.log('[TEST] Cleaned up and disconnected');
}

async function makeRequest(method, endpoint, payload) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` };
  const options = { method, headers };
  if (payload) options.body = JSON.stringify(payload);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

async function runTests() {
  try {
    await setup();

    console.log(`\n--- Test Case: A. Valid verified NAMC + ICD pair -> 201 patient created ---`);
    let res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P001', name: 'Test Patient A', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: 'SP51(EC-3)', icd11Tm2Code: 'SP51'
    });
    console.log(`Status: ${res.status} (Expected: 201)`);
    existingPatientId = res.data.id;
    console.log(`createdBy matches doctor: ${res.data.createdBy === doctorUser._id.toString()}`);
    console.log(`clinicId matches clinic: ${res.data.clinicId === clinic._id.toString()}`);

    console.log(`\n--- Test Case: B. Fake NAMC + fake ICD pair -> 400 ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P002', name: 'Test Patient B', age: 30, status: 'stable', diagnosisLabel: 'Fake', namasteCode: 'FAKE1', icd11Tm2Code: 'FAKE2'
    });
    console.log(`Status: ${res.status} (Expected: 400)`);
    console.log(`Message: ${res.data.detail}`);

    console.log(`\n--- Test Case: C. Valid NAMC + wrong ICD pair -> 400 ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P003', name: 'Test Patient C', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: 'SP51(EC-3)', icd11Tm2Code: 'SP99'
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: D. Valid ICD + wrong NAMC pair -> 400 ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P004', name: 'Test Patient D', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: 'WRONG_NAMC', icd11Tm2Code: 'SP51'
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: E. Valid-looking but unverified pair -> 400 ---`);
    // Create an unverified crosswalk
    await new TerminologyCrosswalk({
      namcCode: 'UNV1', ayushTerm: 'Test', system: 'Ayurveda', icd11Tm2Code: 'UNV2', icd11Term: 'Test', verified: false
    }).save();
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P005', name: 'Test Patient E', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: 'UNV1', icd11Tm2Code: 'UNV2'
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: F. Empty NAMC -> 400 validation error ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P006', name: 'Test Patient F', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: '', icd11Tm2Code: 'SP51'
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: G. Empty ICD -> 400 validation error ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P007', name: 'Test Patient G', age: 30, status: 'stable', diagnosisLabel: 'Fever', namasteCode: 'SP51(EC-3)', icd11Tm2Code: ''
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: I. Update patient to invalid dual-code pair -> 400 ---`);
    res = await makeRequest('PUT', `/patients/${existingPatientId}`, { namasteCode: 'FAKE1', icd11Tm2Code: 'FAKE2' });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: J. Update patient to valid verified pair -> 200 ---`);
    // Create a second verified crosswalk
    await new TerminologyCrosswalk({
      namcCode: 'AYU-0011', ayushTerm: 'Test2', system: 'Ayurveda', icd11Tm2Code: 'MG26', icd11Term: 'Test2', verified: true
    }).save();
    res = await makeRequest('PUT', `/patients/${existingPatientId}`, { namasteCode: 'AYU-0011', icd11Tm2Code: 'MG26' });
    console.log(`Status: ${res.status} (Expected: 200)`);
    console.log(`Updated namasteCode: ${res.data.namasteCode}`);

    console.log(`\n--- Test Case: P. Frontend cannot bypass backend enforcement ---`);
    res = await makeRequest('POST', '/patients', {
      patientCode: 'TEST_P008', name: 'Hacker', age: 20, status: 'stable', diagnosisLabel: 'Hack', namasteCode: 'SP51(EC-3)', icd11Tm2Code: 'SP99', verifiedDualCode: true
    });
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: Q. Clinic isolation works ---`);
    const clinic2 = new Clinic({
      clinicName: 'Other Clinic', doctorName: 'Doc2', email: 'doc2@c.com', phone: '22', address: '22', city: '22', state: '22', pincode: '22'
    });
    await clinic2.save();
    const user2 = new User({
      name: 'Doc2', email: 'doc2@c.com', passwordHash: 'hash', role: 'doctor', clinicId: clinic2._id, isActive: true
    });
    await user2.save();
    const doc2Token = jwt.sign({ id: user2._id, role: 'doctor', clinicId: clinic2._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const resIsol = await fetch(`${API_BASE}/patients/${existingPatientId}`, { headers: { 'Authorization': `Bearer ${doc2Token}` } });
    console.log(`Status: ${resIsol.status} (Expected: 403)`);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await cleanup();
  }
}

runTests();
