const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    productCode: { type: String },
    quantity: { type: Number },
    unitPrice: { type: Number },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer is required'],
    },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: {
        values: ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'],
        message: '{VALUE} is not a valid invoice status',
      },
      default: 'draft',
    },
    dueDate: {
      type: Date,
    },
    issuedAt: {
      type: Date,
    },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate invoiceNumber
invoiceSchema.pre('save', async function (next) {
  if (this.invoiceNumber) return next();
  const { generateCode } = require('../../../utils/autoCode');
  this.invoiceNumber = await generateCode(this.constructor, 'INV', 'invoiceNumber', 'yyyyMMdd');
  next();
});

// Pre-save: keep balance in sync
invoiceSchema.pre('save', function (next) {
  this.balance = Math.max(0, this.totalAmount - this.amountPaid);
  next();
});

invoiceSchema.index({ dealerId: 1 });
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ dealerId: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
