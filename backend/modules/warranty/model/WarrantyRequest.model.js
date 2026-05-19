const mongoose = require('mongoose');

const claimItemSchema = new mongoose.Schema({
  productId: { type: String },
  name:      { type: String },
  sku:       { type: String },
  quantity:  { type: Number, default: 1 },
  reason:    { type: String, default: '' },
}, { _id: false });

const warrantyRequestSchema = new mongoose.Schema({
  claimNumber:   { type: String, unique: true },
  dbeClaimId:    { type: String, sparse: true },

  dealerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },

  dbeInvoiceId:  { type: String },
  invoiceNumber: { type: String },
  invoiceDate:   { type: Date },
  warrantyPeriod: { type: String, default: '' },

  customerName:  { type: String },
  customerPhone: { type: String, default: '' },

  items:            { type: [claimItemSchema] },
  issueDescription: { type: String },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'repaired', 'replaced'],
    default: 'pending',
  },
  supplierNotes: { type: String, default: '' },
  resolvedAt:    { type: Date },
}, { timestamps: true, versionKey: false });

warrantyRequestSchema.pre('save', async function () {
  if (this.claimNumber) return;
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const count = await this.constructor.countDocuments();
  this.claimNumber = `WR-${datePart}-${String(count + 1).padStart(4, '0')}`;
});

warrantyRequestSchema.index({ status: 1 });
warrantyRequestSchema.index({ dealerId: 1 });
warrantyRequestSchema.index({ createdAt: -1 });
warrantyRequestSchema.index({ dbeClaimId: 1 }, { sparse: true });

module.exports = mongoose.model('WarrantyRequest', warrantyRequestSchema);
