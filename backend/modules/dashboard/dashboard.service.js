const Dealer = require('../dealer/model/Dealer.model');
const Order = require('../orders/model/Order.model');
const Invoice = require('../payments/model/Invoice.model');
const Inventory = require('../inventory/model/Inventory.model');
const Return = require('../returns/model/Return.model');
const AuditLog = require('../audit/model/AuditLog.model');
const Transaction = require('../finance/model/Transaction.model');
const { emitToAll } = require('../../websocket/socket');
const { KPI_UPDATE } = require('../../websocket/events');

const getKPIs = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalDealers,
    activeDealers,
    pendingApprovals,
    activeOrders,
    monthRevenue,
    overdueInvoices,
    lowStockAlerts,
    pendingReturns,
  ] = await Promise.all([
    Dealer.countDocuments(),
    Dealer.countDocuments({ status: 'active' }),
    Dealer.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'shipped'] } }),
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.countDocuments({
      status: { $in: ['issued', 'partial'] },
      dueDate: { $lt: now },
    }),
    Inventory.countDocuments({
      $expr: { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] },
    }),
    Return.countDocuments({ status: { $in: ['requested', 'approved'] } }),
  ]);

  const kpis = {
    totalDealers,
    activeDealers,
    pendingApprovals,
    activeOrders,
    monthRevenue: monthRevenue[0]?.total || 0,
    overdueInvoices,
    lowStockAlerts,
    pendingReturns,
    updatedAt: new Date(),
  };

  // Broadcast updated KPIs
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
