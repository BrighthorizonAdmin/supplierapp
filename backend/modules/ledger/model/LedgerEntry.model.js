const mongoose = require('mongoose');

/**
 * LedgerEntry — supplementary, ledger-only data attached to an Order.
 *
 * This collection is OWNED by the ledger module. Nothing else in S-BE or D-BE
 * reads or writes it. The ledger list itself is derived live from the existing
 * `orders` / `invoices` / `payments` collections (see ledger.aggregator.js);
 * this model only stores the things those collections cannot hold:
 *   - payment-proof screenshots
 *   - a manually-set "remaining amount due by" date override
 *   - a manual (book-keeping) payment log that never touches the real
 *     `payments` collection
 *   - a log of reminders sent to the dealer
 */

const MANUAL_PAYMENT_METHODS = [
  'cash', 'upi', 'neft', 'rtgs', 'imps', 'bank-transfer', 'cheque', 'card', 'other',
];

const screenshotSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    label: { type: String, trim: true, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const manualPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: [0.01, 'Amount must be positive'] },
    paidOn: { type: Date, required: true },
    method: { type: String, enum: MANUAL_PAYMENT_METHODS, default: 'other' },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    screenshotUrl: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByName: { type: String, trim: true, default: '' },
    recordedAt: { type: Date, default: Date.now },

    // Set by orderPayment.service when the payment was also posted to the
    // order's S-BE invoice (amountPaid). The aggregator counts such payments
    // through the invoice, NOT again as a manual addend. Entries without it
    // are legacy book-keeping-only rows and are still added on top.
    appliedToInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    // Dealer credit (creditUsed) freed by this payment — given back on reversal
    creditReleased: { type: Number, default: 0 },
    // This payment settled the order and flipped its paymentStatus to 'completed'
    markedOrderPaid: { type: Boolean, default: false },

    // Payments are never deleted — a mistaken one is reversed, keeping history
    reversedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reversedByName: { type: String, trim: true, default: '' },
    reversalReason: { type: String, trim: true, default: '' },

    // Push to the dealer app (D-BE payment-update webhook). 'n/a' = supplier-
    // created order, nothing on the dealer side to update.
    dealerSync: {
      status: { type: String, enum: ['pending', 'synced', 'failed', 'n/a'], default: 'pending' },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, trim: true, default: '' },
      syncedAt: { type: Date },
    },
  },
  { _id: true }
);

const notifyLogSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['app', 'email', 'both'], default: 'both' },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentByName: { type: String, trim: true, default: '' },
    outstandingAtSend: { type: Number, default: 0 },
    dueDateAtSend: { type: Date },
    message: { type: String, trim: true, default: '' },
    emailTo: { type: String, trim: true, default: '' },
    ok: { type: Boolean, default: true },
    errorText: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const ledgerEntrySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      index: true,
    },
    expectedClearanceDate: { type: Date },
    remarks: { type: String, trim: true, default: '' },
    proofScreenshots: { type: [screenshotSchema], default: [] },
    manualPayments: { type: [manualPaymentSchema], default: [] },
    notifyLog: { type: [notifyLogSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'ledgerentries',
  }
);

ledgerEntrySchema.virtual('manualPaidTotal').get(function () {
  return (this.manualPayments || []).reduce((sum, p) => sum + (p.reversedAt ? 0 : (Number(p.amount) || 0)), 0);
});

ledgerEntrySchema.set('toJSON', { virtuals: true });
ledgerEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.LedgerEntry
  || mongoose.model('LedgerEntry', ledgerEntrySchema);

module.exports.MANUAL_PAYMENT_METHODS = MANUAL_PAYMENT_METHODS;
