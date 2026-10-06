const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      detail: firstError.msg || 'Invalid input data.',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  validate
};
