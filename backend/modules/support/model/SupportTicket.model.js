const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  dbeTicketId:  { type: String, unique: true, sparse: true }, // D-Be _id
  ticketNumber: { type: String },
  type:         { type: String, enum: ['GENERAL', 'SERVICE_REQUEST'], default: 'GENERAL' },

  // Dealer info (denormalised for quick access)
  dealerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  dealerName:  { type: String },
  dealerPhone: { type: String },
  dealerEmail: { type: String },

  // General ticket fields
  topic:   { type: String },
  name:    { type: String },
  phone:   { type: String },
  message: { type: String },

  // Service request fields
  productId:   { type: String },
  productName: { type: String },
  productSku:  { type: String },
  issueType:   { type: String },
  description: { type: String },
  contactPhone:{ type: String },

  // Lifecycle
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'AWAITING_DEALER', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  adminNotes:  { type: String, trim: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:  { type: Date },
}, { timestamps: true });

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ dealerId: 1 });
supportTicketSchema.index({ type: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);