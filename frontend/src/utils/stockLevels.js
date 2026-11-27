/**
 * Stock level rule — must match backend/utils/stockLevels.js.
 *   Out of stock : 0 pieces
 *   Low stock    : 1 – 15 pieces
 *   In stock     : more than 15 pieces
 */
export const LOW_STOCK_THRESHOLD = 15;

export const getStockStatus = (qty) => {
  const n = Number(qty) || 0;
  if (n <= 0) return 'out-of-stock';
  if (n <= LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'in-stock';
};

export const STOCK_STATUS_META = {
  'in-stock': {
    label: 'In stock',
    badge: 'badge-green',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    rule: `More than ${LOW_STOCK_THRESHOLD} pieces`,
  },
  'low-stock': {
    label: 'Low stock',
    badge: 'badge-yellow',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    rule: `1 – ${LOW_STOCK_THRESHOLD} pieces left`,
  },
  'out-of-stock': {
    label: 'Out of stock',
    badge: 'badge-red',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    rule: '0 pieces — reorder now',
  },
};

/** Short helper text for a quantity, e.g. "Only 7 left" or "Reorder now". */
export const stockHint = (qty) => {
  const n = Math.max(0, Number(qty) || 0);
  const status = getStockStatus(n);
  if (status === 'out-of-stock') return 'Reorder now';
  if (status === 'low-stock') return `Only ${n} left`;
  return `${n.toLocaleString('en-IN')} available`;
};
