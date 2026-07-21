const mongoose = require('mongoose');

const websiteEnquirySchema = new mongoose.Schema({
  dbeLeadId:     { type: String, unique: true, sparse: true }, // D-BE Lead _id
  enquiryNumber: { type: String },

  name:         { type: String, required: true, trim: true },
  mobile:       { type: String, required: true, trim: true },
  email:        { type: String, trim: true },
  businessType: { type: String, trim: true },
  message:      { type: String, trim: true },
  source:       { type: String, enum: ['support_page', 'get_quote_page', 'other'], default: 'other' },

  status: {
    type: String,
    enum: ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'],
    default: 'NEW',
  },
  adminNotes: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

websiteEnquirySchema.pre('save', async function () {
  if (this.enquiryNumber) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.enquiryNumber = await generateCode(this.constructor, 'ENQ', 'enquiryNumber', 'yyyyMMdd');
});

websiteEnquirySchema.index({ status: 1, createdAt: -1 });
websiteEnquirySchema.index({ source: 1 });

module.exports = mongoose.model('WebsiteEnquiry', websiteEnquirySchema);
