const express = require('express');
const router  = express.Router();
const Invoice = require('../payments/model/Invoice.model');
const Dealer  = require('../dealer/model/Dealer.model');
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
    const lineItems = (items || []).map((item) => ({
      productId:     item.productId || undefined,
      productName:   item.productName || item.name || '',
      productCode:   item.productCode || item.sku || '',
      quantity:      Number(item.quantity),
      unitPrice:     Number(item.unitPrice),
      taxRate:       Number(item.taxRate) || 0,
      taxAmount:     +(Number(item.unitPrice) * Number(item.quantity) * (Number(item.taxRate) || 0) / 100).toFixed(2),
      lineTotal:     Number(item.lineTotal),
      discount:      0,
      discountType:  '%',
      discountValue: 0,
    }));

    // 5. Create invoice — catch E11000 in case of race condition / D-BE retry after timeout
    let invoice;
    try {
      invoice = await Invoice.create({
        invoiceType:   'retail',
        dbeInvoiceId,
        invoiceNumber: `D-${invoiceNumber}`,
        dealerId:      dealer?._id || undefined,
        partyName:     dealerName  || 'Unknown Dealer',
        partyPhone:    dealerPhone || '',
        notes: `Retail sale to: ${customerName}${customerPhone ? ' | ' + customerPhone : ''}`,
        lineItems,
        subtotal:    Number(subtotal),
        taxAmount:   Number(taxAmount),
        totalAmount: Number(totalAmount),
        discountAmt: 0,
        amountPaid:  Number(totalAmount),
        balance:     0,
        paymentMode:  paymentMode || 'Cash',
        invoiceDate:  invoiceDate ? new Date(invoiceDate) : new Date(),
        status:       'paid',
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
      items, subtotal, taxAmount, netAmount, paymentMethod,
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
        productId:   item.productId || undefined,
        sku:         item.sku       || item.productCode || '',
        name:        item.name      || item.productName || '',
        image:       item.image     || '',
        unitPrice:   Number(item.basePrice || item.unitPrice || 0),
        quantity:    Number(item.quantity  || 0),
        moq:         Number(item.moq       || 1),
        lineTotal:   Number(item.lineTotal || 0),
      }));

      // ── 3. Atomic upsert — findOneAndUpdate with upsert:true on dbeOrderId ──
      // findOneAndUpdate does NOT fire Mongoose pre('save') hooks, so we must
      // generate orderNumber explicitly here rather than relying on the pre-save hook.
      const supplierOrderNumber = await generateCode(Order, 'ORD', 'orderNumber', 'yyyyMMdd');

      const result = await Order.findOneAndUpdate(
        { dbeOrderId },
        {
          $setOnInsert: {
            orderNumber:       supplierOrderNumber,
            dealerId:          supplierDealer._id,
            status:            'pending',
            dbeOrderId,
            dealerOrderNumber: orderNumber,
            items:             embeddedItems,
            subtotal:          Number(subtotal  || 0),
            taxAmount:         Number(taxAmount || 0),
            netAmount:         Number(netAmount || 0),
            paymentMethod:     paymentMethod || '',
            paymentStatus:     'pending',
            notes: `Dealer order: ${orderNumber}`,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (result.__v === undefined || result.createdAt?.getTime() === result.updatedAt?.getTime()) {
        console.log(`[Webhook] Created supplier order linked to dbeOrderId=${dbeOrderId}`);
      } else {
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
          title:       `New Order: ${orderNumber}`,
          message:     `${dealerName || 'A dealer'} placed an order for ${itemCount} item(s) — ₹${netAmount} via ${paymentMethod}`,
          type:        'order',
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

module.exports = router;