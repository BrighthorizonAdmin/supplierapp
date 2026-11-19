const mongoose = require('mongoose');

// One entry per change to a sales invoice: who changed it, when, and each field's
// value before and after. Kept separate from the invoice so it survives a delete.
const changeSchema = new mongoose.Schema({
  field: { type: String },                 // e.g. "invoiceDate" or "lineItems.Battery 150Ah.quantity"
  label: { type: String },                 // e.g. "Invoice Date" or "Battery 150Ah — Quantity"
  kind:  { type: String, default: 'text' }, // text | money | number | date
  from:  { type: String, default: '' },
  to:    { type: String, default: '' },
}, { _id: false });

const invoiceHistorySchema = new mongoose.Schema({
  invoiceId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
  invoiceNumber: { type: String, default: '' },
  invoiceType:   { type: String, default: '' },
  partyName:     { type: String, default: '' },

  action: {
    type: String,
    enum: ['edit', 'serials', 'issue', 'cancel', 'delete'],
    required: true,
  },
  source: { type: String, default: '' },   // where the change was made, e.g. "Super Admin edit"

  changes: { type: [changeSchema], default: [] },

  performedBy: {
    id:    { type: String },
    name:  { type: String },
    email: { type: String },
    role:  { type: mongoose.Schema.Types.Mixed },
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
});

invoiceHistorySchema.index({ createdAt: -1 });
invoiceHistorySchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('InvoiceHistory', invoiceHistorySchema);
