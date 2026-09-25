const mongoose = require('mongoose');
const axios = require('axios');
const LedgerEntry = require('./model/LedgerEntry.model');
const Invoice = require('../payments/model/Invoice.model');
const Transaction = require('../finance/model/Transaction.model');
const { applyPaymentStatus } = require('../payments/invoice.service');
const { buildLedgerRows } = require('./ledger.aggregator');
const { AppError } = require('../../middlewares/error.middleware');
const { withTransaction } = require('../../utils/transaction');

/**
 * orderPayment.service — the ONE place an offline payment against a dealer
 * order is recorded (cash / cheque / bank transfer the system didn't capture).
 *
 * A payment is stored in the order's LedgerEntry.manualPayments (the ledger's
 * existing log) and, in the same transaction, also:
 *   - added to the order's S-BE invoice amountPaid (+ status paid/partial)
 *   - frees the dealer's credit (creditUsed) for the credit portion it pays
 *   - logged as a finance Transaction ('credit')
 *   - marks the order paymentStatus 'completed' once the ledger is settled
 *
 * Payments are append-only: a mistaken one is reversed (every effect above is
 * undone) and kept in the log with who/why — never deleted.
 *
 * Deliberately NO 5% credit-limit bonus here (business decision 2026-09-25) —
 * that stays with in-app payments and Payments & Credits.
 */

const coll = (name) => mongoose.connection.collection(name);
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const r2 = (n) => +(Number(n) || 0).toFixed(2);

const loadRow = async (orderId) => {
  const rows = await buildLedgerRows({ orderId, includeSettled: true });
  if (!rows.length) {
    const exists = await coll('orders').findOne({ _id: oid(orderId) }, { projection: { _id: 1 } });
    if (!exists) throw new AppError('Order not found', 404);
    throw new AppError('This order is not eligible for the ledger (cancelled, draft, or non-dealer order)', 409);
  }
  return rows[0];
};

// Credit this order took out of the dealer's limit — mirrors where creditUsed
// is incremented: S-BE confirmOrder (supplier-created: full net) and D-BE
// order placement (net-terms: full total, split: the credit portion only).
const creditReservedFor = (order) => {
  if (!order.dbeOrderId) return Number(order.netAmount) || 0;
  if (/^net-\d+$/i.test(String(order.paymentMethod || ''))) return Number(order.netAmount) || 0;
  if (order.paymentMethod === 'split') return Number(order.splitCreditAmount) || 0;
  return 0;
};

// Pipeline update so creditUsed never goes below 0
const adjustCreditUsed = (dealerId, delta, session) =>
  coll('dealers').updateOne(
    { _id: oid(dealerId) },
    [{ $set: { creditUsed: { $max: [0, { $add: [{ $ifNull: ['$creditUsed', 0] }, delta] }] } } }],
    { session }
  );

