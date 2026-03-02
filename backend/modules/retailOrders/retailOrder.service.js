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

module.exports = { createRetailOrder, getRetailOrders, getRetailOrderById, updateRetailOrderStatus };
