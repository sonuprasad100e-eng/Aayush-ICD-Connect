const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const INPUT_FILE = path.join(__dirname, '../../../data/rag/namc/NATIONAL AYURVEDA MORBIDITY CODES_2.xlsx');
const OUTPUT_FILE = path.join(__dirname, '../../../data/rag/processed/namc_documents.json');

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function ingestNamc() {
  console.log(`Starting NAMC ingestion from: ${INPUT_FILE}`);
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('ERROR: NAMC dataset not found.');
    process.exit(1);
  }

  const workbook = xlsx.readFile(INPUT_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Read as objects using the first row as header
  const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  let successCount = 0;
  let skipCount = 0;
  const processedDocs = [];

  for (const row of data) {
    const namcCode = normalize(row['NAMC_CODE']);
    
    // Skip if there is no NAMC_CODE (invalid record)
    if (!namcCode) {
      skipCount++;
      continue;
    }

    const namcId = normalize(row['NAMC_ID']);
    const ayushTerm = normalize(row['NAMC_term']);
    const diacriticTerm = normalize(row['NAMC_term_diacritical']);
    const devanagariTerm = normalize(row['NAMC_term_DEVANAGARI']);
    const englishTerm = normalize(row['Name English']);
    const englishIndexTerm = normalize(row['Name English Under Index']);
    const shortDefinition = normalize(row['Short_definition']);
    const longDefinition = normalize(row['Long_definition']);
    const ontologyBranches = normalize(row['Ontology_branches']);
    const primaryIndexRelated = normalize(row['Primary Index Related']);

    // Build the searchable text chunk
    const searchableTextParts = [
      namcCode,
      ayushTerm,
      diacriticTerm,
      devanagariTerm,
      englishTerm,
      englishIndexTerm,
      shortDefinition,
      longDefinition
    ].filter(Boolean); // removes empty strings
    
    const searchableText = searchableTextParts.join(' ');

    const doc = {
      sourceType: 'NAMC',
      namcCode,
      namcId,
      ayushTerm,
      diacriticTerm,
      devanagariTerm,
      englishTerm,
      englishIndexTerm,
      shortDefinition,
      longDefinition,
      ontologyBranches,
      primaryIndexRelated,
      searchableText,
      source: 'National Ayurveda Morbidity Codes'
    };

    processedDocs.push(doc);
    successCount++;
  }

  // Ensure processed directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedDocs, null, 2));

  console.log('Ingestion Complete.');
  console.log(`Successfully ingested records: ${successCount}`);
  console.log(`Skipped/invalid records: ${skipCount}`);
  console.log(`Saved normalized documents to: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  ingestNamc();
}

module.exports = { ingestNamc };
