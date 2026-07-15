const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
  name:          { type: String },
  ifscCode:      { type: String },
  accountNumber: { type: String },
  bankBranch:    { type: String },
}, { _id: false });

const lineItemSchema = new mongoose.Schema(
  {
    productId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName:     { type: String, required: true },
    description:     { type: String },
    hsnCode:         { type: String },
    quantity:        { type: Number, required: true, min: 1 },
    unitPrice:       { type: Number, required: true, min: 0 },
    unit:            { type: String, default: 'PCS' },
    discountPercent: { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    taxRate:         { type: Number, default: 0 },
    taxAmount:       { type: Number, default: 0 },
    lineTotal:       { type: Number, default: 0 },
  },
  { _id: false }
);

const additionalChargeSchema = new mongoose.Schema(
  {
    label:     { type: String, default: '' },
    amount:    { type: Number, default: 0 },
    taxRate:   { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const overallDiscountSchema = new mongoose.Schema(
  {
    discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    value:        { type: Number, default: 0 },
    afterTax:     { type: Boolean, default: true },
    amount:       { type: Number, default: 0 },
  },
  { _id: false }
);

const quoteSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, unique: true, trim: true },
    quoteSeq:    { type: Number }, // underlying continuous sequence number behind quoteNumber (needed to free it on delete)

    // Party (Dealer / Customer)
    dealerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
    // Raw business name of the dealer that created this quote (source: 'dealer' only) —
    // stored directly from the webhook payload so the signatory line doesn't depend
    // on dealerId resolving/populating successfully.
    dealerBusinessName: { type: String },
    partyName:     { type: String },
    partyPhone:    { type: String },
    partyAddress:  { type: String },
    partyGST:      { type: String },
    placeOfSupply: { type: String },
    shippingName:  { type: String },
    salesman:      { type: String },

    // Dates
    quoteDate:   { type: Date, default: Date.now },
    expiryDate:  { type: Date },
    validForDays: { type: Number, default: 30 },

    // Line items
    lineItems:    [lineItemSchema],

    // Additional charges
    additionalCharges: { type: [additionalChargeSchema], default: [] },

    // Overall / footer discount
    overallDiscount: { type: overallDiscountSchema, default: null },

    // Round-off
    autoRoundOff:   { type: Boolean, default: false },
    roundOffAmount: { type: Number, default: 0 },

    // Stored totals
    subtotal:    { type: Number, default: 0 },
    taxAmount:   { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    // Bank details (per-quote, overrides company settings in PDF)
    bankDetails: { type: bankDetailsSchema },

    // Optional text
    notes:              { type: String, trim: true },
    termsAndConditions: { type: String },

    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'deletedByDealer'],
      default: 'draft',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Dealer-synced quotes
    source:     { type: String, enum: ['supplier', 'dealer'], default: 'supplier' },
    dbeQuoteId: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

// Auto-generate quote number: QTN-YYYY-MM-0001 (continuous sequence, never resets;
// reuses numbers freed by deleted quotes — see numberSequence.js / quote.service.js deleteQuote)
quoteSchema.pre('save', async function () {
  if (this.quoteNumber) return;
  const { reserveSeq, formatCode } = require('../../../utils/numberSequence');
  const seq = await reserveSeq('supplier-quote', { reuse: true });
  this.quoteSeq    = seq;
  this.quoteNumber = formatCode('QTN', seq);
});

quoteSchema.index({ dealerId: 1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ quoteDate: -1 });
quoteSchema.index({ dbeQuoteId: 1 }, { sparse: true });

module.exports = mongoose.model('Quote', quoteSchema);
