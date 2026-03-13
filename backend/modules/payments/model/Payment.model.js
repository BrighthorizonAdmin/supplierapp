const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Allocation amount must be positive'],
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be positive'],
    },
    method: {
      type: String,
      enum: {
        values: ['bank-transfer', 'cheque', 'cash', 'upi', 'neft', 'rtgs', 'card', 'wire-transfer', 'net-30', 'cod'],
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'confirmed', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
    },
    allocations: [allocationSchema],
    reference: { type: String, trim: true },
    chequeNumber: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    // DealerApp payment fields
    gatewayTransactionId: { type: String, trim: true },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, trim: true },
    failureReason: { type: String, trim: true },
    processedAt: { type: Date },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: {
      type: Date,
    },
    remarks: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Auto-generate paymentNumber
paymentSchema.pre('save', async function (next) {
  if (this.paymentNumber) return next();
  const { generateCode } = require('../../../utils/autoCode');
  this.paymentNumber = await generateCode(this.constructor, 'PAY', 'paymentNumber', 'yyyyMMdd');
  next();
});

// Immutability guard: status cannot change once confirmed
paymentSchema.pre('save', function (next) {
  if (!this.isNew && this.isModified('status')) {
    const original = this._original_status;
    if (original === 'confirmed') {
      const err = new Error('Payment status cannot be changed once confirmed');
      err.statusCode = 400;
      err.isOperational = true;
      return next(err);
    }
  }
  next();
});

// Track original status
paymentSchema.post('init', function (doc) {
  doc._original_status = doc.status;
});

paymentSchema.index({ dealerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentNumber: 1 }, { unique: true });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ dealerId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
