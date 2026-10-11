require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./src/models/User');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const { getBM25Instance } = require('./src/rag/retrieval/bm25');

const API_BASE = 'http://localhost:8000/api/mapping';
let doctorToken = '';
let staffToken = '';
let doctorUser = null;

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[TEST] Connected to MongoDB');

  await TerminologyCrosswalk.deleteMany({});
  
  doctorUser = new User({
    name: 'Test Doctor 2',
    email: 'doc2@caresync.com',
    passwordHash: 'dummyhash',
    role: 'doctor',
    isActive: true
  });
  await doctorUser.save();
  doctorToken = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const staffUser = new User({
    name: 'Test Staff 2',
    email: 'staff2@caresync.com',
    passwordHash: 'dummyhash',
    role: 'staff',
    isActive: true
  });
  await staffUser.save();
  staffToken = jwt.sign({ id: staffUser._id, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  getBM25Instance('NAMC');
  getBM25Instance('ICD11');
}

async function cleanup() {
  await User.deleteMany({ email: { $in: ['doc2@caresync.com', 'staff2@caresync.com'] } });
  await TerminologyCrosswalk.deleteMany({});
  await mongoose.disconnect();
  console.log('[TEST] Cleaned up and disconnected');
}

async function makeRequest(endpoint, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  try {
    await setup();
    
    const namcIndex = getBM25Instance('NAMC');
    const icd11Index = getBM25Instance('ICD11');
    
    // valid documents (the WHO document natively has no code in the Foundation dataset!)
    const jvaraDoc = namcIndex.documents.find(d => d.ayushTerm === 'jvaraH');
    const feverDoc = icd11Index.documents.find(d => d.icd11Term === 'Fever disorder (TM2)');

    // another WHO doc to test conflicts
    const polyuriaDoc = icd11Index.documents.find(d => d.icd11Term === 'Polyuria disorder due to Pitta (TM2)');
    // another NAMC doc to test conflicts
    const kasaDoc = namcIndex.documents.find(d => d.ayushTerm === 'kAsaH');
    
    console.log(`\n--- Test Case: A. Unauthenticated request ---`);
    let res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, null);
    console.log(`Status: ${res.status} (Expected: 401)`);
    
    console.log(`\n--- Test Case: B. Unauthorized/non-doctor user ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, staffToken);
    console.log(`Status: ${res.status} (Expected: 403)`);

    console.log(`\n--- Test Case: C. Missing namcId ---`);
    res = await makeRequest('/verify-official-code', { whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: D. Missing whoEntityUri ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: E. Missing ICD code ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);
    
    console.log(`\n--- Test Case: F. Invalid relationshipType ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'wrong_type' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: G. Fake NAMC candidate ---`);
    res = await makeRequest('/verify-official-code', { namcId: 'fake-id', whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 404)`);

    console.log(`\n--- Test Case: H. Fake WHO URI ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: 'http://fake.uri', icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 404)`);

    console.log(`\n--- Test Case: I, J, K, L, M. Valid doctor confirmation ---`);
    res = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent', verified: false, score: 999 }, doctorToken); 
    console.log(`Status: ${res.status} (Expected: 200)`);
    const verifiedMapping = res.data.mapping;
    console.log(`Verified is true (Server forced): ${verifiedMapping.verified === true}`);
    console.log(`verifiedBy equals doctor ID: ${verifiedMapping.verifiedBy === doctorUser._id.toString()}`);
    console.log(`verifiedAt exists: ${!!verifiedMapping.verifiedAt}`);
    console.log(`verificationMethod exists: ${verifiedMapping.verificationMethod === 'WHO_ICD11_CODING_TOOL_DOCTOR_REVIEW'}`);
    
    console.log(`\n--- Test Case: N. Duplicate ---`);
    const resDup = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${resDup.status} (Expected: 200)`);
    const count = await TerminologyCrosswalk.countDocuments();
    console.log(`Total TerminologyCrosswalks in DB: ${count} (Expected: 1)`);

    console.log(`\n--- Test Case: O. Conflicting WHO entity ---`);
    const resConflictWho = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: polyuriaDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${resConflictWho.status} (Expected: 409)`);

    console.log(`\n--- Test Case: P1. Conflicting ICD code (same NAMC+WHO, diff code) ---`);
    const resConflictCode1 = await makeRequest('/verify-official-code', { namcId: jvaraDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP99', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${resConflictCode1.status} (Expected: 409)`);

    console.log(`\n--- Test Case: P2. Conflicting ICD code (diff NAMC mapped to same code) ---`);
    const resConflictCode2 = await makeRequest('/verify-official-code', { namcId: kasaDoc.namcId, whoEntityUri: feverDoc.whoEntityUri, icd11Tm2Code: 'SP51', relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${resConflictCode2.status} (Expected: 409)`);

    console.log(`\n--- Test Case: Q. Existing GET /lookup works ---`);
    const lookupRes = await fetch(`${API_BASE}/lookup?code=${jvaraDoc.namcCode}&type=NAMC`, { headers: { 'Authorization': `Bearer ${doctorToken}` }});
    const lookupData = await lookupRes.json();
    console.log(`Lookup Status: ${lookupRes.status} (Expected: 200)`);
    console.log(`Lookup Found: ${lookupData.found}`);
    console.log(`Lookup WHO Code: ${lookupData.icd11Tm2Code}`);

    console.log(`\n--- Test Case: R. Reverse lookup works ---`);
    const reverseLookupRes = await fetch(`${API_BASE}/lookup?code=SP51&type=ICD11`, { headers: { 'Authorization': `Bearer ${doctorToken}` }});
    const reverseLookupData = await reverseLookupRes.json();
    console.log(`Reverse Lookup Status: ${reverseLookupRes.status} (Expected: 200)`);
    console.log(`Reverse Lookup Found: ${reverseLookupData.found}`);
    console.log(`Reverse Lookup NAMC Code: ${reverseLookupData.namcCode}`);
    
    console.log(`\n--- Test Case: S. Candidate endpoint still reports candidates as unverified ---`);
    const candidateRes = await fetch(`${API_BASE}/candidates?term=Jvara`, { headers: { 'Authorization': `Bearer ${doctorToken}` }});
    const candidateData = await candidateRes.json();
    console.log(`Candidate API Verified status: ${candidateData.candidates[0].verified} (Expected: false)`);
    
    console.log(`\n--- Test Case: V. No secrets in API response ---`);
    const hasSecret = JSON.stringify(res.data).includes(process.env.JWT_SECRET);
    console.log(`Response contains JWT secret: ${hasSecret}`);
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await cleanup();
  }
}

runTests();
