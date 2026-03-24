/**
 * Audit Analytics Service
 *
 * Provides all analytics data for the Analyst role dashboard.
 * Every function here is intentionally ungated — authorization (audit:read)
 * is enforced at the route level. Adding permission checks inside these
 * helpers would be redundant and would break the analyst use-case.
 *
 * These queries aggregate computed/summary data only. Raw sensitive records
 * (individual transactions, order details, customer PII) are never returned.
 */

const Order = require('../orders/model/Order.model');
const Transaction = require('../finance/model/Transaction.model');
const RetailOrder = require('../retailOrders/model/RetailOrder.model');
const Product = require('../products/model/Product.model');
const Inventory = require('../inventory/model/Inventory.model');
const Dealer = require('../dealer/model/Dealer.model');

// ─── KPIs ────────────────────────────────────────────────────────────────────

const getKPIs = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthRevenueAgg, activeOrders] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'shipped'] } }),
  ]);

  const monthRevenue = monthRevenueAgg[0]?.total || 0;
  return { monthRevenue, activeOrders };
};

// ─── Sales Chart ─────────────────────────────────────────────────────────────

const getSalesChart = async (period = 'year') => {
  const now = new Date();
  let startDate, groupFormat;

  if (period === 'week') {
    startDate = new Date(now.setDate(now.getDate() - 7));
    groupFormat = '%Y-%m-%d';
  } else if (period === 'month') {
    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    groupFormat = '%Y-%m-%d';
  } else {
    startDate = new Date(new Date().getFullYear(), 0, 1);
    groupFormat = '%Y-%m';
  }

  return Transaction.aggregate([
    { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        revenue: { $sum: '$amount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', revenue: 1, orders: 1, _id: 0 } },
  ]);
};

// ─── Inventory Stats ──────────────────────────────────────────────────────────