const recordOrderPayment = async (orderId, body, screenshotUrl, user) => {
  const amount = r2(body.amount);
  if (!(amount > 0)) throw new AppError('A positive amount is required', 400);
  if (!body.paidOn) throw new AppError('paidOn (payment date) is required', 400);

  // Nothing left to collect on a fully-paid order, and never more than what's owed.
  const before = await loadRow(orderId);
  if (before.settled) throw new AppError('This order is already fully paid — no further payment can be recorded', 409);
  if (amount > before.outstanding + 0.01) {
    throw new AppError(`Amount exceeds the outstanding balance of ₹${before.outstanding.toFixed(2)}`, 400);
  }

  const order = await coll('orders').findOne({ _id: oid(orderId) });
  const invoice = await Invoice.findOne({
    orderId: order._id,
    totalAmount: { $type: 'number' },
    status: { $ne: 'cancelled' },
  }).select('_id').lean();

  const paymentId = await withTransaction(async (session) => {
    let entry = await LedgerEntry.findOne({ orderId: order._id }).session(session);
    if (!entry) {
      [entry] = await LedgerEntry.create([{ orderId: order._id, dealerId: order.dealerId, createdBy: user?.id }], { session });
    }

    const alreadyReleased = (entry.manualPayments || [])
      .filter((p) => !p.reversedAt)
      .reduce((s, p) => s + (Number(p.creditReleased) || 0), 0);
    const creditReleased = r2(Math.min(amount, Math.max(0, creditReservedFor(order) - alreadyReleased)));

    // Post to the invoice — guarded so concurrent saves can't push it past its total
    if (invoice) {
      const upd = await Invoice.updateOne(
        { _id: invoice._id, $expr: { $lte: [{ $add: ['$amountPaid', amount] }, { $add: ['$totalAmount', 0.01] }] } },
        { $inc: { amountPaid: amount } },
        { session }
      );
      if (!upd.modifiedCount) {
        throw new AppError('This payment would exceed the invoice total — refresh and check the balance', 409);
      }
      const inv = await Invoice.findById(invoice._id).session(session);
      applyPaymentStatus(inv);
      await inv.save({ session });
    }

    if (creditReleased > 0 && order.dealerId) await adjustCreditUsed(order.dealerId, -creditReleased, session);

    entry.manualPayments.push({
      amount,
      paidOn: new Date(body.paidOn),
      method: body.method || 'other',
      reference: body.reference || '',
      note: body.note || '',
      screenshotUrl: screenshotUrl || '',
      recordedBy: user?.id,
      recordedByName: user?.name || '',
      recordedAt: new Date(),
      appliedToInvoiceId: invoice?._id,
      creditReleased,
    });
    await entry.save({ session });
    const saved = entry.manualPayments[entry.manualPayments.length - 1];

    if (order.dealerId) {
      await Transaction.create([{
        type: 'credit',
        dealerId: order.dealerId,
        amount,
        ref: { refType: 'payment', refId: saved._id },
        description: `Offline payment (${body.method || 'other'}) for order ${order.orderNumber} recorded by ${user?.name || 'supplier'}`,
        createdBy: user?.id,
      }], { session });
    }
    return saved._id;
  });

  // Order status follows the ledger outcome. Remember whether THIS payment
  // flipped it, so a reversal only undoes what it did.
  const after = await loadRow(orderId);
  if (after.settled && !['completed', 'paid'].includes(String(order.paymentStatus || '').toLowerCase())) {
    await coll('orders').updateOne({ _id: order._id }, { $set: { paymentStatus: 'completed' } });
    await LedgerEntry.updateOne(
      { orderId: order._id, 'manualPayments._id': paymentId },
      { $set: { 'manualPayments.$.markedOrderPaid': true } }
    );
  }
  syncInBackground(orderId, paymentId);
  return loadRow(orderId);
};

const reverseOrderPayment = async (orderId, paymentId, reason, user) => {
  const entry = await LedgerEntry.findOne({ orderId: oid(orderId) });
  if (!entry) throw new AppError('Ledger entry not found', 404);
  const mp = entry.manualPayments.id(paymentId);
  if (!mp) throw new AppError('Manual payment not found', 404);
  if (mp.reversedAt) throw new AppError('This payment has already been reversed', 409);

  const order = await coll('orders').findOne({ _id: oid(orderId) });
  const markedOrderPaid = Boolean(mp.markedOrderPaid);

  await withTransaction(async (session) => {
    if (mp.appliedToInvoiceId) {
      // raw driver: this Mongoose version rejects pipeline updates on models
      await Invoice.collection.updateOne(
        { _id: mp.appliedToInvoiceId },
        [{ $set: { amountPaid: { $max: [0, { $subtract: ['$amountPaid', Number(mp.amount) || 0] }] } } }],
        { session }
      );
      const inv = await Invoice.findById(mp.appliedToInvoiceId).session(session);
      if (inv) { applyPaymentStatus(inv); await inv.save({ session }); }
    }

    if (mp.creditReleased > 0 && order?.dealerId) await adjustCreditUsed(order.dealerId, mp.creditReleased, session);

    mp.reversedAt = new Date();
    mp.reversedBy = user?.id;
    mp.reversedByName = user?.name || '';
    mp.reversalReason = String(reason || '').trim();
    await entry.save({ session });

    if (order?.dealerId) {
      await Transaction.create([{
        type: 'debit',
        dealerId: order.dealerId,
        amount: Number(mp.amount) || 0,
        ref: { refType: 'payment', refId: mp._id },
        description: `Reversal of offline payment for order ${order.orderNumber}${mp.reversalReason ? ` — ${mp.reversalReason}` : ''}`,
        createdBy: user?.id,
      }], { session });
    }
  });

  if (markedOrderPaid) {
    const after = await loadRow(orderId);
    if (!after.settled) await coll('orders').updateOne({ _id: oid(orderId) }, { $set: { paymentStatus: 'pending' } });
  }
  await setSync(orderId, paymentId, { status: 'pending' });
  syncInBackground(orderId, paymentId);
  return loadRow(orderId);
};

