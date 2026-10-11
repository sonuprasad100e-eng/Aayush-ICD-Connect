const { getBM25Instance } = require('./retrieval/bm25');

function runTests() {
  const bm25 = getBM25Instance('ICD11');
  
  if (bm25.docCount === 0) {
    console.error('No documents indexed. Please run the ingestion script first.');
    return;
  }

  const queries = [
    'Jvara',
    'Kāsaḥ',
    'Pramehaḥ',
    'Prameha-piḍakā'
  ];

  console.log('--- WHO ICD-11 TM2 BM25 RETRIEVAL TEST ---\n');

  queries.forEach(query => {
    console.log(`\n======================================`);
    console.log(`QUERY: "${query}"`);
    console.log(`======================================`);
    
    const results = bm25.search(query, 3);
    
    if (results.length === 0) {
      console.log('  No candidates found.');
    } else {
      results.forEach((res, index) => {
        const doc = res.document;
        console.log(`\n  Result ${index + 1} (Score: ${res.score.toFixed(4)})`);
        console.log(`  ICD-11 Code:  ${doc.icd11Tm2Code}`);
        console.log(`  ICD-11 Term:  ${doc.icd11Term}`);
        console.log(`  Synonyms:     ${doc.synonyms ? doc.synonyms.join(', ') : 'None'}`);
        console.log(`  Source:       ${doc.source}`);
      });
    }
  });
}

runTests();
