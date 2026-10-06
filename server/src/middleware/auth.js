const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ detail: 'Authentication required. Token missing.' });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const userId = decoded.sub || decoded.id;

    if (!userId) {
      return res.status(401).json({ detail: 'Invalid authorization token: missing subject.' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ detail: 'User not found or session expired.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ detail: 'User account is deactivated. Please contact administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ detail: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ detail: 'Invalid authorization token.' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ detail: 'Forbidden: Insufficient role permissions.' });
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole
};
