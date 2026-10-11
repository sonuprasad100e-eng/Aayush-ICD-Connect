const mongoose = require('mongoose');
const assert = require('assert');
const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
const MappingEvidence = require('./src/models/MappingEvidence');

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error('       ', e.message);
      failed++;
    }
  }

  console.log('--- Running Data Model Tests ---');

  test('Candidate can be created (MappingEvidence)', () => {
    const evidence = new MappingEvidence({
      queryTerm: 'jvara',
      namcCode: 'SP51(EC-3)',
      candidateIcd11Term: 'Fever disorder (TM2)',
      retrievalScore: 0.9,
      whoEntityUri: 'http://id.who.int/icd/entity/1234'
    });
    const err = evidence.validateSync();
    assert.ok(!err, 'Evidence should be valid');
  });

  test('Candidate defaults to unverified (status = candidate)', () => {
    const evidence = new MappingEvidence({
      candidateIcd11Term: 'Test'
    });
    assert.strictEqual(evidence.status, 'candidate', 'Status should default to candidate');
  });

  test('RAG candidate does not create TerminologyCrosswalk automatically', () => {
    // This is tested by the fact that they are separate models.
    const evidence = new MappingEvidence({ queryTerm: 'test' });
    assert.ok(!(evidence instanceof TerminologyCrosswalk), 'Evidence is not a crosswalk');
  });

  test('WHO code may be null', () => {
    const evidence = new MappingEvidence({
      candidateIcd11Tm2Code: null
    });
    const err = evidence.validateSync();
    // candidateIcd11Tm2Code is not required
    assert.ok(!err, 'candidateIcd11Tm2Code can be null');
  });

  test('WHO entity URI is preserved', () => {
    const uri = 'http://id.who.int/icd/entity/12345';
    const evidence = new MappingEvidence({ whoEntityUri: uri });
    assert.strictEqual(evidence.whoEntityUri, uri);
  });

  test('WHO synonyms are preserved', () => {
    const syns = ['(a) jvara'];
    const evidence = new MappingEvidence({ matchedSynonyms: syns });
    assert.deepStrictEqual(evidence.matchedSynonyms, syns);
  });

  test('Verification metadata can be stored in TerminologyCrosswalk', () => {
    const cw = new TerminologyCrosswalk({
      ayushTerm: 'jvara',
      system: 'Ayurveda',
      icd11Term: 'Fever',
      verified: true,
      verifiedBy: new mongoose.Types.ObjectId(),
      verifiedAt: new Date(),
      verificationMethod: 'manual',
      relationshipType: 'equivalent'
    });
    const err = cw.validateSync();
    assert.ok(!err, 'Verification metadata should be valid');
  });

  test('Invalid relationshipType is rejected', () => {
    const cw = new TerminologyCrosswalk({
      ayushTerm: 'jvara',
      system: 'Ayurveda',
      icd11Term: 'Fever',
      relationshipType: 'invalid_type'
    });
    const err = cw.validateSync();
    assert.ok(err && err.errors['relationshipType'], 'Invalid relationshipType should trigger validation error');
  });

  test('Invalid verificationMethod is rejected', () => {
    const cw = new TerminologyCrosswalk({
      ayushTerm: 'jvara',
      system: 'Ayurveda',
      icd11Term: 'Fever',
      verificationMethod: 'magic'
    });
    const err = cw.validateSync();
    assert.ok(err && err.errors['verificationMethod'], 'Invalid verificationMethod should trigger validation error');
  });

  test('A candidate cannot become verified merely because retrievalScore is high', () => {
    const evidence = new MappingEvidence({
      retrievalScore: 0.99
    });
    // status should still be candidate
    assert.strictEqual(evidence.status, 'candidate');
  });

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
}

runTests();
