const mongoose = require('mongoose');
const dns = require('dns');
const { MONGODB_URI, NODE_ENV } = require('./env');
const logger = require('../utils/logger');

// Force IPv4 and use Google DNS directly
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    logger.info(`MongoDB connected: ${conn.connection.host} [${NODE_ENV}]`);

    // Ensure all schema-defined indexes (including the dbeOrderId unique sparse index
    // on the Order model) are created in MongoDB. Without this call, indexes added
    // after the collection was first created are never applied to the live DB.
    mongoose.connection.once('open', async () => {
      try {
        const Order = require('../modules/orders/model/Order.model');
        await Order.syncIndexes();
        logger.info('Order indexes synced');
      } catch (syncErr) {
        logger.warn(`Order index sync failed (non-fatal): ${syncErr.message}`);
      }
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`, {
      stack: err.stack,
      name: err.name,
      code: err.code,
      reason: err.reason,
    });
    process.exit(1);
  }
};

module.exports = connectDB;