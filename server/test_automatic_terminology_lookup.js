/**
 * Test Suite: Automatic Two-Way Terminology Lookup & UI Integration
 *
 * Verifies:
 * 1. Lookup by NAMC code (exact, canonical, parenthetical).
 * 2. Lookup by ICD-11 TM2 code (exact, compound).
 * 3. Correct reverse lookup in both directions.
 * 4. Case-insensitivity and whitespace normalization (spaces, tabs, non-breaking spaces).
 * 5. Canonical and parenthetical code formats (auto-detection and explicit types).
 * 6. Missing code and invalid codeType handling.
 * 7. Unverified candidate handling (never returned as verified, HTTP 404 with candidate notice).
 * 8. Duplicate or ambiguous matches handling (matchCount & matches array).
 * 9. Dataset ingestion and repeatability (Excel, processed documents, BM25 indexing, idempotency).
 * 10. Patient registration with a verified crosswalk.
 * 11. Rejection of unverified or mismatched code pairs during patient registration.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Clinic = require('./src/models/Clinic');
const User = require('./src/models/User');
const Patient = require('./src/models/Patient');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const mappingService = require('./src/services/mappingService');
const patientService = require('./src/services/patientService');
const seedDemoData = require('./src/seed/seedDemoData');
const { getBM25Instance } = require('./src/rag/retrieval/bm25');
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
    clinicName: 'Terminology Lookup Test Center',
    doctorName: 'Dr. Terminology Auditor',
    email: 'termaudit@caresync.in',
    phone: '+91 91111 22222',
    address: '200 Knowledge Park',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    specialization: 'Ayurveda'
  });

  // Create isolated Doctor
  testDoctor = await User.create({
    name: 'Dr. Terminology Auditor',
    email: 'termaudit@caresync.in',
    passwordHash: 'dummy_hash',
    role: 'doctor',
    clinicId: testClinic._id
  });

  doctorToken = jwt.sign(
    { id: testDoctor._id, email: testDoctor.email, role: 'doctor', clinicId: testClinic._id },
    process.env.JWT_SECRET || 'care_sync_super_secret_jwt_key_2026',
    { expiresIn: '1h' }
  );

  // Seed authoritative crosswalks into isolated Mongo database
  await seedDemoData.seedAuthoritativeCrosswalks({
    clinicId: testClinic._id,
    doctorId: testDoctor._id
  });

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
    // Test 1: Lookup by NAMC code
    // ----------------------------------------------------
    console.log('\n--- Test 1: Lookup by NAMC code ---');
    {
      const res = await mappingService.lookupCrosswalk('SP51(EC-3)', 'NAMC');
      assert(res.found === true, 'Lookup by exact NAMC code "SP51(EC-3)" succeeded');
      assert(res.verified === true, 'Returned mapping is marked verified: true');
      assert(res.icd11Tm2Code === 'SP51', `Returned ICD-11 TM2 code is SP51 (got "${res.icd11Tm2Code}")`);
      assert(res.ayushTerm === 'jvaraH', `Returned AYUSH diagnosis is jvaraH (got "${res.ayushTerm}")`);
      assert(res.icd11Term === 'Fever disorder (TM2)', `Returned ICD-11 diagnosis is Fever disorder (TM2) (got "${res.icd11Term}")`);

      // HTTP endpoint
      const httpRes = await request('/api/mapping/lookup?code=SP51(EC-3)&type=NAMC', { token: doctorToken });
      assert(httpRes.status === 200, `HTTP GET /api/mapping/lookup returned 200 (got ${httpRes.status})`);
      assert(httpRes.data.found === true, 'HTTP response found === true');
      assert(httpRes.data.icd11Tm2Code === 'SP51', 'HTTP response contains correct icd11Tm2Code');
    }

    // ----------------------------------------------------
    // Test 2: Lookup by ICD-11 TM2 code
    // ----------------------------------------------------
    console.log('\n--- Test 2: Lookup by ICD-11 TM2 code ---');
    {
      const res = await mappingService.lookupCrosswalk('SP51', 'ICD11');
      assert(res.found === true, 'Lookup by ICD-11 code "SP51" succeeded');
      assert(res.verified === true, 'Returned mapping is verified');
      assert(res.namcCode === 'SP51(EC-3)', `Returned NAMC code is SP51(EC-3) (got "${res.namcCode}")`);
      assert(res.ayushTerm === 'jvaraH', 'Returned AYUSH diagnosis matches');

      const httpRes = await request('/api/mapping/lookup?code=SP51&type=ICD11', { token: doctorToken });
      assert(httpRes.status === 200, 'HTTP GET /api/mapping/lookup?type=ICD11 returned 200');
      assert(httpRes.data.namcCode === 'SP51(EC-3)', 'HTTP response returned expected namcCode');
    }

    // ----------------------------------------------------
    // Test 3: Correct reverse lookup
    // ----------------------------------------------------
    console.log('\n--- Test 3: Correct reverse lookup in both directions ---');
    {
      // Direction 1: TM2 code SL41 -> NAMC code SL41(EA-3)
      const forward = await mappingService.lookupCrosswalk('SL41', 'ICD11');
      assert(forward.found === true, 'Reverse lookup from ICD11 "SL41" succeeded');
      assert(forward.namcCode === 'SL41(EA-3)', 'Retrieved NAMC code SL41(EA-3)');
      assert(forward.ayushTerm === 'kAsaH', 'Retrieved AYUSH diagnosis kAsaH');

      // Direction 2: NAMC code SL41(EA-3) -> TM2 code SL41
      const backward = await mappingService.lookupCrosswalk('SL41(EA-3)', 'NAMC');
      assert(backward.found === true, 'Forward lookup from NAMC "SL41(EA-3)" succeeded');
      assert(backward.icd11Tm2Code === 'SL41', 'Retrieved ICD-11 TM2 code SL41');
      assert(backward.icd11Term === 'Cough disorder (TM2)', 'Retrieved ICD diagnosis Cough disorder (TM2)');

      // Verify symmetric equivalence
      assert(forward.namcCode === backward.namcCode, 'Symmetric code pairing verified');
      assert(forward.icd11Tm2Code === backward.icd11Tm2Code, 'Symmetric TM2 code verified');
    }

    // ----------------------------------------------------
    // Test 4: Case and whitespace handling
    // ----------------------------------------------------
    console.log('\n--- Test 4: Case and whitespace handling ---');
    {
      // 4a. Lowercase NAMC
      const resLowerNamc = await mappingService.lookupCrosswalk('sp51(ec-3)', 'NAMC');
      assert(resLowerNamc.found === true, 'Case-insensitive NAMC lookup "sp51(ec-3)" succeeded');

      // 4b. Lowercase ICD-11
      const resLowerIcd = await mappingService.lookupCrosswalk('sp51', 'ICD11');
      assert(resLowerIcd.found === true, 'Case-insensitive ICD11 lookup "sp51" succeeded');

      // 4c. Whitespace padding
      const resPadded = await mappingService.lookupCrosswalk('   SP51   ', 'ICD11');
      assert(resPadded.found === true, 'Trimmed leading/trailing whitespace "   SP51   " succeeded');

      // 4d. Non-breaking space \u00A0
      const resNbsp = await mappingService.lookupCrosswalk('SR10\u00A0(AAA-2.1)', 'NAMC');
      assert(resNbsp.found === true, 'Handled non-breaking space \\u00A0 inside code succeeded');
      assert(resNbsp.ayushTerm === 'vAtaprakopaH', 'Retrieved diagnosis for SR10 (AAA-2.1)');
    }

    // ----------------------------------------------------
    // Test 5: Canonical and parenthetical code formats
    // ----------------------------------------------------
    console.log('\n--- Test 5: Canonical and parenthetical code formats ---');
    {
      // 5a. Bare parenthetical code EC-3
      const resParen = await mappingService.lookupCrosswalk('EC-3', 'NAMC');
      assert(resParen.found === true, 'Bare parenthetical morbidity code "EC-3" resolved to canonical crosswalk');
      assert(resParen.namcCode === 'SP51(EC-3)', 'Returned full canonical code "SP51(EC-3)"');

      // 5b. Parenthesized string "(EC-3)"
      const resParenBracket = await mappingService.lookupCrosswalk('(EC-3)', 'NAMC');
      assert(resParenBracket.found === true, 'Parenthesized query "(EC-3)" resolved correctly');

      // 5c. Prefix search under NAMC: "SP51"
      const resPrefix = await mappingService.lookupCrosswalk('SP51', 'NAMC');
      assert(resPrefix.found === true, 'Canonical prefix "SP51" under NAMC resolved to "SP51(EC-3)"');

      // 5d. Auto-detection: EC-3 (no type parameter)
      const resAutoNamc = await mappingService.lookupCrosswalk('EC-3');
      assert(resAutoNamc.found === true, 'Auto-detected NAMC code "EC-3" without explicit type');

      // 5e. Auto-detection: SP51 (no type parameter)
      const resAutoIcd = await mappingService.lookupCrosswalk('SP51');
      assert(resAutoIcd.found === true, 'Auto-detected ICD-11 code "SP51" without explicit type');

      // 5f. HTTP auto-detect endpoint
      const httpAuto = await request('/api/mapping/lookup?code=EC-3', { token: doctorToken });
      assert(httpAuto.status === 200, 'HTTP GET /api/mapping/lookup?code=EC-3 (no type) returned 200');
      assert(httpAuto.data.namcCode === 'SP51(EC-3)', 'HTTP auto-detected response correct');
    }

    // ----------------------------------------------------
    // Test 6: Missing code and invalid codeType
    // ----------------------------------------------------
    console.log('\n--- Test 6: Missing code and invalid codeType ---');
    {
      const resMissing = await mappingService.lookupCrosswalk('');
      assert(resMissing.found === false, 'Empty code returned found === false');

      const httpMissing = await request('/api/mapping/lookup?code=', { token: doctorToken });
      assert(httpMissing.status === 404, `Missing code returned HTTP 404 - got ${httpMissing.status}`);

      const resInvalidType = await mappingService.lookupCrosswalk('SP51', 'INVALID_TYPE');
      assert(resInvalidType.found === false, 'Invalid codeType returned found === false');
      assert(resInvalidType.message.includes('Invalid codeType'), 'Error message specifies valid types');

      const httpInvalidType = await request('/api/mapping/lookup?code=SP51&type=INVALID_TYPE', { token: doctorToken });
      assert(httpInvalidType.status === 404, 'Invalid codeType returned HTTP 404');
    }

    // ----------------------------------------------------
    // Test 7: Unverified candidate handling
    // ----------------------------------------------------
    console.log('\n--- Test 7: Unverified candidate handling ---');
    {
      const resUnverified = await mappingService.lookupCrosswalk('AYU-0205', 'NAMC');
      assert(resUnverified.found === false, 'Unverified candidate returned found === false (never verified)');
      assert(resUnverified.verified === false, 'Unverified candidate explicitly has verified: false');
      assert(resUnverified.hasUnverifiedCandidate === true, 'Response flags hasUnverifiedCandidate === true');
      assert(resUnverified.candidate !== undefined, 'Candidate information is provided for review');
      assert(resUnverified.candidate.icd11Tm2Code === 'SP80', 'Candidate TM2 code is SP80');
      assert(resUnverified.message.includes('not been officially verified'), 'Message explains official verification is required');

      const httpUnverified = await request('/api/mapping/lookup?code=AYU-0205&type=NAMC', { token: doctorToken });
      assert(httpUnverified.status === 404, `Unverified candidate lookup returned HTTP 404 - got ${httpUnverified.status}`);
      assert(httpUnverified.data.verified === false, 'HTTP response verified is false');
    }

    // ----------------------------------------------------
    // Test 8: Duplicate or ambiguous matches handling
    // ----------------------------------------------------
    console.log('\n--- Test 8: Duplicate or ambiguous matches handling ---');
    {
      // Create a second verified crosswalk sharing the same base category code to test multi-match
      const secondCrosswalk = await TerminologyCrosswalk.create({
        namcCode: 'SP51-VAR(EC-3)',
        ayushTerm: 'jvara-bhedaH (Fever variant)',
        system: 'Ayurveda',
        icd11Tm2Code: 'SP51.1',
        icd11Term: 'Fever variant disorder (TM2)',
        verified: true,
        source: 'Ministry of Ayush Test Extension',
        relationshipType: 'narrower'
      });

      const resMulti = await mappingService.lookupCrosswalk('EC-3', 'NAMC');
      assert(resMulti.found === true, 'Multi-match search found verified records');
      assert(resMulti.matchCount >= 2, `Multi-match matchCount >= 2 (got ${resMulti.matchCount})`);
      assert(Array.isArray(resMulti.matches), 'Multi-match includes matches array');
      assert(resMulti.matches.length >= 2, `matches array has >= 2 entries (got ${resMulti.matches.length})`);

      // Clean up test extension
      await TerminologyCrosswalk.deleteOne({ _id: secondCrosswalk._id });
    }

    // ----------------------------------------------------
    // Test 9: Dataset ingestion and repeatability
    // ----------------------------------------------------
    console.log('\n--- Test 9: Dataset ingestion and repeatability ---');
    {
      const excelPath = path.resolve(__dirname, 'data/rag/namc/NATIONAL AYURVEDA MORBIDITY CODES_2.xlsx');
      assert(fs.existsSync(excelPath), `Excel dataset exists at ${excelPath}`);

      const namcDocsPath = path.resolve(__dirname, 'data/rag/processed/namc_documents.json');
      assert(fs.existsSync(namcDocsPath), `Processed NAMC documents exist at ${namcDocsPath}`);
      const namcDocs = JSON.parse(fs.readFileSync(namcDocsPath, 'utf8'));
      assert(namcDocs.length === 2910, `NAMC documents contains exactly 2,910 records (got ${namcDocs.length})`);

      const icdDocsPath = path.resolve(__dirname, 'data/rag/processed/icd11_tm2_documents.json');
      assert(fs.existsSync(icdDocsPath), `Processed ICD-11 documents exist at ${icdDocsPath}`);
      const icdDocs = JSON.parse(fs.readFileSync(icdDocsPath, 'utf8'));
      assert(icdDocs.length === 1500, `ICD-11 documents contains exactly 1,500 records (got ${icdDocs.length})`);

      const namcIndex = getBM25Instance('NAMC');
      assert(namcIndex.docCount === 2910, `BM25 NAMC index loaded 2,910 documents (got ${namcIndex.docCount})`);

      // Test idempotency of crosswalk seeding
      const countBefore = await TerminologyCrosswalk.countDocuments();
      await seedDemoData.seedAuthoritativeCrosswalks({
        clinicId: testClinic._id,
        doctorId: testDoctor._id
      });
      const countAfter = await TerminologyCrosswalk.countDocuments();
      assert(countBefore === countAfter, `Seed repeatability: count remained identical (${countAfter})`);
    }

    // ----------------------------------------------------
    // Test 10: Patient registration with a verified mapping
    // ----------------------------------------------------
    console.log('\n--- Test 10: Patient registration with a verified mapping ---');
    {
      const res = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Verified Terminology Patient',
          age: 42,
          diagnosisLabel: 'Fever disorder',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        }
      });

      assert(res.status === 201, `Patient registered successfully with HTTP 201 (got ${res.status})`);
      assert(res.data && res.data.patientCode === 'P001', `Assigned safe patient code P001 (got "${res.data && res.data.patientCode}")`);
      assert(res.data && res.data.namasteCode === 'SP51(EC-3)', 'Patient namasteCode matches verified crosswalk');
      assert(res.data && res.data.icd11Tm2Code === 'SP51', 'Patient icd11Tm2Code matches verified crosswalk');
    }

    // ----------------------------------------------------
    // Test 11: Rejection of unverified or mismatched code pairs
    // ----------------------------------------------------
    console.log('\n--- Test 11: Rejection of unverified or mismatched code pairs ---');
    {
      // 11a. Unverified candidate code
      const resUnverified = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Unverified Code Patient',
          age: 30,
          diagnosisLabel: 'Su-e-Mizaj',
          namasteCode: 'AYU-0205',
          icd11Tm2Code: 'SP80',
          status: 'review'
        }
      });

      assert(resUnverified.status === 400, `Unverified crosswalk strictly rejected with HTTP 400 (got ${resUnverified.status})`);
      const errDetail = resUnverified.data && (resUnverified.data.detail || resUnverified.data.message);
      assert(errDetail && errDetail.includes('officially verified terminology crosswalk'), 'Error message informs user of required verification');

      // 11b. Mismatched code pairing
      const resMismatched = await request('/api/patients', {
        method: 'POST',
        token: doctorToken,
        body: {
          name: 'Mismatched Code Patient',
          age: 35,
          diagnosisLabel: 'Jvara with Cough Code',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SL41', // SL41 is Cough, SP51 is Fever
          status: 'review'
        }
      });

      assert(resMismatched.status === 400, `Mismatched crosswalk pair rejected with HTTP 400 (got ${resMismatched.status})`);

      // Verify records were not created
      const unverifiedInDB = await Patient.findOne({ name: 'Unverified Code Patient' });
      assert(unverifiedInDB === null, 'No patient document saved for unverified candidate');
      const mismatchedInDB = await Patient.findOne({ name: 'Mismatched Code Patient' });
      assert(mismatchedInDB === null, 'No patient document saved for mismatched pair');
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
