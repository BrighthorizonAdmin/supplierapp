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
const axios = require('axios');
const mongoose = require('mongoose');

// ── DealerInventory — shared DB, so we access it directly ─────────────────────
// Both S-BE and D-BE use the same MongoDB (dealer_app), so we can write
// to dealerinventories without any HTTP roundtrip.
const dealerInventorySchema = new mongoose.Schema({
  dealerId: { type: mongoose.Schema.Types.ObjectId },
  productId: { type: mongoose.Schema.Types.ObjectId },
  productName: String,
  sku: String,
  imageUrl: String,
  purchasePrice: { type: Number, default: 0 },
  receivedQty: { type: Number, default: 0 },
  currentQty: { type: Number, default: 0 },
  soldQty: { type: Number, default: 0 },
  threshold: { type: Number, default: 2 },
}, { strict: false, timestamps: true });

// Re-use existing model if already registered (hot-reload safety)
const DealerInventory = mongoose.models.DealerInventory
  || mongoose.model('DealerInventory', dealerInventorySchema, 'dealerinventories');

// ─────────────────────────────────────────────────────────────────────────────
// Notify the dealer backend of an order status change (fire-and-forget)
// Uses dbeOrderId (dealer's MongoDB _id) as the primary lookup key,
// falls back to dealerOrderNumber if dbeOrderId not stored yet.
// ─────────────────────────────────────────────────────────────────────────────
async function notifyDealerOrderStatus(order, status, extraFields = {}) {
  const DEALER_API_URL = process.env.DEALER_API_URL;
  const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;
  if (!DEALER_API_URL || !WEBHOOK_SECRET) {
    console.warn('[notifyDealer] DEALER_API_URL or DEALER_WEBHOOK_SECRET not set — skipping');
    return;
  }

  // Must have either dbeOrderId or dealerOrderNumber to identify the order on dealer side
  const dbeOrderId = order.dbeOrderId;
  const dealerOrderNumber = order.dealerOrderNumber;
  if (!dbeOrderId && !dealerOrderNumber) {
    console.warn(`[notifyDealer] Order ${order.orderNumber} has no dbeOrderId or dealerOrderNumber — cannot notify dealer`);
    return;
  }

  try {
    const payload = {
      ...(dbeOrderId ? { dbeOrderId } : {}),
      ...(dealerOrderNumber ? { orderNumber: dealerOrderNumber } : {}),
      status,
      ...extraFields,
    };
    await axios.post(
      `${DEALER_API_URL}/api/orders/webhook/status-update`,
      payload,
      {
        headers: { 'x-webhook-secret': WEBHOOK_SECRET, 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
    console.log(`[notifyDealer] Order ${order.orderNumber} (dbe: ${dbeOrderId}) → status: ${status} ✓`);
  } catch (err) {
    console.error(`[notifyDealer] Failed for order ${order.orderNumber}:`, err.response?.data || err.message);
  }
}

async function pushStockStatusAfterConfirm(orderItems, orderNumber, dealerId) {
  try {
    const notificationService = require('../notifications/notification.service');
    const User = require('../auth/model/User.model');
    const DEALER_API_URL = process.env.DEALER_API_URL;
    const DEALER_WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;

    const alertItems = [];

    for (const item of orderItems) {
      const pid = item.productId?._id || item.productId;
      if (!pid) continue;

      const product = await Product.findById(pid)
        .select('name productCode currentStockQty openingStockQty')
        .lean();

      if (!product) continue;

      const isOutOfStock = product.currentStockQty <= 0;
      const lowStockThreshold =
        product.openingStockQty > 0 ? product.openingStockQty * 0.2 : product.currentStockQty;

      const isLowStock =
        !isOutOfStock && product.currentStockQty < lowStockThreshold;

      if (!isOutOfStock && !isLowStock) continue;

      alertItems.push({
        productId: pid.toString(),
        productName: product.name,
        productCode: product.productCode || '',
        alertType: isOutOfStock ? 'out-of-stock' : 'low-stock',
        quantityAvailable: product.currentStockQty,
      });
    }

    if (!alertItems.length) return;

    const outCount = alertItems.filter(i => i.alertType === 'out-of-stock').length;
    const lowCount = alertItems.filter(i => i.alertType === 'low-stock').length;
    const parts = [];
    if (outCount) parts.push(`${outCount} out-of-stock`);
    if (lowCount) parts.push(`${lowCount} low-stock`);
    const names = alertItems.map(i => i.productName).join(', ');

    // 1. Notify supplier admins — omit relatedEntity to avoid ObjectId cast errors
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title: `Stock Alert after Order #${orderNumber}`,
        message: `${parts.join(' and ')} product(s) need attention: ${names}`,
        type: 'warning',
      });
    }

    await Promise.all(
      admins.map((admin) =>
        notificationService.create({
          recipientId: admin._id,
          title: `Stock Alert after Order #${orderNumber}`,
          message: `${alertItems.length} product(s) need attention`,
          type: 'warning',
        })
      )
    );

    // ✅ Send to dealer (single API call)
    if (DEALER_API_URL && DEALER_WEBHOOK_SECRET) {
      axios
        .post(
          `${DEALER_API_URL}/api/notifications/supplier/stock-alert`,
          {
            dealerId,
            orderNumber,
            items: alertItems,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': DEALER_WEBHOOK_SECRET,
            },
            timeout: 5000,
          }
        )
        console.log(`[StockAlert] Order ${orderNumber}: ${alertItems.length} alert(s) sent to dealer backend`)
        .catch((err) =>
          console.error('[StockAlert] dealer push failed:', err.message)
        );
    }
  } catch (err) {
    console.error('[pushStockStatusAfterConfirm] error:', err.message);
  }
}

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
  const order = await withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError('Order not found', 404);
    if (!['draft', 'pending'].includes(order.status)) throw new AppError(`Order is already ${order.status}`, 400);

    const dealer = await Dealer.findById(order.dealerId).session(session);
    if (!dealer) throw new AppError('Dealer not found', 404);
    if (dealer.status !== 'active') throw new AppError('Dealer account is not active', 400);

    // D-BE webhook orders (dbeOrderId set) already have creditUsed managed by the dealer app:
    //   - net-30: D-BE incremented creditUsed when the dealer placed the order
    //   - card/UPI/bank: payment was already collected; creditUsed is not involved
    // So only run credit checks/updates for supplier-created orders (no dbeOrderId).
    const isSupplierCreatedOrder = !order.dbeOrderId;

    // Credit limit check — only for supplier-created orders
    if (isSupplierCreatedOrder && dealer.creditUsed + order.netAmount > dealer.creditLimit) {
      throw new AppError(
        `Order amount (₹${order.netAmount}) exceeds available credit (₹${dealer.availableCredit})`,
        400
      );
    }

    const items = await OrderItem.find({ orderId }).session(session);

    // Allocate stock per item and decrement product-level currentStockQty
    for (const item of items) {
      await inventoryService.allocateStock(item.productId, item.warehouseId, item.quantity, session);
      await Product.findByIdAndUpdate(
        item.productId,
        [{ $set: { currentStockQty: { $max: [0, { $add: ['$currentStockQty', -item.quantity] }] } } }],
        { session }
      );
    }

    // D-BE webhook orders embed items in order.items — OrderItem collection is empty for them.
    // Fall back to embedded items so the invoice always has line items with product names.
    const invoiceLineItems = items.length > 0
      ? items.map((i) => ({
          productId:   i.productId,
          productName: i.productName,
          productCode: i.productCode,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          taxRate:     i.taxRate,
          taxAmount:   i.taxAmount,
          lineTotal:   i.lineTotal,
        }))
      : (order.items || []).map((i) => ({
          productId:   i.productId,
          productName: i.productName || i.name || '',
          productCode: i.productCode || i.sku  || '',
          quantity:    Number(i.quantity)  || 0,
          unitPrice:   Number(i.unitPrice  || i.basePrice) || 0,
          taxRate:     Number(i.taxRate)   || 0,
          taxAmount:   Number(i.taxAmount) || 0,
          lineTotal:   Number(i.lineTotal) || 0,
        }));

    // Orders paid upfront (card / UPI / bank transfer) arrive with paymentStatus:'completed'.
    // Mark the invoice as paid immediately; net-30 and supplier-created orders stay as 'issued'.
    const isAlreadyPaid = order.paymentStatus === 'completed';

    // Create Invoice
    const invoice = await Invoice.create(
      [{
        orderId:      order._id,
        dealerId:     order.dealerId,
        lineItems:    invoiceLineItems,
        subtotal:     order.subtotal,
        taxAmount:    order.taxAmount,
        totalAmount:  order.netAmount,
        amountPaid:   isAlreadyPaid ? order.netAmount : 0,
        status:       isAlreadyPaid ? 'paid' : 'issued',
        paymentMode:  order.paymentMethod || undefined,
        issuedAt:     new Date(),
        dueDate:      addDays(new Date(), 30),
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

    // Update dealer creditUsed — only for supplier-created orders.
    // D-BE webhook orders already had creditUsed incremented by the dealer app at order placement.
    if (isSupplierCreatedOrder) {
      await Dealer.findByIdAndUpdate(
        order.dealerId,
        { $inc: { creditUsed: order.netAmount } },
        { session }
      );
    }

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
      before: { status: order.status },
      after: { status: 'confirmed', invoiceId: invoice[0]._id },
    });

    emitToAll(ORDER_CONFIRMED, { orderId, orderNumber: order.orderNumber, dealerId: order.dealerId });

    // Notify D-BE so the dealer's order status updates to 'confirmed'
    notifyDealerOrderStatus(order, 'confirmed');

    return order;
  });

  // After transaction commits, check stock and notify both sides (non-blocking).
  // Supplier-created orders use the separate OrderItem collection.
  // Dealer webhook orders embed items in order.items — use that as fallback.
  const confirmedItems = order.items?.length
    ? order.items
    : await OrderItem.find({ orderId }).lean();
  pushStockStatusAfterConfirm(confirmedItems, order.orderNumber,order.dealerId);

  return order;
};

