const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 login requests per window
  message: { detail: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('identifier').notEmpty().withMessage('Email or ABHA ID is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  validate,
  authController.login
);

// GET /api/auth/me
router.get('/me', requireAuth, authController.me);

// POST /api/auth/logout
router.post('/logout', requireAuth, authController.logout);

// POST /api/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long.')
  ],
  validate,
  authController.changePassword
);

// POST /api/auth/register (Clinic registration)
router.post(
  '/register',
  [
    body('clinicName').trim().notEmpty().withMessage('Clinic name is required.'),
    body('doctorName').trim().notEmpty().withMessage('Doctor/Administrator name is required.'),
    body('email').trim().isEmail().withMessage('Valid email is required.'),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('address').trim().notEmpty().withMessage('Clinic address is required.'),
    body('city').trim().notEmpty().withMessage('City is required.'),
    body('state').trim().notEmpty().withMessage('State is required.'),
    body('pincode').trim().notEmpty().withMessage('Pincode is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('confirmPassword').optional().custom((value, { req }) => {
      if (value && value !== req.body.password) {
        throw new Error('Password confirmation does not match.');
      }
      return true;
    })
  ],
  validate,
  authController.register
);

module.exports = router;
