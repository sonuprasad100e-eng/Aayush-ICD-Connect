const fs = require('fs');
const path = require('path');

/**
 * Normalizes code strings: trims, collapses whitespace, and eliminates
 * non-breaking or zero-width unicode spaces (e.g. \u00A0, \u200B).
 */
function normalizeCodeString(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether a code string is formatted as a NAMASTE/NAMC code or an ICD-11 TM2 code.
 */
function detectCodeType(code) {
  const cleaned = normalizeCodeString(code);
  if (!cleaned) return null;
  if (/\([^\)]+\)/.test(cleaned)) return 'NAMC';
  if (/^AYU-/i.test(cleaned)) return 'NAMC';
  if (/^[A-Z]{1,3}-[0-9]/i.test(cleaned)) return 'NAMC';
  if (/^S[A-Z0-9]{3}$/i.test(cleaned)) return 'ICD11';
  return 'AMBIGUOUS';
}

const isTm2Code = (str) => /^S[A-Z0-9]{3}$/i.test((str || '').trim());

class TerminologyIndex {
  constructor() {
    this.initialized = false;

    // Primary code lookups
    this.verifiedByTm2 = new Map();       // UPPER(tm2Code) -> [verifiedEntries]
    this.verifiedByNamc = new Map();      // UPPER(namcMorbidityCode) -> [verifiedEntries]
    this.verifiedByCanonical = new Map(); // UPPER(canonicalCodeNoSpace) -> [verifiedEntries]
    this.verifiedByRaw = new Map();       // UPPER(rawCode) -> [verifiedEntries]

    // Candidate lookups
    this.candidatesByCode = new Map();    // UPPER(code) -> candidateEntry

    // Unmapped NAMC catalog entries
    this.unmappedByNamc = new Map();      // UPPER(namcCode) -> namcDoc

    // WHO Module 2 concepts
    this.whoConceptsByUri = new Map();    // whoEntityUri -> icdDoc
    this.whoConceptsByTerm = new Map();   // lower(term) -> icdDoc

    // All verified records list
    this.verifiedList = [];
    this.candidateList = [];
    this.unmappedList = [];
    this.whoList = [];
  }

  ensureInitialized() {
    if (this.initialized) return;
    this.loadDatasets();
    this.initialized = true;
  }

