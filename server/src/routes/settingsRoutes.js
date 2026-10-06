const express = require('express');
const settingsController = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');
const { uploadPhoto } = require('../config/uploads');

const router = express.Router();

router.use(requireAuth);

// GET /api/settings
router.get('/', settingsController.getSettings);

// PUT /api/settings/profile
router.put('/profile', settingsController.updateProfile);

// POST /api/settings/photo
router.post('/photo', uploadPhoto.single('photo'), settingsController.uploadPhoto);

// PUT /api/settings/security
router.put('/security', settingsController.updateSecurity);

// PUT /api/settings/preferences
router.put('/preferences', settingsController.updatePreferences);

// PUT /api/settings/notifications
router.put('/notifications', settingsController.updateNotifications);

module.exports = router;
