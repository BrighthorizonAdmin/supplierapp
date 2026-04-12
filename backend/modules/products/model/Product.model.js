const mongoose = require('mongoose');

// Each variant is a selectable option (e.g. "USB+LAN", "USB+LAN+Serial")
// with its own price. If a product has no variants, basePrice is used directly.
const variantSchema = new mongoose.Schema(
  {
    label:     { type: String, required: true, trim: true }, // e.g. "USB+LAN"
    price:     { type: Number, required: true, min: 0 },     // variant-specific dealer price
    sku:       { type: String, trim: true },                  // optional suffix e.g. "BVS-GL-A2-USB"
    isDefault: { type: Boolean, default: false },             // pre-selected in dealer app
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    filePath: { type: String },
    url:      { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    unit: {
      type: String,
      enum: {
        values: ['piece', 'kg', 'litre', 'box', 'dozen', 'metre', 'pack'],
        message: '{VALUE} is not a valid unit',
      },
      default: 'piece',
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price cannot be negative'],
    },
    mrp: {
      type: Number,
      min: [0, 'MRP cannot be negative'],
    },
    // Pricing by tier
    pricingTiers: {
      standard: { type: Number, min: 0 },
      silver:   { type: Number, min: 0 },
      gold:     { type: Number, min: 0 },
      platinum: { type: Number, min: 0 },
    },
    taxRate: {
      type: Number,
      default: 18,
      min: [0, 'Tax rate cannot be negative'],
    },
    hsn: {
      type: String,
      trim: true,
    },
    moq: {
      type: Number,
      min: [0, 'MOQ cannot be negative'],
    },
    openingStockQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStockQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    openingStockDate: {
      type: Date,
    },
    specifications: {
      weight:     { type: String, trim: true },
      dimensions: { type: String, trim: true },
      color:      { type: String, trim: true },
    },
    images: [imageSchema],

    // ── Variants ──────────────────────────────────────────────────────────────
    // Optional. When present, dealer must select one before adding to cart.
    // variantLabel is the group heading shown in the dealer app (e.g. "Interface").
    variantLabel: { type: String, trim: true },
    variants: [variantSchema],
    // ─────────────────────────────────────────────────────────────────────────

    tags: [{ type: String, trim: true, lowercase: true }],
    isActive: {
      type: Boolean,
      default: true,
    },
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

// Guard: openingStockQty is immutable after creation
productSchema.pre('save', function () {
  if (!this.isNew && this.isModified('openingStockQty')) {
    const err = new Error('openingStockQty cannot be changed after creation');
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
});

// Auto-generate productCode
productSchema.pre('save', async function () {
  if (this.productCode) return;
  const { generateCode } = require('../../../utils/autoCode');
  this.productCode = await generateCode(this.constructor, 'PRD', 'productCode', 'yyyyMM');
});

// Helper: get price for a tier
productSchema.methods.getPriceForTier = function (tier) {
  if (this.pricingTiers && this.pricingTiers[tier]) return this.pricingTiers[tier];
  return this.basePrice;
};

productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);