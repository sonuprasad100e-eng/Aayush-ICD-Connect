const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err);

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ detail: 'File size exceeds maximum allowed limit.' });
    }
    return res.status(400).json({ detail: `Upload error: ${err.message}` });
  }

  // Handle custom validation or input errors
  if (err.status) {
    return res.status(err.status).json({ detail: err.message });
  }

  res.status(500).json({
    detail: err.message || 'An internal server error occurred.'
  });
};

module.exports = errorHandler;
