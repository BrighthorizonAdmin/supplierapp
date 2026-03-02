const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Warehouse code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    capacity: {
      type: Number,
      min: [0, 'Capacity cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

warehouseSchema.index({ code: 1 }, { unique: true });
warehouseSchema.index({ isActive: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
