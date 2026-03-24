const Dealer = require('../dealer/model/Dealer.model');
const Order = require('../orders/model/Order.model');
const Invoice = require('../payments/model/Invoice.model');
const Inventory = require('../inventory/model/Inventory.model');
const Return = require('../returns/model/Return.model');
const AuditLog = require('../audit/model/AuditLog.model');
const Transaction = require('../finance/model/Transaction.model');
const { emitToAll } = require('../../websocket/socket');
const { KPI_UPDATE } = require('../../websocket/events');
const { hasPermission } = require('../../middlewares/rbac.middleware');

/**
 * Returns only the KPIs the user is permitted to see, based on their role and permissions.
 * Super-admin sees everything; all other roles are filtered by their permission set.
 */
const getKPIs = async (user = {}) => {
  const { role, permissions = [] } = user;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isSuperAdmin = role === 'super-admin';
  const can = (perm) => isSuperAdmin || hasPermission(permissions, perm);

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
    can('dealer:read') ? Dealer.countDocuments() : Promise.resolve(undefined),
    can('dealer:read') ? Dealer.countDocuments({ status: 'active' }) : Promise.resolve(undefined),
    can('dealer:read') ? Dealer.countDocuments({ status: 'pending' }) : Promise.resolve(undefined),
    can('orders:read') ? Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'shipped'] } }) : Promise.resolve(undefined),
    can('finance:read')
      ? Transaction.aggregate([
          { $match: { type: 'debit', 'ref.refType': 'order', createdAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
      : Promise.resolve(undefined),
    can('finance:read') || can('invoices:read')
      ? Invoice.countDocuments({ status: { $in: ['issued', 'partial'] }, dueDate: { $lt: now } })
      : Promise.resolve(undefined),
    can('inventory:read')
      ? Inventory.countDocuments({
          $expr: { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] },
        })
      : Promise.resolve(undefined),
    can('returns:read') ? Return.countDocuments({ status: { $in: ['requested', 'approved'] } }) : Promise.resolve(undefined),
  ]);

  const kpis = { updatedAt: new Date() };
  if (totalDealers !== undefined) kpis.totalDealers = totalDealers;
  if (activeDealers !== undefined) kpis.activeDealers = activeDealers;
  if (pendingApprovals !== undefined) kpis.pendingApprovals = pendingApprovals;
  if (activeOrders !== undefined) kpis.activeOrders = activeOrders;
  if (monthRevenue !== undefined) kpis.monthRevenue = monthRevenue[0]?.total || 0;
  if (overdueInvoices !== undefined) kpis.overdueInvoices = overdueInvoices;
  if (lowStockAlerts !== undefined) kpis.lowStockAlerts = lowStockAlerts;
  if (pendingReturns !== undefined) kpis.pendingReturns = pendingReturns;

  try {
    emitToAll(KPI_UPDATE, kpis);
  } catch {}

  return kpis;
};

/**
 * Users with audit:read see all activity. Others see only their own actions.
 */
const getRecentActivity = async (limit = 10, user = {}) => {
  const { role, id: userId, permissions = [] } = user;
  const canSeeAll = role === 'super-admin' || hasPermission(permissions, 'audit:read');

  const filter = canSeeAll ? {} : { performedBy: userId };

  return AuditLog.find(filter)
    .populate('performedBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Returns sales chart data. Returns empty array if user lacks finance:read.
 */
const getSalesChart = async (period = 'month', user = {}) => {
  const { role, permissions = [] } = user;
  const isSuperAdmin = role === 'super-admin';
  if (!isSuperAdmin && !hasPermission(permissions, 'finance:read')) return [];

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

/**
 * Returns top dealers by revenue. Returns empty array if user lacks dealer:read.
 */
const getTopDealers = async (limit = 5, user = {}) => {
  const { role, permissions = [] } = user;
  const isSuperAdmin = role === 'super-admin';
  if (!isSuperAdmin && !hasPermission(permissions, 'dealer:read')) return [];

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
