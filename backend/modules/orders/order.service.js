const Order = require('./model/Order.model');
const OrderItem = require('./model/OrderItem.model');
const Invoice = require('../payments/model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const Product = require('../products/model/Product.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { withTransaction } = require('../../utils/transaction');
const inventoryService = require('../inventory/inventory.service');
const auditService = require('../audit/audit.service');
const Transaction = require('../finance/model/Transaction.model');
const { emitToAll } = require('../../websocket/socket');
const { ORDER_CONFIRMED, ORDER_CANCELLED } = require('../../websocket/events');
const { addDays } = require('date-fns');

const createOrder = async ({ dealerId, items, notes, orderType }, userId) => {
  const dealer = await Dealer.findById(dealerId).lean({ virtuals: true });
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (dealer.status !== 'active') throw new AppError('Dealer account is not active', 400);

  // Validate products and calculate totals
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let subtotal = 0;
  const enrichedItems = items.map((item) => {
    const product = productMap[item.productId];
    if (!product) throw new AppError(`Product ${item.productId} not found or inactive`, 400);

    const unitPrice = item.unitPrice ?? (product.pricingTiers?.[dealer.pricingTier] ?? product.basePrice);
    const discount = item.discount || 0;
    const taxRate = item.taxRate ?? product.taxRate ?? 18;
    const priceAfterDiscount = unitPrice * (1 - discount / 100);
    const taxAmount = priceAfterDiscount * item.quantity * (taxRate / 100);
    const lineTotal = priceAfterDiscount * item.quantity + taxAmount;

    subtotal += lineTotal;

    return {
      productId: item.productId,
      warehouseId: item.warehouseId,
      productName: product.name,
      productCode: product.productCode,
      quantity: item.quantity,
      unitPrice,
      discount,
      taxRate,
      taxAmount,
      lineTotal,
    };
  });

  const order = await Order.create({
    dealerId,
    orderType: orderType || 'b2b',
    pricingTier: dealer.pricingTier,
    subtotal,
    netAmount: subtotal,
    notes,
    status: 'draft',
  });

  const orderItems = enrichedItems.map((i) => ({ ...i, orderId: order._id }));
  await OrderItem.insertMany(orderItems);

  await auditService.log('order', order._id, 'create', userId, { after: { orderNumber: order.orderNumber, dealerId } });
  return order;
};

const confirmOrder = async (orderId, userId) => {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'draft') throw new AppError(`Order is already ${order.status}`, 400);

    const dealer = await Dealer.findById(order.dealerId).session(session);
    if (!dealer) throw new AppError('Dealer not found', 404);
    if (dealer.status !== 'active') throw new AppError('Dealer account is not active', 400);

    // Credit limit check
    if (dealer.creditUsed + order.netAmount > dealer.creditLimit) {
      throw new AppError(
        `Order amount (₹${order.netAmount}) exceeds available credit (₹${dealer.availableCredit})`,
        400
      );
    }

    const items = await OrderItem.find({ orderId }).session(session);

    // Allocate stock per item
    for (const item of items) {
      await inventoryService.allocateStock(item.productId, item.warehouseId, item.quantity, session);
    }

    // Create Invoice
    const invoice = await Invoice.create(
      [{
        orderId: order._id,
        dealerId: order.dealerId,
        lineItems: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          productCode: i.productCode,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          taxAmount: i.taxAmount,
          lineTotal: i.lineTotal,
        })),
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        totalAmount: order.netAmount,
        status: 'issued',
        issuedAt: new Date(),
        dueDate: addDays(new Date(), 30),
      }],
      { session }
    );

    // Update order
    order.status = 'confirmed';
    order.confirmedBy = userId;
    order.confirmedAt = new Date();
    order.invoiceId = invoice[0]._id;
    order.creditUsed = order.netAmount;
    await order.save({ session });

    // Update dealer creditUsed
    dealer.creditUsed += order.netAmount;
    await dealer.save({ session });

    // Create transaction record
    await Transaction.create([{
      type: 'debit',
      dealerId: order.dealerId,
      amount: order.netAmount,
      ref: { refType: 'order', refId: order._id },
      description: `Order ${order.orderNumber} confirmed`,
      createdBy: userId,
    }], { session });

    await auditService.log('order', orderId, 'confirm', userId, {
      before: { status: 'draft' },
      after: { status: 'confirmed', invoiceId: invoice[0]._id },
    });

    emitToAll(ORDER_CONFIRMED, { orderId, orderNumber: order.orderNumber, dealerId: order.dealerId });
    return order;
  });
};