const cancelOrder = async (orderId, reason, userId) => {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError('Order not found', 404);
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new AppError(`Cannot cancel an order with status: ${order.status}`, 400);
    }

    const wasConfirmed = order.status === 'confirmed';
    // D-BE webhook orders never had creditUsed incremented by S-BE (D-BE manages it).
    // Only reverse creditUsed for supplier-created orders.
    const isSupplierCreatedOrder = !order.dbeOrderId;
    const items = await OrderItem.find({ orderId }).session(session);

    if (wasConfirmed) {
      // Release inventory allocations and restore product-level currentStockQty
      for (const item of items) {
        await inventoryService.releaseAllocation(item.productId, item.warehouseId, item.quantity, session);
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { currentStockQty: item.quantity } },
          { session }
        );
      }

      // Reverse creditUsed — only for supplier-created orders
      if (isSupplierCreatedOrder) {
        const dealer = await Dealer.findById(order.dealerId).session(session).lean();
        if (dealer) {
          const decrement = Math.min(dealer.creditUsed, order.netAmount);
          await Dealer.findByIdAndUpdate(
            order.dealerId,
            { $inc: { creditUsed: -decrement } },
            { session }
          );
        }
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

    const newStatus = order.status === 'pending' ? 'rejected' : 'cancelled';
    const beforeStatus = order.status; 
    order.status = newStatus;
    order.cancelledBy = userId;
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    await order.save({ session });

    await auditService.log('order', orderId, 'cancel', userId, {
      before: { status: wasConfirmed ? 'confirmed' : beforeStatus },
      after: { status: newStatus, reason },
    });

    emitToAll(ORDER_CANCELLED, { orderId, orderNumber: order.orderNumber });

    // Notify D-BE so the dealer's order status updates to 'cancelled'
    notifyDealerOrderStatus(order, newStatus);

    return order;
  });
};

