const mongoose = require('mongoose');

/**
 * CustomerLedgerEntry — ledger-only data for a Buvvas website (b2c) order.
 *
 * Owned by the customerLedger module; nothing else reads or writes it. The
 * customer ledger itself is derived live from `orders` / `invoices` (see
 * customerLedger.service.js). This only stores what those cannot hold: the
 * COD collections staff record by hand, and the reminder log.
 */

const PAYMENT_METHODS = ['cash', 'upi', 'neft', 'rtgs', 'imps', 'bank-transfer', 'cheque', 'card', 'other'];

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: [0.01, 'Amount must be positive'] },
    paidOn: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    screenshotUrl: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByName: { type: String, trim: true, default: '' },
    recordedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedByName: { type: String, trim: true, default: '' },
    editedAt: { type: Date },

    // Undo keeps the entry (history) and stops counting it
    reversedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reversedByName: { type: String, trim: true, default: '' },
    reversalReason: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const reminderSchema = new mongoose.Schema(
  {
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentByName: { type: String, trim: true, default: '' },
    emailTo: { type: String, trim: true, default: '' },
    outstandingAtSend: { type: Number, default: 0 },
  },
  { _id: true }
);

const customerLedgerEntrySchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    payments: { type: [paymentSchema], default: [] },
    reminders: { type: [reminderSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('CustomerLedgerEntry', customerLedgerEntrySchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
