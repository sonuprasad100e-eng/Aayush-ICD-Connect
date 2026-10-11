const fs = require('fs');
const path = require('path');

class BM25 {
  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = [];
    this.docLengths = [];
    this.avgDocLength = 0;
    this.docCount = 0;
    this.termFrequencies = [];
    this.documentFrequencies = {};
    this.isIndexed = false;
  }

  // Basic tokenizer with conservative Sanskrit normalization
  tokenize(text) {
    if (!text) return [];
    
    return text.toLowerCase()
      .replace(/[^a-z0-9āīūṛṝḷḹṅñṭḍṇśṣḥṃ]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => t.replace(/ḥ$/, 'h').replace(/h$/, ''));
  }

  addDocuments(docs) {
    this.documents = docs;
    this.docCount = docs.length;
    let totalLength = 0;

    for (let i = 0; i < this.docCount; i++) {
      const docText = docs[i].searchableText || '';
      const tokens = this.tokenize(docText);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      const tf = {};
      const uniqueTokens = new Set();

      for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
        uniqueTokens.add(token);
      }
      this.termFrequencies.push(tf);

      for (const token of uniqueTokens) {
        this.documentFrequencies[token] = (this.documentFrequencies[token] || 0) + 1;
      }
    }

    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;
    this.isIndexed = true;
  }

  // Calculate Inverse Document Frequency
  computeIDF(token) {
    const df = this.documentFrequencies[token] || 0;
    // Classic BM25 IDF formula
    return Math.max(0, Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1));
  }

  search(query, topK = 5) {
    if (!this.isIndexed || this.docCount === 0) return [];

    const queryTokens = this.tokenize(query);
    const scores = new Array(this.docCount).fill(0);

    for (const token of queryTokens) {
      const idf = this.computeIDF(token);
      if (idf <= 0) continue;

      for (let i = 0; i < this.docCount; i++) {
        const tf = this.termFrequencies[i][token] || 0;
        if (tf === 0) continue;

        const docLen = this.docLengths[i];
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        
        scores[i] += idf * (numerator / denominator);
      }
    }

    const results = [];
    for (let i = 0; i < this.docCount; i++) {
      if (scores[i] > 0) {
        results.push({
          score: scores[i],
          document: this.documents[i]
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

let namcBm25Instance = null;
let icd11Bm25Instance = null;

function getBM25Instance(type = 'NAMC') {
  if (type === 'NAMC') {
    if (namcBm25Instance && namcBm25Instance.isIndexed) return namcBm25Instance;
    const processedDataPath = path.join(__dirname, '../../../data/rag/processed/namc_documents.json');
    namcBm25Instance = new BM25();
    if (fs.existsSync(processedDataPath)) {
      const docs = JSON.parse(fs.readFileSync(processedDataPath, 'utf-8'));
      namcBm25Instance.addDocuments(docs);
      console.log(`[RAG] Initialized NAMC BM25 index with ${docs.length} documents.`);
    } else {
      console.warn(`[RAG] Warning: NAMC documents not found at ${processedDataPath}`);
    }
    return namcBm25Instance;
  } 
  
  if (type === 'ICD11') {
    if (icd11Bm25Instance && icd11Bm25Instance.isIndexed) return icd11Bm25Instance;
    const processedDataPath = path.join(__dirname, '../../../data/rag/processed/icd11_tm2_documents.json');
    icd11Bm25Instance = new BM25();
    if (fs.existsSync(processedDataPath)) {
      const docs = JSON.parse(fs.readFileSync(processedDataPath, 'utf-8'));
      icd11Bm25Instance.addDocuments(docs);
      console.log(`[RAG] Initialized ICD11 BM25 index with ${docs.length} documents.`);
    } else {
      console.warn(`[RAG] Warning: ICD11 documents not found at ${processedDataPath}`);
    }
    return icd11Bm25Instance;
  }
}

async function retrieveCandidates(queryTerm, topK = 5) {
  const namcIndex = getBM25Instance('NAMC');
  const icd11Index = getBM25Instance('ICD11');
  
  // Normalize the query using the existing tokenizer
  const normQueryTokens = namcIndex.tokenize(queryTerm);
  const normQueryStr = normQueryTokens.join(' ');
  
  // Stage 1: NAMC retrieval
  const namcCandidates = namcIndex.search(queryTerm, 50);
  let bestNamcDoc = null;
  
  // Find exact normalized NAMC match first
  for (const res of namcCandidates) {
    const docTokens = namcIndex.tokenize(res.document.ayushTerm || '');
    if (docTokens.join(' ') === normQueryStr) {
      bestNamcDoc = res.document;
      break;
    }
  }
  // Fallback to top BM25 if no exact match
  if (!bestNamcDoc && namcCandidates.length > 0) {
    bestNamcDoc = namcCandidates[0].document;
  }
  
  // Stage 2: WHO TM2 terminology retrieval
  const searchString = bestNamcDoc ? `${queryTerm} ${bestNamcDoc.ayushTerm || ''} ${bestNamcDoc.englishTerm || ''}` : queryTerm;
  const icd11Results = icd11Index.search(searchString, 50); // Fetch more to re-rank

  const scoredCandidates = icd11Results.map(res => {
    const doc = res.document;
    const matchReasons = ["BM25 retrieval"];
    let finalScore = res.score;
    
    // Normalize target strings for comparison
    const normWhoTermTokens = icd11Index.tokenize(doc.icd11Term || '');
    const normWhoTermStr = normWhoTermTokens.join(' ');
    
    // Check Exact WHO Synonym Match
    let exactSynonymMatch = false;
    let partialSynonymMatch = false;
    let matchedSyns = [];
    
    if (doc.synonyms && Array.isArray(doc.synonyms)) {
      for (const syn of doc.synonyms) {
        // Strip out the leading "(a) " or "(b) " for comparison
        const cleanSyn = syn.replace(/^\([a-z]\)\s*/i, '');
        const normSynTokens = icd11Index.tokenize(cleanSyn);
        const normSynStr = normSynTokens.join(' ');
        
        if (normSynStr === normQueryStr) {
          exactSynonymMatch = true;
          matchedSyns.push(syn);
        } else if (normSynStr.includes(normQueryStr) || normQueryStr.includes(normSynStr)) {
          partialSynonymMatch = true;
          matchedSyns.push(syn);
        }
      }
    }
    
    if (exactSynonymMatch) {
      finalScore += 1000;
      matchReasons.push("exact normalized WHO Ayurvedic synonym");
    } else if (partialSynonymMatch) {
      finalScore += 100;
      matchReasons.push("partial terminology match");
    }
    
    // Check Exact English Terminology Match
    // Typically WHO terms look like "Cough disorder (TM2)". We ignore "disorder (tm2)" for exactness check.
    const cleanWhoTermTokens = normWhoTermTokens.filter(t => t !== 'disorder' && t !== 'tm2' && t !== 'tm1' && t !== 'disease');
    const cleanWhoTermStr = cleanWhoTermTokens.join(' ');
    
    if (cleanWhoTermStr === normQueryStr && normQueryStr.length > 0) {
      finalScore += 500;
      matchReasons.push("exact normalized WHO English terminology");
    } else if (normWhoTermStr.includes(normQueryStr) && normQueryStr.length > 0) {
      finalScore += 50;
      matchReasons.push("partial terminology match");
    }

    // Ensure uniqueness of match reasons
    const uniqueReasons = [...new Set(matchReasons)];

    return {
      candidateData: {
        namcId: bestNamcDoc ? bestNamcDoc.namcId : null,
        namcCode: bestNamcDoc ? bestNamcDoc.namcCode : null,
        namcTerm: bestNamcDoc ? bestNamcDoc.ayushTerm : null,
        englishTerm: bestNamcDoc ? bestNamcDoc.englishTerm : null,
  
        whoEntityUri: doc.whoEntityUri || null,
        whoRelease: doc.whoRelease || '2026-01',
        whoParentUri: doc.whoParentUri || null,
        icd11Tm2Code: doc.icd11Tm2Code || null,
        icd11Term: doc.icd11Term || null,
  
        matchedSynonyms: matchedSyns,
  
        retrievalMethod: 'bm25',
        retrievalScore: finalScore,
        matchReasons: uniqueReasons,
        verified: false
      },
      finalScore: finalScore
    };
  });

  // Re-rank based on finalScore
  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
  
  // Return topK candidates
  const candidates = scoredCandidates.slice(0, topK).map(sc => sc.candidateData);

  return {
    query: queryTerm,
    source: "NAMC",
    candidates: candidates
  };
}

module.exports = { BM25, getBM25Instance, retrieveCandidates };
