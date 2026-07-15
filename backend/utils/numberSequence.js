const NumberCounter = require('./NumberCounter.model');

// Formats a continuous sequence number as PREFIX-YYYY-MM-####. The YYYY-MM
// reflects the current date at generation time — the numeric tail is a single
// running counter that never resets at day/month boundaries.
const formatCode = (prefix, seq) => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${yyyy}-${mm}-${String(seq).padStart(4, '0')}`;
};

// Atomically reserves the next number for `key`. If `reuse` is true and a
// freed (previously deleted) number is available, the smallest one is reused;
// otherwise the running counter is incremented.
const reserveSeq = async (key, { reuse = false } = {}) => {
  if (reuse) {
    const before = await NumberCounter.findOneAndUpdate(
      { key, 'freed.0': { $exists: true } },
      { $pop: { freed: -1 } },
      { new: false }
    );
    if (before) return before.freed[0];
  }
  const counter = await NumberCounter.findOneAndUpdate(
    { key },
    { $inc: { nextSeq: 1 } },
    { new: true, upsert: true }
  );
  return counter.nextSeq;
};

// Returns a freed sequence number to the pool for `key`, sorted ascending so
// the smallest freed number is always reused first.
const freeSeq = async (key, seq) => {
  if (!Number.isFinite(seq)) return;
  await NumberCounter.findOneAndUpdate(
    { key },
    { $push: { freed: { $each: [seq], $sort: 1 } } },
    { upsert: true }
  );
};

// Non-mutating preview of what reserveSeq(key, {reuse:true}) would currently
// return — for display only. Does NOT advance the counter or pop the freed
// pool, so merely opening a screen that calls this can never burn a number;
// only an actual reserveSeq() call (at real creation time) does that.
const peekSeq = async (key) => {
  const counter = await NumberCounter.findOne({ key });
  if (counter?.freed?.length) return counter.freed[0];
  return (counter?.nextSeq || 0) + 1;
};

module.exports = { formatCode, reserveSeq, freeSeq, peekSeq };
