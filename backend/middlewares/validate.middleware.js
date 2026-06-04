const { AppError } = require('./error.middleware');

// Each check fn receives (value, fieldName) and returns an error string or undefined.

const required = (val, field) => {
  if (val === undefined || val === null || val === '') return `${field} is required`;
};

const isEmail = (val, field) => {
  if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim()))
    return `${field} must be a valid email address`;
};

const minLen = (min) => (val, field) => {
  if (val !== undefined && String(val).length < min)
    return `${field} must be at least ${min} characters`;
};

const isNonEmptyArray = (val, field) => {
  if (val !== undefined && (!Array.isArray(val) || val.length === 0))
    return `${field} must be a non-empty array`;
};

const isPositiveNumber = (val, field) => {
  if (val !== undefined && (isNaN(Number(val)) || Number(val) <= 0))
    return `${field} must be a positive number`;
};

const oneOf = (allowed) => (val, field) => {
  if (val !== undefined && !allowed.includes(val))
    return `${field} must be one of: ${allowed.join(', ')}`;
};

/**
 * validate(schema) → Express middleware that validates req.body fields.
 * schema: { fieldName: [checkFn, ...] }
 */
const validate = (schema) => (req, res, next) => {
  for (const [field, checks] of Object.entries(schema)) {
    const val = req.body[field];
    for (const check of checks) {
      const msg = check(val, field);
      if (msg) return next(new AppError(msg, 400));
    }
  }
  next();
};

const ORDER_STATUSES = [
  'draft', 'pending', 'confirmed', 'processing',
  'shipped', 'out_for_delivery', 'delivered',
  'cancelled', 'rejected', 'returned', 'refunded',
];

const RETURN_STATUSES = ['requested', 'approved', 'received', 'refunded', 'rejected'];

module.exports = {
  validate,
  required,
  isEmail,
  minLen,
  isNonEmptyArray,
  isPositiveNumber,
  oneOf,
  ORDER_STATUSES,
  RETURN_STATUSES,
};
