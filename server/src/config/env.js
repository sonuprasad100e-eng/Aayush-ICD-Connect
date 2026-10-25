const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file in server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const INSECURE_JWT_DEFAULTS = [
  'care_sync_super_secret_jwt_key_2026',
  'your_jwt_secret_key_change_in_production',
  'secret',
  'jwtsecret',
  'changeme'
];

function validateJwtSecret(secret, isProd) {
  if (!isProd) {
    return secret || 'care_sync_super_secret_jwt_key_2026';
  }
  if (!secret || secret.trim() === '') {
    throw new Error('[Env Fatal] JWT_SECRET environment variable is required in production. Startup aborted.');
  }
  const trimmed = secret.trim();
  if (INSECURE_JWT_DEFAULTS.includes(trimmed) || trimmed.length < 32) {
    throw new Error('[Env Fatal] Insecure JWT_SECRET detected in production. It cannot use known default/placeholder values and must be a secure string of at least 32 characters (256 bits). Startup aborted.');
  }
  return trimmed;
}

const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '8000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:8000',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: validateJwtSecret(process.env.JWT_SECRET, isProduction),
  JWT_EXPIRES_DEFAULT: '1d',
  JWT_EXPIRES_REMEMBER: '7d',
  UPLOAD_DIR: path.join(__dirname, '../../uploads'),
  MAX_PHOTO_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_BULK_SIZE: 10 * 1024 * 1024, // 10MB
  validateJwtSecret
};

module.exports = env;
