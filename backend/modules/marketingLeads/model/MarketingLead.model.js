const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    outcome: {
      type: String,
      enum: ['interested', 'not-interested', 'callback', 'no-answer', 'requesting-details', 'form-sent', 'other'],
      required: true,
    },
    notes: { type: String, trim: true },
    followUpDate: { type: Date },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const marketingLeadSchema = new mongoose.Schema(
  {
    leadCode: { type: String, unique: true, uppercase: true, trim: true },

    // Business info
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [200, 'Business name cannot exceed 200 characters'],
    },
    primaryContact: {
      type: String,
      required: [true, 'Primary contact is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    leadSource: {
      type: String,
      enum: ['justdial', 'external-list', 'referral', 'trade-fair', 'cold-call', 'online-enquiry', 'field-visit', 'other'],
      default: 'other',
    },

    // Location
    address: {
      street: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      country: { type: String, default: 'India', trim: true },
    },

    // Pipeline stage
    pipelineStage: {
      type: String,
      enum: ['lead-creation', 'document-collection', 'admin-review', 'approval'],
      default: 'lead-creation',
    },

    // KYC / onboarding status label shown in UI
    kycStatus: {
      type: String,
      enum: ['pending-kyc', 'kyc-submitted', 'kyc-verified', 'kyc-rejected'],
      default: 'pending-kyc',
    },

    // Overall lead status
    status: {
      type: String,
      enum: ['active', 'converted', 'dropped', 'on-hold', 'not-interested'],
      default: 'active',
    },

    // Initial call log (inline on form)
    initialCallOutcome: {
      type: String,
      enum: ['interested', 'not-interested', 'callback', 'no-answer', 'requesting-details', 'form-sent', 'other'],
    },
    initialCallNotes: { type: String, trim: true },
    nextFollowUpDate: { type: Date },

    // Activity & call logs (array)
    callLogs: [callLogSchema],

    // Who created / manages
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Link to dealer once converted
    convertedDealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
    convertedAt: { type: Date },

    // Document request tracking
    documentsRequested: { type: Boolean, default: false },
    documentsRequestedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate leadCode
marketingLeadSchema.pre('save', async function (next) {
  if (this.leadCode) return next();
  const { generateCode } = require('../../../utils/autoCode');
  this.leadCode = await generateCode(this.constructor, 'MKT', 'leadCode', 'yyyyMM');
  next();
});

marketingLeadSchema.index({ status: 1 });
marketingLeadSchema.index({ pipelineStage: 1 });
marketingLeadSchema.index({ createdBy: 1 });
marketingLeadSchema.index({ leadCode: 1 }, { unique: true });
marketingLeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketingLead', marketingLeadSchema);