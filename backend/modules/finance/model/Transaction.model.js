const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['credit', 'debit'],
        message: '{VALUE} is not a valid transaction type',
      },
      required: [true, 'Transaction type is required'],
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    ref: {
      refType: {
        type: String,
        enum: ['order', 'payment', 'return', 'adjustment'],
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    runningBalance: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Append-only: block updates
transactionSchema.pre('findOneAndUpdate', function () {
  throw new Error('Transactions are append-only and cannot be modified');
});

transactionSchema.pre('updateOne', function () {
  throw new Error('Transactions are append-only and cannot be modified');
});

transactionSchema.index({ dealerId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'ref.refType': 1, 'ref.refId': 1 });
transactionSchema.index({ dealerId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
