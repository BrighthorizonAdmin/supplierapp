const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
  },
  { _id: false }
);

const dealerSchema = new mongoose.Schema(
  {
    dealerCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [200, 'Business name cannot exceed 200 characters'],
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      maxlength: [100, 'Owner name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number'],
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      // required: [true, 'GST number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      sparse: true,
      // match: [
      //   /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      //   'Please provide a valid GST number',
      // ],
    },
    panNumber: {
      type: String,
      // required: [true, 'PAN number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      // match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN number'],
      sparse: true,
    },
    address: {
      type: addressSchema,
      // required: [true, 'Address is required'],
    },
    businessType: {
      type: String,
      enum: {
        values: ['retailer', 'wholesaler', 'distributor'],
        message: '{VALUE} is not a valid business type',
      },
      required: [true, 'Business type is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'updates-required', 'active', 'suspended', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    kycStatus: {
      type: String,
      enum: {
        values: ['pending', 'verified', 'rejected'],
        message: '{VALUE} is not a valid KYC status',
      },
      default: 'pending',
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
    },
    creditUsed: {
      type: Number,
      default: 0,
      min: [0, 'Credit used cannot be negative'],
    },
    pricingTier: {
      type: String,
      enum: {
        values: ['standard', 'silver', 'gold', 'platinum'],
        message: '{VALUE} is not a valid pricing tier',
      },
      default: 'standard',
    },
    bankDetails: {
      type: bankDetailsSchema,
    },
    onboardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    suspensionReason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    applicationId: {        
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: available credit
dealerSchema.virtual('availableCredit').get(function () {
  return Math.max(0, this.creditLimit - this.creditUsed);
});

// Auto-generate dealerCode before save
dealerSchema.pre('save', async function () {
  if (this.dealerCode) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.dealerCode = await generateCode(this.constructor, 'DLR', 'dealerCode', 'yyyyMM');
});

dealerSchema.index({ gstNumber: 1 }, { unique: true });
dealerSchema.index({ panNumber: 1 }, { unique: true });
dealerSchema.index({ email: 1 }, { unique: true });
dealerSchema.index({ status: 1 });
dealerSchema.index({ kycStatus: 1 });
dealerSchema.index({ businessType: 1 });
dealerSchema.index({ dealerCode: 1 }, { unique: true });
dealerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Dealer', dealerSchema);
