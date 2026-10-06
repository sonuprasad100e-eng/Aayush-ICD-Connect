const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file in server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:8000',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'care_sync_super_secret_jwt_key_2026',
  JWT_EXPIRES_DEFAULT: '1d',
  JWT_EXPIRES_REMEMBER: '7d',
  UPLOAD_DIR: path.join(__dirname, '../../uploads'),
  MAX_PHOTO_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_BULK_SIZE: 10 * 1024 * 1024 // 10MB
};

module.exports = env;
