const express = require('express');
const { body } = require('express-validator');
const patientController = require('../controllers/patientController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(requireAuth);

// GET /api/patients
router.get('/', patientController.getPatients);

// POST /api/patients
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Patient name is required.'),
    body('age').isNumeric().withMessage('Valid age is required.'),
    body('diagnosisLabel').notEmpty().withMessage('Diagnosis label is required.'),
    body('namasteCode').notEmpty().withMessage('NAMASTE code is required.'),
    body('icd11Tm2Code').notEmpty().withMessage('ICD-11 TM2 code is required.')
  ],
  validate,
  patientController.createPatient
);

// GET /api/patients/:id/fhir
router.get('/:id/fhir', patientController.getFhirResource);

// GET /api/patients/:id
router.get('/:id', patientController.getPatientById);

// PUT /api/patients/:id
router.put('/:id', patientController.updatePatient);

// DELETE /api/patients/:id
router.delete('/:id', patientController.deletePatient);

module.exports = router;
