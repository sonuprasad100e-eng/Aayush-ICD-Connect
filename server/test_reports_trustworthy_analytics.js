/**
 * Test Suite: Trustworthy Reports & Analytics
 *
 * Verifies:
 * 1. Correct diagnosis counts:
 *    - Catalogue diagnoses (2,910 approved NAMC entries).
 *    - Registered clinical cases (clinic-isolated Patient records).
 *    - Unique diagnosis concepts.
 * 2. Correct mapping statistics:
 *    - Verified crosswalks vs unverified candidates.
 *    - Clinic confirmed mappings vs unmapped entries.
 *    - Candidates are never counted as verified.
 * 3. Insurance Claims Handling:
 *    - Honest unavailable state (available: false, approvedRate: null, rejectedRate: null).
 *    - No fabricated 96% or 4.2% percentages.
 * 4. Monthly Dual-Coding Volume Aggregation:
 *    - Real timestamps and month grouping.
 *    - Zero volume reported as 0, not fabricated defaults.
 * 5. Available Reports & CSV Generation:
 *    - Morbidity CSV generates genuine clinic patient data with proper headers.
 *    - Dual-coding audit CSV generates genuine mapping data.
 *    - Fabricated claims reports are omitted from file list.
 *    - Requesting a claims report download returns 404 with honest explanation.
 * 6. Clinic Isolation:
 *    - Clinic A data does not leak into Clinic B analytics or CSV exports.
 * 7. Empty Collections:
 *    - Gracefully handles empty database without throwing or reverting to fake fallback constants.
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
const reportService = require('./src/services/reportService');
const app = require('./src/app');

let mongoServer;
let testServer;
let baseUrl = '';
let clinicA, clinicB;
let doctorA, doctorB;
let tokenA = '', tokenB = '';

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
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('====================================================');
  console.log(' RUNNING TRUSTWORTHY REPORTS & ANALYTICS TEST SUITE ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Setup MongoMemoryServer
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    assertSafeTestEnvironment(mongoUri);

    await mongoose.connect(mongoUri);
    console.log('[Setup] Connected to isolated in-memory test database.\n');

    // 2. Start HTTP server
    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const port = testServer.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Setup] Ephemeral test server running at ${baseUrl}\n`);

    // 3. Create Clinics and Doctors
    clinicA = await Clinic.create({
      clinicName: 'Patanjali Ayurveda Kendra',
      doctorName: 'Dr. Sonu',
      email: 'sonu@pak.in',
      phone: '+91 91111 11111',
      address: 'Haridwar',
      city: 'Haridwar',
      state: 'Uttarakhand',
      pincode: '249401'
    });

    clinicB = await Clinic.create({
      clinicName: 'National Homeopathy Care',
      doctorName: 'Dr. Banerjee',
      email: 'banerjee@nhc.in',
      phone: '+91 92222 22222',
      address: 'Kolkata',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001'
    });

    doctorA = await User.create({
      name: 'Dr. Sonu',
      email: 'sonu@pak.in',
      passwordHash: 'dummyhash',
      role: 'doctor',
      clinicId: clinicA._id,
      clinicName: clinicA.clinicName
    });

    doctorB = await User.create({
      name: 'Dr. Banerjee',
      email: 'banerjee@nhc.in',
      passwordHash: 'dummyhash',
      role: 'doctor',
      clinicId: clinicB._id,
      clinicName: clinicB.clinicName
    });

    const env = require('./src/config/env');
    const secret = env.JWT_SECRET || 'secret';
    tokenA = jwt.sign(
      { id: doctorA._id.toString(), sub: doctorA._id.toString(), email: doctorA.email, role: 'doctor', clinicId: clinicA._id.toString() },
      secret,
      { expiresIn: '1h' }
    );
    tokenB = jwt.sign(
      { id: doctorB._id.toString(), sub: doctorB._id.toString(), email: doctorB.email, role: 'doctor', clinicId: clinicB._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    console.log('[TEST GROUP 1] Empty Collections & Non-Fabricated Defaults');
    {
      const res = await request('/api/reports/overview', { token: tokenA });
      assert(res.status === 200, 'Overview endpoint returns 200 on empty collection');
      assert(res.data.catalogueDiagnoses === 2910, 'Reports 2,910 approved NAMC catalogue entries');
      assert(res.data.registeredClinicalCases === 0, 'Reports 0 registered clinical cases when collection is empty (not 2856)');
      assert(res.data.uniqueClinicalConcepts === 0, 'Reports 0 unique clinical concepts when collection is empty');
      assert(res.data.claims.available === false, 'Claims availability is false (honest unavailable state)');
      assert(res.data.claims.claimsApprovedRate === null, 'Claims approved rate is null, not fake 96%');
      assert(res.data.claims.claimsRejectedRate === null, 'Claims rejected rate is null, not fake 4.2%');
      assert(res.data.codesMappedYtd === 789, 'Returns verified crosswalk count (789 baseline in index), not fake 1024');

      const sysRes = await request('/api/reports/system-breakdown', { token: tokenA });
      assert(sysRes.status === 200, 'System breakdown endpoint returns 200 on empty collection');
      assert(Array.isArray(sysRes.data) && sysRes.data.length === 5, 'Returns 5 AYUSH systems in breakdown');
      const totalPct = sysRes.data.reduce((sum, s) => sum + s.percentage, 0);
      assert(Math.abs(totalPct - 100.0) < 0.5 || totalPct === 0, `System breakdown percentages sum to 100% or 0% (actual: ${totalPct}%), not fake 177.8%`);

      const trendRes = await request('/api/reports/trend?months=6', { token: tokenA });
      assert(trendRes.status === 200, 'Monthly trend endpoint returns 200 on empty collection');
      assert(trendRes.data.length === 6, 'Returns 6 chronological months');
      assert(trendRes.data.every(m => m.count === 0 && m.volume === 0), 'Every month reports 0 volume when no mappings exist (not fake [40, 55, ...])');
    }

    console.log('\n[TEST GROUP 2] Seed Verified Crosswalks and Candidate Crosswalks');
    {
      await TerminologyCrosswalk.create([
        {
          namcCode: 'SP51(EC-3)',
          namcId: '689',
          ayushTerm: 'jvaraH',
          system: 'Ayurveda',
          icd11Tm2Code: 'SP51',
          icd11Term: 'Fever disorder (TM2)',
          relationshipType: 'equivalent',
          verified: true,
          verificationMethod: 'official_crosswalk'
        },
        {
          namcCode: 'SL41(EA-3)',
          namcId: '480',
          ayushTerm: 'kAsaH',
          system: 'Ayurveda',
          icd11Tm2Code: 'SL41',
          icd11Term: 'Cough disorder (TM2)',
          relationshipType: 'equivalent',
          verified: true,
          verificationMethod: 'official_crosswalk'
        },
        {
          namcCode: 'AYU-0205',
          ayushTerm: 'Su-e-Mizaj',
          system: 'Unani',
          icd11Tm2Code: 'SP80',
          icd11Term: 'Temperament Disorder',
          relationshipType: 'related',
          verified: false
        }
      ]);

      const res = await request('/api/reports/overview', { token: tokenA });
      assert(res.data.verifiedMappings === 2, 'Verified mappings count matches official verified crosswalks in DB (2)');
      assert(res.data.candidateMappings === 1, 'Candidate mappings count matches unverified crosswalks in DB (1)');
      assert(res.data.verifiedMappings !== res.data.candidateMappings, 'Verified and candidate mappings are strictly distinguished');
    }

    console.log('\n[TEST GROUP 3] Clinical Cases, Unique Concepts, and Clinic Isolation');
    {
      // Register 3 patients for Clinic A
      await Patient.create([
        {
          clinicId: clinicA._id,
          patientCode: 'PAK-P001',
          name: 'Aarav Sharma',
          age: 38,
          diagnosisLabel: 'Jvara (Fever)',
          namasteCode: 'AYU-0011',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        },
        {
          clinicId: clinicA._id,
          patientCode: 'PAK-P002',
          name: 'Pooja Verma',
          age: 45,
          diagnosisLabel: 'Kasa (Cough)',
          namasteCode: 'AYU-0034',
          icd11Tm2Code: 'SL41',
          status: 'review'
        },
        {
          clinicId: clinicA._id,
          patientCode: 'PAK-P003',
          name: 'Rohan Mehra',
          age: 29,
          diagnosisLabel: 'Jvara (Fever)', // Duplicate concept
          namasteCode: 'AYU-0011',
          icd11Tm2Code: 'SP51',
          status: 'stable'
        }
      ]);

      // Register 1 patient for Clinic B
      await Patient.create({
        clinicId: clinicB._id,
        patientCode: 'NHC-P001',
        name: 'Sourav Ganguly',
        age: 50,
        diagnosisLabel: 'Arnica Treatment',
        namasteCode: 'HOM-0099',
        icd11Tm2Code: 'TM2-HOM-01',
        status: 'stable'
      });

      // Clinic A Overview check
      const resA = await request('/api/reports/overview', { token: tokenA });
      assert(resA.data.registeredClinicalCases === 3, 'Clinic A reports exactly 3 registered clinical cases');
      assert(resA.data.uniqueClinicalConcepts === 2, 'Clinic A reports exactly 2 unique concepts (Jvara and Kasa, deduplicating)');

      // Clinic B Overview check (Isolation)
      const resB = await request('/api/reports/overview', { token: tokenB });
      assert(resB.data.registeredClinicalCases === 1, 'Clinic B reports exactly 1 registered clinical case (Clinic A isolated)');
      assert(resB.data.uniqueClinicalConcepts === 1, 'Clinic B reports exactly 1 unique concept');

      // System Breakdown for Clinic A
      const sysA = await request('/api/reports/system-breakdown', { token: tokenA });
      const ayuSys = sysA.data.find(s => s.system === 'Ayurveda');
      assert(ayuSys && ayuSys.count === 3, 'Clinic A system breakdown reflects 3 Ayurveda cases');
      assert(ayuSys.percentage === 100.0, 'Ayurveda percentage is 100% for Clinic A (3 out of 3 cases)');

      // System Breakdown for Clinic B
      const sysB = await request('/api/reports/system-breakdown', { token: tokenB });
      const homSys = sysB.data.find(s => s.system === 'Homeopathy');
      assert(homSys && homSys.count === 1, 'Clinic B system breakdown reflects 1 Homeopathy case');
      assert(homSys.percentage === 100.0, 'Homeopathy percentage is 100% for Clinic B (1 out of 1 case)');
    }

    console.log('\n[TEST GROUP 4] Monthly Trend Aggregation with Real Timestamps');
    {
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);

      // Create confirmed mappings with valid timestamps for Clinic A
      await Mapping.create([
        {
          clinicId: clinicA._id,
          searchTerm: 'Fever',
          namasteCode: 'SP51(EC-3)',
          icd11Tm2Code: 'SP51',
          status: 'confirmed',
          confirmedAt: currentMonth
        },
        {
          clinicId: clinicA._id,
          searchTerm: 'Cough',
          namasteCode: 'SL41(EA-3)',
          icd11Tm2Code: 'SL41',
          status: 'confirmed',
          confirmedAt: currentMonth
        },
        {
          clinicId: clinicA._id,
          searchTerm: 'Old Mapping',
          namasteCode: 'AYU-0042',
          icd11Tm2Code: '5A11',
          status: 'confirmed',
          confirmedAt: twoMonthsAgo
        },
        // Candidate mapping (should not be counted in volume)
        {
          clinicId: clinicA._id,
          searchTerm: 'Candidate Only',
          namasteCode: 'AYU-0099',
          icd11Tm2Code: 'SP99',
          status: 'suggested',
          createdAt: currentMonth
        }
      ]);

      const trendRes = await request('/api/reports/trend?months=6', { token: tokenA });
      const currentMonthItem = trendRes.data[trendRes.data.length - 1];
      const twoMonthsAgoItem = trendRes.data[trendRes.data.length - 3];

      assert(currentMonthItem.count === 2, `Current month reports 2 confirmed mappings (actual: ${currentMonthItem.count})`);
      assert(twoMonthsAgoItem.count === 1, `2 months ago reports 1 confirmed mapping (actual: ${twoMonthsAgoItem.count})`);
      assert(currentMonthItem.volume === 100, 'Current month bar height normalized to 100% (max count)');
      assert(twoMonthsAgoItem.volume === 50, 'Earlier month bar height normalized to 50% (1 out of 2)');

      // Clinic B Trend (Clinic Isolation)
      const trendResB = await request('/api/reports/trend?months=6', { token: tokenB });
      assert(trendResB.data.every(m => m.count === 0), 'Clinic B reports 0 confirmed mappings across all months (isolated)');
    }

    console.log('\n[TEST GROUP 5] Available Reports and Authentic CSV Downloads');
    {
      const filesRes = await request('/api/reports/files', { token: tokenA });
      assert(filesRes.status === 200, 'Files endpoint returns 200');
      assert(Array.isArray(filesRes.data), 'Returns an array of available reports');
      assert(filesRes.data.length === 2, 'Only returns genuine reports (2), excluding fake claims reports');
      const hasClaimsReport = filesRes.data.some(f => f.type === 'claims' || f.name.toLowerCase().includes('claim'));
      assert(!hasClaimsReport, 'Fake insurance claims report is completely eliminated from report list');

      // Test Morbidity CSV Download for Clinic A
      const morbDownload = await request('/api/reports/download/rep-morbidity', { token: tokenA });
      assert(morbDownload.status === 200, 'Morbidity report download returns 200');
      assert(morbDownload.headers.get('content-type').includes('text/csv'), 'Morbidity download returns text/csv header');
      assert(morbDownload.data.includes('Patient Code,Name,Age,Diagnosis,NAMASTE Code,ICD-11 TM2 Code,Status,Date Recorded'), 'CSV contains correct header row');
      assert(morbDownload.data.includes('PAK-P001') && morbDownload.data.includes('Aarav Sharma'), 'CSV contains Clinic A patient PAK-P001');
      assert(!morbDownload.data.includes('NHC-P001') && !morbDownload.data.includes('Sourav Ganguly'), 'CSV does not leak Clinic B patient NHC-P001 (clinic isolation)');

      // Test Morbidity CSV Download for Clinic B
      const morbDownloadB = await request('/api/reports/download/rep-morbidity', { token: tokenB });
      assert(morbDownloadB.data.includes('NHC-P001') && morbDownloadB.data.includes('Sourav Ganguly'), 'Clinic B CSV contains NHC-P001');
      assert(!morbDownloadB.data.includes('PAK-P001'), 'Clinic B CSV does not contain Clinic A patients');

      // Test Dual-Coding Audit CSV Download
      const auditDownload = await request('/api/reports/download/rep-mapping', { token: tokenA });
      assert(auditDownload.status === 200, 'Mapping audit report download returns 200');
      assert(auditDownload.data.includes('Search Term,NAMASTE Code,ICD-11 TM2 Code,Confidence Score,Status,Confirmed Date'), 'Audit CSV contains correct header row');
      assert(auditDownload.data.includes('SP51(EC-3)'), 'Audit CSV contains confirmed mapping code');

      // Test Fake Claims Report Rejection
      const fakeClaimsDownload = await request('/api/reports/download/rep-claims', { token: tokenA });
      assert(fakeClaimsDownload.status === 404, 'Requesting claims download returns 404 (not fabricated CLM-001...CLM-005)');
      assert(fakeClaimsDownload.data.message.includes('No insurance claims data is available'), 'Returns clear, honest explanation that claims integration is pending');
    }

  } catch (err) {
    console.error('[FATAL ERROR IN TEST SUITE]', err);
    failed++;
  } finally {
    if (testServer) {
      await new Promise(resolve => testServer.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
