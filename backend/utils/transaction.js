const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Wraps a callback in a MongoDB transaction with automatic session management.
 * @param {Function} fn - async function receiving (session)
 * @returns result of fn
 */
const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    logger.error(`Transaction aborted: ${err.message}`);
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };
