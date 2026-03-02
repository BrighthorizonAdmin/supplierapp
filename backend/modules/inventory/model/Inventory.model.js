const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required'],
    },
    quantityOnHand: {
      type: Number,
      default: 0,
      min: [0, 'Quantity on hand cannot be negative'],
    },
    quantityAllocated: {
      type: Number,
      default: 0,
      min: [0, 'Allocated quantity cannot be negative'],
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: [0, 'Reorder level cannot be negative'],
    },
    lastRestockedAt: {
      type: Date,
    },
    lastRestockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: available quantity
inventorySchema.virtual('quantityAvailable').get(function () {
  return Math.max(0, this.quantityOnHand - this.quantityAllocated);
});

// Virtual: isLowStock
inventorySchema.virtual('isLowStock').get(function () {
  return this.quantityAvailable <= this.reorderLevel;
});

// Compound unique index: one record per product per warehouse
inventorySchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
inventorySchema.index({ productId: 1 });
inventorySchema.index({ warehouseId: 1 });
inventorySchema.index({ quantityOnHand: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
