const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    // Tab 0 — General Dealer & Onboarding
    defaultStatus: { type: String, default: 'active' },
    autoApprove: { type: Boolean, default: true },
    multipleUsers: { type: Boolean, default: true },
    dealerIdFormat: { type: String, default: 'auto' },
    defaultDealerType: { type: String, default: 'distributor' },
    gstCertificate: { type: Boolean, default: true },
    panCard: { type: Boolean, default: true },
    bankDetails: { type: Boolean, default: true },
    addressProof: { type: Boolean, default: true },
    manualApproval: { type: Boolean, default: true },
    // Tab 1 — Credit & Financial
    defaultCreditLimit: { type: String, default: '10000' },
    defaultCreditPeriod: { type: String, default: 'net30' },
    allowPrePaid: { type: Boolean, default: false },
    autoBlockOnBreach: { type: Boolean, default: true },
    gracePeriod: { type: String, default: '3' },
    // Tab 2 — Order & Pricing
    minOrderValue: { type: String, default: '10000' },
    paymentMethods: { type: [String], default: ['cash', 'card', 'upi'] },
    allowPartialOrders: { type: Boolean, default: false },
    allowBackorders: { type: String, default: '6' },
    maxBackorderDays: { type: String, default: '3' },
    defaultPriceTier: { type: String, default: 'tier1' },
    dealerOrderOverride: { type: Boolean, default: true },
    // Tab 3 — Company Info
    companyName: { type: String, default: 'Your Company Name' },
    companyAddress: { type: String, default: '' },
    companyMobile: { type: String, default: '' },
    companyGSTIN: { type: String, default: '' },
    companyPAN: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    companyWebsite: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankIFSC: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
    // Item-wise discount limits (%) — default for all products; a product's own
    // minDiscount/maxDiscount overrides these. Super Admin is not limited.
    minItemDiscount: { type: Number, default: 0, min: 0, max: 100 },
    maxItemDiscount: { type: Number, default: 100, min: 0, max: 100 },
    // Per pricing-tier limits (%). Empty = use min/maxItemDiscount above.
    // A dealer's own minDiscount/maxDiscount overrides its tier.
    tierDiscounts: {
      standard: { min: { type: Number, default: null }, max: { type: Number, default: null } },
      silver:   { min: { type: Number, default: null }, max: { type: Number, default: null } },
      gold:     { min: { type: Number, default: null }, max: { type: Number, default: null } },
      platinum: { min: { type: Number, default: null }, max: { type: Number, default: null } },
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Settings', settingsSchema);
