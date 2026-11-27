/**
 * One stock-level rule for the whole supplier app:
 *   Out of stock : 0 pieces (or fewer)
 *   Low stock    : 1 – LOW_STOCK_THRESHOLD pieces
 *   In stock     : more than LOW_STOCK_THRESHOLD pieces
 * The count is the product's live stock (`currentStockQty`).
 */
const LOW_STOCK_THRESHOLD = 15;

const getStockStatus = (qty) => {
  const n = Number(qty) || 0;
  if (n <= 0) return 'out-of-stock';
  if (n <= LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'in-stock';
};

const isOutOfStock = (qty) => getStockStatus(qty) === 'out-of-stock';
const isLowStock = (qty) => getStockStatus(qty) === 'low-stock';

// Aggregation expressions on a numeric field path such as '$currentStockQty'.
const qtyExpr = (field) => ({ $ifNull: [field, 0] });
const outOfStockExpr = (field = '$currentStockQty') => ({ $lte: [qtyExpr(field), 0] });
const lowStockExpr = (field = '$currentStockQty') => ({
  $and: [{ $gt: [qtyExpr(field), 0] }, { $lte: [qtyExpr(field), LOW_STOCK_THRESHOLD] }],
});
const inStockExpr = (field = '$currentStockQty') => ({ $gt: [qtyExpr(field), LOW_STOCK_THRESHOLD] });
const stockStatusExpr = (field = '$currentStockQty') => ({
  $switch: {
    branches: [
      { case: outOfStockExpr(field), then: 'out-of-stock' },
      { case: lowStockExpr(field), then: 'low-stock' },
    ],
    default: 'in-stock',
  },
});

// Query filters on currentStockQty for find()/countDocuments().
const STOCK_FILTERS = {
  'out-of-stock': { $or: [{ currentStockQty: { $lte: 0 } }, { currentStockQty: null }] },
  'low-stock': { currentStockQty: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } },
  'in-stock': { currentStockQty: { $gt: LOW_STOCK_THRESHOLD } },
};

module.exports = {
  LOW_STOCK_THRESHOLD,
  getStockStatus,
  isOutOfStock,
  isLowStock,
  outOfStockExpr,
  lowStockExpr,
  inStockExpr,
  stockStatusExpr,
  STOCK_FILTERS,
};
