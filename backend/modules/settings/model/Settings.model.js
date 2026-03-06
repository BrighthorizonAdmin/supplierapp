const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    // Tab 0 — General Dealer & Onboarding
    defaultStatus:     { type: String, default: 'active' },
    autoApprove:       { type: Boolean, default: true },
    multipleUsers:     { type: Boolean, default: true },
    dealerIdFormat:    { type: String, default: 'auto' },
    defaultDealerType: { type: String, default: 'distributor' },
    gstCertificate:    { type: Boolean, default: true },
    panCard:           { type: Boolean, default: true },
    bankDetails:       { type: Boolean, default: true },
    addressProof:      { type: Boolean, default: true },
    manualApproval:    { type: Boolean, default: true },
    // Tab 1 — Credit & Financial
    defaultCreditLimit:  { type: String, default: '10000' },
    defaultCreditPeriod: { type: String, default: 'net30' },
    allowPrePaid:        { type: Boolean, default: false },
    autoBlockOnBreach:   { type: Boolean, default: true },
    gracePeriod:         { type: String, default: '3' },
    // Tab 2 — Order & Pricing
    minOrderValue:       { type: String, default: '10000' },
    paymentMethods:      { type: [String], default: ['cash', 'card', 'upi'] },
    allowPartialOrders:  { type: Boolean, default: false },
    allowBackorders:     { type: String, default: '6' },
    maxBackorderDays:    { type: String, default: '3' },
    defaultPriceTier:    { type: String, default: 'tier1' },
    dealerOrderOverride: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Settings', settingsSchema);
