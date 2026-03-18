const mongoose = require('mongoose');

const retailItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true },
    productCode: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const retailOrderSchema = new mongoose.Schema(
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
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    customerAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    items: {
      type: [retailItemSchema],
      validate: [(v) => v.length > 0, 'At least one item is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'credit', 'bank-transfer'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    notes: { type: String, trim: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate orderNumber
retailOrderSchema.pre('save', async function () {
  if (this.orderNumber) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.orderNumber = await generateCode(this.constructor, 'RET', 'orderNumber', 'yyyyMMdd');
});

retailOrderSchema.index({ dealerId: 1 });
retailOrderSchema.index({ status: 1 });
retailOrderSchema.index({ orderNumber: 1 }, { unique: true });
retailOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('RetailOrder', retailOrderSchema);