const cancelOrder = async (orderId, reason, userId) => {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError('Order not found', 404);
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new AppError(`Cannot cancel an order with status: ${order.status}`, 400);
    }

    const wasConfirmed = order.status === 'confirmed';
    const items = await OrderItem.find({ orderId }).session(session);

    if (wasConfirmed) {
      // Release inventory allocations
      for (const item of items) {
        await inventoryService.releaseAllocation(item.productId, item.warehouseId, item.quantity, session);
      }

      // Reverse creditUsed
      const dealer = await Dealer.findById(order.dealerId).session(session);
      if (dealer) {
        dealer.creditUsed = Math.max(0, dealer.creditUsed - order.netAmount);
        await dealer.save({ session });
      }

      // Cancel invoice
      if (order.invoiceId) {
        await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' }, { session });
      }

      // Reverse transaction
      await Transaction.create([{
        type: 'credit',
        dealerId: order.dealerId,
        amount: order.netAmount,
        ref: { refType: 'order', refId: order._id },
        description: `Order ${order.orderNumber} cancelled`,
        createdBy: userId,
      }], { session });
    }

    order.status = 'cancelled';
    order.cancelledBy = userId;
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    await order.save({ session });

    await auditService.log('order', orderId, 'cancel', userId, {
      before: { status: wasConfirmed ? 'confirmed' : order.status },
      after: { status: 'cancelled', reason },
    });

    emitToAll(ORDER_CANCELLED, { orderId, orderNumber: order.orderNumber });
    return order;
  });
};

const getOrderStats = async () => {
  const results = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = { draft: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, total: 0 };
  for (const { _id, count } of results) {
    if (_id in counts) counts[_id] = count;
    counts.total += count;
  }
  return counts;
};

const getOrders = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.status) match.status = query.status;
  if (query.orderType) match.orderType = query.orderType;

  // Date filter
  if (query.startDate || query.endDate) {
    match.createdAt = {};
    if (query.startDate) match.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) match.createdAt.$lte = new Date(query.endDate);
  }

  // Search functionality
  if (query.search) {
    const re = new RegExp(query.search, "i");

    const Dealer = require("../dealer/model/Dealer.model");

    const dealers = await Dealer.find({
      $or: [
        { businessName: re },
        { dealerCode: re },
        { phone: re }
      ]
    })
      .select("_id")
      .lean();

    const dealerIds = dealers.map(d => d._id);

    match.$or = [
      { orderId: re },
      // { invoiceId: re },
      ...(dealerIds.length ? [{ dealerId: { $in: dealerIds } }] : [])
    ];
  }

  const [data, total] = await Promise.all([
    Order.find(match)
      .populate("dealerId") // full dealer info
      .populate("confirmedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getOrderById = async (id) => {
  const order = await Order.findById(id)
    .populate('dealerId')
    .populate('confirmedBy', 'name email')
    // .populate('invoiceId')
    .lean();
  if (!order) throw new AppError('Order not found', 404);

  const items = await OrderItem.find({ orderId: id })
    .populate('productId', 'name productCode unit')
    .populate('warehouseId', 'name code')
    .lean();

  return { ...order, items };
};

const updateOrderStatus = async (orderId, status, userId) => {
  const allowed = { processing: ['confirmed'], shipped: ['processing'], delivered: ['shipped'] };
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const validFrom = allowed[status];
  if (!validFrom || !validFrom.includes(order.status)) {
    throw new AppError(`Cannot move order from ${order.status} to ${status}`, 400);
  }

  const before = { status: order.status };
  order.status = status;
  if (status === 'shipped') order.shippedAt = new Date();
  if (status === 'delivered') order.deliveredAt = new Date();
  await order.save();

  await auditService.log('order', orderId, 'update', userId, { before, after: { status } });
  return order;
};

module.exports = { createOrder, confirmOrder, cancelOrder, getOrders, getOrderStats, getOrderById, updateOrderStatus };
