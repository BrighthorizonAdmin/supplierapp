const express = require('express');
const router = express.Router();
const Invoice = require('../payments/model/Invoice.model');
const Quote  = require('../quotes/model/Quote.model');
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
      dealerEmail,
      dealerName,
      dealerPhone,
      customerName,
      customerPhone,
      customerAddress,
      shipToAddress,
      dealerBankName, dealerAccountNumber, dealerIfscCode, dealerAccountHolderName,
      items,
      additionalCharges,
      subtotal,
      taxAmount,
      totalAmount,
      receivedAmount,
      paymentMode,
      salesmanName,
      quoteNumber,
    } = req.body;
 
    // 2. Idempotent on dbeInvoiceId OR invoiceNumber — if already synced, this is an
    // edit on the dealer side, so update the existing record instead of no-op'ing.
    const existing = await Invoice.findOne({
      $or: [
        { dbeInvoiceId },
        { invoiceNumber: `D-${invoiceNumber}` },
      ],
    });

    // 3. Resolve dealer — email first (unique key), then phone, then businessName
    let dealer = null;
    if (dealerEmail) {
      dealer = await Dealer.findOne({ email: dealerEmail.toLowerCase().trim() }).lean();
    }
    if (!dealer && dealerPhone) {
      const digits = String(dealerPhone).replace(/\D/g, '');
      const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (phone10) dealer = await Dealer.findOne({ phone: phone10 }).lean();
    }
    if (!dealer && dealerName) {
      const escaped = dealerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      dealer = await Dealer.findOne({
        businessName: { $regex: `^${escaped}$`, $options: 'i' },
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
        productId:     item.productId || undefined,
        productName:   item.productName || item.name || '',
        productCode:   item.productCode || item.sku || '',
        hsnCode:       item.hsnCode || '',
        quantity:      qty,
        unitPrice:     price,
        taxRate:       taxR,
        taxAmount:     +lineTax.toFixed(2),
        lineTotal:     +Number(item.lineTotal || (lineBase + lineTax)).toFixed(2),
        discount:      0,
        discountType:  '%',
        discountValue: 0,
        productSource: item.productSource || 'supplier',
        serialNumbers: (item.serialNumbers || []).map(s => String(s).trim().toUpperCase()).filter(Boolean),
      };
    });
 
    // 5. Derive correct payment status and balance — same logic as D-BE
    const total    = Number(totalAmount) || 0;
    const received = receivedAmount !== undefined ? Number(receivedAmount) : total;
    const balance  = Math.max(0, +(total - received).toFixed(2));
    const invoiceStatus = received >= total ? 'paid' : (received > 0 ? 'partial' : 'issued');
 
    // Build customer address string from the customerAddress object if provided
    const custAddrStr = customerAddress && typeof customerAddress === 'object'
      ? [customerAddress.street, customerAddress.city, customerAddress.state, customerAddress.pincode].filter(Boolean).join(', ')
      : (typeof customerAddress === 'string' ? customerAddress : '');

    // Build shippingAddress subdocument from shipToAddress if provided
    const shipAddrDoc = shipToAddress && typeof shipToAddress === 'object' && (shipToAddress.street || shipToAddress.city)
      ? {
          label:   shipToAddress.label || customerName || '',
          street:  shipToAddress.street || '',
          city:    shipToAddress.city || '',
          state:   shipToAddress.state || '',
          pincode: shipToAddress.pincode || shipToAddress.postalCode || '',
        }
      : undefined;

    // Dealer's own bank details, in the Invoice model's bankDetailsSchema shape.
    const dealerBankDetails = {
      label:          dealerAccountHolderName || dealerName || '',
      accountNumber:  dealerAccountNumber || '',
      ifscCode:       dealerIfscCode || '',
      bankBranchName: dealerBankName || '',
      holderName:     dealerAccountHolderName || dealerName || '',
    };

    const invoiceFields = {
      quoteNumber:  quoteNumber || '',
      dealerId:     dealer?._id || undefined,
      partyName:    dealerName || 'Unknown Dealer',
      partyPhone:   dealerPhone || '',
      partyAddress: custAddrStr || '',
      shippingAddress: shipAddrDoc,
      salesmanName: salesmanName || '',
      notes:        `Retail sale to: ${customerName}${customerPhone ? ' | ' + customerPhone : ''}`,
      lineItems,
      bankDetails:  dealerBankDetails,
      // Invoice.additionalCharges is a flat total (unlike Quote's itemized array) — sum here.
      additionalCharges: (additionalCharges || []).reduce((s, c) => s + (Number(c.amount) || 0), 0),
      subtotal:     Number(subtotal),
      taxAmount:    Number(taxAmount),
      totalAmount:  total,
      amountPaid:   received,
      balance,
      paymentMode:  paymentMode || 'Cash',
      status:       invoiceStatus,
    };

    // 6. Update existing (dealer-side edit) or create new — catch E11000 in case
    // of race condition / D-BE retry after timeout
    let invoice;
    let isNew = false;
    try {
      if (existing) {
        Object.assign(existing, invoiceFields);
        invoice = await existing.save();
      } else {
        isNew = true;
        invoice = await Invoice.create({
          invoiceType:  'retail',
          dbeInvoiceId,
          invoiceNumber: `D-${invoiceNumber}`,
          ...invoiceFields,
          discountAmt:  0,
          invoiceDate:  invoiceDate ? new Date(invoiceDate) : new Date(),
          issuedAt:     new Date(),
        });
      }
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

    console.log(`[Webhook] Retail invoice ${isNew ? 'synced' : 'updated'}: ${invoice.invoiceNumber} for dealer: ${dealerName}`);

    // Notify all active supplier admins — only for a genuinely new sale, not edits
    if (isNew) {
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
    }

    return res.status(isNew ? 201 : 200).json({ success: true, data: invoice });
 
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
      dealerEmail, dealerName, dealerPhone,
      items, subtotal, taxAmount, netAmount, paymentMethod, paymentStatus,
      splitPayNowAmount, splitCreditAmount,
    } = req.body;
 
    const Order = require('../orders/model/Order.model');
    const { generateCode } = require('../../utils/autoCode');
 
    // ── 1. Resolve the supplier-side Dealer record ──
    // Resolution priority: email (unique shared key) > phone > businessName regex.
    // Email is the reliable link because the supplier approves dealers by email,
    // so the S-BE dealer record's email always matches the D-BE dealer account email.
    const Dealer = require('../dealer/model/Dealer.model');
    let supplierDealer = null;
    if (dealerEmail) {
      supplierDealer = await Dealer.findOne({ email: dealerEmail.toLowerCase().trim() }).lean();
    }
    if (!supplierDealer && dealerPhone) {
      const digits = String(dealerPhone).replace(/\D/g, '');
      const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (phone10) supplierDealer = await Dealer.findOne({ phone: phone10 }).lean();
    }
    if (!supplierDealer && dealerName) {
      const escaped = dealerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      supplierDealer = await Dealer.findOne({
        businessName: { $regex: `^${escaped}$`, $options: 'i' },
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
            splitPayNowAmount: Number(splitPayNowAmount || 0),
            splitCreditAmount: Number(splitCreditAmount || 0),
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
// POST /api/webhooks/dealer-exchange
// Called by D-BE when a dealer submits an exchange request.
// Notifies all active supplier admins.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-exchange', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
 
    const { exchangeId, dealerName, itemCount } = req.body;
 
    const User = require('../auth/model/User.model');
    const notificationService = require('../notifications/notification.service');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title: `New Exchange Request: ${exchangeId}`,
        message: `${dealerName || 'A dealer'} submitted an exchange request for ${itemCount || 0} item(s).`,
        type: 'return',
      });
    }
 
    console.log(`[Webhook] dealer-exchange: notified ${admins.length} admin(s) for ${exchangeId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] dealer-exchange error:', err.message);
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
// Called by D-BE when a dealer cancels their own pending order.
// Finds the matching S-BE order (by dbeOrderId) and marks it as cancelled
// so the supplier sees CANCELLED instead of Accept/Reject buttons.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-order-cancel', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
 
    const { dbeOrderId, orderNumber, reason } = req.body;
    if (!dbeOrderId && !orderNumber) {
      return res.status(400).json({ success: false, message: 'dbeOrderId or orderNumber required' });
    }
 
    const Order = require('../orders/model/Order.model');
    const query = dbeOrderId ? { dbeOrderId } : { dealerOrderNumber: orderNumber };
    const order = await Order.findOne(query);
 
    if (!order) {
      console.warn(`[Webhook] dealer-order-cancel: no S-BE order found for dbeOrderId=${dbeOrderId}`);
      return res.json({ success: true, message: 'No matching supplier order found, skipping' });
    }
 
    // Only cancel if the order hasn't shipped yet — can't cancel a shipped/delivered order
    if (!['pending', 'confirmed'].includes(order.status)) {
      console.warn(`[Webhook] dealer-order-cancel: order ${order.orderNumber} is already ${order.status}, skipping`);
      return res.json({ success: true, message: `Order already ${order.status}, not overridden` });
    }
 
    // If order was confirmed, cancel the invoice.
    // Stock is already restored by the dealer BE cancel route (both share the same DB).
    if (order.status === 'confirmed' && order.invoiceId) {
      const Invoice = require('../payments/model/Invoice.model');
      await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' });
    }
 
    order.status            = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by dealer';
    order.cancelledAt       = new Date();
    await order.save();
      const User = require('../auth/model/User.model');
      const notificationService = require('../notifications/notification.service');
      const admins = await User.find({ isActive: true }).lean();
    await notificationService.create({
      recipientId: admins.map(a => a._id), // notify all admins
      title:       `Order Cancelled: ${order.orderNumber}`,
      message:     `Your order has been marked as cancelled. Reason: ${reason || 'Cancelled by dealer'}`,
      type:        'order',
      relatedEntity: { entityType: 'Order', entityId: order._id },
    });
    console.log(`[Webhook] dealer-order-cancel: S-BE order ${order.orderNumber} → cancelled (dbeOrderId=${dbeOrderId})`);
    return res.json({ success: true, message: 'Supplier order marked as cancelled' });
  } catch (err) {
    console.error('[Webhook] dealer-order-cancel error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});
 
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-warranty-claim
// Called by D-BE when a dealer submits a warranty claim for a retail invoice.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-warranty-claim', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized dealer-warranty-claim attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
 
    const {
      dbeClaimId, invoiceNumber, dbeInvoiceId, invoiceDate, warrantyPeriod,
      dealerName, dealerPhone, dealerEmail,
      customerName, customerPhone,
      items, issueDescription,
    } = req.body;
 
    if (!dbeClaimId) {
      return res.status(400).json({ success: false, message: 'dbeClaimId required' });
    }
 
    const WarrantyRequest = require('../warranty/model/WarrantyRequest.model');
 
    // Idempotency — skip if already synced
    const existing = await WarrantyRequest.findOne({ dbeClaimId });
    if (existing) {
      console.warn(`[Webhook] dealer-warranty-claim already synced: ${dbeClaimId}`);
      return res.json({ success: true, message: 'Already synced', data: existing });
    }
 
    // Resolve dealer
    let dealer = null;
    if (dealerEmail) {
      dealer = await Dealer.findOne({ email: dealerEmail.toLowerCase().trim() }).lean();
    }
    if (!dealer && dealerPhone) {
      const digits = String(dealerPhone).replace(/\D/g, '');
      const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (phone10) dealer = await Dealer.findOne({ phone: phone10 }).lean();
    }
    if (!dealer && dealerName) {
      const escaped = dealerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      dealer = await Dealer.findOne({
        businessName: { $regex: `^${escaped}$`, $options: 'i' },
      }).lean();
    }
 
    // If warrantyPeriod not provided by D-BE, look it up from S-BE product by SKU
    let resolvedWarrantyPeriod = warrantyPeriod || '';
    if (!resolvedWarrantyPeriod && Array.isArray(items) && items.length > 0) {
      const Product = require('../products/model/Product.model');
      const firstItem = items[0];
      let product = null;
      if (firstItem.productId) {
        product = await Product.findById(firstItem.productId).select('warrantyPeriod').lean();
      }
      if (!product?.warrantyPeriod && firstItem.sku) {
        product = await Product.findOne({ sku: firstItem.sku.toUpperCase() }).select('warrantyPeriod').lean();
      }
      resolvedWarrantyPeriod = product?.warrantyPeriod || '';
    }
 
    // Compute warranty expiry date from invoiceDate + warrantyPeriod
    const computeWarrantyExpiry = (invDate, period) => {
      if (!invDate || !period) return undefined;
      const d = new Date(invDate);
      if (isNaN(d.getTime())) return undefined;
      const match = String(period).match(/(\d+)\s*(month|year|day)/i);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('month')) d.setMonth(d.getMonth() + num);
        else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() + num);
        else if (unit.startsWith('day')) d.setDate(d.getDate() + num);
        return d;
      }
      const months = parseInt(period);
      if (!isNaN(months) && months > 0) { d.setMonth(d.getMonth() + months); return d; }
      return undefined;
    };
    const warrantyExpiryDate = computeWarrantyExpiry(invoiceDate, resolvedWarrantyPeriod);
 
    const warrantyReq = await WarrantyRequest.create({
      dbeClaimId,
      dealerId:       dealer?._id || undefined,
      dbeInvoiceId,
      invoiceNumber,
      invoiceDate:        invoiceDate ? new Date(invoiceDate) : undefined,
      warrantyPeriod:     resolvedWarrantyPeriod,
      warrantyExpiryDate: warrantyExpiryDate || undefined,
      customerName,
      customerPhone:  customerPhone || '',
      items:          (items || []).map((i) => ({
        productId:     i.productId || '',
        name:          i.name || '',
        sku:           i.sku || '',
        quantity:      Number(i.quantity) || 1,
        reason:        i.reason || '',
        serialNumbers: Array.isArray(i.serialNumbers) ? i.serialNumbers : [],
      })),
      issueDescription: issueDescription || '',
    });
 
    console.log(`[Webhook] Warranty claim synced: ${warrantyReq.claimNumber} for dealer: ${dealerName}`);
 
    // Notify all active supplier admins in real-time
    try {
      const User = require('../auth/model/User.model');
      const { emitToAll } = require('../../websocket/socket');
      const { WARRANTY_NEW_CLAIM } = require('../../websocket/events');
      const admins = await User.find({ isActive: true }).select('_id').lean();
      const title = `New Warranty Claim: ${warrantyReq.claimNumber}`;
      const message = `${dealerName} submitted a warranty claim for invoice ${invoiceNumber || 'N/A'}.`;
      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title,
          message,
          type: 'warranty',
          relatedEntity: { entityType: 'warranty', entityId: warrantyReq._id },
        });
      }
      emitToAll(WARRANTY_NEW_CLAIM, {
        claimId: warrantyReq._id,
        claimNumber: warrantyReq.claimNumber,
        dealerName,
        invoiceNumber: invoiceNumber || '',
      });
    } catch (notifyErr) {
      console.error('[Webhook] warranty claim notification failed:', notifyErr.message);
    }
 
    return res.status(201).json({ success: true, data: warrantyReq });
  } catch (err) {
    console.error('[Webhook] dealer-warranty-claim error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});
 
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-stock-alert
// Called by D-BE when a dealer reports a product is out of stock.
// Notifies all active supplier admins.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-stock-alert', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
 
    const { productId, productName, sku, dealerName } = req.body;
 
    const User = require('../auth/model/User.model');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title: `Restock Request: ${productName || sku || 'Unknown Product'}`,
        message: `${dealerName || 'A dealer'} is requesting a restock for "${productName || sku}" which is currently out of stock.`,
        type: 'warning',
        ...(productId && { relatedEntity: { entityType: 'Product', entityId: productId } }),
      });
    }
 
    console.log(`[Webhook] dealer-stock-alert: notified ${admins.length} admin(s) for product ${productId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhook] dealer-stock-alert error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});
 
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-quote
// Called by D-BE when a dealer creates or updates a quote.
// Upserts into the supplier's Quote model (source: 'dealer').
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-quote', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
 
    const {
      dbeQuoteId, quoteNumber, quoteDate, expiryDate, status,
      dealerEmail, dealerName, dealerPhone,
      dealerBankName, dealerAccountNumber, dealerIfscCode, dealerAccountHolderName,
      customerName, customerCompany, customerGST, customerPhone, customerCity, salesman,
      items, additionalCharges, subtotal, taxAmount, totalAmount, notes,
    } = req.body;
 
    if (!dbeQuoteId) return res.status(400).json({ success: false, message: 'dbeQuoteId required' });
 
    // Resolve supplier-side dealer by email → phone
    let dealer = null;
    if (dealerEmail) dealer = await Dealer.findOne({ email: dealerEmail.toLowerCase().trim() }).lean();
    if (!dealer && dealerPhone) {
      const phone10 = String(dealerPhone).replace(/\D/g, '').slice(-10);
      if (phone10) dealer = await Dealer.findOne({ phone: phone10 }).lean();
    }
 
    // Map D-BE items to S-BE lineItems
    const lineItems = (items || []).map(item => {
      const qty   = Number(item.quantity);
      const price = Number(item.unitPrice);
      const taxR  = Number(item.taxRate) || 0;
      const base  = price * qty;
      const tax   = base * (taxR / 100);
      return {
        productId:   item.productId || undefined,
        productName: item.name,
        hsnCode:     item.hsnCode || '',
        quantity:    qty,
        unitPrice:   price,
        taxRate:     taxR,
        taxAmount:   +tax.toFixed(2),
        lineTotal:   +(base + tax).toFixed(2),
      };
    });
 
    // Map D-BE additional charges (name/gstRate/includesGst) to S-BE shape (label/taxRate/taxAmount)
    const mappedAdditionalCharges = (additionalCharges || []).map(charge => {
      const amt  = Number(charge.amount) || 0;
      const rate = charge.includesGst ? (Number(charge.gstRate) || 0) : 0;
      const tax  = rate > 0 ? +(amt * (rate / 100)).toFixed(2) : 0;
      return {
        label:     charge.name || '',
        amount:    amt,
        taxRate:   rate,
        taxAmount: tax,
      };
    });

    // Dealer's own bank details, in the same shape QuoteDetailPage.jsx already
    // renders for supplier-created quotes (name/ifscCode/accountNumber/bankBranch).
    const dealerBankDetails = {
      name:          dealerAccountHolderName || dealerName || '',
      ifscCode:      dealerIfscCode || '',
      accountNumber: dealerAccountNumber || '',
      bankBranch:    dealerBankName || '',
    };

    const quoteFields = {
      source:      'dealer',
      dbeQuoteId,
      dealerId:    dealer?._id || undefined,
      dealerBusinessName: dealerName || '',
      partyName:   customerName,
      partyGST:    customerGST || '',
      partyPhone:  customerPhone || '',
      partyAddress: customerCity || '',
      salesman:    salesman || '',
      lineItems,
      additionalCharges: mappedAdditionalCharges,
      bankDetails: dealerBankDetails,
      subtotal:    Number(subtotal),
      taxAmount:   Number(taxAmount),
      totalAmount: Number(totalAmount),
      status:      status || 'draft',
      quoteDate:   quoteDate ? new Date(quoteDate) : new Date(),
      expiryDate:  expiryDate ? new Date(expiryDate) : undefined,
      notes:       notes || `Dealer quote to: ${customerName}`,
    };
 
    // Check if already synced — upsert manually to preserve quoteNumber
    const existing = await Quote.findOne({ dbeQuoteId });
    let quote;
    if (existing) {
      Object.assign(existing, quoteFields);
      quote = await existing.save();
    } else {
      quote = await Quote.create({ ...quoteFields, quoteNumber: `D-${quoteNumber}` });
    }
 
    console.log(`[Webhook] dealer-quote synced: ${quote.quoteNumber} for ${dealerName}`);
    return res.status(200).json({ success: true, data: quote });
  } catch (err) {
    console.error('[Webhook] dealer-quote error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/dealer-quote-deleted
// Called by D-BE when a dealer deletes a quote. We never delete the synced
// supplier-side copy (keeps the audit trail) — just flag its status so admins
// can see it was removed on the dealer side. No-ops if it was never synced.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-quote-deleted', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { dbeQuoteId } = req.body;
    if (!dbeQuoteId) return res.status(400).json({ success: false, message: 'dbeQuoteId required' });

    const quote = await Quote.findOneAndUpdate(
      { dbeQuoteId },
      { status: 'deletedByDealer' },
      { new: true }
    );

    if (!quote) {
      console.warn(`[Webhook] dealer-quote-deleted: no synced quote found for dbeQuoteId ${dbeQuoteId}`);
      return res.json({ success: true, message: 'No synced quote found' });
    }

    console.log(`[Webhook] dealer-quote-deleted: flagged ${quote.quoteNumber}`);
    return res.json({ success: true, data: quote });
  } catch (err) {
    console.error('[Webhook] dealer-quote-deleted error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/ecommerce-order
// Called by D-BE (backend 1) whenever a customer places an order on the
// Buvvas Ecommerce storefront. No dealer is involved — writes into the SAME
// Order collection dealer orders use (orderType:'b2c', no dealerId), so it
// shows up in the existing Order Management screen next to B2B orders.
// Mirrors the /dealer-order handler above but skips dealer resolution.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ecommerce-order', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized ecommerce-order attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      dbeOrderId, orderNumber,
      customerName, customerEmail, customerPhone,
      deliveryAddress, items, subtotal, taxAmount, netAmount,
      paymentMethod, paymentStatus, shippingCost,
    } = req.body;

    if (!dbeOrderId) {
      return res.status(400).json({ success: false, message: 'dbeOrderId required' });
    }

    const Order = require('../orders/model/Order.model');
    const { generateCode } = require('../../utils/autoCode');

    const embeddedItems = (items || []).map(item => ({
      productId: item.productId || undefined,
      sku: item.sku || '',
      name: item.name || '',
      image: item.image || '',
      unitPrice: Number(item.unitPrice || item.basePrice || 0),
      quantity: Number(item.quantity || 0),
      lineTotal: Number(item.lineTotal || 0),
    }));

    // Same upsert-only-on-insert pattern as /dealer-order — see the comment
    // there for why $set and $setOnInsert must not be mixed in one upsert.
    const supplierOrderNumber = await generateCode(Order, 'ORD', 'orderNumber', 'yyyyMMdd');

    const order = await Order.findOneAndUpdate(
      { dbeOrderId },
      {
        $setOnInsert: {
          orderNumber: supplierOrderNumber,
          orderType: 'b2c',
          status: 'pending',
          dbeOrderId,
          dealerOrderNumber: orderNumber,
          customerName: customerName || '',
          customerEmail: customerEmail || '',
          customerPhone: customerPhone || '',
          items: embeddedItems,
          subtotal: Number(subtotal || 0),
          taxAmount: Number(taxAmount || 0),
          netAmount: Number(netAmount || 0),
          shippingCost: Number(shippingCost || 0),
          paymentMethod: paymentMethod || '',
          paymentStatus: paymentStatus || '',
          deliveryAddress: deliveryAddress || {},
          notes: `Buvvas Ecommerce order: ${orderNumber}`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Webhook] Ecommerce order synced: ${order.orderNumber} (dbeOrderId=${dbeOrderId})`);

    // Notify all active admins + push real-time event, same as warranty claims
    try {
      const User = require('../auth/model/User.model');
      const { emitToAll } = require('../../websocket/socket');
      const { ECOMMERCE_NEW_ORDER } = require('../../websocket/events');
      const admins = await User.find({ isActive: true }).select('_id').lean();
      const itemCount = Array.isArray(items) ? items.length : 0;
      for (const admin of admins) {
        await notificationService.create({
          recipientId: admin._id,
          title: `New Buvvas Order: ${order.orderNumber}`,
          message: `${customerName || 'A customer'} placed an order for ${itemCount} item(s) worth ₹${netAmount} via Buvvas Ecommerce`,
          type: 'order',
          relatedEntity: { entityType: 'Order', entityId: order._id },
        });
      }
      emitToAll(ECOMMERCE_NEW_ORDER, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName,
        netAmount,
      });
      console.log(`[Webhook] ecommerce-order — notified ${admins.length} admin(s)`);
    } catch (notifErr) {
      console.error('[Webhook] ecommerce-order notification failed:', notifErr.message);
    }

    return res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error('[Webhook] ecommerce-order error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;