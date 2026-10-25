/**
 * Test Suite: Phase 2B — Seed Verified Terminology Crosswalks
 *
 * Verifies:
 * 1. Initialization on an empty database.
 * 2. Running initialization twice without creating duplicates.
 * 3. Preservation of existing verified crosswalks.
 * 4. Rejection of unverified or conflicting mappings where verification is required.
 * 5. Successful lookup of an existing verified crosswalk.
 * 6. Patient registration with a valid verified crosswalk.
 * 7. Clear rejection when a required mapping is absent.
 * 8. Confirmation that existing patient records are not deleted or modified by initialization.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Clinic = require('./src/models/Clinic');
const User = require('./src/models/User');
const Patient = require('./src/models/Patient');
const Mapping = require('./src/models/Mapping');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const seedDemoData = require('./src/seed/seedDemoData');
const mappingService = require('./src/services/mappingService');
const patientService = require('./src/services/patientService');
const app = require('./src/app');

let mongoServer;
let testServer;
let baseUrl = '';
let testClinic;
let testDoctor;
let doctorToken = '';

function assertSafeTestEnvironment(uri) {
  if (!uri) return;
  const lower = uri.toLowerCase();
  const dangerousPatterns = ['mongodb.net', 'mongodb+srv', 'atlas', 'prod', 'live', 'cluster'];
  const isDangerous = dangerousPatterns.some(p => lower.includes(p));
  if (isDangerous || process.env.NODE_ENV === 'production') {
    throw new Error(`[SAFETY BLOCKED] Refusing to run tests against: ${uri.replace(/:[^:]*@/, ':****@')}`);
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = options.headers || {};
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, body: data };
}

async function setup() {
  console.log('\n--- Setting up isolated in-memory test environment ---');
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  assertSafeTestEnvironment(uri);

  await mongoose.connect(uri);
  console.log('[Setup] Connected to MongoMemoryServer at:', uri);

  // Start ephemeral HTTP server
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Setup] Ephemeral test server listening at: ${baseUrl}`);
      resolve();
    });
  });

  // Seed clinic and doctor fixtures
  testClinic = await Clinic.create({
    clinicName: 'Test Ayush Clinic',
    doctorName: 'Dr. Test',
    email: 'testdoctor@caresync.in',
    phone: '+91 99999 88888',
    address: '108 Ayurveda Marg',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    specialization: 'Ayurveda Physician'
  });

  testDoctor = await User.create({
    name: 'Dr. Test',
    email: 'testdoctor@caresync.in',
    passwordHash: 'dummyhash',
    role: 'doctor',
    clinicId: testClinic._id,
    clinicName: testClinic.clinicName
  });

  const secret = process.env.JWT_SECRET || 'secret';
  doctorToken = jwt.sign(
    { id: testDoctor._id.toString(), email: testDoctor.email, role: 'doctor', clinicId: testClinic._id.toString() },
    secret,
    { expiresIn: '1h' }
  );

  console.log('[Setup] Setup complete.\n');
}

async function teardown() {
  console.log('\n--- Tearing down isolated test environment ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log('[Teardown] In-memory database and server shut down successfully.');
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    await setup();

    // =========================================================================
    // Test 1: Initialization on an empty database
    // =========================================================================
    console.log('[Test 1] Initialization on an empty database');
    const initialCrosswalkCount = await TerminologyCrosswalk.countDocuments();
    assert(initialCrosswalkCount === 0, 'TerminologyCrosswalk collection is initially empty');

    const seedResult1 = await seedDemoData.seedAuthoritativeCrosswalks({
      clinicId: testClinic._id,
      doctorId: testDoctor._id
    });

    assert(seedResult1.seeded > 0, `Seeded ${seedResult1.seeded} records on empty database`);
    const countAfterSeed1 = await TerminologyCrosswalk.countDocuments();
    assert(countAfterSeed1 === seedResult1.seeded, `Database contains exactly ${seedResult1.seeded} crosswalks`);

    // Verify verified vs unverified records
    const verifiedRecords = await TerminologyCrosswalk.find({ verified: true });
    const unverifiedRecords = await TerminologyCrosswalk.find({ verified: false });
    assert(verifiedRecords.length === 6, `Exactly 6 authoritative records seeded as verified (got ${verifiedRecords.length})`);
    assert(unverifiedRecords.length === 3, `Exactly 3 candidate records retained as unverified (got ${unverifiedRecords.length})`);

    // Verify metadata of an authoritative verified record
    const jvara = await TerminologyCrosswalk.findOne({ icd11Tm2Code: 'SP51' });
    assert(jvara !== null, 'Found SP51 (jvaraH) record');
    assert(jvara.verified === true, 'SP51 is marked verified: true');
    assert(jvara.verificationMethod === 'official_crosswalk', 'SP51 verificationMethod is official_crosswalk');
    assert(jvara.source.includes('Ministry of Ayush'), 'SP51 source mentions Ministry of Ayush');

    // =========================================================================
    // Test 2: Running initialization twice without creating duplicates (idempotence)
    // =========================================================================
    console.log('\n[Test 2] Running initialization twice without creating duplicates');
    const seedResult2 = await seedDemoData.seedAuthoritativeCrosswalks({
      clinicId: testClinic._id,
      doctorId: testDoctor._id
    });

    assert(seedResult2.seeded === 0, `Second initialization seeded 0 new records (got ${seedResult2.seeded})`);
    assert(seedResult2.existing === countAfterSeed1, `Second initialization found ${seedResult2.existing} existing records`);
    const countAfterSeed2 = await TerminologyCrosswalk.countDocuments();
    assert(countAfterSeed2 === countAfterSeed1, `Total record count unchanged after second initialization (${countAfterSeed2})`);

    // =========================================================================
    // Test 3: Preservation of existing verified crosswalks
    // =========================================================================
    console.log('\n[Test 3] Preservation of existing verified crosswalks');
    // Create a doctor-verified custom crosswalk
    const customDoctorVerified = await TerminologyCrosswalk.create({
      namcCode: 'AYU-CUSTOM-99',
      ayushTerm: 'Custom Sandhigata Vata',
      system: 'Ayurveda',
      icd11Tm2Code: 'SP99',
      icd11Term: 'Osteoarthritis pattern (TM2)',
      source: 'RAG_Candidate_Doctor_Verified',
      relationshipType: 'equivalent',
      verified: true,
      verifiedBy: testDoctor._id,
      verifiedAt: new Date('2026-05-01'),
      verificationMethod: 'manual'
    });

    // Modify jvara record's ayushTerm to simulate local note
    await TerminologyCrosswalk.updateOne(
      { icd11Tm2Code: 'SP51' },
      { $set: { source: 'Ministry of Ayush - Custom Note Preserved' } }
    );

    // Run initialization again
    await seedDemoData.seedAuthoritativeCrosswalks({
      clinicId: testClinic._id,
      doctorId: testDoctor._id
    });

    // Verify custom crosswalk still exists and unmodified
    const checkCustom = await TerminologyCrosswalk.findOne({ namcCode: 'AYU-CUSTOM-99' });
    assert(checkCustom !== null, 'Custom doctor-verified crosswalk was preserved');
    assert(checkCustom.verified === true, 'Custom crosswalk remains verified: true');
    assert(checkCustom.verifiedBy.toString() === testDoctor._id.toString(), 'Custom crosswalk doctor reference intact');

    // Verify SP51 source was not overwritten
    const checkJvara = await TerminologyCrosswalk.findOne({ icd11Tm2Code: 'SP51' });
    assert(checkJvara.source === 'Ministry of Ayush - Custom Note Preserved', 'Existing verified record was not overwritten by initialization');

    // Clean up custom test record
    await TerminologyCrosswalk.deleteOne({ _id: customDoctorVerified._id });

    // =========================================================================
    // Test 4: Rejection of unverified or conflicting mappings where verification is required
    // =========================================================================
    console.log('\n[Test 4] Rejection of unverified or conflicting mappings');
    // 4a. Candidate mapping (AYU-0205 / SP80) is unverified in crosswalk
    const unverifiedCandidate = await TerminologyCrosswalk.findOne({ namcCode: 'AYU-0205' });
    assert(unverifiedCandidate !== null && unverifiedCandidate.verified === false, 'AYU-0205 exists as unverified candidate');

    // 4b. Lookup rejects unverified candidate
    const lookupCandidate = await mappingService.lookupCrosswalk('AYU-0205', 'NAMC');
    assert(lookupCandidate.found === false, 'Lookup rejects unverified candidate (found: false)');

    // 4c. Direct service registration rejects unverified candidate
    let unverifiedRejected = false;
    try {
      await patientService.createPatient({
        name: 'Unverified Test Patient',
        age: 45,
        diagnosisLabel: 'Su-e-Mizaj',
        namasteCode: 'AYU-0205',
        icd11Tm2Code: 'SP80'
      }, testDoctor);
    } catch (err) {
      unverifiedRejected = true;
      assert(err.status === 400, 'Rejection returned HTTP status 400');
      assert(err.message.includes('do not match an officially verified terminology crosswalk'), 'Error message explains mapping is not verified');
      assert(err.message.includes('doctor must first verify'), 'Error message provides actionable instruction to verify');
    }
    assert(unverifiedRejected, 'Patient registration strictly rejected unverified candidate');

    // 4d. Registration rejects conflicting/mismatched codes (SP51 paired with wrong code SP80)
    let conflictRejected = false;
    try {
      await patientService.createPatient({
        name: 'Conflicting Code Patient',
        age: 38,
        diagnosisLabel: 'Fever with wrong code',
        namasteCode: 'SP51(EC-3)',
        icd11Tm2Code: 'SP80'
      }, testDoctor);
    } catch (err) {
      conflictRejected = true;
      assert(err.status === 400, 'Conflicting code rejected with HTTP 400');
    }
    assert(conflictRejected, 'Patient registration strictly rejected mismatched code pair');

    // =========================================================================
    // Test 5: Successful lookup of an existing verified crosswalk
    // =========================================================================
    console.log('\n[Test 5] Successful lookup of an existing verified crosswalk');
    // 5a. Lookup by exact NAMC code
    const lookupExactNamc = await mappingService.lookupCrosswalk('SP51(EC-3)', 'NAMC');
    assert(lookupExactNamc.found === true, 'Lookup by exact NAMC code (SP51(EC-3)) succeeded');
    assert(lookupExactNamc.icd11Tm2Code === 'SP51', 'Lookup returned correct ICD-11 TM2 code SP51');
    assert(lookupExactNamc.ayushTerm === 'jvaraH', 'Lookup returned correct Ayush term jvaraH');

    // 5b. Lookup by parenthetical morbidity code (EC-3)
    const lookupParenthetical = await mappingService.lookupCrosswalk('EC-3', 'NAMC');
    assert(lookupParenthetical.found === true, 'Lookup by parenthetical morbidity code (EC-3) succeeded');
    assert(lookupParenthetical.namcCode === 'SP51(EC-3)', 'Lookup returned canonical code SP51(EC-3)');

    // 5c. Lookup by ICD-11 TM2 code (SP51)
    const lookupIcd = await mappingService.lookupCrosswalk('SP51', 'ICD11');
    assert(lookupIcd.found === true, 'Lookup by ICD-11 code (SP51) succeeded');
    assert(lookupIcd.namcCode === 'SP51(EC-3)', 'Lookup returned correct NAMC code');

    // 5d. Via HTTP endpoint /api/mapping/lookup
    const httpLookup = await request('/api/mapping/lookup?code=SP51&type=ICD11', {
      token: doctorToken
    });
    assert(httpLookup.status === 200, 'HTTP /api/mapping/lookup returned 200 OK');
    assert(httpLookup.body.found === true, 'HTTP lookup response has found: true');
    assert(httpLookup.body.namcCode === 'SP51(EC-3)', 'HTTP lookup response has expected namcCode');

    // =========================================================================
    // Test 6: Patient registration with a valid verified crosswalk
    // =========================================================================
    console.log('\n[Test 6] Patient registration with a valid verified crosswalk');
    // 6a. Direct service registration with full code
    const patient1 = await patientService.createPatient({
      name: 'Kavita Rao',
      age: 28,
      diagnosisLabel: 'Jvara (Fever disorder)',
      namasteCode: 'SP51(EC-3)',
      icd11Tm2Code: 'SP51'
    }, testDoctor);

    assert(patient1 !== null, 'Patient 1 successfully created');
    assert(patient1.patientCode === 'P001', `Assigned patientCode P001 (got ${patient1.patientCode})`);
    assert(patient1.namasteCode === 'SP51(EC-3)', 'Patient namasteCode matches verified crosswalk');
    assert(patient1.icd11Tm2Code === 'SP51', 'Patient icd11Tm2Code matches verified crosswalk');

    // 6b. HTTP POST /api/patients registration with parenthetical code
    const httpPatientRes = await request('/api/patients', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Rohan Deshmukh',
        age: 34,
        diagnosisLabel: 'Kasa (Cough disorder)',
        namasteCode: 'EA-3', // short parenthetical code for SL41(EA-3)
        icd11Tm2Code: 'SL41'
      }
    });

    assert(httpPatientRes.status === 201, `HTTP POST /api/patients succeeded with 201 Created (got ${httpPatientRes.status})`);
    assert(httpPatientRes.body.name === 'Rohan Deshmukh', 'Registered patient name matches');
    assert(httpPatientRes.body.icd11Tm2Code === 'SL41', 'Registered patient ICD-11 code matches');

    // =========================================================================
    // Test 7: Clear rejection when a required mapping is absent
    // =========================================================================
    console.log('\n[Test 7] Clear rejection when a required mapping is absent');
    // 7a. Non-existent NAMC code
    const httpFailRes = await request('/api/patients', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Invalid Code Patient',
        age: 50,
        diagnosisLabel: 'Unknown Illness',
        namasteCode: 'NONEXISTENT-CODE',
        icd11Tm2Code: 'SP51'
      }
    });

    assert(httpFailRes.status === 400, `Absent mapping returned 400 Bad Request (got ${httpFailRes.status})`);
    const errorMsg = httpFailRes.body.detail || httpFailRes.body.message || '';
    assert(errorMsg.includes('do not match an officially verified terminology crosswalk'), 'Error explains mapping is not verified');
    assert(errorMsg.includes('doctor must first verify this disease mapping in the Disease Mapping module'), 'Error instructs doctor to verify in Disease Mapping module');

    // =========================================================================
    // Test 8: Confirmation that existing patient records are not deleted or modified by initialization
    // =========================================================================
    console.log('\n[Test 8] Existing patient records are not deleted or modified by initialization');
    // Capture state of existing patients
    const patientsBefore = await Patient.find({ clinicId: testClinic._id }).lean();
    assert(patientsBefore.length === 2, `Pre-initialization patient count is 2 (got ${patientsBefore.length})`);

    // Run seedAuthoritativeCrosswalks multiple times
    await seedDemoData.seedAuthoritativeCrosswalks({ clinicId: testClinic._id, doctorId: testDoctor._id });
    await seedDemoData.seedAuthoritativeCrosswalks({ clinicId: testClinic._id, doctorId: testDoctor._id });

    // Re-query patients
    const patientsAfter = await Patient.find({ clinicId: testClinic._id }).lean();
    assert(patientsAfter.length === patientsBefore.length, `Post-initialization patient count matches exactly (${patientsAfter.length})`);

    for (const before of patientsBefore) {
      const after = patientsAfter.find(p => p._id.toString() === before._id.toString());
      assert(after !== undefined, `Patient ${before.patientCode} still exists`);
      assert(after.name === before.name, `Patient ${before.patientCode} name unchanged`);
      assert(after.namasteCode === before.namasteCode, `Patient ${before.patientCode} namasteCode unchanged`);
      assert(after.icd11Tm2Code === before.icd11Tm2Code, `Patient ${before.patientCode} icd11Tm2Code unchanged`);
      assert(after.isDeleted === false, `Patient ${before.patientCode} is not marked deleted`);
    }

    console.log('\n============================================================');
    console.log(`ALL 8 TESTS PASSED SUCCESSFULLY! (${passed} assertions, ${failed} failures)`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n[TEST SUITE FAILURE]', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

runTests();
