const express = require('express');
const { body } = require('express-validator');
const mappingController = require('../controllers/mappingController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadBulk } = require('../config/uploads');

const router = express.Router();

router.use(requireAuth);

// GET /api/mapping/lookup
router.get('/lookup', mappingController.lookup);

// GET /api/mapping/search
router.get('/search', mappingController.search);

// GET /api/mapping/candidates
router.get('/candidates', mappingController.getCandidates);

// POST /api/mapping/verify
router.post(
  '/verify',
  requireRole('doctor', 'admin'),
  [
    body('namcId').notEmpty().withMessage('NAMC ID is required.'),
    body('whoEntityUri').notEmpty().withMessage('WHO Entity URI is required.'),
    body('relationshipType').notEmpty().withMessage('Relationship type is required.')
  ],
  validate,
  mappingController.verifyCandidate
);

// POST /api/mapping/verify-official-code
router.post(
  '/verify-official-code',
  requireRole('doctor', 'admin'),
  [
    body('namcId').notEmpty().withMessage('NAMC ID is required.'),
    body('whoEntityUri').notEmpty().withMessage('WHO Entity URI is required.'),
    body('icd11Tm2Code').notEmpty().withMessage('ICD-11 TM2 Code is required.'),
    body('relationshipType').notEmpty().withMessage('Relationship type is required.')
  ],
  validate,
  mappingController.verifyOfficialCode
);

// POST /api/mapping/confirm
router.post(
  '/confirm',
  [
    body('searchTerm').notEmpty().withMessage('Search term is required.'),
    body('namasteCode').notEmpty().withMessage('NAMASTE code is required.'),
    body('icd11Tm2Code').notEmpty().withMessage('ICD-11 TM2 code is required.')
  ],
  validate,
  mappingController.confirm
);

// GET /api/mapping/recent
router.get('/recent', mappingController.getRecent);

// GET /api/mapping/stats
router.get('/stats', mappingController.getStats);

// POST /api/mapping/bulk-upload
router.post('/bulk-upload', uploadBulk.single('file'), mappingController.bulkUpload);

module.exports = router;
