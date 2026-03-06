const RetailOrder = require('./model/RetailOrder.model');
const Dealer = require('../dealer/model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');

const createRetailOrder = async (data, userId) => {
  const dealer = await Dealer.findById(data.dealerId);
  if (!dealer || dealer.status !== 'active') {
    throw new AppError('Dealer not found or not active', 400);
  }

  // Calculate totals
  let subtotal = 0, taxAmount = 0;
  const items = data.items.map((item) => {
    const priceAfterDiscount = item.unitPrice * (1 - (item.discount || 0) / 100);
    const itemTax = priceAfterDiscount * item.quantity * ((item.taxRate || 0) / 100);
    const lineTotal = priceAfterDiscount * item.quantity + itemTax;
    subtotal += priceAfterDiscount * item.quantity;
    taxAmount += itemTax;
    return { ...item, lineTotal };
  });

  const order = await RetailOrder.create({
    ...data,
    items,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    processedBy: userId,
  });

  await auditService.log('retailOrder', order._id, 'create', userId, {
    after: { orderNumber: order.orderNumber, dealerId: data.dealerId },
  });
  return order;
};

const getRetailOrders = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.status) match.status = query.status;
  if (query.paymentStatus) match.paymentStatus = query.paymentStatus;
  if (query.search) {
    match.$or = [
      { customerName: { $regex: query.search, $options: 'i' } },
      { orderNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    RetailOrder.find(match)
      .populate('dealerId', 'businessName dealerCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RetailOrder.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getRetailOrderById = async (id) => {
  const order = await RetailOrder.findById(id)
    .populate('dealerId', 'businessName dealerCode')
    .populate('processedBy', 'name')
    .lean();
  if (!order) throw new AppError('Retail order not found', 404);
  return order;
};

const updateRetailOrderStatus = async (orderId, status, userId) => {
  const order = await RetailOrder.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true }
  );
  if (!order) throw new AppError('Retail order not found', 404);
  await auditService.log('retailOrder', orderId, 'update', userId, { after: { status } });
  return order;
};

const getRetailAnalytics = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Month KPIs ──
  const [monthAgg = {}] = await RetailOrder.aggregate([
    { $match: { createdAt: { $gte: monthStart } } },
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
  ]);
  const monthRevenue  = monthAgg.revenue || 0;
  const monthOrders   = monthAgg.orders  || 0;
  const avgOrderValue = monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0;

  // ── Delivery rate (all-time) ──
  const [deliveryAgg = {}] = await RetailOrder.aggregate([
    { $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } } } },
  ]);
  const deliveryRate = deliveryAgg.total > 0
    ? parseFloat(((deliveryAgg.delivered / deliveryAgg.total) * 100).toFixed(1))
    : 0;

  // ── Monthly retail revenue trend (last 6 months) ──
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const retailTrend = await RetailOrder.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        retail: { $sum: '$totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const trend = retailTrend.map((r) => ({
    date: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
    retail: r.retail,
  }));

  // ── Payment method / channel breakdown ──
  const channelAgg = await RetailOrder.aggregate([
    { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' } } },
    { $sort: { amount: -1 } },
  ]);
  const CHANNEL_LABELS = {
    cash: 'Walk-in Store',
    card: 'Online Store',
    upi: 'Online Store',
    credit: 'Market Place',
    'bank-transfer': 'Net Banking',
  };
  // Merge channels that share the same label
  const channelMap = {};
  channelAgg.forEach(({ _id, amount }) => {
    const label = CHANNEL_LABELS[_id] || _id;
    channelMap[label] = (channelMap[label] || 0) + amount;
  });
  const channels = Object.entries(channelMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ── Top dealers by retail revenue ──
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

  // ── Customer insights ──
  const customerAgg = await RetailOrder.aggregate([
    { $group: { _id: '$customerPhone', orderCount: { $sum: 1 } } },
  ]);
  const totalCustomers  = customerAgg.length;
  const repeatBuyers    = customerAgg.filter((c) => c.orderCount > 1).length;
  const repeatBuyerPct  = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;

  return {
    kpis: { monthRevenue, monthOrders, avgOrderValue, deliveryRate },
    trend,
    channels,
    topDealers,
    customerInsights: { totalCustomers, repeatBuyerPct, newBuyerPct: 100 - repeatBuyerPct },
  };
};

module.exports = { createRetailOrder, getRetailOrders, getRetailOrderById, updateRetailOrderStatus, getRetailAnalytics };
