const test = require('node:test');
const assert = require('node:assert/strict');
const { getStockStatus, LOW_STOCK_THRESHOLD, STOCK_FILTERS } = require('./stockLevels');

test('zero or negative stock is out of stock', () => {
  assert.equal(getStockStatus(0), 'out-of-stock');
  assert.equal(getStockStatus(-3), 'out-of-stock');
  assert.equal(getStockStatus(undefined), 'out-of-stock');
});

test('1 to 15 pieces is low stock', () => {
  assert.equal(LOW_STOCK_THRESHOLD, 15);
  assert.equal(getStockStatus(1), 'low-stock');
  assert.equal(getStockStatus(15), 'low-stock');
});

test('more than 15 pieces is in stock', () => {
  assert.equal(getStockStatus(16), 'in-stock');
  assert.equal(getStockStatus(500), 'in-stock');
});

test('query filters use the same boundaries', () => {
  assert.deepEqual(STOCK_FILTERS['low-stock'], { currentStockQty: { $gt: 0, $lte: 15 } });
  assert.deepEqual(STOCK_FILTERS['in-stock'], { currentStockQty: { $gt: 15 } });
});
