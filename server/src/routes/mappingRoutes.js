const express = require('express');
const { body } = require('express-validator');
const mappingController = require('../controllers/mappingController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadBulk } = require('../config/uploads');

const router = express.Router();

router.use(requireAuth);

// GET /api/mapping/search
router.get('/search', mappingController.search);

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
