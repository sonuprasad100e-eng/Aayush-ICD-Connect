const express = require('express');
const reportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/reports/overview
router.get('/overview', reportController.getOverview);

// GET /api/reports/system-breakdown
router.get('/system-breakdown', reportController.getSystemBreakdown);

// GET /api/reports/trend
router.get('/trend', reportController.getTrend);

// GET /api/reports/files
router.get('/files', reportController.getFiles);

module.exports = router;
