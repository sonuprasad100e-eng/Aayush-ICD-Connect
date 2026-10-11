const { retrieveCandidates } = require('./src/rag/retrieval/bm25');

async function testRetrieval() {
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

  console.log('--- PHASE 5 RETRIEVAL TEST ---');

  for (const q of queries) {
    const res = await retrieveCandidates(q);
    console.log('--- Query ---');
    console.log(q);
    console.log('NAMC candidates:');
    if (res.candidates && res.candidates.length > 0 && res.candidates[0].namcId) {
      console.log('  namcId:', res.candidates[0].namcId);
      console.log('  namcCode:', res.candidates[0].namcCode);
      console.log('  namcTerm:', res.candidates[0].namcTerm);
      // retrievalScore might be attached to NAMC internally, but the output structure from retrieveCandidates uses it for the final candidate combination
    } else {
      console.log('  None found or NAMC doc was null.');
    }
    
    console.log('WHO candidates:');
    if (res.candidates && res.candidates.length > 0) {
      for (const cand of res.candidates) {
        if (!cand.whoEntityUri && !cand.icd11Term) {
            console.log('  NOT RETRIEVED');
            continue;
        }
        console.log('  whoEntityUri:', cand.whoEntityUri);
        console.log('  icd11Tm2Code:', cand.icd11Tm2Code);
        console.log('  icd11Term:', cand.icd11Term);
        console.log('  matchedSynonyms:', cand.matchedSynonyms);
        console.log('  retrievalScore:', cand.retrievalScore);
        console.log('  matchReasons:', cand.matchReasons);
        console.log('  verified:', cand.verified);
      }
    } else {
      console.log('  NOT RETRIEVED');
    }
    console.log();
  }
}

testRetrieval().catch(e => console.error(e));
