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

const getRetailAnalytics = async ({ startDate, endDate } = {}) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const periodStart = startDate ? new Date(startDate) : monthStart;
  const periodEnd   = endDate   ? new Date(endDate)   : now;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // ── Run all aggregations in parallel (native RetailOrders + dealer-synced Invoices) ──
  const [
    nativeKpi,
    invoiceKpi,
    nativeDelivery,
    invoiceDelivery,
    nativeTrend,
    invoiceTrend,
    nativeChannels,
    invoiceChannels,
    nativeTopDealers,
    invoiceTopDealers,
    nativeCustomers,
    invoiceCustomers,
  ] = await Promise.all([
    // KPI: native orders in period
    RetailOrder.aggregate([
      { $match: { createdAt: { $gte: periodStart, $lte: periodEnd } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    // KPI: synced invoices in period (use invoiceDate, fall back to createdAt)
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null }, invoiceDate: { $gte: periodStart, $lte: periodEnd } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    // Delivery: native all-time
    RetailOrder.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } } } },
    ]),
    // Delivery: synced invoices are always "delivered"
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null } } },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]),
    // Trend: native last 6 months
    RetailOrder.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, retail: { $sum: '$totalAmount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    // Trend: synced invoices last 6 months
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null }, invoiceDate: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$invoiceDate' }, month: { $month: '$invoiceDate' } }, retail: { $sum: '$totalAmount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    // Channels: native
    RetailOrder.aggregate([
      { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' } } },
    ]),
    // Channels: synced invoices (paymentMode field)
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null } } },
      { $group: { _id: '$paymentMode', amount: { $sum: '$totalAmount' } } },
    ]),
    // Top dealers: native
    RetailOrder.aggregate([
      { $group: { _id: '$dealerId', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
      { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
    ]),
    // Top dealers: synced invoices
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null } } },
      { $group: { _id: '$dealerId', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
      { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
    ]),
    // Customers: native
    RetailOrder.aggregate([
      { $group: { _id: '$customerPhone', orderCount: { $sum: 1 } } },
    ]),
    // Customers: synced invoices (phone embedded in notes: "Name | Phone")
    Invoice.aggregate([
      { $match: { invoiceType: 'retail', dbeInvoiceId: { $ne: null } } },
      {
        $addFields: {
          _phone: {
            $trim: { input: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ['$notes', ' | '] }, 1] }, ' '] }, 0] } },
          },
        },
      },
      { $group: { _id: '$_phone', orderCount: { $sum: 1 } } },
    ]),
  ]);

  // ── Merge KPIs ──
  const totalRevenue = (nativeKpi[0]?.revenue || 0) + (invoiceKpi[0]?.revenue || 0);
  const totalOrders  = (nativeKpi[0]?.orders  || 0) + (invoiceKpi[0]?.orders  || 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // ── Delivery rate ──
  const nativeDel = nativeDelivery[0] || {};
  const syncedDelTotal = invoiceDelivery[0]?.total || 0;
  const allTotal     = (nativeDel.total || 0) + syncedDelTotal;
  const allDelivered = (nativeDel.delivered || 0) + syncedDelTotal; // synced are always delivered
  const deliveryRate = allTotal > 0
    ? parseFloat(((allDelivered / allTotal) * 100).toFixed(1))
    : 0;

  // ── Merge trend (sum by year-month key) ──
  const trendMap = {};
  const addToTrend = (rows) => rows.forEach((r) => {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
    trendMap[key] = (trendMap[key] || 0) + r.retail;
  });
  addToTrend(nativeTrend);
  addToTrend(invoiceTrend);
  const trend = Object.entries(trendMap)
    .map(([date, retail]) => ({ date, retail }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Merge channels ──
  const CHANNEL_LABELS = {
    cash: 'Walk-in Store', card: 'Online Store', upi: 'Online Store',
    credit: 'Market Place', 'bank-transfer': 'Net Banking',
  };
  const channelMap = {};
  [...nativeChannels, ...invoiceChannels].forEach(({ _id, amount }) => {
    const label = CHANNEL_LABELS[(_id || '').toLowerCase()] || (_id || 'Other');
    channelMap[label] = (channelMap[label] || 0) + amount;
  });
  const channels = Object.entries(channelMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ── Merge top dealers ──
  const dealerMap = {};
  [...nativeTopDealers, ...invoiceTopDealers].forEach((d) => {
    const key = String(d._id);
    if (!dealerMap[key]) {
      dealerMap[key] = { dealer: d.dealer, revenue: 0, orders: 0 };
    }
    dealerMap[key].revenue += d.revenue;
    dealerMap[key].orders  += d.orders;
  });
  const STATUS_MAP = { active: 'Active', pending: 'Pending', suspended: 'Review', rejected: 'Review' };
  const topDealers = Object.values(dealerMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((d, i) => ({
      rank:    String(i + 1).padStart(2, '0'),
      name:    d.dealer?.businessName || 'Unknown',
      orders:  d.orders,
      revenue: d.revenue,
      status:  STATUS_MAP[d.dealer?.status] || 'Active',
    }));

  // ── Merge customer insights ──
  const customerMap = {};
  [...nativeCustomers, ...invoiceCustomers].forEach(({ _id, orderCount }) => {
    if (_id) customerMap[_id] = (customerMap[_id] || 0) + orderCount;
  });
  const allCustomers = Object.entries(customerMap);
  const totalCustomers  = allCustomers.length;
  const repeatBuyers    = allCustomers.filter(([, c]) => c > 1).length;
  const repeatBuyerPct  = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;

  return {
    kpis: { monthRevenue: totalRevenue, monthOrders: totalOrders, avgOrderValue, deliveryRate },
    trend,
    channels,
    topDealers,
    customerInsights: { totalCustomers, repeatBuyerPct, newBuyerPct: 100 - repeatBuyerPct },
  };
};

module.exports = { createRetailOrder, getRetailOrders, getRetailOrderById, updateRetailOrderStatus, getRetailAnalytics };