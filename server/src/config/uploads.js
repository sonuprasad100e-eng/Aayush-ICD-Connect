const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('./env');

// Ensure upload directory exists
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, env.UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Profile photo filter
const photoFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed.'), false);
  }
};

// Bulk file filter (CSV / Excel)
const bulkFilter = (req, file, cb) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel (.xlsx, .xls) files are allowed.'), false);
  }
};

const uploadPhoto = multer({
  storage: storage,
  limits: { fileSize: env.MAX_PHOTO_SIZE },
  fileFilter: photoFilter
});

const uploadBulk = multer({
  storage: storage,
  limits: { fileSize: env.MAX_BULK_SIZE },
  fileFilter: bulkFilter
});

module.exports = {
  uploadPhoto,
  uploadBulk
};
