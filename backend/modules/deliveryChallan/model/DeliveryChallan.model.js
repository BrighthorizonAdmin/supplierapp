const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
  name:          { type: String },
  ifscCode:      { type: String },
  accountNumber: { type: String },
  bankBranch:    { type: String },
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
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
}, { _id: false });

const additionalChargeSchema = new mongoose.Schema({
  label:     { type: String, default: '' },
  amount:    { type: Number, default: 0 },
  taxRate:   { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
}, { _id: false });

const overallDiscountSchema = new mongoose.Schema({
  discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  value:        { type: Number, default: 0 },
  afterTax:     { type: Boolean, default: true },
  amount:       { type: Number, default: 0 },
}, { _id: false });

const shipToSchema = new mongoose.Schema({
  name:    { type: String },
  address: { type: String },
  gstin:   { type: String },
}, { _id: false });

const challanSchema = new mongoose.Schema({
  challanNumber: { type: String, unique: true, trim: true },

  dealerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  partyName:      { type: String },
  partyPhone:     { type: String },
  partyAddress:   { type: String },
  partyGST:       { type: String },
  partyPAN:       { type: String },
  placeOfSupply:  { type: String },
  salesman:       { type: String },

  shipTo:         { type: shipToSchema },
  courierPartner: { type: String },
  awbNumber:      { type: String },
  orderId:        { type: String },
  warrantyPeriod: { type: String },

  challanDate: { type: Date, default: Date.now },

  lineItems:         [lineItemSchema],
  additionalCharges: { type: [additionalChargeSchema], default: [] },
  overallDiscount:   { type: overallDiscountSchema, default: null },

  autoRoundOff:   { type: Boolean, default: false },
  roundOffAmount: { type: Number, default: 0 },

  subtotal:    { type: Number, default: 0 },
  taxAmount:   { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  bankDetails: { type: bankDetailsSchema },

  notes:              { type: String, trim: true },
  termsAndConditions: { type: String },

  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

challanSchema.pre('save', async function () {
  if (this.challanNumber) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.challanNumber = await generateCode(this.constructor, 'DC', 'challanNumber', 'yyyyMMdd');
});

challanSchema.index({ dealerId: 1 });
challanSchema.index({ status: 1 });
challanSchema.index({ challanDate: -1 });

module.exports = mongoose.model('DeliveryChallan', challanSchema);