  loadDatasets() {
    const dataDir = path.resolve(__dirname, '../../data');
    const namcJsonPath = path.join(dataDir, 'rag/processed/namc_documents.json');
    const icdJsonPath = path.join(dataDir, 'rag/processed/icd11_tm2_documents.json');
    const crosswalkJsonPath = path.join(dataDir, 'mappings/namaste_icd11_tm2_crosswalk.json');

    let namcDocs = [];
    let icdDocs = [];
    let baselineCrosswalks = [];

    try {
      if (fs.existsSync(namcJsonPath)) {
        namcDocs = JSON.parse(fs.readFileSync(namcJsonPath, 'utf8'));
      }
    } catch (e) {
      console.error('[TerminologyIndex] Failed to load namc_documents.json:', e.message);
    }

    try {
      if (fs.existsSync(icdJsonPath)) {
        icdDocs = JSON.parse(fs.readFileSync(icdJsonPath, 'utf8'));
      }
    } catch (e) {
      console.error('[TerminologyIndex] Failed to load icd11_tm2_documents.json:', e.message);
    }

    try {
      if (fs.existsSync(crosswalkJsonPath)) {
        baselineCrosswalks = JSON.parse(fs.readFileSync(crosswalkJsonPath, 'utf8'));
      }
    } catch (e) {
      console.error('[TerminologyIndex] Failed to load namaste_icd11_tm2_crosswalk.json:', e.message);
    }

    this.whoList = icdDocs;
    for (const doc of icdDocs) {
      if (doc.whoEntityUri) {
        this.whoConceptsByUri.set(doc.whoEntityUri, doc);
      }
      if (doc.icd11Term) {
        this.whoConceptsByTerm.set(doc.icd11Term.trim().toLowerCase(), doc);
      }
    }

    // 1. Ingest baseline crosswalks
    for (const cw of baselineCrosswalks) {
      if (cw.verified) {
        const parenMatch = (cw.namcCode || '').match(/^([^(]+)\(([^)]+)\)$/);
        const morbidityCode = parenMatch ? parenMatch[2].trim() : cw.namcCode.trim();
        this._addVerifiedRecord({
          namcCode: cw.namcCode,
          namcMorbidityCode: morbidityCode,
          rawCode: cw.namcCode,
          icd11Tm2Code: cw.icd11Tm2Code,
          ayushTerm: cw.ayushTerm,
          icd11Term: cw.icd11Term,
          relationshipType: cw.relationshipType || 'equivalent',
          source: cw.source || 'Ministry of Ayush & WHO ICD-11 TM2 Curated Crosswalk',
          verificationMethod: cw.verificationMethod || 'official_crosswalk',
          verified: true
        });
      } else {
        const candidate = {
          namcCode: cw.namcCode,
          icd11Tm2Code: cw.icd11Tm2Code,
          ayushTerm: cw.ayushTerm,
          icd11Term: cw.icd11Term,
          relationshipType: cw.relationshipType || 'related',
          source: cw.source || 'NAMASTE Catalog (Unverified Candidate)',
          verified: false
        };
        this.candidateList.push(candidate);
        this.candidatesByCode.set(candidate.namcCode.toUpperCase(), candidate);
        if (candidate.icd11Tm2Code) {
          this.candidatesByCode.set(candidate.icd11Tm2Code.toUpperCase(), candidate);
        }
      }
    }

    // 2. Ingest NAMC documents (2,910 rows)
    for (const doc of namcDocs) {
      const rawCode = normalizeCodeString(doc.namcCode);
      if (rawCode.includes('(')) {
        const m = rawCode.match(/^([^(]+)\(([^)]+)\)$/);
        if (m) {
          const partA = m[1].trim();
          const partB = m[2].trim();
          const tm2 = isTm2Code(partA) ? partA.toUpperCase() : (isTm2Code(partB) ? partB.toUpperCase() : null);
          const namc = isTm2Code(partA) ? partB : (isTm2Code(partB) ? partA : null);

          if (tm2 && namc) {
            // Find corresponding WHO ICD doc by term or synonym if possible
            let whoEntityUri = null;
            let whoSynonyms = [];
            const termLower = (doc.englishTerm || '').trim().toLowerCase();
            const matchingWho = this.whoConceptsByTerm.get(termLower);
            if (matchingWho) {
              whoEntityUri = matchingWho.whoEntityUri;
              whoSynonyms = matchingWho.synonyms || [];
            }

            this._addVerifiedRecord({
              namcCode: `${tm2}(${namc})`,
              namcMorbidityCode: namc,
              rawCode: rawCode,
              icd11Tm2Code: tm2,
              ayushTerm: doc.ayushTerm,
              diacriticTerm: doc.diacriticTerm,
              devanagariTerm: doc.devanagariTerm,
              englishTerm: doc.englishTerm,
              longDefinition: doc.longDefinition,
              primaryIndex: doc.primaryIndexRelated,
              whoEntityUri,
              whoSynonyms,
              system: 'Ayurveda',
              relationshipType: 'equivalent',
              source: 'National Ayurveda Morbidity Codes (Ministry of Ayush) & WHO ICD-11 Traditional Medicine Module 2',
              verificationMethod: 'official_crosswalk',
              provenance: 'Ministry of Ayush National Ayurveda Morbidity Codes (dual-coded Chapter 26 TM2 release)',
              verified: true
            });
            continue;
          }
        }
      }

      // If not dual-coded, store in unmapped NAMC records
      this.unmappedList.push(doc);
      this.unmappedByNamc.set(rawCode.toUpperCase(), doc);
    }
  }

