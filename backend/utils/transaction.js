const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Detects whether the connected MongoDB supports multi-document transactions.
 * Transactions require a replica set or mongos (sharded cluster).
 * A standalone mongod does NOT support them.
 *
 * Probes once and caches the result.
 */
let _transactionsSupported = null;

async function transactionsSupported() {
  if (_transactionsSupported !== null) return _transactionsSupported;
  try {
    const admin = mongoose.connection.db.admin();
    // MongoDB 5+ uses `hello`; older versions use `isMaster`
    let info;
    try {
      const res = await admin.command({ hello: 1 });
      info = res;
    } catch {
      const res = await admin.command({ isMaster: 1 });
      info = res;
    }
    // Replica set member has `setName`; mongos has `msg === 'isdbgrid'`
    _transactionsSupported = !!(info?.setName || info?.msg === 'isdbgrid');
  } catch (err) {
    logger.warn(`[Transaction] Could not detect topology: ${err.message} — assuming no transactions`);
    _transactionsSupported = false;
  }
  logger.info(`[Transaction] Transactions supported: ${_transactionsSupported}`);
  return _transactionsSupported;
}

/**
 * Wraps a callback in a MongoDB transaction when the server supports it.
 * On standalone instances (development / single-node) it falls back to
 * running the callback without a session so the app stays functional.
 *
 * Callers pass `session` to every Mongoose operation that accepts it.
 * When session is null, Mongoose simply ignores it — no caller changes needed.
 *
 * @param {Function} fn - async (session: ClientSession | null) => any
 * @returns {Promise<any>} result of fn
 */
const withTransaction = async (fn) => {
  const supported = await transactionsSupported();

  if (!supported) {
    // Standalone MongoDB — run without a transaction.
    // Operations are sequential but not atomic. Suitable for dev/single-node.
    logger.warn('[Transaction] Running without transaction (standalone MongoDB — no atomicity guarantee)');
    return fn(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    logger.error(`[Transaction] Aborted: ${err.message}`);
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };