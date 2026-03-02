const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        message: '{VALUE} is not a valid order status',
      },
      default: 'draft',
    },
    pricingTier: {
      type: String,
      enum: ['standard', 'silver', 'gold', 'platinum'],
      default: 'standard',
    },
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    netAmount: {
      type: Number,
      default: 0,
      min: [0, 'Net amount cannot be negative'],
    },
    creditUsed: {
      type: Number,
      default: 0,
      min: [0, 'Credit used cannot be negative'],
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    notes: {
      type: String,
      trim: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate orderNumber
orderSchema.pre('save', async function (next) {
  if (this.orderNumber) return next();
  const { generateCode } = require('../../../utils/autoCode');
  this.orderNumber = await generateCode(this.constructor, 'ORD', 'orderNumber', 'yyyyMMdd');
  next();
});

orderSchema.index({ dealerId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ dealerId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
