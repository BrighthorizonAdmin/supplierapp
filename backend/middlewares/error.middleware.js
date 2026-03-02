const logger = require('../utils/logger');
const { error } = require('../utils/response');

const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return error(res, `Invalid ${err.path}: ${err.value}`, 400);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return error(res, 'Validation failed', 400, errors);
  }

  // Mongoose Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return error(res, `Duplicate value: '${value}' for field '${field}' already exists.`, 409);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired', 401);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return error(res, 'File size exceeds the allowed limit (5MB)', 400);
  }
  if (err.message && err.message.includes('Only')) {
    return error(res, err.message, 400);
  }

  // Custom app errors
  if (err.isOperational) {
    return error(res, err.message, err.statusCode || 400);
  }

  // Default 500
  return error(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500
  );
};

// Operational error class
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = errorMiddleware;
module.exports.AppError = AppError;
