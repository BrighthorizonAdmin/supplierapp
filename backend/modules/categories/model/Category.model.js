const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, unique: true, trim: true },
    hsnCode: { type: String, trim: true, default: '' },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Category', categorySchema);
