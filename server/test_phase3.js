const fs = require('fs');

const icd11Data = JSON.parse(fs.readFileSync('./data/rag/processed/icd11_tm2_documents.json', 'utf8'));

let tm1Count = 0;
let tm2Count = 0;
let withSynonyms = 0;
let withNonNullCode = 0;
let withNullCode = 0;

for (const doc of icd11Data) {
  const isTm2 = doc.icd11Term && doc.icd11Term.includes('(TM2)');
  const isTm1 = doc.icd11Term && doc.icd11Term.includes('(TM1)');
  
  if (isTm2) tm2Count++;
  if (isTm1) tm1Count++;
  
  if (doc.synonyms && doc.synonyms.length > 0) withSynonyms++;
  if (doc.icd11Tm2Code !== null && doc.icd11Tm2Code !== '') withNonNullCode++;
  else withNullCode++;
}

console.log('--- WHO INGESTION STATISTICS ---');
console.log('Total WHO documents:', icd11Data.length);
console.log('TM1 documents:', tm1Count);
console.log('TM2 documents:', tm2Count);
console.log('Documents with synonyms:', withSynonyms);
console.log('Documents with non-null icd11Tm2Code:', withNonNullCode);
console.log('Documents with null icd11Tm2Code:', withNullCode);

console.log('\n--- FIRST 10 TM2 RECORDS ---');
let printed = 0;
for (const doc of icd11Data) {
  if (doc.icd11Term && doc.icd11Term.includes('(TM2)')) {
    console.log(`Term: ${doc.icd11Term}`);
    console.log(`  icd11Tm2Code: ${doc.icd11Tm2Code}`);
    console.log(`  whoEntityUri: ${doc.whoEntityUri}`);
    console.log(`  whoParentUri: ${doc.whoParentUri}`);
    console.log(`  synonyms: ${JSON.stringify(doc.synonyms)}`);
    printed++;
    if (printed >= 10) break;
  }
}
