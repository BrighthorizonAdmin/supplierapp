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
// Called by D-BE whenever a dealer places a new order
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dealer-order', async (req, res) => {
  try {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (!WEBHOOK_SECRET || incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized order webhook attempt from:', req.ip);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { dbeOrderId, orderNumber, dealerName, dealerPhone, items, netAmount, paymentMethod } = req.body;

    // Notify all active admin/supplier users
    try {
      const User = require('../auth/model/User.model');
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