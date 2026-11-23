/**
 * Item-wise discount limits (min % / max %) on quotes.
 *
 * 1. Party (dealer in Bill To) limit:
 *      dealer's own minDiscount/maxDiscount
 *      → else its pricing tier limit (Settings.tierDiscounts)
 *      → else the general default (Settings.minItemDiscount / maxItemDiscount)
 *      → else 0% – 100%
 * 2. Product limit (Product Catalog minDiscount/maxDiscount), if set.
 * 3. When both apply, the STRICTER one wins: higher min, lower max.
 *
 * Super Admin is never limited.
 * Currently used by Quotes; written generically so Sales Invoice can reuse it.
 */
const Settings = require('../modules/settings/model/Settings.model');
const Product  = require('../modules/products/model/Product.model');
const Dealer   = require('../modules/dealer/model/Dealer.model');
const { AppError } = require('../middlewares/error.middleware');

const isSuperAdmin = (user) => {
  const role = user?.role;
  return Array.isArray(role) ? role.includes('super-admin') : role === 'super-admin';
};

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

const resolveLimits = (product, dealer, settings) => {
  const tier = settings?.tierDiscounts?.[dealer?.pricingTier || 'standard'] || {};

  let min = num(dealer?.minDiscount) ?? num(tier.min) ?? num(settings?.minItemDiscount) ?? 0;
  let max = num(dealer?.maxDiscount) ?? num(tier.max) ?? num(settings?.maxItemDiscount) ?? 100;

  // Product limit: stricter one wins
  const pMin = num(product?.minDiscount);
  const pMax = num(product?.maxDiscount);
  if (pMin !== null) min = Math.max(min, pMin);
  if (pMax !== null) max = Math.min(max, pMax);

  if (min > max) min = max; // conflicting limits: the max cap wins
  return { min, max };
};

// Effective discount % of a line: uses the % field, or converts a flat ₹ discount.
const lineDiscountPercent = (item) => {
  const pct = Number(item.discountPercent) || 0;
  if (pct > 0) return pct;
  const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const amt  = Number(item.discountAmount) || 0;
  return base > 0 ? (amt / base) * 100 : 0;
};

/**
 * Throws a 400 AppError if any line's discount is outside its allowed range.
 * Skipped for Super Admin and when no user is given (internal/sync calls).
 */
const assertItemDiscountsWithinLimits = async (lineItems = [], user, dealerId) => {
  if (!user || isSuperAdmin(user) || !lineItems.length) return;

  const productIds = [...new Set(lineItems.map((i) => i.productId).filter(Boolean).map(String))];
  const [settings, dealer, products] = await Promise.all([
    Settings.findOne({ key: 'global' }).lean(),
    dealerId ? Dealer.findById(dealerId).select('pricingTier minDiscount maxDiscount').lean().catch(() => null) : null,
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select('name minDiscount maxDiscount').lean()
      : [],
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  for (const item of lineItems) {
    const product = item.productId ? byId.get(String(item.productId)) : null;
    const { min, max } = resolveLimits(product, dealer, settings);
    const pct  = +lineDiscountPercent(item).toFixed(2);
    const name = item.productName || product?.name || 'item';
    if (pct > max + 0.001) {
      throw new AppError(`Discount for "${name}" is ${pct}%. Maximum allowed is ${max}%.`, 400);
    }
    if (pct < min - 0.001) {
      throw new AppError(`Discount for "${name}" is ${pct}%. Minimum required is ${min}%.`, 400);
    }
  }
};

module.exports = { assertItemDiscountsWithinLimits, resolveLimits, isSuperAdmin };
