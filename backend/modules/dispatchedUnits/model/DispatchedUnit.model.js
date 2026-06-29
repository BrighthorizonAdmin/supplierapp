const mongoose = require('mongoose');

const dispatchedUnitSchema = new mongoose.Schema(
  {
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    productName: { type: String, trim: true },
    warrantyMonths: { type: Number, default: 0 },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    invoiceNumber: { type: String, trim: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
    },
    dispatchedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['dispatched', 'delivered', 'in_stock'],
      default: 'dispatched',
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedReason: { type: String, trim: true },
    restoredAt: { type: Date },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

dispatchedUnitSchema.index({ serialNumber: 1 });
dispatchedUnitSchema.index({ invoiceId: 1 });
dispatchedUnitSchema.index({ dealerId: 1 });
dispatchedUnitSchema.index({ productId: 1 });

module.exports = mongoose.model('DispatchedUnit', dispatchedUnitSchema);
