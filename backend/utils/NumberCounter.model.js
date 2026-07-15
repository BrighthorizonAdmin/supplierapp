const mongoose = require('mongoose');

// Continuous, never-resetting sequence counters — one doc per `key` (e.g. 'quote', 'invoice').
// `nextSeq` only ever goes up. `freed` holds sequence numbers given back by deleted documents,
// kept sorted ascending so the smallest freed number is always reused first.
const numberCounterSchema = new mongoose.Schema({
  key:     { type: String, unique: true, required: true },
  nextSeq: { type: Number, default: 0 },
  freed:   { type: [Number], default: [] },
});

module.exports = mongoose.model('NumberCounter', numberCounterSchema);
