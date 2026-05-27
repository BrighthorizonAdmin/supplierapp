const Dealer = require('../dealer/model/Dealer.model');
const Order = require('../orders/model/Order.model');
const Invoice = require('../payments/model/Invoice.model');
const Inventory = require('../inventory/model/Inventory.model');
const Return = require('../returns/model/Return.model');
const AuditLog = require('../audit/model/AuditLog.model');
const Transaction = require('../finance/model/Transaction.model');
const ServiceRequest = require('../support/model/ServiceRequest.model');
const WarrantyRequest = require('../warranty/model/WarrantyRequest.model');
const { emitToAll } = require('../../websocket/socket');
const { KPI_UPDATE } = require('../../websocket/events');

const getKPIs = async () => {
  const now = new Date();
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart     = new Date(now.getFullYear(), 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevYearEnd   = new Date(now.getFullYear(), 0, 1);
  // Orders older than 3 days that are still processing/shipped = delayed
  const threeDaysAgo  = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [
    totalDealers,
    activeDealers,
    pendingApprovals,
    activeOrders,
    totalOrders,
    delayedOrders,
    monthRevenueRes,
    prevMonthRevenueRes,
    yearRevenueRes,
    prevYearRevenueRes,
    overdueInvoicesRes,
    lowStockAlerts,
    pendingReturns,
    inventoryValueRes,
    serviceRequests,
    warrantyPending,
    thisMonthDealers,
    prevMonthDealers,
    thisMonthOrders,
    prevMonthOrders,
  ] = await Promise.all([
    Dealer.countDocuments(),
    Dealer.countDocuments({ status: 'active' }),
    Dealer.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'shipped'] } }),
    Order.countDocuments({ orderNumber: { $not: /^ORD-\d{13}-\d+$/ } }),
    Order.countDocuments({
      status: { $in: ['processing', 'shipped'] },
      updatedAt: { $lt: threeDaysAgo },
    }),
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: prevMonthStart, $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: prevYearStart, $lt: prevYearEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ['issued', 'partial'] }, dueDate: { $lt: now } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]),
    Inventory.countDocuments({
      $expr: { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] },
    }),
    Return.countDocuments({ status: { $in: ['requested', 'approved'] } }),
    Inventory.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $multiply: ['$quantityOnHand', { $ifNull: ['$product.basePrice', 0] }] },
          },
        },
      },
    ]),
    ServiceRequest.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    WarrantyRequest.countDocuments({ status: 'pending' }),
    Dealer.countDocuments({ createdAt: { $gte: monthStart } }),
    Dealer.countDocuments({ createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
    Order.countDocuments({
      orderNumber: { $not: /^ORD-\d{13}-\d+$/ },
      createdAt: { $gte: monthStart },
    }),
    Order.countDocuments({
      orderNumber: { $not: /^ORD-\d{13}-\d+$/ },
      createdAt: { $gte: prevMonthStart, $lt: monthStart },
    }),
  ]);

  const monthRevenue    = monthRevenueRes[0]?.total || 0;
  const prevMonthRevenue = prevMonthRevenueRes[0]?.total || 0;
  const yearRevenue     = yearRevenueRes[0]?.total || 0;
  const prevYearRevenue = prevYearRevenueRes[0]?.total || 0;
  const overdueCount    = overdueInvoicesRes[0]?.count || 0;
  const overdueAmount   = overdueInvoicesRes[0]?.amount || 0;
  const inventoryValue  = inventoryValueRes[0]?.total || 0;

  // Trend = percentage change vs previous period (null if no previous data)
  const pct = (curr, prev) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

  const kpis = {
    // Core counts
    totalDealers,
    activeDealers,
    pendingApprovals,
    activeOrders,
    totalOrders,
    delayedOrders,
    pendingReturns,
    lowStockAlerts,
    serviceRequests,
    warrantyPending,

    // Revenue
    monthRevenue,
    yearRevenue,
    overdueInvoices: overdueCount,
    overdueAmount,
    inventoryValue,

    // Trends (percentage vs previous period)
    revenueTrend:  pct(monthRevenue, prevMonthRevenue),
    dealersTrend:  pct(thisMonthDealers, prevMonthDealers),
    ordersTrend:   pct(thisMonthOrders, prevMonthOrders),
    yearRevTrend:  pct(yearRevenue, prevYearRevenue),

    updatedAt: new Date(),
  };

  try {
    emitToAll(KPI_UPDATE, kpis);
  } catch {}

  return kpis;
};

const getRecentActivity = async (limit = 10) => {
  return AuditLog.find()
    .populate('performedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const getSalesChart = async (period = 'month') => {
  const now = new Date();
  let startDate, groupFormat;

  if (period === 'week') {
    startDate = new Date(now.setDate(now.getDate() - 7));
    groupFormat = '%Y-%m-%d';
  } else if (period === 'month') {
    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    groupFormat = '%Y-%m-%d';
  } else if (period === 'year') {
    startDate = new Date(new Date().getFullYear(), 0, 1);
    groupFormat = '%Y-%m';
  } else {
    startDate = new Date(now.setDate(now.getDate() - 7));
    groupFormat = '%Y-%m-%d';
  }

  return Transaction.aggregate([
    {
      $match: {
        type: 'debit',
        'ref.refType': 'order',
        createdAt: { $gte: startDate },
      },
    },
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

const getTopDealers = async (limit = 5) => {
  return Order.aggregate([
    { $match: { status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } } },
    { $group: { _id: '$dealerId', totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$netAmount' } } },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'dealers',
        localField: '_id',
        foreignField: '_id',
        as: 'dealer',
      },
    },
    { $unwind: '$dealer' },
    {
      $project: {
        dealerCode: '$dealer.dealerCode',
        businessName: '$dealer.businessName',
        pricingTier: '$dealer.pricingTier',
        totalOrders: 1,
        totalRevenue: 1,
      },
    },
  ]);
};

module.exports = { getKPIs, getRecentActivity, getSalesChart, getTopDealers };
