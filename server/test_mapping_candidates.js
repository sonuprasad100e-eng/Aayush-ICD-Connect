const mongoose = require('mongoose');
require('dotenv').config();

const mappingService = require('./src/services/mappingService');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');

async function testCandidates() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aayush_icd_connect');
  
  console.log('--- STARTING CANDIDATE SEARCH TEST ---\n');
  
  const beforeCount = await TerminologyCrosswalk.countDocuments();
  console.log(`[SAFETY CHECK] TerminologyCrosswalk count before test: ${beforeCount}`);
  
  const queries = [
    'Jvara',
    'Kāsaḥ',
    'Pramehaḥ',
    'Prameha-piḍakā',
    'jvara',
    'kasa',
    'prameha',
    'piḍakā',
    'fever',
    'cough'
  ];

  for (const q of queries) {
    const result = await mappingService.findMappingCandidates(q);
    console.log(`\n==================================================`);
    console.log(`--- Query: ${q} ---`);
    console.log(`==================================================`);
    
    if (result.candidates.length === 0) {
      console.log('No candidates found.');
      continue;
    }
    
    for (let i = 0; i < Math.min(5, result.candidates.length); i++) {
      const cand = result.candidates[i];
      console.log(`\n--- RANK ${i + 1} ---`);
      
      console.log('NAMC candidate:');
      console.log(`- NAMC ID: ${cand.namcId}`);
      console.log(`- NAMC code: ${cand.namcCode}`);
      console.log(`- NAMC term: ${cand.namcTerm}`);
      console.log(`- NAMC English term: ${cand.namcEnglishTerm}`);
      
      console.log('\nWHO candidate:');
      console.log(`- WHO entity URI: ${cand.whoEntityUri}`);
      console.log(`- ICD-11 TM2 code: ${cand.icd11Tm2Code}`);
      console.log(`- ICD-11 term: ${cand.icd11Term}`);
      console.log(`- matched synonyms: ${JSON.stringify(cand.matchedSynonyms)}`);
      
      console.log('\nEvidence:');
      console.log(`- retrieval method: ${cand.retrievalMethod}`);
      console.log(`- retrieval score: ${cand.retrievalScore}`);
      console.log(`- match reasons: ${JSON.stringify(cand.matchReasons)}`);
      
      console.log('\nSafety:');
      console.log(`- status: ${cand.status}`);
      console.log(`- verified: ${cand.verified}`);
    }
  }

  const afterCount = await TerminologyCrosswalk.countDocuments();
  console.log(`\n[SAFETY CHECK] TerminologyCrosswalk count after test: ${afterCount}`);
  
  if (beforeCount === afterCount) {
    console.log('[SUCCESS] No TerminologyCrosswalk documents were created.');
  } else {
    console.log('[ERROR] TerminologyCrosswalk count changed!');
  }
  
  console.log('\n--- EXISTING LOOKUP TEST ---');
  // Test existing /api/mapping/lookup equivalence
  const lookupRes = await mappingService.lookupCrosswalk('SL41(EA-3)', 'NAMC');
  console.log('Lookup Crosswalk for SL41(EA-3):', lookupRes);
  
  console.log('Test Complete.');
  mongoose.connection.close();
}

testCandidates().catch(console.error);
