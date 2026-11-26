const mongoose = require('mongoose');

// Product reviews written on the Buvvas website. Created by the storefront API
// (dealerManagementBackend, src/models/ProductReview.js) in the shared database;
// this app only moderates them. Keep the two schemas in step.
const mediaSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  type:     { type: String, enum: ['image', 'video'], required: true },
  mimeType: { type: String },
  size:     { type: Number },
}, { _id: false });

const productReviewSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  productName: { type: String, trim: true },
  productPath: { type: String, trim: true },
  name:     { type: String, required: true, trim: true },
  email:    { type: String, trim: true },
  phone:    { type: String, trim: true },
  location: { type: String, trim: true },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  title:    { type: String, trim: true },
  comment:  { type: String, required: true, trim: true },
  media:    { type: [mediaSchema], default: [] },
  customerId:       { type: mongoose.Schema.Types.ObjectId },
  verifiedPurchase: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  moderatedAt:     { type: Date },
  moderatedBy:     { type: String },
  rejectionReason: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true, collection: 'productreviews' });

module.exports = mongoose.models.ProductReview || mongoose.model('ProductReview', productReviewSchema);
