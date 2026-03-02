const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
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
    productName: {
      type: String,
      trim: true,
    },
    productCode: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    lineTotal: {
      type: Number,
      default: 0,
      min: [0, 'Line total cannot be negative'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Pre-save: calculate lineTotal
orderItemSchema.pre('save', function (next) {
  const priceAfterDiscount = this.unitPrice * (1 - this.discount / 100);
  this.taxAmount = priceAfterDiscount * this.quantity * (this.taxRate / 100);
  this.lineTotal = priceAfterDiscount * this.quantity + this.taxAmount;
  next();
});

orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 });
orderItemSchema.index({ orderId: 1, productId: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