const getOrderStats = async () => {
  const results = await Order.aggregate([
    // Exclude D-BE-native orders that share the same collection
    { $match: { orderNumber: { $not: { $regex: /^ORD-\d{13}-\d+$/ } } } },
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

  // Both D-BE and S-BE share the same MongoDB `orders` collection.
  // D-BE orders have orderNumber like ORD-{13-digit-timestamp}-{4-digits}.
  // S-BE orders (webhook + manual) have orderNumber like ORD-{8-digit-date}-{seq}.
  // Exclude D-BE-native documents so they never appear in the supplier order list.
  const match = {
    orderNumber: { $not: /^ORD-\d{13}-\d+$/ },
  };

  if (query.status) match.status = query.status;
  if (query.orderType) match.orderType = query.orderType;
  if (query.dealerId) match.dealerId = query.dealerId;

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
      { orderNumber: re },
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

  // DealerApp orders embed items directly; SupplierApp orders use separate OrderItem collection
  const items = order.items?.length
    ? order.items
    : await OrderItem.find({ orderId: id })
      .populate('productId', 'name productCode unit')
      .populate('warehouseId', 'name code')
      .lean();

  return { ...order, items };
};

const updateOrderStatus = async (orderId, status, userId, extraFields = {}) => {
  const allowed = {
    confirmed: ['pending', 'draft'],
    processing: ['confirmed'],
    shipped: ['processing', 'confirmed'],
    out_for_delivery: ['shipped', 'processing'],
    delivered: ['shipped', 'out_for_delivery', 'processing'],
  };
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
  if (extraFields.trackingId) order.trackingId = extraFields.trackingId;
  if (extraFields.carrier) order.carrier = extraFields.carrier;
  await order.save();

  await auditService.log('order', orderId, 'update', userId, { before, after: { status } });

  // ── On delivered: write directly to DealerInventory (shared DB — no HTTP needed) ──
  if (status === 'delivered') {
    try {
      // Resolve embedded items or separate OrderItems
      const items = order.items?.length
        ? order.items
        : await OrderItem.find({ orderId: order._id }).lean();

      for (const item of items) {
        const pid = item.productId;
        if (!pid) continue;

        const product = await Product.findById(pid).lean();
        const purchasePrice = item.basePrice || item.unitPrice || product?.basePrice || product?.price || 0;
        const imageUrl = item.image || product?.images?.find(i => i.isPrimary)?.url || product?.images?.[0]?.url || '';
        const qty = Number(item.quantity) || 0;
        const threshold = Math.max(2, Math.ceil(qty * 0.2));

        await DealerInventory.findOneAndUpdate(
          { dealerId: order.dealerId, productId: pid },
          {
            // $inc: { receivedQty: qty, currentQty: qty },
            $setOnInsert: {
              productName: item.name || item.productName || product?.name || '',
              sku: item.sku || item.productCode || product?.sku || '',
              imageUrl,
              purchasePrice,
              soldQty: 0,
              threshold,
            },
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[updateOrderStatus] Inventory credited for order ${order.orderNumber} (${items.length} item(s))`);
    } catch (invErr) {
      // Never block the status update if inventory write fails — log and continue
      console.error(`[updateOrderStatus] Inventory write failed for order ${order.orderNumber}:`, invErr.message);
    }
  }

  // Keep the HTTP notify as a best-effort fallback (updates timeline/notifications on dealer side)
  notifyDealerOrderStatus(order, status, extraFields);

  // After confirming a webhook/dealer order, check stock levels and notify both sides
  if (status === 'confirmed') {
    const items = order.items?.length
      ? order.items
      : await OrderItem.find({ orderId: order._id }).lean();
    pushStockStatusAfterConfirm(items, order.orderNumber);
  }

  return order;
};

module.exports = { createOrder, confirmOrder, cancelOrder, getOrders, getOrderStats, getOrderById, updateOrderStatus };