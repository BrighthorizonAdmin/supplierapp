const Transaction = require('./model/Transaction.model');
const Invoice = require('../payments/model/Invoice.model');
const Order = require('../orders/model/Order.model');
const Payment = require('../payments/model/Payment.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

const getRevenueSummary = async ({ startDate, endDate, groupBy = 'month' } = {}) => {
  const match = { type: 'debit', 'ref.refType': 'order' };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const groupFormat = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'week' ? '%G-W%V' : '%Y-%m';

  const revenue = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { period: '$_id', revenue: { $max: ['$revenue', 0] }, count: 1, _id: 0 } },
  ]);

  const refunds = await Transaction.aggregate([
    { $match: { ...match, 'ref.refType': 'return' } },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        refunds: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const refundMap = Object.fromEntries(refunds.map((r) => [r._id, r.refunds]));

  return revenue.map((r) => ({
    period: r.period,
    revenue: r.revenue,
    refunds: refundMap[r.period] || 0,
    netRevenue: Math.max(0, r.revenue - (refundMap[r.period] || 0)),
    orderCount: r.count,
  }));
};

const getOverallStats = async () => {
  const [revenueResult, refundResult, overdueInvoices, pendingPayments] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: 'debit', 'ref.refType': 'order' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { 'ref.refType': 'return' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.countDocuments({
      status: { $in: ['issued', 'partial'] },
      dueDate: { $lt: new Date() },
    }),
    Payment.countDocuments({ status: 'pending' }),
  ]);

  const totalRevenue = revenueResult[0]?.total || 0;
  const totalRefunds = refundResult[0]?.total || 0;

  return {
    totalRevenue,
    totalRefunds,
    netRevenue: Math.max(0, totalRevenue - totalRefunds),
    overdueInvoices,
    pendingPayments,
  };
};

const getDealerLedger = async (dealerId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = { dealerId: require('mongoose').Types.ObjectId.createFromHexString(dealerId) };

  const [data, total] = await Promise.all([
    Transaction.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(match),
  ]);

  // Running balance (from oldest to newest)
  return { data, pagination: buildMeta(total, page, limit) };
};

const getPaymentCollectionReport = async (query = {}) => {
  const { startDate, endDate } = query;
  const match = { status: 'confirmed' };
  if (startDate || endDate) {
    match.confirmedAt = {};
    if (startDate) match.confirmedAt.$gte = new Date(startDate);
    if (endDate) match.confirmedAt.$lte = new Date(endDate);
  }

  return Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$method',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    { $project: { method: '$_id', total: 1, count: 1, _id: 0 } },
  ]);
};

module.exports = { getRevenueSummary, getOverallStats, getDealerLedger, getPaymentCollectionReport };
