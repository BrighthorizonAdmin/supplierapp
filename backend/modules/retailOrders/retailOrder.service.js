const RetailOrder = require('./model/RetailOrder.model');
const Invoice = require('../payments/model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const Product = require('../products/model/Product.model');
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

  // Deduct currentStockQty for each product in the order
  for (const item of order.items) {
    if (item.productId) {
      await Product.findByIdAndUpdate(
        item.productId,
        [{ $set: { currentStockQty: { $max: [0, { $add: ['$currentStockQty', -item.quantity] }] } } }]
      );
    }
  }

  await auditService.log('retailOrder', order._id, 'create', userId, {
    after: { orderNumber: order.orderNumber, dealerId: data.dealerId },
  });
  return order;
};

// Normalize a native RetailOrder doc to a unified shape
const normalizeRetailOrder = (doc) => ({
  _id:           doc._id,
  source:        'internal',
  orderNumber:   doc.orderNumber,
  dealerId:      doc.dealerId,
  dealerName:    doc.dealerId?.businessName || doc.dealerId?.name || '—',
  customerName:  doc.customerName,
  customerPhone: doc.customerPhone || '',
  status:        doc.status,
  paymentMethod: doc.paymentMethod,
  paymentStatus: doc.paymentStatus,
  subtotal:      doc.subtotal,
  taxAmount:     doc.taxAmount,
  totalAmount:   doc.totalAmount,
  notes:         doc.notes || '',
  createdAt:     doc.createdAt,
  updatedAt:     doc.updatedAt,
});

// Normalize a dealer-synced Invoice (invoiceType:'retail') to unified shape
const normalizeSyncedInvoice = (doc) => {
  // notes format from webhook: "Retail sale to: Name | Phone"
  const notesRaw   = doc.notes || '';
  const afterPrefix = notesRaw.replace('Retail sale to: ', '');
  const [customerName = '', customerPhone = ''] = afterPrefix.split(' | ');

  return {
    _id:           doc._id,
    source:        'dealer_sync',
    orderNumber:   doc.invoiceNumber,          // e.g. "D-RET-20260327-0002"
    dealerId:      doc.dealerId || null,
    dealerName:    doc.partyName || '—',
    customerName:  customerName.trim() || '—',
    customerPhone: customerPhone.trim() || '',
    status:        'delivered',                // dealer retail = already fulfilled
    paymentMethod: (doc.paymentMode || 'cash').toLowerCase(),
    paymentStatus: 'paid',
    subtotal:      doc.subtotal,
    taxAmount:     doc.taxAmount,
    totalAmount:   doc.totalAmount,
    notes:         doc.notes || '',
    createdAt:     doc.invoiceDate || doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
};

const getRetailOrders = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);

  // ── Build match for native RetailOrder ─────────────────────────────────────
  const nativeMatch = {};
  if (query.dealerId)     nativeMatch.dealerId     = query.dealerId;
  if (query.status)       nativeMatch.status       = query.status;
  if (query.paymentStatus) nativeMatch.paymentStatus = query.paymentStatus;
  if (query.search) {
    nativeMatch.$or = [
      { customerName: { $regex: query.search, $options: 'i' } },
      { orderNumber:  { $regex: query.search, $options: 'i' } },
    ];
  }

  // ── Build match for dealer-synced Invoices ──────────────────────────────────
  // Only include dealer-synced retail invoices (skip if caller filtered by a
  // status that can never apply to synced invoices, e.g. 'pending'/'cancelled')
  const syncedStatuses = ['delivered', 'paid', ''];
  const skipSynced =
    (query.status       && !['delivered', ''].includes(query.status)) ||
    (query.paymentStatus && query.paymentStatus !== 'paid');

  const invoiceMatch = { invoiceType: 'retail', dbeInvoiceId: { $ne: null } };
  if (query.dealerId) invoiceMatch.dealerId = query.dealerId;
  if (query.search) {
    invoiceMatch.$or = [
      { partyName:     { $regex: query.search, $options: 'i' } },
      { invoiceNumber: { $regex: query.search, $options: 'i' } },
      { notes:         { $regex: query.search, $options: 'i' } },
    ];
  }

  // ── Fetch both collections in parallel ─────────────────────────────────────
  const [nativeDocs, nativeTotal, syncedDocs, syncedTotal] = await Promise.all([
    RetailOrder.find(nativeMatch)
      .populate('dealerId', 'businessName name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RetailOrder.countDocuments(nativeMatch),

    skipSynced ? Promise.resolve([])  : Invoice.find(invoiceMatch).sort({ invoiceDate: -1 }).skip(skip).limit(limit).lean(),
    skipSynced ? Promise.resolve(0)   : Invoice.countDocuments(invoiceMatch),
  ]);

  // ── Merge + re-sort by createdAt desc, then paginate ───────────────────────
  const merged = [
    ...nativeDocs.map(normalizeRetailOrder),
    ...syncedDocs.map(normalizeSyncedInvoice),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Apply pagination to the merged list (both collections already skipped/limited
  // individually; merged view re-paginates the combined window — good enough for
  // typical page sizes; for large datasets a proper union aggregation is preferred)
  const total = nativeTotal + syncedTotal;
  const data  = merged.slice(0, limit);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getRetailOrderById = async (id) => {
  const order = await RetailOrder.findById(id)
    .populate('dealerId', 'name')
    .populate('processedBy', 'name')
    .lean();
  if (!order) throw new AppError('Retail order not found', 404);
  return order;
};

const updateRetailOrderStatus = async (orderId, status, userId) => {
  const order = await RetailOrder.findById(orderId);
  if (!order) throw new AppError('Retail order not found', 404);

  const prevStatus = order.status;
  order.status = status;
  await order.save();

  // Restore currentStockQty if order is being cancelled (and wasn't already cancelled)
  if (status === 'cancelled' && prevStatus !== 'cancelled') {
    for (const item of order.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { currentStockQty: item.quantity } });
      }
    }
  }

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