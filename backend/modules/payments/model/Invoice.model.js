const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const lineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  productCode: { type: String },
  description: { type: String },
  hsnCode: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'PCS' },
  discountType: { type: String, enum: ['%', '₹'], default: '%' },
  discountValue: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },   // kept for backward compat (% value)
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
}, { _id: false });

const bankDetailsSchema = new mongoose.Schema({
  label: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  bankBranchName: { type: String },
  holderName: { type: String },
  upiId: { type: String },
  openingBalance: { type: Number, default: 0 },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  label: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    unique: true,
    default: () => `INV-${uuidv4().split('-')[0].toUpperCase()}`,
  },
  invoiceNumber: { type: String, unique: true, trim: true },

  invoiceType: {
    type: String,
    enum: ['b2b', 'retail'],
    default: 'b2b',
  },

  dbeInvoiceId: {
    type: String,
    default: null,
  },

  // Invoice numbering settings
  invoicePrefix: { type: String },
  invoiceSequence: { type: Number },

  // Party (Dealer)
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  partyName: { type: String, required: false },
  partyAddress: { type: String },
  partyGST: { type: String },
  partyPhone: { type: String },

  // Shipping address
  shippingAddress: { type: shippingAddressSchema },

  // Optional link to order
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  // Billing from (your company)
  billedFrom: {
    name: { type: String },
    address: { type: String },
    gstin: { type: String },
    phone: { type: String },
  },

  lineItems: [lineItemSchema],
  subtotal: { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },

  // Additional charges
  additionalCharges: { type: Number, default: 0 },
  additionalLabel: { type: String, default: 'Additional Charges' },

  // Round off
  roundOff: { type: Boolean, default: false },
  roundOffAmt: { type: Number, default: 0 },

  // Payment
  paymentMode: { type: String, default: 'Cash' },
  paymentReceivedIn: { type: String },   // bank account number used

  // Bank details attached to this invoice
  bankDetails: { type: bankDetailsSchema },

  invoiceDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  paymentTerms: { type: String },

  notes: { type: String, trim: true },
  termsAndConditions: { type: String },

  status: {
    type: String,
    enum: ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  },
  issuedAt: { type: Date },
  cancelledAt: { type: Date },
}, {
  timestamps: true,
  versionKey: false,
});

// Auto invoice number
invoiceSchema.pre('save', async function () {
  if (this.invoiceNumber) return;
  // If prefix+sequence set, compose number from them
  if (this.invoicePrefix && this.invoiceSequence) {
    this.invoiceNumber = `${this.invoicePrefix}-${this.invoiceSequence}`;
    return;
  }
  const { generateCode } = require('../../../utils/autoCode');
  this.invoiceNumber = await generateCode(this.constructor, 'INV', 'invoiceNumber', 'yyyyMMdd');
});

// Keep balance in sync
invoiceSchema.pre('save', async function () {
  this.balance = Math.max(0, this.totalAmount - this.amountPaid);
});

invoiceSchema.index({ dealerId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);