const getInventoryStats = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const distributionAgg = Product.aggregate([
    { $match: { isActive: true } },
    { $lookup: { from: 'inventories', localField: '_id', foreignField: 'productId', as: 'invRecords' } },
    { $unwind: { path: '$invRecords', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        _qoh:    { $ifNull: ['$invRecords.quantityOnHand',    { $ifNull: ['$openingStockQty', 0] }] },
        _qalloc: { $ifNull: ['$invRecords.quantityAllocated', 0] },
        _rl:     { $ifNull: ['$invRecords.reorderLevel',      10] },
      },
    },
    { $addFields: { _qavail: { $subtract: ['$_qoh', '$_qalloc'] } } },
    {
      $group: {
        _id: null,
        inStock:    { $sum: { $cond: [{ $and: [{ $gt: ['$_qoh', 0] }, { $gt:  ['$_qavail', '$_rl'] }] }, 1, 0] } },
        lowStock:   { $sum: { $cond: [{ $and: [{ $gt: ['$_qoh', 0] }, { $lte: ['$_qavail', '$_rl'] }] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$_qoh', 0] }, 1, 0] } },
      },
    },
  ]);

  const [totalAgg, totalCatalogSKUs, distResult, fastMovingCount, slowMovingCount] = await Promise.all([
    Inventory.aggregate([
      { $group: { _id: null, totalOnHand: { $sum: '$quantityOnHand' }, totalAllocated: { $sum: '$quantityAllocated' } } },
    ]),
    Product.countDocuments({ isActive: true }),
    distributionAgg,
    Inventory.countDocuments({ lastRestockedAt: { $gte: thirtyDaysAgo } }),
    Inventory.countDocuments({ $or: [{ lastRestockedAt: { $lt: ninetyDaysAgo } }, { lastRestockedAt: null }] }),
  ]);

  const totalOnHand    = totalAgg[0]?.totalOnHand    || 0;
  const totalAllocated = totalAgg[0]?.totalAllocated || 0;
  const dist           = distResult[0] || { inStock: 0, lowStock: 0, outOfStock: 0 };

  return {
    totalOnHand,
    totalAllocated,
    totalSKUs: totalCatalogSKUs,
    lowStockCount: dist.lowStock,
    outOfStockCount: dist.outOfStock,
    inStockCount: dist.inStock,
    fastMovingCount,
    slowMovingCount,
    distribution: { inStock: dist.inStock, lowStock: dist.lowStock, outOfStock: dist.outOfStock },
  };
};

// ─── Top Products ─────────────────────────────────────────────────────────────

const getTopProducts = async (limit = 7) => {
  const mongoose = require('mongoose');

  const pipeline = [
    { $match: { isActive: true } },
    { $lookup: { from: 'inventories', localField: '_id', foreignField: 'productId', as: 'invRecords' } },
    { $unwind: { path: '$invRecords', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'warehouses', localField: 'invRecords.warehouseId', foreignField: '_id', as: 'whArr' } },
    {
      $project: {
        _id: { $ifNull: ['$invRecords._id', '$_id'] },
        productId: {
          _id: '$_id',
          name: '$name',
          productCode: '$productCode',
          category: '$category',
          unit: '$unit',
          basePrice: '$basePrice',
        },
        warehouseId:       { $arrayElemAt: ['$whArr', 0] },
        quantityOnHand:    { $ifNull: ['$invRecords.quantityOnHand',    '$openingStockQty'] },
        quantityAllocated: { $ifNull: ['$invRecords.quantityAllocated', 0] },
        reorderLevel:      { $ifNull: ['$invRecords.reorderLevel',      10] },
        lastRestockedAt:   '$invRecords.lastRestockedAt',
        updatedAt:         { $ifNull: ['$invRecords.updatedAt', '$updatedAt'] },
        openingStockQty:   '$openingStockQty',
        currentStockQty:   '$currentStockQty',
      },
    },
    { $sort: { updatedAt: -1 } },
    { $limit: limit },
  ];

  return Product.aggregate(pipeline);
};

// ─── Delivered Orders Count ───────────────────────────────────────────────────

const getDeliveredCount = async () => {
  return Order.countDocuments({ status: 'delivered' });
};

// ─── Retail Analytics ─────────────────────────────────────────────────────────

const getRetailAnalytics = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthAgg = {}] = await RetailOrder.aggregate([
    { $match: { createdAt: { $gte: monthStart } } },
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
  ]);
  const monthRevenue  = monthAgg.revenue || 0;
  const monthOrders   = monthAgg.orders  || 0;
  const avgOrderValue = monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0;

  const [deliveryAgg = {}] = await RetailOrder.aggregate([
    { $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } } } },
  ]);
  const deliveryRate = deliveryAgg.total > 0
    ? parseFloat(((deliveryAgg.delivered / deliveryAgg.total) * 100).toFixed(1))
    : 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const retailTrend = await RetailOrder.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, retail: { $sum: '$totalAmount' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  const trend = retailTrend.map((r) => ({
    date: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
    retail: r.retail,
  }));

  const channelAgg = await RetailOrder.aggregate([
    { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' } } },
    { $sort: { amount: -1 } },
  ]);
  const CHANNEL_LABELS = { cash: 'Walk-in Store', card: 'Online Store', upi: 'Online Store', credit: 'Market Place', 'bank-transfer': 'Net Banking' };
  const channelMap = {};
  channelAgg.forEach(({ _id, amount }) => {
    const label = CHANNEL_LABELS[_id] || _id;
    channelMap[label] = (channelMap[label] || 0) + amount;
  });
  const channels = Object.entries(channelMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topDealersAgg = await RetailOrder.aggregate([
    { $group: { _id: '$dealerId', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 8 },
    { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
    { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
  ]);
  const STATUS_MAP = { active: 'Active', pending: 'Pending', suspended: 'Review', rejected: 'Review' };
  const topDealers = topDealersAgg.map((d, i) => ({
    rank:    String(i + 1).padStart(2, '0'),
    name:    d.dealer?.businessName || 'Unknown',
    orders:  d.orders,
    revenue: d.revenue,
    status:  STATUS_MAP[d.dealer?.status] || 'Active',
  }));

  const customerAgg = await RetailOrder.aggregate([
    { $group: { _id: '$customerPhone', orderCount: { $sum: 1 } } },
  ]);
  const totalCustomers = customerAgg.length;
  const repeatBuyers   = customerAgg.filter((c) => c.orderCount > 1).length;
  const repeatBuyerPct = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;

  return {
    kpis: { monthRevenue, monthOrders, avgOrderValue, deliveryRate },
    trend,
    channels,
    topDealers,
    customerInsights: { totalCustomers, repeatBuyerPct, newBuyerPct: 100 - repeatBuyerPct },
  };
};

module.exports = { getKPIs, getSalesChart, getInventoryStats, getTopProducts, getDeliveredCount, getRetailAnalytics };
