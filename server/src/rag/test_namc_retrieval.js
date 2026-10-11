const { getBM25Instance } = require('./retrieval/bm25');

function runTests() {
  const bm25 = getBM25Instance();
  
  if (bm25.docCount === 0) {
    console.error('No documents indexed. Please run the ingestion script first.');
    return;
  }

  const queries = [
    'Jvara',
    'Kāsaḥ',
    'Pramehaḥ',
    'vātaprakopaḥ',
    'Fever',
    'Cough',
    'AAA-2.3' // Actual NAMC code from dataset
  ];

  console.log('--- NAMC BM25 RETRIEVAL TEST ---\n');

  queries.forEach(query => {
    console.log(`\n======================================`);
    console.log(`QUERY: "${query}"`);
    console.log(`======================================`);
    
    const results = bm25.search(query, 3); // top 3
    
    if (results.length === 0) {
      console.log('  No candidates found.');
    } else {
      results.forEach((res, index) => {
        const doc = res.document;
        console.log(`\n  Result ${index + 1} (Score: ${res.score.toFixed(4)})`);
        console.log(`  NAMC_CODE:    ${doc.namcCode}`);
        console.log(`  AYUSH Term:   ${doc.ayushTerm}`);
        console.log(`  English Term: ${doc.englishTerm}`);
        console.log(`  Source:       ${doc.source}`);
      });
    }
  });

  // Check embedding configuration status
  console.log('\n--- SYSTEM STATUS ---');
  const embeddingProvider = process.env.EMBEDDING_PROVIDER;
  if (!embeddingProvider) {
    console.log('Embeddings Config: DISABLED (EMBEDDING_PROVIDER not set. Relying on BM25 lexical search only).');
  } else {
    console.log(`Embeddings Config: ENABLED (Provider: ${embeddingProvider})`);
  }
}

runTests();
