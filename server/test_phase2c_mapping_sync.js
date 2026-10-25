/**
 * Test Suite: Phase 2C — Synchronize Verified Mapping Records & Dashboard Statistics
 *
 * Verifies:
 * 1. Doctor verifies a mapping and the record is persisted.
 * 2. The verified mapping appears in the recent mappings API/UI data.
 * 3. Dashboard statistics reflect actual records.
 * 4. Duplicate records do not inflate statistics.
 * 5. Unverified mappings are not counted as verified.
 * 6. Conflicting mappings do not overwrite existing verified records.
 * 7. Existing patient records and crosswalks remain unchanged.
 * 8. Clinic-specific data remains isolated.
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
const mappingService = require('./src/services/mappingService');
const dashboardService = require('./src/services/dashboardService');
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
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, body: data };
}

async function setup() {
  console.log('\n--- Setting up isolated in-memory test environment for Phase 2C ---');
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  assertSafeTestEnvironment(uri);

  await mongoose.connect(uri);
  console.log('[Setup] Connected to MongoMemoryServer at:', uri);

  // Start ephemeral HTTP server on dynamic port
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Setup] Ephemeral test server listening at: ${baseUrl}`);
      resolve();
    });
  });

  // Create Clinic A
  clinicA = await Clinic.create({
    clinicName: 'Phase2C Clinic Alpha',
    doctorName: 'Dr. Alpha',
    email: 'alpha@phase2c.test',
    phone: '+91 91111 11111',
    address: '100 Alpha Way',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001'
  });

  doctorA = await User.create({
    name: 'Dr. Alpha',
    email: 'doctorA@phase2c.test',
    passwordHash: 'dummyhash',
    role: 'doctor',
    clinicId: clinicA._id,
    clinicName: clinicA.clinicName
  });

  // Create Clinic B (for isolation testing)
  clinicB = await Clinic.create({
    clinicName: 'Phase2C Clinic Beta',
    doctorName: 'Dr. Beta',
    email: 'beta@phase2c.test',
    phone: '+91 92222 22222',
    address: '200 Beta Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  });

  doctorB = await User.create({
    name: 'Dr. Beta',
    email: 'doctorB@phase2c.test',
    passwordHash: 'dummyhash',
    role: 'doctor',
    clinicId: clinicB._id,
    clinicName: clinicB.clinicName
  });

  const secret = process.env.JWT_SECRET || 'secret';
  tokenA = jwt.sign(
    { id: doctorA._id.toString(), email: doctorA.email, role: 'doctor', clinicId: clinicA._id.toString() },
    secret,
    { expiresIn: '1h' }
  );

  tokenB = jwt.sign(
    { id: doctorB._id.toString(), email: doctorB.email, role: 'doctor', clinicId: clinicB._id.toString() },
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
    // Initial State Check: Empty database stats and empty recent mappings
    // =========================================================================
    console.log('[Initial Check] Empty state verification');
    const emptyStatsRes = await request('/api/mapping/stats', { token: tokenA });
    assert(emptyStatsRes.status === 200, 'GET /api/mapping/stats returns 200 on empty db');
    assert(emptyStatsRes.body.mappedCount === 0, `Initial mappedCount is strictly 0 (got ${emptyStatsRes.body.mappedCount}, NOT 542)`);
    assert(emptyStatsRes.body.unmappedCount === 0, `Initial unmappedCount is strictly 0 (got ${emptyStatsRes.body.unmappedCount}, NOT 23)`);
    assert(emptyStatsRes.body.avgConfidence === 0, `Initial avgConfidence is 0 (got ${emptyStatsRes.body.avgConfidence})`);

    const emptyRecentRes = await request('/api/mapping/recent?limit=10', { token: tokenA });
    assert(emptyRecentRes.status === 200, 'GET /api/mapping/recent returns 200 on empty db');
    assert(Array.isArray(emptyRecentRes.body) && emptyRecentRes.body.length === 0, 'GET /api/mapping/recent returns empty array []');

    // Create existing patient records for Test 7 baseline
    const patientPre1 = await Patient.create({
      patientCode: 'P_ALPHA_01',
      name: 'Ramesh Patel',
      age: 42,
      diagnosisLabel: 'Jvara',
      namasteCode: 'SP51(EC-3)',
      icd11Tm2Code: 'SP51',
      clinicId: clinicA._id,
      createdBy: doctorA._id,
      updatedBy: doctorA._id
    });

    const patientPre2 = await Patient.create({
      patientCode: 'P_BETA_01',
      name: 'Suresh Rao',
      age: 38,
      diagnosisLabel: 'Kasa',
      namasteCode: 'SL41(EA-3)',
      icd11Tm2Code: 'SL41',
      clinicId: clinicB._id,
      createdBy: doctorB._id,
      updatedBy: doctorB._id
    });

    // =========================================================================
    // Test 1: Doctor verifies a mapping and the record is persisted
    // =========================================================================
    console.log('\n[Test 1] Doctor verifies a mapping and the record is persisted');
    const verifyRes = await request('/api/mapping/verify-official-code', {
      method: 'POST',
      token: tokenA,
      body: {
        namcId: '689', // jvaraH in NAMC dataset
        whoEntityUri: 'https://id.who.int/icd/entity/1754178993', // WHO fever disorder
        icd11Tm2Code: 'SP51',
        relationshipType: 'equivalent'
      }
    });

    assert(verifyRes.status === 200, `POST /api/mapping/verify-official-code returned 200 (got ${verifyRes.status})`);
    assert(verifyRes.body.success === true, 'Verification response has success: true');
    assert(verifyRes.body.mapping.verified === true, 'Returned mapping is verified: true');

    // Check persistence in authoritative model (TerminologyCrosswalk)
    const crosswalkDoc = await TerminologyCrosswalk.findOne({ icd11Tm2Code: 'SP51' });
    assert(crosswalkDoc !== null, 'Record persisted in TerminologyCrosswalk');
    assert(crosswalkDoc.verified === true, 'TerminologyCrosswalk verified === true');
    assert(crosswalkDoc.verifiedBy.toString() === doctorA._id.toString(), 'TerminologyCrosswalk verifiedBy matches Doctor Alpha');
    assert(crosswalkDoc.source === 'WHO_ICD11_CODING_TOOL', 'TerminologyCrosswalk source is WHO_ICD11_CODING_TOOL');

    // Check synchronization to legacy model (Mapping) for Clinic Alpha
    const legacyDoc = await Mapping.findOne({ clinicId: clinicA._id, icd11Tm2Code: 'SP51' });
    assert(legacyDoc !== null, 'Synchronized record exists in Mapping for Clinic Alpha');
    assert(legacyDoc.status === 'confirmed', 'Mapping status is confirmed');
    assert(legacyDoc.confirmedBy.toString() === doctorA._id.toString(), 'Mapping confirmedBy matches Doctor Alpha');
    assert(legacyDoc.namasteCode === crosswalkDoc.namcCode, 'Mapping namasteCode matches TerminologyCrosswalk namcCode');

    // =========================================================================
    // Test 2: The verified mapping appears in the recent mappings API/UI data
    // =========================================================================
    console.log('\n[Test 2] Verified mapping appears in recent mappings API data');
    const recentRes = await request('/api/mapping/recent?limit=10', { token: tokenA });
    assert(recentRes.status === 200, 'GET /api/mapping/recent returned 200');
    assert(Array.isArray(recentRes.body) && recentRes.body.length === 1, `Recent mappings contains exactly 1 record (got ${recentRes.body.length})`);

    const recentItem = recentRes.body[0];
    assert(recentItem.icd11Tm2Code === 'SP51', 'Recent mapping has ICD-11 TM2 code SP51');
    assert(recentItem.namasteCode === 'SP51(EC-3)', 'Recent mapping has NAMASTE code SP51(EC-3)');
    assert(recentItem.searchTerm.includes('jvaraH'), `Recent mapping searchTerm includes jvaraH (got ${recentItem.searchTerm})`);
    assert(recentItem.confidenceScore >= 90, `Recent mapping confidenceScore is >= 90 (got ${recentItem.confidenceScore})`);
    assert(recentItem.verified === true, 'Recent mapping has verified: true');

    // =========================================================================
    // Test 3: Dashboard statistics reflect actual records
    // =========================================================================
    console.log('\n[Test 3] Dashboard statistics reflect actual records');
    // 3a. Mapping Stats (/api/mapping/stats)
    const statsRes = await request('/api/mapping/stats', { token: tokenA });
    assert(statsRes.status === 200, 'GET /api/mapping/stats returned 200');
    assert(statsRes.body.mappedCount === 1, `mappedCount is strictly 1 (got ${statsRes.body.mappedCount}, NOT 543)`);
    assert(statsRes.body.unmappedCount === 0, `unmappedCount is strictly 0 (got ${statsRes.body.unmappedCount})`);
    assert(statsRes.body.avgConfidence === 98, `avgConfidence reflects actual verified confidence (got ${statsRes.body.avgConfidence}%)`);

    // 3b. Dashboard Summary (/api/dashboard/summary) for Clinic Alpha
    const dashResA = await request('/api/dashboard/summary', { token: tokenA });
    assert(dashResA.status === 200, 'GET /api/dashboard/summary for Clinic A returned 200');
    assert(dashResA.body.mappingCount === 1, `Clinic A dashboard mappingCount is 1 (got ${dashResA.body.mappingCount})`);
    assert(dashResA.body.mappedCount === 1, `Clinic A dashboard mappedCount is 1 (got ${dashResA.body.mappedCount})`);
    assert(dashResA.body.unmappedCount === 0, `Clinic A dashboard unmappedCount is 0 (got ${dashResA.body.unmappedCount})`);
    assert(dashResA.body.mappingRate === 100, `Clinic A dashboard mappingRate is 100% (got ${dashResA.body.mappingRate}%)`);

    // =========================================================================
    // Test 4: Duplicate records do not inflate statistics
    // =========================================================================
    console.log('\n[Test 4] Duplicate records do not inflate statistics');
    // Verify the exact same record again via API (duplicate verification attempt)
    const duplicateVerifyRes = await request('/api/mapping/verify-official-code', {
      method: 'POST',
      token: tokenA,
      body: {
        namcId: '689',
        whoEntityUri: 'https://id.who.int/icd/entity/1754178993',
        icd11Tm2Code: 'SP51',
        relationshipType: 'equivalent'
      }
    });

    assert(duplicateVerifyRes.status === 200, 'Duplicate verification returned 200 idempotently');
    const totalCrosswalkCount = await TerminologyCrosswalk.countDocuments();
    assert(totalCrosswalkCount === 1, `Total TerminologyCrosswalks is still 1 (got ${totalCrosswalkCount})`);

    const totalClinicAMappings = await Mapping.countDocuments({ clinicId: clinicA._id });
    assert(totalClinicAMappings === 1, `Total Clinic A Mappings is still 1 (got ${totalClinicAMappings})`);

    // Check that recent mappings still returns only 1 entry (not duplicated)
    const recentDedupRes = await request('/api/mapping/recent?limit=10', { token: tokenA });
    assert(recentDedupRes.body.length === 1, `Recent mappings contains exactly 1 record after duplicate attempt (got ${recentDedupRes.body.length})`);

    // Check that stats still report mappedCount === 1 (not 2)
    const statsDedupRes = await request('/api/mapping/stats', { token: tokenA });
    assert(statsDedupRes.body.mappedCount === 1, `mappedCount is strictly 1 (got ${statsDedupRes.body.mappedCount})`);

    // =========================================================================
    // Test 5: Unverified mappings are not counted as verified
    // =========================================================================
    console.log('\n[Test 5] Unverified mappings are not counted as verified');
    // Insert an unverified candidate in TerminologyCrosswalk
    const unverifiedCandidate = await TerminologyCrosswalk.create({
      namcCode: 'AYU-0205',
      ayushTerm: 'Su-e-Mizaj',
      system: 'Unani',
      icd11Tm2Code: 'SP80',
      icd11Term: 'Temperament Disorder (TM2 Candidate)',
      source: 'Unverified AYUSH Clinical Catalog',
      relationshipType: 'related',
      verified: false
    });

    // Insert an unmapped entry in Mapping for Clinic Alpha
    const unmappedClinicEntry = await Mapping.create({
      searchTerm: 'Unmapped Diagnosis Query',
      namasteCode: 'AYU-UNMAPPED-01',
      icd11Tm2Code: 'SP90',
      confidenceScore: 50,
      clinicId: clinicA._id,
      status: 'unmapped'
    });

    // Check /api/mapping/stats
    const statsUnverifiedRes = await request('/api/mapping/stats', { token: tokenA });
    assert(statsUnverifiedRes.body.mappedCount === 1, `mappedCount remains strictly 1 (got ${statsUnverifiedRes.body.mappedCount})`);
    assert(statsUnverifiedRes.body.unmappedCount === 2, `unmappedCount is 2 (candidate + unmapped legacy, got ${statsUnverifiedRes.body.unmappedCount})`);
    assert(statsUnverifiedRes.body.pendingCount === 2, `pendingCount is 2 (got ${statsUnverifiedRes.body.pendingCount})`);

    // Check Clinic Alpha dashboard summary:
    const dashUnverifiedRes = await request('/api/dashboard/summary', { token: tokenA });
    assert(dashUnverifiedRes.body.mappedCount === 1, `Clinic A dashboard mappedCount is strictly 1 (got ${dashUnverifiedRes.body.mappedCount})`);
    assert(dashUnverifiedRes.body.unmappedCount === 1, `Clinic A dashboard unmappedCount is 1 (got ${dashUnverifiedRes.body.unmappedCount})`);
    assert(dashUnverifiedRes.body.mappingRate === 50, `Clinic A mappingRate is 50% (1 confirmed / 2 total, got ${dashUnverifiedRes.body.mappingRate}%)`);

    // Clean up test entries
    await TerminologyCrosswalk.deleteOne({ _id: unverifiedCandidate._id });
    await Mapping.deleteOne({ _id: unmappedClinicEntry._id });

    // =========================================================================
    // Test 6: Conflicting mappings do not overwrite existing verified records
    // =========================================================================
    console.log('\n[Test 6] Conflicting mappings do not overwrite existing verified records');
    // Try verifying the same NAMC term to a different WHO entity
    const conflictRes = await request('/api/mapping/verify-official-code', {
      method: 'POST',
      token: tokenA,
      body: {
        namcId: '689', // jvaraH
        whoEntityUri: 'https://id.who.int/icd/entity/1280110553', // Valid WHO entity (Polyuria disorder), conflicting for jvaraH
        icd11Tm2Code: 'SP51',
        relationshipType: 'equivalent'
      }
    });

    assert(conflictRes.status === 409, `Conflicting entity returned HTTP 409 Conflict (got ${conflictRes.status})`);

    // Try verifying the same NAMC term to a different ICD code
    const conflictCodeRes = await request('/api/mapping/verify-official-code', {
      method: 'POST',
      token: tokenA,
      body: {
        namcId: '689',
        whoEntityUri: 'https://id.who.int/icd/entity/1754178993',
        icd11Tm2Code: 'SP99', // Conflicting code
        relationshipType: 'equivalent'
      }
    });

    assert(conflictCodeRes.status === 409, `Conflicting code returned HTTP 409 Conflict (got ${conflictCodeRes.status})`);

    // Verify existing crosswalk document is completely intact
    const originalCrosswalk = await TerminologyCrosswalk.findOne({ icd11Tm2Code: 'SP51' });
    assert(originalCrosswalk.whoEntityUri === 'https://id.who.int/icd/entity/1754178993', 'Existing WHO URI unchanged');
    assert(originalCrosswalk.icd11Tm2Code === 'SP51', 'Existing ICD-11 code unchanged');
    assert(originalCrosswalk.verified === true, 'Existing verified status unchanged');

    // =========================================================================
    // Test 7: Existing patient records and crosswalks remain unchanged
    // =========================================================================
    console.log('\n[Test 7] Existing patient records remain unchanged');
    const checkPatient1 = await Patient.findById(patientPre1._id);
    assert(checkPatient1 !== null, 'Patient 1 still exists');
    assert(checkPatient1.name === 'Ramesh Patel', 'Patient 1 name unchanged');
    assert(checkPatient1.namasteCode === 'SP51(EC-3)', 'Patient 1 namasteCode unchanged');
    assert(checkPatient1.icd11Tm2Code === 'SP51', 'Patient 1 icd11Tm2Code unchanged');
    assert(checkPatient1.isDeleted === false, 'Patient 1 is not deleted');

    const checkPatient2 = await Patient.findById(patientPre2._id);
    assert(checkPatient2 !== null, 'Patient 2 still exists');
    assert(checkPatient2.name === 'Suresh Rao', 'Patient 2 name unchanged');
    assert(checkPatient2.clinicId.toString() === clinicB._id.toString(), 'Patient 2 clinic association unchanged');

    // =========================================================================
    // Test 8: Clinic-specific data remains isolated
    // =========================================================================
    console.log('\n[Test 8] Clinic-specific data remains isolated');
    // Doctor Beta from Clinic Beta accesses dashboard summary
    const dashResB = await request('/api/dashboard/summary', { token: tokenB });
    assert(dashResB.status === 200, 'GET /api/dashboard/summary for Clinic B returned 200');
    assert(dashResB.body.mappingCount === 0, `Clinic B mappingCount is strictly 0 (got ${dashResB.body.mappingCount})`);
    assert(dashResB.body.mappedCount === 0, `Clinic B mappedCount is strictly 0 (got ${dashResB.body.mappedCount})`);
    assert(dashResB.body.unmappedCount === 0, `Clinic B unmappedCount is strictly 0 (got ${dashResB.body.unmappedCount})`);
    assert(dashResB.body.patientCount === 1, `Clinic B patientCount is strictly 1 (only Suresh Rao, got ${dashResB.body.patientCount})`);

    // Verify Clinic Alpha dashboard summary remains isolated to Clinic Alpha
    const dashResA2 = await request('/api/dashboard/summary', { token: tokenA });
    assert(dashResA2.body.patientCount === 1, `Clinic A patientCount is strictly 1 (only Ramesh Patel, got ${dashResA2.body.patientCount})`);
    assert(dashResA2.body.mappingCount === 1, `Clinic A mappingCount is strictly 1 (got ${dashResA2.body.mappingCount})`);

    console.log('\n============================================================');
    console.log(`ALL 8 PHASE 2C TESTS PASSED SUCCESSFULLY! (${passed} assertions, ${failed} failures)`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n[PHASE 2C TEST FAILURE]', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

runTests();
