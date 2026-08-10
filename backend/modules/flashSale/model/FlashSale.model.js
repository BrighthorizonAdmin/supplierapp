const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'], 
    },
    discountPercent: { 
      type: Number,
      required: [true, 'Discount percent is required'],
      min: [1, 'Discount percent must be at least 1'],
      max: [100, 'Discount percent cannot exceed 100'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    // Optional — when unset, the sale stays live until the supplier manually
    // disables it (isEnabled: false) rather than expiring on a fixed date.
    endDate: {
      type: Date,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    // 'all' — applies to every product on the Buvvas storefront.
    // 'selected' — applies only to productIds/categories below.
    scope: {
      type: String,
      enum: ['all', 'selected'],
      default: 'all',
    },
    productIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    categories: [{
      type: String,
      trim: true,
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

flashSaleSchema.index({ isEnabled: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('FlashSale', flashSaleSchema);
