const Return = require('./model/Return.model');
const Order = require('../orders/model/Order.model');
const OrderItem = require('../orders/model/OrderItem.model');
const Dealer = require('../dealer/model/Dealer.model');
const Payment = require('../payments/model/Payment.model');
const Transaction = require('../finance/model/Transaction.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { withTransaction } = require('../../utils/transaction');
const inventoryService = require('../inventory/inventory.service');
const auditService = require('../audit/audit.service');
const { differenceInDays } = require('date-fns');
const { emitToAll } = require('../../websocket/socket');
const { RETURN_PROCESSED } = require('../../websocket/events');

const RETURN_WINDOW_DAYS = 30;

const createReturn = async (data, userId) => {
  const order = await Order.findById(data.orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === 'cancelled') throw new AppError('Cannot return items from a cancelled order', 400);

  // 30-day validation
  const daysSinceOrder = differenceInDays(new Date(), order.createdAt);
  if (daysSinceOrder > RETURN_WINDOW_DAYS) {
    throw new AppError(`Return window of ${RETURN_WINDOW_DAYS} days has expired`, 400);
  }

  // Validate return items are part of the order
  const orderItems = await OrderItem.find({ orderId: data.orderId }).lean();
  const orderItemMap = Object.fromEntries(orderItems.map((i) => [i._id.toString(), i]));

  for (const item of data.items) {
    if (item.orderItemId && !orderItemMap[item.orderItemId]) {
      throw new AppError(`Order item ${item.orderItemId} not found in this order`, 400);
    }
  }

  const ret = await Return.create({
    ...data,
    dealerId: order.dealerId,
  });

  await auditService.log('return', ret._id, 'create', userId, {
    after: { rmaNumber: ret.rmaNumber, orderId: data.orderId },
  });
  return ret;
};

const processReturn = async (returnId, { refundAmount, refundMethod }, userId) => {
  return withTransaction(async (session) => {
    const ret = await Return.findById(returnId).session(session);
    if (!ret) throw new AppError('Return not found', 404);
    if (ret.status === 'refunded') throw new AppError('Return has already been processed', 400);
    if (ret.status === 'rejected') throw new AppError('Rejected returns cannot be processed', 400);

    // Validate refund ≤ order total
    const order = await Order.findById(ret.orderId).session(session);
    if (!order) throw new AppError('Original order not found', 404);
    if (refundAmount > order.netAmount) {
      throw new AppError(`Refund amount (₹${refundAmount}) cannot exceed order total (₹${order.netAmount})`, 400);
    }

    // Restore inventory for sellable items
    for (const item of ret.items) {
      if (item.condition === 'sellable' && item.productId && item.warehouseId) {
        await inventoryService.adjustStock(
          item.productId, item.warehouseId, item.quantity, 'add', userId, session
        );
        // Release the original allocation as well
        await inventoryService.releaseAllocation(item.productId, item.warehouseId, item.quantity, session);
      }
    }

    // Reduce dealer creditUsed
    const dealer = await Dealer.findById(ret.dealerId).session(session);
    if (dealer) {
      dealer.creditUsed = Math.max(0, dealer.creditUsed - refundAmount);
      await dealer.save({ session });
    }

    // Transaction record
    await Transaction.create([{
      type: 'debit',
      dealerId: ret.dealerId,
      amount: refundAmount,
      ref: { refType: 'return', refId: ret._id },
      description: `Refund for RMA ${ret.rmaNumber}`,
      createdBy: userId,
    }], { session });

    // Update return record
    ret.status = 'refunded';
    ret.refundAmount = refundAmount;
    ret.refundMethod = refundMethod;
    ret.refundStatus = 'processed';
    ret.processedBy = userId;
    ret.inventoryAdjusted = true;
    await ret.save({ session });

    await auditService.log('return', returnId, 'refund', userId, {
      after: { status: 'refunded', refundAmount },
    });

    emitToAll(RETURN_PROCESSED, { returnId, rmaNumber: ret.rmaNumber, refundAmount });
    return ret;
  });
};

const updateReturnStatus = async (returnId, status, reason, userId) => {
  const ret = await Return.findById(returnId);
  if (!ret) throw new AppError('Return not found', 404);

  const before = { status: ret.status };
  ret.status = status;
  if (reason) ret.rejectionReason = reason;
  await ret.save();

  await auditService.log('return', returnId, 'update', userId, { before, after: { status, reason } });
  return ret;
};

const getReturns = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.status) match.status = query.status;
  if (query.orderId) match.orderId = query.orderId;

  const [data, total] = await Promise.all([
    Return.find(match)
      .populate('dealerId', 'name')
      .populate('orderId', 'orderNumber')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Return.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getReturnById = async (id) => {
  const ret = await Return.findById(id)
    .populate('dealerId', 'name')
    .populate('orderId', 'orderNumber netAmount')
    .populate('processedBy', 'name email')
    .lean();
  if (!ret) throw new AppError('Return not found', 404);
  return ret;
};

module.exports = { createReturn, processReturn, updateReturnStatus, getReturns, getReturnById };
