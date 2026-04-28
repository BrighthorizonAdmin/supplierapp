const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
  {
    orderItemId: { type: mongoose.Schema.Types.ObjectId },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    productName: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, min: 0 },
    returnReason: { type: String, trim: true },
    condition: {
      type: String,
      enum: ['sellable', 'damaged', 'expired'],
      default: 'sellable',
    },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    rmaNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer is required'],
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    items: {
      type: [returnItemSchema],
      validate: [(v) => v.length > 0, 'At least one item is required'],
    },
    reason: {
      type: String,
      required: [true, 'Return reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['requested', 'approved', 'received', 'refunded', 'rejected'],
        message: '{VALUE} is not a valid return status',
      },
      default: 'requested',
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refund amount cannot be negative'],
    },
    refundMethod: {
      type: String,
      trim: true,
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    inventoryAdjusted: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      trim: true,
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

// Auto-generate rmaNumber
returnSchema.pre('save', async function () {
  if (this.rmaNumber) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.rmaNumber = await generateCode(this.constructor, 'RMA', 'rmaNumber', 'yyyyMMdd');
});

returnSchema.index({ dealerId: 1 });
returnSchema.index({ orderId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ rmaNumber: 1 }, { unique: true, sparse: true });
returnSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
