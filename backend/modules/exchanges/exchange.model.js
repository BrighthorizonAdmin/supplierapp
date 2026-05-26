const mongoose = require('mongoose');

// Lightweight schema that maps to the 'exchanges' collection created by D-BE.
// S-BE reads/updates exchange documents but does not create them (dealers initiate).
const exchangeItemSchema = new mongoose.Schema({
  productId:            { type: mongoose.Schema.Types.ObjectId },
  sku:                  { type: String },
  name:                 { type: String },
  quantity:             { type: Number },
  unitPrice:            { type: Number },
  reason:               { type: String },
  exchangeType:         { type: String },
  replacementProductId: { type: mongoose.Schema.Types.ObjectId },
  replacementSku:       { type: String },
  replacementName:      { type: String },
}, { _id: false, strict: false });

const exchangeSchema = new mongoose.Schema({
  exchangeId:          { type: String },
  orderId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  dealerId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  items:               [exchangeItemSchema],
  status:              { type: String },
  comments:            { type: String },
  photos:              [{ type: String }],
  supplierNotes:       { type: String },
  supplierApprovedAt:  { type: Date },
  completedAt:         { type: Date },
  cancelledAt:         { type: Date },
  timeline: [{
    status:      { type: String },
    timestamp:   { type: Date, default: Date.now },
    description: { type: String },
  }],
}, { timestamps: true, strict: false, collection: 'exchanges' });

module.exports = mongoose.models.Exchange
  || mongoose.model('Exchange', exchangeSchema, 'exchanges');
