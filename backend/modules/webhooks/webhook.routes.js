const express = require('express');
const router = express.Router();
const Invoice = require('../payments/model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const notificationService = require('../notifications/notification.service');

const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET || '';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-retail-invoice
// Called by D-BE whenever a dealer logs a retail sale
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-retail-invoice', async (req, res) => {
  try {
    // 1. Verify shared secret
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      dbeInvoiceId,
      invoiceNumber,
      invoiceDate,
      dealerRef,
      dealerName,
      dealerPhone,
      customerName,
      customerPhone,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      receivedAmount,
      paymentMode,
    } = req.body;

    // 2. Prevent duplicate — idempotent based on dbeInvoiceId OR invoiceNumber
    const existing = await Invoice.findOne({
      $or: [
        { dbeInvoiceId },
        { invoiceNumber: `D-${invoiceNumber}` },
      ],
    });
    if (existing) {
      console.warn(`[Webhook] Already synced, returning existing: D-${invoiceNumber}`);
      return res.json({ success: true, message: 'Already synced', data: existing });
    }

    // 3. Try to find the dealer in Sup-BE by phone or name
    let dealer = null;
    if (dealerPhone) {
      dealer = await Dealer.findOne({ phone: dealerPhone }).lean();
    }
    if (!dealer && dealerName) {
      dealer = await Dealer.findOne({
        businessName: { $regex: dealerName.trim(), $options: 'i' },
      }).lean();
    }

    // 4. Map items to Sup-BE lineItems schema
    // Use exact same calculation as D-BE: lineTotal = unitPrice * qty + (unitPrice * qty * taxRate/100)
    const lineItems = (items || []).map((item) => {
      const qty       = Number(item.quantity);
      const price     = Number(item.unitPrice);
      const taxR      = Number(item.taxRate) || 0;
      const lineBase  = price * qty;
      const lineTax   = lineBase * (taxR / 100);
      return {
        productId:    item.productId || undefined,
        productName:  item.productName || item.name || '',
        productCode:  item.productCode || item.sku || '',
        hsnCode:      item.hsnCode || '',
        quantity:     qty,
        unitPrice:    price,
        taxRate:      taxR,
        taxAmount:    +lineTax.toFixed(2),
        lineTotal:    +Number(item.lineTotal || (lineBase + lineTax)).toFixed(2),
        discount:     0,
        discountType: '%',
        discountValue: 0,
      };
    });

    // 5. Derive correct payment status and balance — same logic as D-BE
    const total    = Number(totalAmount) || 0;
    const received = receivedAmount !== undefined ? Number(receivedAmount) : total;
    const balance  = Math.max(0, +(total - received).toFixed(2));
    const invoiceStatus = received >= total ? 'paid' : (received > 0 ? 'partial' : 'issued');

    // 6. Create invoice — catch E11000 in case of race condition / D-BE retry after timeout
    let invoice;
    try {
      invoice = await Invoice.create({
        invoiceType:  'retail',
        dbeInvoiceId,
        invoiceNumber: `D-${invoiceNumber}`,
        dealerId:     dealer?._id || undefined,
        partyName:    dealerName || 'Unknown Dealer',
        partyPhone:   dealerPhone || '',
        notes:        `Retail sale to: ${customerName}${customerPhone ? ' | ' + customerPhone : ''}`,
        lineItems,
        subtotal:     Number(subtotal),
        taxAmount:    Number(taxAmount),
        totalAmount:  total,
        discountAmt:  0,
        amountPaid:   received,
        balance,
        paymentMode:  paymentMode || 'Cash',
        invoiceDate:  invoiceDate ? new Date(invoiceDate) : new Date(),
        status:       invoiceStatus,
        issuedAt:     new Date(),
      });
    } catch (createErr) {
      // Duplicate key — D-BE retried after a timeout but invoice was already saved
      if (createErr.code === 11000) {
        const saved = await Invoice.findOne({
          $or: [
            { dbeInvoiceId },
            { invoiceNumber: `D-${invoiceNumber}` },
          ],
        });
        console.warn(`[Webhook] Duplicate on create, returning existing: D-${invoiceNumber}`);
        return res.status(200).json({ success: true, message: 'Already synced', data: saved });
      }
      throw createErr;
    }

    console.log(`[Webhook] Retail invoice synced: ${invoice.invoiceNumber} for dealer: ${dealerName}`);

    // Notify all active supplier admins about the new retail sale invoice
    try {
      const User = require('../auth/model/User.model');
      const admins = await User.find({ isActive: true }).lean();
      const itemCount = Array.isArray(items) ? items.length : 0;
      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title:       `Retail Sale Invoice: ${invoice.invoiceNumber}`,
          message:     `${dealerName || 'A dealer'} generated a retail sale of ₹${totalAmount} (${itemCount} item${itemCount !== 1 ? 's' : ''}) to ${customerName}`,
          type:        'payment',
          relatedEntity: { entityType: 'Invoice', entityId: invoice._id },
        });
      }
    } catch (notifErr) {
      console.error('[Webhook] retail-invoice notification failed:', notifErr.message);
    }

    return res.status(201).json({ success: true, data: invoice });

  } catch (err) {
    console.error('[Webhook] dealer-retail-invoice error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-order
// Called by D-BE whenever a dealer places a new order.
// Creates (or idempotently updates) a supplier-side Order record that carries
// dbeOrderId + dealerOrderNumber — this is the critical link that lets
// updateOrderStatus → notifyDealerOrderStatus reach back to the dealer.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-order', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized order webhook attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      dbeOrderId, orderNumber, dealerId: dealerRef,
      dealerName, dealerPhone,
      items, subtotal, taxAmount, netAmount, paymentMethod, paymentStatus,
    } = req.body;

    const Order = require('../orders/model/Order.model');
    const { generateCode } = require('../../utils/autoCode');

    // ── 1. Resolve the supplier-side Dealer record ──
    const Dealer = require('../dealer/model/Dealer.model');
    let supplierDealer = null;
    if (dealerPhone) supplierDealer = await Dealer.findOne({ phone: dealerPhone }).lean();
    if (!supplierDealer && dealerName) {
      supplierDealer = await Dealer.findOne({
        businessName: { $regex: dealerName.trim(), $options: 'i' },
      }).lean();
    }

    // ── 1b. Skip if dealer could not be resolved ──
    if (!supplierDealer) {
      console.warn(`[Webhook] dealer-order: could not resolve dealer (phone=${dealerPhone}, name=${dealerName}) — order not created in supplier DB`);
    } else {
      // ── 2. Build embedded items from the dealer payload ──
      const embeddedItems = (items || []).map(item => ({
        productId: item.productId || undefined,
        sku: item.sku || item.productCode || '',
        name: item.name || item.productName || '',
        image: item.image || '',
        unitPrice: Number(item.basePrice || item.unitPrice || 0),
        quantity: Number(item.quantity || 0),
        moq: Number(item.moq || 1),
        lineTotal: Number(item.lineTotal || 0),
      }));

      // ── 3. Atomic upsert — findOneAndUpdate with upsert:true on dbeOrderId ──
      // findOneAndUpdate does NOT fire Mongoose pre('save') hooks, so we must
      // generate orderNumber explicitly here rather than relying on the pre-save hook.
      //
      // IMPORTANT: Do NOT mix $set and $setOnInsert in the same upsert.
      // When both operators are present, MongoDB applies $set on INSERT too —
      // this can conflict with the filter field (dbeOrderId) being written into
      // the new document and causes the insert to fail or the order to be missing.
      // Instead: use $setOnInsert-only for the upsert, then do a separate $set
      // update if the document already existed (identified by updatedAt > createdAt).
      const supplierOrderNumber = await generateCode(Order, 'ORD', 'orderNumber', 'yyyyMMdd');

      const result = await Order.findOneAndUpdate(
        { dbeOrderId },
        {
          $setOnInsert: {
            orderNumber: supplierOrderNumber,
            dealerId: supplierDealer._id,
            status: 'pending',
            dbeOrderId,
            dealerOrderNumber: orderNumber,
            items: embeddedItems,
            subtotal: Number(subtotal || 0),
            taxAmount: Number(taxAmount || 0),
            netAmount: Number(netAmount || 0),
            paymentMethod: paymentMethod || '',
            paymentStatus: paymentStatus || '',
            notes: `Dealer order: ${orderNumber}`,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const wasInserted = result.createdAt && result.updatedAt &&
        Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;

      if (wasInserted) {
        console.log(`[Webhook] Created supplier order linked to dbeOrderId=${dbeOrderId}`);
      } else {
        // Order already existed — patch payment fields that may have changed
        if (paymentMethod || paymentStatus) {
          await Order.updateOne(
            { dbeOrderId },
            {
              $set: {
                ...(paymentMethod ? { paymentMethod } : {}),
                ...(paymentStatus ? { paymentStatus } : {}),
              },
            }
          );
        }
        console.log(`[Webhook] dealer-order already linked (upsert no-op): dbeOrderId=${dbeOrderId}`);
      }
    }

    // ── 5. Notify all active admins ──
    try {
      const User = require('../auth/model/User.model');
      const notificationService = require('../notifications/notification.service');
      const admins = await User.find({ isActive: true }).lean();
      const itemCount = Array.isArray(items) ? items.length : 0;
      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title: `New Order: ${orderNumber}`,
          message: `${dealerName || 'A dealer'} placed an order for ${itemCount} item(s) — ₹${netAmount} via ${paymentMethod}`,
          type: 'order',
          relatedEntity: { entityType: 'Order', entityId: dbeOrderId },
        });
      }
      console.log(`[Webhook] Order ${orderNumber} — notified ${admins.length} admin(s)`);
    } catch (notifErr) {
      console.error('[Webhook] dealer-order notification failed:', notifErr.message);
    }

    return res.status(200).json({ success: true, message: 'Order notification processed' });
  } catch (err) {
    console.error('[Webhook] dealer-order error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-return
// Called by D-BE when a dealer submits a return request.
// Creates a Return record in S-BE so the supplier can review and process it.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-return', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized dealer-return attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      returnId, dbeReturnId, dbeOrderId, dealerOrderNumber,
      dealerName, dealerPhone,
      items, totalRefundAmount, refundMethod, comments, createdAt,
    } = req.body;

    const Return = require('../returns/model/Return.model');
    const Order = require('../orders/model/Order.model');
    const Dealer = require('../dealer/model/Dealer.model');

    // ── Idempotency: skip if already synced ──
    const existing = await Return.findOne({ dbeReturnId });
    if (existing) {
      console.warn(`[Webhook] dealer-return already synced: ${returnId}`);
      return res.json({ success: true, message: 'Already synced', data: existing });
    }

    // ── Resolve supplier-side Order ──
    let supplierOrder = null;
    if (dbeOrderId) {
      supplierOrder = await Order.findOne({ dbeOrderId });
    }
    if (!supplierOrder && dealerOrderNumber) {
      supplierOrder = await Order.findOne({ dealerOrderNumber });
    }

    // ── Resolve supplier-side Dealer ──
    let supplierDealer = null;
    if (dealerPhone) supplierDealer = await Dealer.findOne({ phone: dealerPhone }).lean();
    if (!supplierDealer && dealerName) {
      supplierDealer = await Dealer.findOne({
        businessName: { $regex: dealerName.trim(), $options: 'i' },
      }).lean();
    }

    if (!supplierOrder) {
      console.warn(`[Webhook] dealer-return: could not resolve supplier order (dbeOrderId=${dbeOrderId}) — return skipped`);
      return res.status(200).json({ success: false, message: 'Supplier order not found, return not created' });
    }

    // ── Map D-BE return items → S-BE return items ──
    const returnItems = (items || []).map(i => ({
      productId: i.productId || undefined,
      productName: i.name || '',
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      returnReason: i.reason || '',
      condition: 'sellable', // default; supplier can update when inspected
    }));

    // ── Create Return record in S-BE ──
    const ret = await Return.create({
      dbeReturnId,            // link back to D-BE record
      dealerId: supplierDealer?._id || supplierOrder.dealerId,
      orderId: supplierOrder._id,
      items: returnItems,
      reason: (items?.[0]?.reason) || 'Dealer return request',
      refundAmount: Number(totalRefundAmount) || 0,
      totalRefundAmount: Number(totalRefundAmount) || 0,
      refundMethod: refundMethod || '',
      notes: comments || '',
      status: 'requested',
    });

    // ── Notify all active admins ──
    try {
      const User = require('../auth/model/User.model');
      const notificationService = require('../notifications/notification.service');
      const admins = await User.find({ isActive: true }).lean();
      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title: `Return Request: ${returnId}`,
          message: `${dealerName || 'A dealer'} submitted a return for order ${dealerOrderNumber || supplierOrder.orderNumber} — ₹${totalRefundAmount}`,
          type: 'order',
          relatedEntity: { entityType: 'Return', entityId: ret._id },
        });
      }
    } catch (notifErr) {
      console.error('[Webhook] dealer-return notification failed:', notifErr.message);
    }

    console.log(`[Webhook] dealer-return synced: ${returnId} → RMA ${ret.rmaNumber}`);
    return res.status(201).json({ success: true, data: ret });
  } catch (err) {
    console.error('[Webhook] dealer-return error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-return-cancel
// Called by D-BE when a dealer cancels their own return request.
// Finds the matching S-BE return (by dbeReturnId) and marks it as rejected/cancelled.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-return-cancel', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { returnId } = req.body; // D-BE returnId string, e.g. "RET-..."
    if (!returnId) {
      return res.status(400).json({ success: false, message: 'returnId required' });
    }

    const Return = require('../returns/model/Return.model');
    const Order  = require('../orders/model/Order.model');
    const updated = await Return.findOneAndUpdate(
      { dbeReturnId: returnId },
      {
        $set:  { status: 'cancelled' },
        $push: {
          timeline: {
            status:      'cancelled',
            timestamp:   new Date(),
            description: 'Return request cancelled by dealer',
          },
        },
      },
      { runValidators: false, new: true }
    );

    if (!updated) {
      console.warn(`[Webhook] dealer-return-cancel: no S-BE return found for dbeReturnId=${returnId}`);
      return res.json({ success: false, message: 'Matching return not found on supplier side' });
    }

    // Revert the S-BE order status back to 'delivered'
    if (updated.orderId) {
      await Order.findByIdAndUpdate(updated.orderId, { status: 'delivered' });
    }

    console.log(`[Webhook] dealer-return-cancel: cancelled S-BE return ${updated.rmaNumber} for D-BE return ${returnId}`);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Webhook] dealer-return-cancel error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// POST /api/webhooks/low-stock-after-order
// Called by D-BE after an order is confirmed and some ordered products are
// found to be low-stock or out-of-stock. Notifies all supplier admins.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/low-stock-after-order', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { orderNumber, lowStockItems } = req.body;
    if (!Array.isArray(lowStockItems) || lowStockItems.length === 0) {
      return res.json({ success: true, message: 'No low-stock items' });
    }

    try {
      const User = require('../auth/model/User.model');
      const admins = await User.find({ isActive: true }).lean();
      const names  = lowStockItems.map(i => i.productName).join(', ');
      const outCount = lowStockItems.filter(i => i.alertType === 'out-of-stock').length;
      const lowCount = lowStockItems.filter(i => i.alertType === 'low-stock').length;
      const parts = [];
      if (outCount) parts.push(`${outCount} out-of-stock`);
      if (lowCount) parts.push(`${lowCount} low-stock`);

      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title:       `Stock Alert after Order #${orderNumber}`,
          message:     `${parts.join(' and ')} product(s) need attention: ${names}`,
          type:        'warning',
          relatedEntity: { entityType: 'Order', entityId: orderNumber },
        });
      }
      console.log(`[Webhook] low-stock-after-order — notified ${admins.length} admin(s) for order ${orderNumber}`);
    } catch (notifErr) {
      console.error('[Webhook] low-stock-after-order notification failed:', notifErr.message);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] low-stock-after-order error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-order-cancel
