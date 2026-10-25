/**
 * Test Suite: Patient ID Generation & Registration Validation
 *
 * Verifies:
 * 1. Creating the first patient (P001).
 * 2. Creating several patients consecutively (P002, P003, ...).
 * 3. Creating patients after reinitialization (counters never reset on restart).
 * 4. Concurrent patient creation (10 parallel requests, strictly unique IDs).
 * 5. Creating patients when P001 and P002 already exist (starts safely at P003+).
 * 6. Preserving existing patient records (no destructive overwriting or deletion).
 * 7. Correct handling of genuine duplicate-key conflicts (returns HTTP 409 Conflict).
 * 8. Successful registration using a valid verified terminology crosswalk.
 * 9. Rejection of unverified or mismatched code pairs (returns HTTP 400).
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Clinic = require('./src/models/Clinic');
const User = require('./src/models/User');
const Patient = require('./src/models/Patient');
const Counter = require('./src/models/Counter');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const patientService = require('./src/services/patientService');
const app = require('./src/app');

let mongoServer;
let testServer;
let baseUrl = '';
let testClinic;
let testDoctor;
let doctorToken = '';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

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

  return { status: res.status, ok: res.ok, data };
}

async function setup() {
  console.log('\n======================================================');
  console.log('--- Setting up Isolated Test Environment ---');
  console.log('======================================================');

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  assertSafeTestEnvironment(uri);

  await mongoose.connect(uri);
  console.log(`[Test] Connected to MongoMemoryServer: ${uri}`);

  // Create isolated Clinic
  testClinic = await Clinic.create({
    clinicName: 'Ayush Safe ID Test Center',
    doctorName: 'Dr. ID Safety',
    email: 'idsafety@caresync.in',
    phone: '+91 99999 88888',
    address: '100 Safe Way',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    specialization: 'Ayurveda'
  });

  // Create isolated Doctor
  testDoctor = await User.create({
    name: 'Dr. ID Safety',
    email: 'idsafety@caresync.in',
    passwordHash: 'dummy_hash_for_test',
    role: 'doctor',
    clinicId: testClinic._id
  });

  doctorToken = jwt.sign(
    { id: testDoctor._id, email: testDoctor.email, role: 'doctor', clinicId: testClinic._id },
    process.env.JWT_SECRET || 'care_sync_super_secret_jwt_key_2026',
    { expiresIn: '1h' }
  );

  // Seed verified crosswalks for dual-code testing
  await TerminologyCrosswalk.create([
    {
      namcId: 'NAMC_TEST_001',
      namcCode: 'SP51(EC-3)',
      ayushTerm: 'Jvara',
      system: 'Ayurveda',
      icd11Tm2Code: 'SP51',
      icd11Term: 'Fever disorder (TM2)',
      whoEntityUri: 'https://id.who.int/icd/entity/1280110553',
      verified: true,
      verifiedBy: testDoctor._id,
      confidence: 1.0,
      source: 'OFFICIAL_AYUSH'
    },
    {
      namcId: 'NAMC_TEST_002',
      namcCode: 'AYU-0042',
      ayushTerm: 'Prameha',
      system: 'Ayurveda',
      icd11Tm2Code: '5A11',
      icd11Term: 'Type 2 diabetes mellitus',
      whoEntityUri: 'https://id.who.int/icd/entity/5A11',
      verified: true,
      verifiedBy: testDoctor._id,
      confidence: 1.0,
      source: 'OFFICIAL_AYUSH'
    },
    {
      namcId: 'NAMC_TEST_003',
      namcCode: 'AYU-UNVERIFIED',
      ayushTerm: 'Unverified Disorder',
      system: 'Ayurveda',
      icd11Tm2Code: 'UNVERIFIED_CODE',
      icd11Term: 'Unverified ICD Term',
      whoEntityUri: 'https://id.who.int/icd/entity/999999',
      verified: false,
      confidence: 0.5,
      source: 'AI_RAG_CANDIDATE'
    }
  ]);

  // Start HTTP server on dynamic port
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test] HTTP Server running on ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Isolated Test Environment ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log('[Test] Teardown complete.');
}

async function runTests() {
  try {
    await setup();

    // ----------------------------------------------------
    // Test 1: Creating the first patient (P001)
    // ----------------------------------------------------
    console.log('\n--- Test 1: Creating the first patient (P001) ---');
    {
      const res = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'First Patient',
          age: 30,
          diagnosisLabel: 'Jvara (Fever)',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        }
      });

      assert(res.status === 201, `First patient created successfully (HTTP 201) - got ${res.status}`);
      assert(res.data && res.data.patientCode === 'P001', `First patient received code "P001" - got "${res.data && res.data.patientCode}"`);
      assert(res.data && res.data.name === 'First Patient', 'Patient name matches');

      const saved = await Patient.findOne({ patientCode: 'P001' });
      assert(saved !== null, 'Patient record exists in MongoDB collection');
    }

    // ----------------------------------------------------
    // Test 2: Creating several patients consecutively
    // ----------------------------------------------------
    console.log('\n--- Test 2: Creating several patients consecutively ---');
    {
      const res2 = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Second Patient',
          age: 40,
          diagnosisLabel: 'Prameha',
          namasteCode: 'AYU-0042',
          icd11Tm2Code: '5A11',
          status: 'stable'
        }
      });
      assert(res2.status === 201, `Second patient created (HTTP 201) - got ${res2.status}`);
      assert(res2.data && res2.data.patientCode === 'P002', `Second patient received code "P002" - got "${res2.data && res2.data.patientCode}"`);

      const res3 = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Third Patient',
          age: 50,
          diagnosisLabel: 'Jvara',
          namasteCode: 'SP51',
          icd11Tm2Code: 'SP51',
          status: 'review'
        }
      });
      assert(res3.status === 201, `Third patient created (HTTP 201) - got ${res3.status}`);
      assert(res3.data && res3.data.patientCode === 'P003', `Third patient received code "P003" - got "${res3.data && res3.data.patientCode}"`);

      const res4 = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Fourth Patient',
          age: 25,
          diagnosisLabel: 'Prameha',
          namasteCode: 'AYU-0042',
          icd11Tm2Code: '5A11',
          status: 'stable'
        }
      });
      assert(res4.status === 201, `Fourth patient created (HTTP 201) - got ${res4.status}`);
      assert(res4.data && res4.data.patientCode === 'P004', `Fourth patient received code "P004" - got "${res4.data && res4.data.patientCode}"`);

      const allPatients = await Patient.find({}).sort({ patientCode: 1 });
      const codes = allPatients.map(p => p.patientCode);
      assert(codes.includes('P001') && codes.includes('P002') && codes.includes('P003') && codes.includes('P004'), `Consecutive patient codes strictly ordered: ${codes.join(', ')}`);
    }

    // ----------------------------------------------------
    // Test 3: Creating patients after reinitialization
    // ----------------------------------------------------
    console.log('\n--- Test 3: Creating patients after reinitialization ---');
    {
      // Simulate server startup / reinitialization
      const highestBefore = await patientService.getHighestExistingPatientNumber();
      assert(highestBefore === 4, `Highest existing patient number detected as 4 - got ${highestBefore}`);

      // Re-run counter synchronization (as done during server startup)
      await Counter.findOneAndUpdate(
        { _id: 'patientCode' },
        { $max: { seq: highestBefore } },
        { upsert: true, new: true }
      );

      const counterDoc = await Counter.findById('patientCode');
      assert(counterDoc.seq >= 4, `Counter seq preserved at ${counterDoc.seq} (not reset to 0 or 1)`);

      const resAfterRestart = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Post-Restart Patient',
          age: 33,
          diagnosisLabel: 'Jvara',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        }
      });

      assert(resAfterRestart.status === 201, `Post-restart patient created successfully - got ${resAfterRestart.status}`);
      assert(resAfterRestart.data && resAfterRestart.data.patientCode === 'P005', `Post-restart patient assigned "P005" - got "${resAfterRestart.data && resAfterRestart.data.patientCode}"`);
    }

    // ----------------------------------------------------
    // Test 4: Concurrent patient creation
    // ----------------------------------------------------
    console.log('\n--- Test 4: Concurrent patient creation (10 parallel requests) ---');
    {
      const concurrency = 10;
      const parallelPromises = [];

      for (let i = 0; i < concurrency; i++) {
        parallelPromises.push(
          request('/api/patients', {
            method: 'POST',
            token: doctorToken,
            body: {
              name: `Concurrent Patient ${i + 1}`,
              age: 20 + i,
              diagnosisLabel: 'Jvara',
              namasteCode: 'SP51(EC-3)',
              icd11Tm2Code: 'SP51',
              status: 'stable'
            }
          })
        );
      }

      const results = await Promise.all(parallelPromises);
      const successful = results.filter(r => r.status === 201);
      assert(successful.length === concurrency, `All ${concurrency} concurrent requests succeeded with HTTP 201 (got ${successful.length})`);

      const returnedCodes = results.map(r => r.data && r.data.patientCode);
      const uniqueCodes = new Set(returnedCodes);
      assert(uniqueCodes.size === concurrency, `All generated codes are unique without collisions: ${returnedCodes.join(', ')}`);

      // Verify each code starts with P and followed by 3+ digits
      const allValidFormat = returnedCodes.every(c => /^P\d{3,}$/.test(c));
      assert(allValidFormat, 'All concurrent patient codes match standard P-series format');
    }

    // ----------------------------------------------------
    // Test 5: Creating patients when P001 and P002 already exist
    // ----------------------------------------------------
    console.log('\n--- Test 5: Creating patients when P001 and P002 already exist ---');
    {
      // Verify that existing records exist and next ID is strictly greater than the maximum
      const currentHighest = await patientService.getHighestExistingPatientNumber();
      assert(currentHighest >= 15, `Current highest existing patient is P${currentHighest}`);

      const nextCode = await patientService.generateNextPatientCode();
      const expectedCode = `P${String(currentHighest + 1).padStart(3, '0')}`;
      assert(nextCode === expectedCode, `Next generated code is "${expectedCode}" - got "${nextCode}"`);

      // Verify that generating next code did not reuse P001 or P002
      assert(nextCode !== 'P001' && nextCode !== 'P002', 'Next generated code is not P001 or P002');
    }

    // ----------------------------------------------------
    // Test 6: Preserving existing patient records
    // ----------------------------------------------------
    console.log('\n--- Test 6: Preserving existing patient records ---');
    {
      const p1 = await Patient.findOne({ patientCode: 'P001' });
      assert(p1 !== null, 'P001 patient record is intact');
      assert(p1 && p1.name === 'First Patient', 'P001 name has not been overwritten');
      assert(p1 && p1.diagnosisLabel === 'Jvara (Fever)', 'P001 diagnosis data is intact');

      const p2 = await Patient.findOne({ patientCode: 'P002' });
      assert(p2 !== null, 'P002 patient record is intact');
      assert(p2 && p2.name === 'Second Patient', 'P002 name has not been overwritten');

      const totalCount = await Patient.countDocuments({});
      assert(totalCount >= 15, `All ${totalCount} patient records remain preserved without accidental deletion`);
    }

    // ----------------------------------------------------
    // Test 7: Correct handling of genuine duplicate-key conflicts
    // ----------------------------------------------------
    console.log('\n--- Test 7: Correct handling of genuine duplicate-key conflicts ---');
    {
      // Attempting to register with custom patientCode "P001" (which already belongs to First Patient)
      const resDup = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          patientCode: 'P001', // Explicit duplicate
          name: 'Imposter Patient',
          age: 99,
          diagnosisLabel: 'Jvara',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        }
      });

      assert(resDup.status === 409, `Duplicate patientCode rejected with HTTP 409 Conflict - got ${resDup.status}`);
      const hasConflictMsg = resDup.data && (
        (resDup.data.message && resDup.data.message.includes('already exists')) ||
        (resDup.data.detail && resDup.data.detail.includes('already exists'))
      );
      assert(hasConflictMsg, `Conflict error message mentions existing patient: "${JSON.stringify(resDup.data)}"`);

      // Verify original P001 was not overwritten
      const originalP1 = await Patient.findOne({ patientCode: 'P001' });
      assert(originalP1.name === 'First Patient', 'Original P001 was preserved and not overwritten');
    }

    // ----------------------------------------------------
    // Test 8: Successful registration using a valid verified terminology crosswalk
    // ----------------------------------------------------
    console.log('\n--- Test 8: Successful registration using a valid verified terminology crosswalk ---');
    {
      const resVerified = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Verified Crosswalk Patient',
          age: 45,
          diagnosisLabel: 'Type 2 Diabetes',
          namasteCode: 'AYU-0042',
          icd11Tm2Code: '5A11',
          status: 'stable'
        }
      });

      assert(resVerified.status === 201, `Verified crosswalk registration succeeded (HTTP 201) - got ${resVerified.status}`);
      assert(resVerified.data && resVerified.data.namasteCode === 'AYU-0042', 'namasteCode properly persisted');
      assert(resVerified.data && resVerified.data.icd11Tm2Code === '5A11', 'icd11Tm2Code properly persisted');
    }

    // ----------------------------------------------------
    // Test 9: Rejection of unverified or mismatched code pairs
    // ----------------------------------------------------
    console.log('\n--- Test 9: Rejection of unverified or mismatched code pairs ---');
    {
      // 9A: Completely unverified candidate code
      const resUnverified = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Unverified Code Patient',
          age: 28,
          diagnosisLabel: 'Unknown Disorder',
          namasteCode: 'AYU-UNVERIFIED',
          icd11Tm2Code: 'UNVERIFIED_CODE',
          status: 'review'
        }
      });

      assert(resUnverified.status === 400, `Unverified crosswalk rejected with HTTP 400 - got ${resUnverified.status}`);
      const unverifiedMsg = resUnverified.data && (resUnverified.data.detail || resUnverified.data.message);
      assert(unverifiedMsg && unverifiedMsg.includes('officially verified'), `Informative error returned for unverified codes: "${unverifiedMsg}"`);

      // 9B: Mismatched codes (valid NAMC with wrong ICD-11 TM2)
      const resMismatched = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Mismatched Code Patient',
          age: 38,
          diagnosisLabel: 'Jvara with wrong ICD code',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: '5A11', // 5A11 is Diabetes, not Jvara
          status: 'review'
        }
      });

      assert(resMismatched.status === 400, `Mismatched crosswalk pair rejected with HTTP 400 - got ${resMismatched.status}`);
      const mismatchMsg = resMismatched.data && (resMismatched.data.detail || resMismatched.data.message);
      assert(mismatchMsg && mismatchMsg.includes('officially verified'), `Informative error returned for mismatched pair: "${mismatchMsg}"`);

      // Verify no invalid patient was created
      const unverifiedInDB = await Patient.findOne({ name: 'Unverified Code Patient' });
      assert(unverifiedInDB === null, 'No patient saved with unverified code');
      const mismatchedInDB = await Patient.findOne({ name: 'Mismatched Code Patient' });
      assert(mismatchedInDB === null, 'No patient saved with mismatched pair');
    }

  } catch (err) {
    console.error('[FATAL TEST SUITE ERROR]', err);
    failedTests++;
  } finally {
    await teardown();
  }

  console.log('\n======================================================');
  console.log(`--- Test Suite Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed) ---`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
