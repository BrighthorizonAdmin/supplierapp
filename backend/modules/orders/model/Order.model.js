const mongoose = require('mongoose');

// Embedded items schema — used by DealerApp-created orders
const embeddedItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String },
    name: { type: String },
    image: { type: String },
    unitPrice: { type: Number, min: 0 },
    quantity: { type: Number, min: 1 },
    moq: { type: Number },
    lineTotal: { type: Number },
    // SupplierApp-style fields (may be present)
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    productName: { type: String },
    productCode: { type: String },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number },
    taxAmount: { type: Number },
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    description: { type: String },
    location: { type: String },
  },
  { _id: false }
);

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
    orderType: {
      type: String,
      enum: { values: ['b2b', 'b2c'], message: '{VALUE} is not a valid order type' },
      default: 'b2b',
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rejected', 'returned', 'refunded'],
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
    // Embedded items — present on DealerApp-created orders
    items: [embeddedItemSchema],
    // DealerApp order fields
    shippingCost: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String },
    paymentStatus: { type: String },
    // Link back to the originating dealer-side order (set when order arrives via webhook)
    dbeOrderId:        { type: String, default: null },   // dealer's MongoDB _id
    dealerOrderNumber: { type: String, default: null },   // dealer's orderNumber (e.g. ORD-xxx)
    deliveryAddress: {
      label: { type: String },
      fullAddress: { type: String },
      city: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
    trackingId: { type: String },
    carrier: { type: String },
    timeline: [timelineEventSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate orderNumber
orderSchema.pre('save', async function () {
  if (this.orderNumber) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.orderNumber = await generateCode(this.constructor, 'ORD', 'orderNumber', 'yyyyMMdd');
});

orderSchema.index({ dealerId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ dealerId: 1, status: 1 });
orderSchema.index({ dbeOrderId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Order', orderSchema);