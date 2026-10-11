const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./src/models/User');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');

async function testApi() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aayush_icd_connect');
  console.log('[TEST] Connected to MongoDB');

  await User.deleteMany({ email: 'testdoctor@caresync.com' });
  const tempUser = new User({
    name: 'Test Doctor',
    email: 'testdoctor@caresync.com',
    passwordHash: 'dummyhash',
    role: 'doctor',
    isActive: true
  });
  await tempUser.save();
  console.log(`[TEST] Created temporary user: ${tempUser._id}`);

  // Generate a valid JWT token
  const token = jwt.sign(
    { sub: tempUser._id, id: tempUser._id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const baseUrl = 'http://127.0.0.1:8000/api/mapping';
  const headers = { 'Authorization': `Bearer ${token}` };

  const testCases = [
    { name: 'A. Jvara', endpoint: '/candidates?term=Jvara', expectedStatus: 200 },
    { name: 'B. Kāsaḥ', endpoint: '/candidates?term=Kāsaḥ', expectedStatus: 200 },
    { name: 'C. Pramehaḥ', endpoint: '/candidates?term=Pramehaḥ', expectedStatus: 200 },
    { name: 'D. Prameha-piḍakā', endpoint: '/candidates?term=Prameha-piḍakā', expectedStatus: 200 },
    { name: 'E. Missing term', endpoint: '/candidates', expectedStatus: 400 },
    { name: 'F. Empty term', endpoint: '/candidates?term=', expectedStatus: 400 },
    { name: 'G. Unknown term', endpoint: '/candidates?term=XYZUnknownTerm123', expectedStatus: 200 }
  ];

  const beforeCrosswalkCount = await TerminologyCrosswalk.countDocuments();
  console.log(`[TEST] TerminologyCrosswalk count before: ${beforeCrosswalkCount}`);

  for (const tc of testCases) {
    console.log(`\n--- Test Case: ${tc.name} ---`);
    console.log(`GET ${tc.endpoint}`);
    
    try {
      const res = await fetch(`${baseUrl}${tc.endpoint}`, { headers });
      const data = await res.json();
      
      console.log(`Status: ${res.status} (Expected: ${tc.expectedStatus})`);
      if (res.status !== tc.expectedStatus) {
        console.error(`[FAIL] Expected ${tc.expectedStatus} but got ${res.status}`);
      }

      if (res.status === 200 && data.candidates) {
        console.log(`Candidates returned: ${data.count}`);
        
        // J. Verify icd11Tm2Code can be null
        // I. Verify verified=false
        let hasNullCode = false;
        let allVerifiedFalse = true;
        let allStatusCandidate = true;
        
        for (const c of data.candidates) {
          if (c.icd11Tm2Code === null) hasNullCode = true;
          if (c.verified !== false) allVerifiedFalse = false;
          if (c.status !== 'candidate') allStatusCandidate = false;
        }
        
        console.log(`Verified is always false: ${allVerifiedFalse}`);
        console.log(`Status is always 'candidate': ${allStatusCandidate}`);
        if (data.candidates.length > 0) {
            console.log(`Contains candidates with null icd11Tm2Code: ${hasNullCode}`);
            console.log(`Top candidate NAMC: ${data.candidates[0].namcTerm}`);
            console.log(`Top candidate WHO: ${data.candidates[0].icd11Term}`);
        }
      } else if (res.status === 400) {
        console.log(`Error message: ${data.message}`);
      }
    } catch (err) {
      console.error(`[ERROR] Request failed: ${err.message}`);
    }
  }

  // K. Verify existing /mapping/lookup behavior is unchanged
  console.log(`\n--- Test Case: K. Existing Lookup Endpoint ---`);
  const lookupRes = await fetch(`${baseUrl}/lookup?code=SL41(EA-3)&type=NAMC`, { headers });
  const lookupData = await lookupRes.json();
  console.log(`Status: ${lookupRes.status}`);
  console.log(`Lookup response: ${JSON.stringify(lookupData)}`);

  // H. Verify candidate search does NOT create TerminologyCrosswalk records
  const afterCrosswalkCount = await TerminologyCrosswalk.countDocuments();
  console.log(`\n[TEST] TerminologyCrosswalk count after: ${afterCrosswalkCount}`);
  if (beforeCrosswalkCount === afterCrosswalkCount) {
    console.log('[SUCCESS] No TerminologyCrosswalk records were created during candidate searches.');
  } else {
    console.error('[FAIL] TerminologyCrosswalk count changed!');
  }

  // Cleanup
  await User.findByIdAndDelete(tempUser._id);
  console.log(`[TEST] Cleaned up temporary user.`);
  
  await mongoose.disconnect();
}

testApi().catch(console.error);
