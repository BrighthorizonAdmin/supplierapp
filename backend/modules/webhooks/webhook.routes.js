const express = require('express');
const router  = express.Router();
const Invoice = require('../payments/model/Invoice.model');
const Dealer  = require('../dealer/model/Dealer.model');

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

    // 2. Prevent duplicate — idempotent based on dbeInvoiceId
    const existing = await Invoice.findOne({ dbeInvoiceId });
    if (existing) {
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

    // 5. Create invoice in Sup-BE using existing Invoice model
    const invoice = await Invoice.create({
      invoiceType:   'retail',
      dbeInvoiceId,

      // D- prefix distinguishes dealer-originated invoice numbers from supplier ones
      invoiceNumber: `D-${invoiceNumber}`,

      dealerId:   dealer?._id || undefined,
      partyName:  dealerName  || 'Unknown Dealer',
      partyPhone: dealerPhone || '',

      // Customer info stored in notes (customer is not a DB entity in Sup-BE)
      notes: `Retail sale to: ${customerName}${customerPhone ? ' | ' + customerPhone : ''}`,

      lineItems,
      subtotal:    Number(subtotal),
      taxAmount:   Number(taxAmount),
      totalAmount: Number(totalAmount),
      discountAmt: 0,

      amountPaid: Number(totalAmount), // retail = fully paid at point of sale
      balance:    0,

      paymentMode:  paymentMode || 'Cash',
      invoiceDate:  invoiceDate ? new Date(invoiceDate) : new Date(),
      status:       'paid',
      issuedAt:     new Date(),
    });

    console.log(`[Webhook] Retail invoice synced: ${invoice.invoiceNumber} for dealer: ${dealerName}`);

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    console.error('[Webhook] dealer-retail-invoice error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;