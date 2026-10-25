const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const patientRoutes = require('./routes/patientRoutes');
const diagnosisRoutes = require('./routes/diagnosisRoutes');
const mappingRoutes = require('./routes/mappingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow external CDNs (Bootstrap, FontAwesome, Google Fonts, Unsplash) used in frontend
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Compression
app.use(compression());

// Request logger
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// CORS configuration
const corsOptionsDelegate = (req, callback) => {
  // 1. In development and test environments, allow all origins
  if (env.NODE_ENV !== 'production') {
    return callback(null, { origin: true, credentials: true });
  }

  const origin = req.header('Origin');
  // 2. Allow requests with no Origin header (same-origin browser requests, server-to-server, curl, mobile apps)
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  const cleanOrigin = origin.trim().replace(/\/$/, '');
  const host = req.get('host');
  const allowedOrigins = (env.CLIENT_URL || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // 3. Allow same-origin requests when Express serves client/ on the same host (e.g. Render web service)
  const isSameHost = host && (
    cleanOrigin === `https://${host}` ||
    cleanOrigin === `http://${host}`
  );

  // 4. Allow configured frontend origin(s) (e.g. from CLIENT_URL)
  const isAllowedOrigin = allowedOrigins.includes(cleanOrigin);

  if (isSameHost || isAllowedOrigin) {
    return callback(null, { origin: cleanOrigin, credentials: true });
  }

  // 5. Reject unauthorized cross-origin requests in production
  const corsError = new Error(`CORS policy violation: Origin '${origin}' is not authorized.`);
  corsError.status = 403;
  return callback(corsError);
};

app.use(cors(corsOptionsDelegate));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded static files
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Serve client frontend files statically from client folder
const clientPath = path.join(__dirname, '../../client');
app.use(express.static(clientPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Care Sync (Aayush-ICD-Connect) API',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/diagnoses', diagnosisRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);

// Fallback to client/index.html for any unhandled GET route that isn't /api
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ detail: `Route ${req.originalUrl} not found.` });
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