// Called by D-BE when a dealer cancels their own order.
// Finds the matching S-BE order (by dbeOrderId) and marks it as cancelled.
// If the supplier had already confirmed the order, also reverses any S-BE-side
// inventory allocations and cancels the S-BE invoice.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-order-cancel', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized dealer-order-cancel attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { dbeOrderId, orderNumber, reason } = req.body;

    const Order = require('../orders/model/Order.model');
    const OrderItem = require('../orders/model/OrderItem.model');
    const Invoice = require('../payments/model/Invoice.model');

    // Find the S-BE order linked to this D-BE order
    let supplierOrder = null;
    if (dbeOrderId) supplierOrder = await Order.findOne({ dbeOrderId });
    if (!supplierOrder && orderNumber) {
      supplierOrder = await Order.findOne({ dealerOrderNumber: orderNumber });
    }

    if (!supplierOrder) {
      console.warn(`[Webhook] dealer-order-cancel: no S-BE order found for dbeOrderId=${dbeOrderId}`);
      return res.json({ success: true, message: 'Supplier order not found, nothing to cancel' });
    }

    if (['cancelled', 'delivered'].includes(supplierOrder.status)) {
      console.log(`[Webhook] dealer-order-cancel: order already ${supplierOrder.status}, skipping`);
      return res.json({ success: true, message: `Order already ${supplierOrder.status}` });
    }

    const wasConfirmed = supplierOrder.status === 'confirmed';

    // If supplier had already confirmed, reverse S-BE inventory allocations
    if (wasConfirmed) {
      const items = await OrderItem.find({ orderId: supplierOrder._id }).lean();
      if (items.length > 0) {
        const inventoryService = require('../inventory/inventory.service');
        const Product = require('../products/model/Product.model');
        for (const item of items) {
          try {
            await inventoryService.releaseAllocation(item.productId, item.warehouseId, item.quantity);
            await Product.findByIdAndUpdate(item.productId, { $inc: { currentStockQty: item.quantity } });
          } catch (invErr) {
            console.error('[Webhook] dealer-order-cancel: inventory reversal failed:', invErr.message);
          }
        }
      }
      // Cancel the S-BE invoice created at confirmation time
      if (supplierOrder.invoiceId) {
        await Invoice.findByIdAndUpdate(supplierOrder.invoiceId, { status: 'cancelled' });
      }
    }

    supplierOrder.status = 'cancelled';
    supplierOrder.cancellationReason = reason || 'Cancelled by dealer';
    supplierOrder.cancelledAt = new Date();
    await supplierOrder.save();

    console.log(`[Webhook] dealer-order-cancel: cancelled S-BE order ${supplierOrder.orderNumber} (dbeOrderId=${dbeOrderId}, wasConfirmed=${wasConfirmed})`);
    return res.json({ success: true, data: { orderNumber: supplierOrder.orderNumber, status: 'cancelled' } });
  } catch (err) {
    console.error('[Webhook] dealer-order-cancel error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;