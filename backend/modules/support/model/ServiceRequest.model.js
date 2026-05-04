const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  dbeRequestId: { type: String, unique: true, sparse: true },
  ticketNumber: { type: String },
  type: { type: String, enum: ['SERVICE_REQUEST'], default: 'SERVICE_REQUEST' },
  dealerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  dealerName:  { type: String },
  dealerPhone: { type: String },
  dealerEmail: { type: String },

  productId:   { type: String },
  productName: { type: String },
  productSku:  { type: String },
  issueType:   { type: String },
  description: { type: String },
  contactPhone:{ type: String },

  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'AWAITING_DEALER', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  },
  priority:   { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  adminNotes: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ dealerId: 1 });
serviceRequestSchema.index({ type: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
