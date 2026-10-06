const express = require('express');
const { body } = require('express-validator');
const diagnosisController = require('../controllers/diagnosisController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(requireAuth);

// GET /api/diagnoses
router.get('/', diagnosisController.getDiagnoses);

// POST /api/diagnoses
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Diagnosis name is required.'),
    body('description').notEmpty().withMessage('Description is required.'),
    body('system').notEmpty().withMessage('AYUSH system is required.'),
    body('namasteCode').notEmpty().withMessage('NAMASTE code is required.'),
    body('icd11Tm2Code').notEmpty().withMessage('ICD-11 TM2 code is required.')
  ],
  validate,
  diagnosisController.createDiagnosis
);

// GET /api/diagnoses/:id
router.get('/:id', diagnosisController.getDiagnosisById);

// PUT /api/diagnoses/:id
router.put('/:id', diagnosisController.updateDiagnosis);

// DELETE /api/diagnoses/:id
router.delete('/:id', diagnosisController.deleteDiagnosis);

module.exports = router;