/* ─────────────────────── dealer-app sync (D-BE webhook) ─────────────────────── */

const setSync = (orderId, paymentId, fields) =>
  LedgerEntry.updateOne(
    { orderId: oid(orderId), 'manualPayments._id': oid(paymentId) },
    { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`manualPayments.$.dealerSync.${k}`, v])) }
  );

/**
 * Push one payment's CURRENT state (recorded or reversed) to the dealer app.
 * Safe to call any number of times — D-BE applies each payment at most once and
 * undoes it at most once. Retries a few times; a final failure is left visible
 * on the payment (dealerSync.status 'failed') for a manual retry from the Ledger.
 */
const syncPaymentToDealer = async (orderId, paymentId, { retries = 3 } = {}) => {
  const order = await coll('orders').findOne({ _id: oid(orderId) }, { projection: { dbeOrderId: 1, dealerOrderNumber: 1 } });
  if (!order?.dbeOrderId && !order?.dealerOrderNumber) {
    await setSync(orderId, paymentId, { status: 'n/a' });
    return { status: 'n/a' };
  }
  const DEALER_API_URL = process.env.DEALER_API_URL;
  const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;
  if (!DEALER_API_URL || !WEBHOOK_SECRET) {
    await setSync(orderId, paymentId, { status: 'failed', lastError: 'DEALER_API_URL / DEALER_WEBHOOK_SECRET not configured' });
    return { status: 'failed' };
  }

  let lastError = '';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Re-read every attempt so a retry always sends the latest state
      const entry = await LedgerEntry.findOne({ orderId: oid(orderId) }).lean();
      const mp = (entry?.manualPayments || []).find((p) => String(p._id) === String(paymentId));
      if (!mp) return { status: 'failed' };
      const row = await loadRow(orderId);
      await axios.post(
        `${DEALER_API_URL}/api/orders/webhook/payment-update`,
        {
          ...(order.dbeOrderId ? { dbeOrderId: order.dbeOrderId } : { orderNumber: order.dealerOrderNumber }),
          payment: {
            supplierPaymentId: String(mp._id),
            amount: mp.amount,
            method: mp.method,
            paidOn: mp.paidOn,
            reference: mp.reference,
            reversed: Boolean(mp.reversedAt),
            reversalReason: mp.reversalReason || '',
          },
          settled: row.settled,
          outstanding: row.outstanding,
        },
        { headers: { 'x-webhook-secret': WEBHOOK_SECRET, 'Content-Type': 'application/json' }, timeout: 8000 }
      );
      await setSync(orderId, paymentId, { status: 'synced', attempts: attempt, lastError: '', syncedAt: new Date() });
      return { status: 'synced' };
    } catch (err) {
      lastError = err.response?.data?.message || err.message;
      await setSync(orderId, paymentId, { status: 'failed', attempts: attempt, lastError });
      if (attempt < retries) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  console.error(`[orderPayment] dealer sync failed for order ${orderId} payment ${paymentId}: ${lastError}`);
  return { status: 'failed', lastError };
};

// Background push — the supplier's save never waits on / fails because of the dealer app
const syncInBackground = (orderId, paymentId) => {
  syncPaymentToDealer(orderId, paymentId).catch((e) =>
    console.error('[orderPayment] dealer sync crashed:', e.message));
};

// Manual "Retry" from the Ledger when a sync failed
const resyncPayment = async (orderId, paymentId) => {
  await syncPaymentToDealer(orderId, paymentId, { retries: 1 });
  return loadRow(orderId);
};

module.exports = { recordOrderPayment, reverseOrderPayment, resyncPayment };
