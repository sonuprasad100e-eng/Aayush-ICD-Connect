const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', requireAuth, dashboardController.getSummary);

module.exports = router;