  _addVerifiedRecord(entry) {
    const tm2Key = entry.icd11Tm2Code.toUpperCase();
    const namcKey = entry.namcMorbidityCode.toUpperCase();
    const canonKey = entry.namcCode.toUpperCase().replace(/\s+/g, '');
    const rawKey = entry.rawCode.toUpperCase().replace(/\s+/g, '');

    // Check if already present under this exact pair
    const existing = this.verifiedByCanonical.get(canonKey);
    if (existing && existing.length > 0) {
      return;
    }

    this.verifiedList.push(entry);

    if (!this.verifiedByTm2.has(tm2Key)) this.verifiedByTm2.set(tm2Key, []);
    this.verifiedByTm2.get(tm2Key).push(entry);

    if (!this.verifiedByNamc.has(namcKey)) this.verifiedByNamc.set(namcKey, []);
    this.verifiedByNamc.get(namcKey).push(entry);

    if (!this.verifiedByCanonical.has(canonKey)) this.verifiedByCanonical.set(canonKey, []);
    this.verifiedByCanonical.get(canonKey).push(entry);

    if (!this.verifiedByRaw.has(rawKey)) this.verifiedByRaw.set(rawKey, []);
    this.verifiedByRaw.get(rawKey).push(entry);
  }

  /**
   * Two-way code lookup resolving exact, canonical, parenthetical, and alternative formats.
   */
  lookupByCode(rawCode, codeType) {
    this.ensureInitialized();
    const cleaned = normalizeCodeString(rawCode);
    if (!cleaned) {
      return { found: false, verified: false, message: 'Code parameter is required' };
    }

    // Resolve code type
    let resolvedType = (codeType || '').trim().toUpperCase();
    if (!resolvedType || resolvedType === 'AUTO') {
      const detected = detectCodeType(cleaned);
      resolvedType = detected === 'AMBIGUOUS' ? 'ALL' : detected;
    }

    if (resolvedType !== 'NAMC' && resolvedType !== 'ICD11' && resolvedType !== 'ALL') {
      return { found: false, verified: false, message: 'Invalid codeType. Use NAMC or ICD11' };
    }

    const upperCleaned = cleaned.toUpperCase();
    const upperNoSpace = upperCleaned.replace(/\s+/g, '');
    const bareParen = upperCleaned.replace(/^\((.+)\)$/, '$1').trim();

    // 1. Search verified mappings
    let matches = [];

    // Case A: Look in canonical index e.g. "SP51(EC-3)", "SN5Y(ED-4.3.2)"
    if (this.verifiedByCanonical.has(upperNoSpace)) {
      matches.push(...this.verifiedByCanonical.get(upperNoSpace));
    }

    // Case B: Look in raw index e.g. "SR11 (AAA-1)", "ED-4.3.2(SN5Y)"
    if (this.verifiedByRaw.has(upperNoSpace)) {
      for (const e of this.verifiedByRaw.get(upperNoSpace)) {
        if (!matches.some(m => m.namcCode === e.namcCode && m.icd11Tm2Code === e.icd11Tm2Code)) {
          matches.push(e);
        }
      }
    }

    // Case C: By ICD-11 TM2 code e.g. "SP51", "SR11", "SN5Y"
    if (resolvedType === 'ICD11' || resolvedType === 'ALL') {
      if (this.verifiedByTm2.has(upperCleaned)) {
        for (const e of this.verifiedByTm2.get(upperCleaned)) {
          if (!matches.some(m => m.namcCode === e.namcCode && m.icd11Tm2Code === e.icd11Tm2Code)) {
            matches.push(e);
          }
        }
      }
      // If code was entered as compound in ICD mode like "SP51(EC-3)"
      const tm2Compound = cleaned.match(/^([A-Z0-9]{4})\s*\(/i);
      if (tm2Compound && this.verifiedByTm2.has(tm2Compound[1].toUpperCase())) {
        for (const e of this.verifiedByTm2.get(tm2Compound[1].toUpperCase())) {
          if (!matches.some(m => m.namcCode === e.namcCode && m.icd11Tm2Code === e.icd11Tm2Code)) {
            matches.push(e);
          }
        }
      }
    }

    // Case D: By NAMC morbidity code e.g. "EC-3", "AAA-1", "ED-4.3.2"
    if (resolvedType === 'NAMC' || resolvedType === 'ALL') {
      if (this.verifiedByNamc.has(bareParen)) {
        for (const e of this.verifiedByNamc.get(bareParen)) {
          if (!matches.some(m => m.namcCode === e.namcCode && m.icd11Tm2Code === e.icd11Tm2Code)) {
            matches.push(e);
          }
        }
      }
      // Or by TM2 prefix in NAMC search e.g. user typed "SP51" under NAMC
      if (this.verifiedByTm2.has(upperCleaned)) {
        for (const e of this.verifiedByTm2.get(upperCleaned)) {
          if (!matches.some(m => m.namcCode === e.namcCode && m.icd11Tm2Code === e.icd11Tm2Code)) {
            matches.push(e);
          }
        }
      }
    }

    // Return verified match if found
    if (matches.length > 0) {
      const primary = matches[0];
      const result = {
        found: true,
        verified: true,
        searchedCode: cleaned,
        searchedType: resolvedType,
        matchCount: matches.length,
        namcCode: primary.namcCode,
        ayushTerm: primary.ayushTerm,
        system: primary.system || 'Ayurveda',
        icd11Tm2Code: primary.icd11Tm2Code,
        icd11Term: primary.englishTerm || primary.icd11Term,
        relationshipType: primary.relationshipType || 'equivalent',
        source: primary.source || 'National Ayurveda Morbidity Codes (Ministry of Ayush) & WHO ICD-11 Traditional Medicine Module 2',
        whoEntityUri: primary.whoEntityUri,
        whoSynonyms: primary.whoSynonyms || []
      };

      if (matches.length > 1) {
        result.matches = matches.map(m => ({
          namcCode: m.namcCode,
          ayushTerm: m.ayushTerm,
          system: m.system || 'Ayurveda',
          icd11Tm2Code: m.icd11Tm2Code,
          icd11Term: m.englishTerm || m.icd11Term,
          relationshipType: m.relationshipType || 'equivalent',
          source: m.source,
          verified: true
        }));
      }

      return result;
    }

    // 2. Check candidate crosswalks
    if (this.candidatesByCode.has(upperCleaned) || this.candidatesByCode.has(bareParen)) {
      const candidate = this.candidatesByCode.get(upperCleaned) || this.candidatesByCode.get(bareParen);
      return {
        found: false,
        verified: false,
        searchedCode: cleaned,
        searchedType: resolvedType,
        hasUnverifiedCandidate: true,
        message: `An unverified candidate mapping exists for "${cleaned}", but it has not been officially verified by a doctor or Ministry of Ayush. Disease mappings must be officially verified in the Disease Mapping module before patient registration.`,
        candidate: {
          namcCode: candidate.namcCode,
          ayushTerm: candidate.ayushTerm,
          system: candidate.system || 'Ayurveda',
          icd11Tm2Code: candidate.icd11Tm2Code,
          icd11Term: candidate.icd11Term,
          source: candidate.source || 'Unverified AYUSH Clinical Catalog',
          relationshipType: candidate.relationshipType || 'related',
          verified: false
        }
      };
    }

    // 3. Check unmapped NAMC records
    if (this.unmappedByNamc.has(upperCleaned) || this.unmappedByNamc.has(bareParen)) {
      const doc = this.unmappedByNamc.get(upperCleaned) || this.unmappedByNamc.get(bareParen);
      return {
        found: false,
        verified: false,
        searchedCode: cleaned,
        searchedType: resolvedType,
        inDataset: true,
        datasetSource: 'National Ayurveda Morbidity Codes',
        message: `Code "${cleaned}" is an official National Ayurveda Morbidity Code ("${doc.ayushTerm}" / "${doc.englishTerm}"), but does not currently have an established WHO ICD-11 TM2 dual-code mapping.`,
        namcEntry: {
          namcCode: doc.namcCode,
          namcId: doc.namcId,
          ayushTerm: doc.ayushTerm,
          englishTerm: doc.englishTerm,
          source: doc.source || 'National Ayurveda Morbidity Codes'
        }
      };
    }

    return {
      found: false,
      verified: false,
      searchedCode: cleaned,
      searchedType: resolvedType,
      message: `No verified crosswalk found for code "${cleaned}".`
    };
  }

  /**
   * Search across diagnosis terms, Sanskrit transliterations, Devanagari,
   * English terms, and WHO ICD-11 synonyms.
   */
  searchByTerm(query, options = {}) {
    this.ensureInitialized();
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return { query: '', totalMatches: 0, verified: [], candidates: [], unmapped: [], whoConcepts: [] };
    }

    const limit = options.limit || 50;

    // Search verified
    const verifiedMatches = [];
    for (const v of this.verifiedList) {
      const matchAyush = (v.ayushTerm || '').toLowerCase().includes(q);
      const matchDiacritic = (v.diacriticTerm || '').toLowerCase().includes(q);
      const matchEn = (v.englishTerm || '').toLowerCase().includes(q);
      const matchDev = (v.devanagariTerm || '').includes(q);
      const matchCode = (v.namcCode || '').toLowerCase().includes(q) || (v.icd11Tm2Code || '').toLowerCase().includes(q);

      if (matchAyush || matchDiacritic || matchEn || matchDev || matchCode) {
        verifiedMatches.push(v);
        if (verifiedMatches.length >= limit) break;
      }
    }

    // Search candidates
    const candidateMatches = [];
    for (const c of this.candidateList) {
      const matchAyush = (c.ayushTerm || '').toLowerCase().includes(q);
      const matchEn = (c.icd11Term || '').toLowerCase().includes(q);
      const matchCode = (c.namcCode || '').toLowerCase().includes(q) || (c.icd11Tm2Code || '').toLowerCase().includes(q);

      if (matchAyush || matchEn || matchCode) {
        candidateMatches.push(c);
        if (candidateMatches.length >= limit) break;
      }
    }

    // Search unmapped NAMC
    const unmappedMatches = [];
    for (const u of this.unmappedList) {
      const matchAyush = (u.ayushTerm || '').toLowerCase().includes(q);
      const matchDiacritic = (u.diacriticTerm || '').toLowerCase().includes(q);
      const matchEn = (u.englishTerm || '').toLowerCase().includes(q);
      const matchDev = (u.devanagariTerm || '').includes(q);
      const matchCode = (u.namcCode || '').toLowerCase().includes(q);

      if (matchAyush || matchDiacritic || matchEn || matchDev || matchCode) {
        unmappedMatches.push(u);
        if (unmappedMatches.length >= limit) break;
      }
    }

    // Search WHO concepts
    const whoMatches = [];
    for (const w of this.whoList) {
      const matchTerm = (w.icd11Term || '').toLowerCase().includes(q);
      const matchSyn = (w.synonyms || []).some(s => s.toLowerCase().includes(q));

      if (matchTerm || matchSyn) {
        whoMatches.push(w);
        if (whoMatches.length >= limit) break;
      }
    }

    return {
      query,
      totalMatches: verifiedMatches.length + candidateMatches.length + unmappedMatches.length + whoMatches.length,
      verified: verifiedMatches,
      candidates: candidateMatches,
      unmapped: unmappedMatches,
      whoConcepts: whoMatches
    };
  }

  /**
   * Returns exact dataset counts for auditing and reporting.
   */
  getStatistics() {
    this.ensureInitialized();
    const uniqueTm2Codes = new Set(this.verifiedList.map(v => v.icd11Tm2Code));
    const uniqueNamcMorbidityCodes = new Set(this.verifiedList.map(v => v.namcMorbidityCode));

    return {
      totalNamcRecords: 2910,
      totalWhoFoundationConcepts: this.whoList.length,
      verifiedCrosswalks: this.verifiedList.length,
      uniqueVerifiedTm2Codes: uniqueTm2Codes.size,
      uniqueVerifiedNamcCodes: uniqueNamcMorbidityCodes.size,
      unverifiedCandidates: this.candidateList.length,
      unmappedNamcRecords: this.unmappedList.length,
      totalSearchableCodes: this.verifiedByCanonical.size + this.unmappedByNamc.size + this.candidatesByCode.size
    };
  }
}

// Export singleton instance
module.exports = new TerminologyIndex();
module.exports.TerminologyIndex = TerminologyIndex;
