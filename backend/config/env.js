require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3001,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5001',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  isDev: process.env.NODE_ENV !== 'production',
};
