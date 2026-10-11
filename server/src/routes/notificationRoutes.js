const express = require('express');
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/notifications
router.get('/', notificationController.getNotifications);

// PUT /api/notifications/read-all
router.put('/read-all', notificationController.markAllAsRead);

// PUT /api/notifications/:id/read
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
