const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

// GET /api/public/stats
router.get('/stats', publicController.getStats);

module.exports = router;
