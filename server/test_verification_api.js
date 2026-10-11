require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./src/models/User');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const { getBM25Instance } = require('./src/rag/retrieval/bm25');
const fs = require('fs');

const API_BASE = 'http://127.0.0.1:8000/api/mapping';
let doctorToken = '';
let staffToken = '';
let doctorUser = null;
let staffUser = null;

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[TEST] Connected to MongoDB');

  // Clean existing crosswalks for test
  await TerminologyCrosswalk.deleteMany({});
  await User.deleteMany({ email: { $in: ['doctor_verify@caresync.com', 'staff_verify@caresync.com'] } });
  
  // Create temp Doctor
  doctorUser = new User({
    name: 'Test Doctor',
    email: 'doctor_verify@caresync.com',
    passwordHash: 'dummyhash',
    role: 'doctor',
    isActive: true
  });
  await doctorUser.save();
  doctorToken = jwt.sign({ id: doctorUser._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Create temp Staff
  staffUser = new User({
    name: 'Test Staff',
    email: 'staff_verify@caresync.com',
    passwordHash: 'dummyhash',
    role: 'staff',
    isActive: true
  });
  await staffUser.save();
  staffToken = jwt.sign({ id: staffUser._id, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // Make sure BM25 is initialized so documents are loaded
  getBM25Instance('NAMC');
  getBM25Instance('ICD11');
}

async function cleanup() {
  await User.deleteMany({ email: { $in: ['doctor_verify@caresync.com', 'staff_verify@caresync.com'] } });
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
    
    // We need valid IDs from the RAG index to test effectively
    const namcIndex = getBM25Instance('NAMC');
    const icd11Index = getBM25Instance('ICD11');
    
    // Invalid TM2 candidate (null icd11Tm2Code) e.g., Fever
    const invalidNamc = namcIndex.documents.find(d => d.ayushTerm === 'jvaraH');
    const invalidWho = icd11Index.documents.find(d => d.icd11Term === 'Fever disorder (TM2)');
    
    console.log(`\n--- Test Case: A. Unauthenticated request ---`);
    let res = await makeRequest('/verify', { namcId: invalidNamc.namcId, whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'equivalent' }, null);
    console.log(`Status: ${res.status} (Expected: 401)`);
    
    console.log(`\n--- Test Case: B. Unauthorized/non-doctor user ---`);
    res = await makeRequest('/verify', { namcId: invalidNamc.namcId, whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'equivalent' }, staffToken);
    console.log(`Status: ${res.status} (Expected: 403)`);

    console.log(`\n--- Test Case: C. Missing namcId ---`);
    res = await makeRequest('/verify', { whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);
    console.log(`Message: ${res.data.message}`);

    console.log(`\n--- Test Case: D. Missing WHO Entity URI ---`);
    res = await makeRequest('/verify', { namcId: invalidNamc.namcId, relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);
    
    console.log(`\n--- Test Case: E. Invalid relationshipType ---`);
    res = await makeRequest('/verify', { namcId: invalidNamc.namcId, whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'wrong_type' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 400)`);

    console.log(`\n--- Test Case: F. Nonexistent candidate ---`);
    res = await makeRequest('/verify', { namcId: 'fake-id', whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 404)`);

    console.log(`\n--- Test Case: G. WHO candidate with null icd11Tm2Code ---`);
    res = await makeRequest('/verify', { namcId: invalidNamc.namcId, whoEntityUri: invalidWho.whoEntityUri, relationshipType: 'equivalent' }, doctorToken);
    console.log(`Status: ${res.status} (Expected: 422)`);
    console.log(`Message: ${res.data.message}`);

    console.log(`\n--- Test Case: O. Existing GET /lookup works ---`);
    const lookupRes = await fetch(`${API_BASE}/lookup?code=${invalidNamc.namcCode}&type=NAMC`, { headers: { 'Authorization': `Bearer ${doctorToken}` }});
    const lookupData = await lookupRes.json();
    console.log(`Lookup Status: ${lookupRes.status} (Expected: 404 or 200 with not found)`);
    console.log(`Lookup Found: ${lookupData.found}`);

    console.log(`\n--- Test Case: Q. Candidate endpoint still returns candidates as verified=false ---`);
    const candidateRes = await fetch(`${API_BASE}/candidates?term=Kāsaḥ`, { headers: { 'Authorization': `Bearer ${doctorToken}` }});
    const candidateData = await candidateRes.json();
    console.log(`Candidate API Verified status: ${candidateData.candidates[0].verified} (Expected: false)`);
    
    console.log(`\n--- Test Case: T. No secrets in API response ---`);
    const hasSecret = JSON.stringify(res.data).includes(process.env.JWT_SECRET);
    console.log(`Response contains JWT secret: ${hasSecret}`);
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await cleanup();
  }
}

runTests();
