const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');

const app = require('./src/app');
const User = require('./src/models/User');
const Clinic = require('./src/models/Clinic');
const Patient = require('./src/models/Patient');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const terminologyIndex = require('./src/services/terminologyIndex');
const seedDemoData = require('./src/seed/seedDemoData');

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
  if (dangerousPatterns.some(p => lower.includes(p)) || process.env.NODE_ENV === 'production') {
    throw new Error(`[SAFETY BLOCKED] Refusing to run tests against: ${uri}`);
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
  console.log('======================================================');
  console.log('--- Setting up Isolated Test Environment for Comprehensive Index ---');
  console.log('======================================================');

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  assertSafeTestEnvironment(uri);

  await mongoose.connect(uri);
  console.log('[Test] Connected to MongoMemoryServer:', uri);

  // Initialize seed crosswalks in DB
  testClinic = await Clinic.create({
    clinicName: 'Aayush Central Clinic',
    doctorName: 'Dr. Sharangadhara',
    email: 'sharangadhara@caresync.in',
    phone: '+91 98888 77777',
    address: '1 Ayurvedic Enclave',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    pincode: '221005',
    specialization: 'Kayachikitsa'
  });

  testDoctor = await User.create({
    name: 'Dr. Sharangadhara',
    email: 'sharangadhara@caresync.in',
    passwordHash: 'dummyhash123',
    role: 'doctor',
    clinicId: testClinic._id,
    clinicName: testClinic.clinicName
  });

  await seedDemoData.seedAuthoritativeCrosswalks({
    clinicId: testClinic._id,
    doctorId: testDoctor._id
  });

  const secret = process.env.JWT_SECRET || 'secret';
  doctorToken = jwt.sign(
    { id: testDoctor._id.toString(), email: testDoctor.email, role: 'doctor', clinicId: testClinic._id.toString() },
    secret,
    { expiresIn: '1h' }
  );

  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test] HTTP Server running on ${baseUrl}\n`);
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
  console.log('[Test] Teardown complete.\n');
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    await setup();

    // =========================================================================
    // Test 1: Comprehensive Dataset Statistics Verification
    // =========================================================================
    console.log('--- Test 1: Comprehensive Dataset Statistics ---');
    const stats = terminologyIndex.getStatistics();
    assert(stats.totalNamcRecords === 2910, `NAMC records count is 2,910 (got ${stats.totalNamcRecords})`);
    assert(stats.totalWhoFoundationConcepts === 1500, `WHO Foundation concepts count is 1,500 (got ${stats.totalWhoFoundationConcepts})`);
    assert(stats.verifiedCrosswalks >= 780, `Indexed verified crosswalks count >= 780 (got ${stats.verifiedCrosswalks})`);
    assert(stats.uniqueVerifiedTm2Codes === 400, `Unique verified TM2 codes count is 400 (got ${stats.uniqueVerifiedTm2Codes})`);
    assert(stats.uniqueVerifiedNamcCodes >= 780, `Unique verified NAMC codes count >= 780 (got ${stats.uniqueVerifiedNamcCodes})`);
    assert(stats.unmappedNamcRecords === 2104, `Unmapped NAMC records count is 2,104 (got ${stats.unmappedNamcRecords})`);
    assert(stats.unverifiedCandidates === 3, `Unverified candidates count is 3 (got ${stats.unverifiedCandidates})`);

    // =========================================================================
    // Test 2: Exact Code Matches (Both Directions)
    // =========================================================================
    console.log('\n--- Test 2: Exact Code Matches in Both Directions ---');
    // Direction A: TM2 code SR11 -> NAMC AAA-1
    const resSR11 = await request('/api/mapping/lookup?code=SR11&type=ICD11', { token: doctorToken });
    assert(resSR11.status === 200, 'GET /api/mapping/lookup?code=SR11 returned 200');
    assert(resSR11.body.found === true, 'SR11 lookup returned found: true');
    assert(resSR11.body.verified === true, 'SR11 lookup returned verified: true');
    assert(resSR11.body.namcCode.includes('AAA-1'), `SR11 resolved to AAA-1 (got ${resSR11.body.namcCode})`);
    assert(resSR11.body.ayushTerm === 'vAtasa~jcayaH', `SR11 Ayush diagnosis is vAtasa~jcayaH (got ${resSR11.body.ayushTerm})`);
    assert(resSR11.body.icd11Term.includes('Accumulation of Vata'), 'SR11 ICD term mentions Accumulation of Vata');

    // Direction B: Reverse lookup from NAMC morbidity code AAA-1 -> TM2 SR11
    const resAAA1 = await request('/api/mapping/lookup?code=AAA-1&type=NAMC', { token: doctorToken });
    assert(resAAA1.status === 200, 'GET /api/mapping/lookup?code=AAA-1 returned 200');
    assert(resAAA1.body.found === true, 'AAA-1 lookup returned found: true');
    assert(resAAA1.body.verified === true, 'AAA-1 lookup returned verified: true');
    assert(resAAA1.body.icd11Tm2Code === 'SR11', `AAA-1 resolved to SR11 (got ${resAAA1.body.icd11Tm2Code})`);

    // Another bidirectional pair: SK51 <-> AAC-35 (viSvAcI / Cervicobrachial pain)
    const resSK51 = await request('/api/mapping/lookup?code=SK51&type=ICD11', { token: doctorToken });
    assert(resSK51.status === 200, 'GET /api/mapping/lookup?code=SK51 returned 200');
    assert(resSK51.body.ayushTerm === 'viSvAcI', `SK51 Ayush term is viSvAcI (got ${resSK51.body.ayushTerm})`);

    const resAAC35 = await request('/api/mapping/lookup?code=AAC-35&type=NAMC', { token: doctorToken });
    assert(resAAC35.status === 200, 'GET /api/mapping/lookup?code=AAC-35 returned 200');
    assert(resAAC35.body.icd11Tm2Code === 'SK51', `AAC-35 resolved to SK51 (got ${resAAC35.body.icd11Tm2Code})`);

    // =========================================================================
    // Test 3: Alternative Code Formats & Parenthetical Syntax
    // =========================================================================
    console.log('\n--- Test 3: Alternative Code Formats & Syntax ---');
    // Format 1: Inverted format where NAMC is outside and TM2 is inside parentheses: ED-4.3.2(SN5Y)
    const resInverted = await request('/api/mapping/lookup?code=ED-4.3.2(SN5Y)', { token: doctorToken });
    assert(resInverted.status === 200, 'GET /api/mapping/lookup?code=ED-4.3.2(SN5Y) returned 200');
    assert(resInverted.body.found === true, 'Inverted format resolved successfully');
    assert(resInverted.body.icd11Tm2Code === 'SN5Y', `Inverted format extracted TM2 code SN5Y (got ${resInverted.body.icd11Tm2Code})`);
    assert(resInverted.body.namcCode.includes('ED-4.3.2'), 'Inverted format extracted NAMC code ED-4.3.2');

    // Format 2: Morbidity code with spaces: SR11 (AAA-1)
    const resSpaced = await request('/api/mapping/lookup?code=SR11%20(AAA-1)', { token: doctorToken });
    assert(resSpaced.status === 200, 'Lookup with spaces returned 200');
    assert(resSpaced.body.found === true, 'Spaced compound code resolved');

    // Format 3: Bare morbidity query inside parentheses: (AAA-1)
    const resParenOnly = await request('/api/mapping/lookup?code=(AAA-1)', { token: doctorToken });
    assert(resParenOnly.status === 200, 'Lookup with (AAA-1) returned 200');
    assert(resParenOnly.body.icd11Tm2Code === 'SR11', 'Bare parenthesized code resolved to SR11');

    // =========================================================================
    // Test 4: Term & Synonym Search API
    // =========================================================================
    console.log('\n--- Test 4: Term & Synonym Search ---');
    // Search by Sanskrit transliteration
    const resSearchAyush = await request('/api/mapping/search?term=viSvAcI', { token: doctorToken });
    assert(resSearchAyush.status === 200, 'GET /api/mapping/search?term=viSvAcI returned 200');
    assert(resSearchAyush.body.verified.length >= 1, `Found verified match for viSvAcI (got ${resSearchAyush.body.verified.length})`);
    assert(resSearchAyush.body.verified[0].icd11Tm2Code === 'SK51', 'viSvAcI search mapped to SK51');

    // Search by IAST Diacritic term
    const resSearchDiacritic = await request('/api/mapping/search?term=viśvācī', { token: doctorToken });
    assert(resSearchDiacritic.status === 200, 'GET /api/mapping/search?term=viśvācī returned 200');
    assert(resSearchDiacritic.body.verified.length >= 1, 'IAST diacritic matched verified record');

    // Search by English diagnostic term
    const resSearchEnglish = await request('/api/mapping/search?term=Cervicobrachial', { token: doctorToken });
    assert(resSearchEnglish.status === 200, 'GET /api/mapping/search?term=Cervicobrachial returned 200');
    assert(resSearchEnglish.body.verified.length >= 1, 'English diagnosis matched verified record');

    // =========================================================================
    // Test 5: Ambiguous / Multi-Match Results
    // =========================================================================
    console.log('\n--- Test 5: Ambiguous & Multi-Match Results ---');
    // SN5Y represents Thickening of skin disorder which covers multiple NAMC sub-conditions
    const resMulti = await request('/api/mapping/lookup?code=SN5Y&type=ICD11', { token: doctorToken });
    assert(resMulti.status === 200, 'GET /api/mapping/lookup?code=SN5Y returned 200');
    assert(resMulti.body.matchCount > 1, `SN5Y returned multiple sub-condition matches (got ${resMulti.body.matchCount})`);
    assert(Array.isArray(resMulti.body.matches), 'SN5Y returned matches array');
    assert(resMulti.body.matches.length === resMulti.body.matchCount, 'matches array length equals matchCount');

    // =========================================================================
    // Test 6: Unverified Candidate Protection
    // =========================================================================
    console.log('\n--- Test 6: Unverified Candidate Protection ---');
    const resCandidate = await request('/api/mapping/lookup?code=AYU-0205&type=NAMC', { token: doctorToken });
    assert(resCandidate.status === 404, 'Unverified candidate returned HTTP 404');
    assert(resCandidate.body.found === false, 'Candidate returned found: false');
    assert(resCandidate.body.verified === false, 'Candidate returned verified: false');
    assert(resCandidate.body.hasUnverifiedCandidate === true, 'Candidate flagged hasUnverifiedCandidate: true');
    assert(resCandidate.body.candidate.icd11Tm2Code === 'SP80', 'Candidate contains TM2 code SP80');
    assert(resCandidate.body.message.includes('Disease mappings must be officially verified'), 'Message warns verification is required');

    // =========================================================================
    // Test 7: Unmapped Catalog Codes
    // =========================================================================
    console.log('\n--- Test 7: Unmapped Catalog Codes ---');
    // EC-3.1 is prodromes of jvara in NAMC catalog, without a WHO TM2 code
    const resUnmapped = await request('/api/mapping/lookup?code=EC-3.1&type=NAMC', { token: doctorToken });
    assert(resUnmapped.status === 404, 'Unmapped NAMC code returned HTTP 404');
    assert(resUnmapped.body.found === false, 'Unmapped returned found: false');
    assert(resUnmapped.body.verified === false, 'Unmapped returned verified: false');
    assert(resUnmapped.body.inDataset === true, 'Unmapped flagged inDataset: true');
    assert(resUnmapped.body.namcEntry.ayushTerm === 'jvara-pUrvarupam', 'Returned catalog Ayush term');
    assert(resUnmapped.body.message.includes('does not currently have an established WHO ICD-11 TM2 dual-code mapping'), 'Message clearly states unmapped status');

    // =========================================================================
    // Test 8: Patient Registration Integration with Dataset Dual Codes
    // =========================================================================
    console.log('\n--- Test 8: Patient Registration with Verified Dataset Dual Code ---');
    // Doctor registers a patient using dataset dual code SR11 / AAA-1
    const resPatient1 = await request('/api/patients', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Keshav Sharma',
        age: 48,
        status: 'stable',
        diagnosisLabel: 'vAtasa~jcayaH',
        namasteCode: 'SR11(AAA-1)',
        icd11Tm2Code: 'SR11'
      }
    });
    assert(resPatient1.status === 201, `Patient created with dataset dual code (HTTP 201, got ${resPatient1.status})`);
    assert(resPatient1.body.patientCode === 'P001', `Assigned patient code P001 (got ${resPatient1.body.patientCode})`);
    assert(resPatient1.body.namasteCode === 'SR11(AAA-1)', 'Patient namasteCode matches');
    assert(resPatient1.body.icd11Tm2Code === 'SR11', 'Patient icd11Tm2Code matches');

    // =========================================================================
    // Test 9: Strict Patient Registration Rejection of Unmapped & Candidate Codes
    // =========================================================================
    console.log('\n--- Test 9: Strict Patient Registration Rejection ---');
    // Reject candidate code AYU-0205
    const resRejectCandidate = await request('/api/patients', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Pooja Verma',
        age: 32,
        status: 'stable',
        diagnosisLabel: 'Su-e-Mizaj',
        namasteCode: 'AYU-0205',
        icd11Tm2Code: 'SP80'
      }
    });
    assert(resRejectCandidate.status === 400, 'Unverified candidate strictly rejected with HTTP 400');
    assert(resRejectCandidate.body.detail.includes('Disease Mapping module'), 'Rejection instructs doctor to verify in Disease Mapping');

    // Reject unmapped code EC-3.1
    const resRejectUnmapped = await request('/api/patients', {
      method: 'POST',
      token: doctorToken,
      body: {
        name: 'Vikas Gupta',
        age: 26,
        status: 'stable',
        diagnosisLabel: 'jvara-pUrvarupam',
        namasteCode: 'EC-3.1',
        icd11Tm2Code: 'SP51' // Fake pairing
      }
    });
    assert(resRejectUnmapped.status === 400, 'Unmapped code pair strictly rejected with HTTP 400');
    assert(resRejectUnmapped.body.detail.includes('do not match an officially verified terminology crosswalk'), 'Rejection prevents fake pairings');

    // Confirm database has only Keshav Sharma saved
    const patientCount = await Patient.countDocuments({ clinicId: testClinic._id });
    assert(patientCount === 1, `Exactly 1 valid patient persisted in clinic (got ${patientCount})`);

    console.log('\n======================================================');
    console.log(`--- Test Suite Results: ${passed}/${passed + failed} Passed (0 Failed) ---`);
    console.log('======================================================\n');
  } finally {
    await teardown();
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL ERROR IN TEST RUNNER]', err);
  process.exit(1);
});
