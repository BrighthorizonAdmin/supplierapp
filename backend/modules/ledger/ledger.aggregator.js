const mongoose = require('mongoose');
const { addDays } = require('date-fns');

/**
 * ledger.aggregator — derives the outstanding-dues ledger LIVE from the existing
 * `orders`, `invoices` and `payments` collections. It performs READS ONLY and
 * never writes to those collections. Cross-app documents (written by D-BE) are
 * read through the raw collection driver so every field is visible regardless of
 * which app's Mongoose schema created them.
 *
 * A ledger row is produced for every dealer order that still has money owed
 * (status pending or partial). Fully-paid orders — including orders paid up
 * front in cash — are excluded unless includeSettled is passed. Each row carries
 * a paymentType ('credit' | 'cash') so callers can filter on it.
 */

const coll = (name) => mongoose.connection.collection(name);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const oid = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

// 'pending' (awaiting the supplier's Accept/Reject decision) is excluded on
// purpose: the rest of the app never creates an invoice / payment obligation
// until the order is confirmed (see order.service.js's confirm flow), so an
// order that might still be rejected should never show up here as money owed.
const EXCLUDED_ORDER_STATUS = ['draft', 'pending', 'cancelled', 'rejected', 'refunded', 'returned'];
const PAID_PAYMENT_STATES = ['confirmed', 'completed', 'success', 'captured', 'paid', 'processing'];

const METHOD_LABELS = {
  'bank-transfer': 'Bank Transfer', 'wire-transfer': 'Wire Transfer',
  upi: 'UPI', cash: 'Cash', cheque: 'Cheque', neft: 'NEFT', rtgs: 'RTGS',
  imps: 'IMPS', card: 'Card', cod: 'COD', razorpay: 'Razorpay', split: 'Split (Pay Now + Credit)',
  'net-30': 'Net 30', 'net-45': 'Net 45', 'net-60': 'Net 60', 'net-90': 'Net 90',
  other: 'Other',
};
const methodLabel = (m) => METHOD_LABELS[m] || (m ? String(m) : '—');

// "Credit-based" = the dealer was allowed to pay later: a net-terms order, or a
// split order (which always leaves a credit portion at placement, even once that
// portion is later paid off). Everything else is paid up front — cash / UPI /
// card / bank transfer / COD — and is "cash".
const paymentTypeOf = (order, isSplit) =>
  isSplit || /^net-\d+$/i.test(String(order.paymentMethod || '')) ? 'credit' : 'cash';

// The `dealers` collection is shared and written by BOTH apps with different field
// names, so dealer docs are read raw and each detail below falls back to the
// dealer-app (D-BE) name: dealerCode|dealerId, ownerName|name, phone|mobile,
// gstNumber|gstin. Address is a sub-document on supplier-created dealers
// (street/city/state/pincode) but flat top-level strings on dealer-app ones
// (address = street, plus city / state / pinCode).
const formatAddress = (dealer) => {
  const a = dealer.address;
  if (a && typeof a === 'object') {
    return [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  }
  return [a, dealer.city, dealer.state, dealer.pinCode || dealer.pincode].filter(Boolean).join(', ');
};

const isSbeInvoice = (inv) => typeof inv.totalAmount === 'number';
const isDbeInvoice = (inv) => !isSbeInvoice(inv) && typeof inv.amount === 'number';

/**
 * @param {object} opts
 * @param {string} [opts.dealerId]         restrict to one dealer
 * @param {string} [opts.orderId]          restrict to one order
 * @param {string} [opts.startDate]        order.createdAt >= this
 * @param {string} [opts.endDate]          order.createdAt <= this
 * @param {boolean} [opts.includeSettled]  keep rows whose balance is now 0
 * @returns {Promise<object[]>} flat array of ledger rows
 */
async function buildLedgerRows(opts = {}) {
  const { dealerId, orderId, startDate, endDate, includeSettled = false } = opts;

  const orderMatch = {
    dealerId: { $exists: true, $ne: null },
    orderType: { $ne: 'b2c' },
    status: { $nin: EXCLUDED_ORDER_STATUS },
  };
  if (orderId) {
    // A specific order was asked for — return it regardless of which of the
    // two shared-collection copies it is.
    orderMatch._id = oid(orderId);
  } else {
    // D-BE mirrors every dealer-app order into this same `orders` collection
    // (see webhooks/dealer-order), creating a second document with a
    // D-BE-native orderNumber (ORD-{13-digit timestamp}-{seq}) alongside the
    // S-BE copy (ORD-{8-digit date}-{seq}) the supplier actually manages.
    // Exclude the D-BE-native duplicate so one dealer order isn't counted
    // twice — same pattern already used by order.service.js / dashboard.service.js.
    orderMatch.orderNumber = { $not: /^ORD-\d{13}-\d+$/ };
  }
  if (dealerId) orderMatch.dealerId = oid(dealerId);
  if (startDate || endDate) {
    orderMatch.createdAt = {};
    if (startDate) orderMatch.createdAt.$gte = new Date(startDate);
    if (endDate) orderMatch.createdAt.$lte = new Date(endDate);
  }

  const orders = await coll('orders').find(orderMatch).sort({ createdAt: -1 }).toArray();
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o._id);
  const dealerIds = [...new Set(orders.map((o) => String(o.dealerId)))].map(oid);

  const [invoices, dealers, ledgerEntries] = await Promise.all([
    coll('invoices').find({ orderId: { $in: orderIds } }).toArray(),
    coll('dealers').find({ _id: { $in: dealerIds } }).toArray(),
    coll('ledgerentries').find({ orderId: { $in: orderIds } }).toArray(),
  ]);

  const invoiceIds = invoices.map((i) => i._id);
  const payments = await coll('payments')
    .find({
      $or: [
        { orderId: { $in: orderIds } },
        invoiceIds.length ? { 'allocations.invoiceId': { $in: invoiceIds } } : { _id: null },
      ],
    })
    .toArray();

  const dealerById = new Map(dealers.map((d) => [String(d._id), d]));
  const ledgerByOrder = new Map(ledgerEntries.map((l) => [String(l.orderId), l]));
  const invoicesByOrder = new Map();
  for (const inv of invoices) {
    const k = String(inv.orderId);
    if (!invoicesByOrder.has(k)) invoicesByOrder.set(k, []);
    invoicesByOrder.get(k).push(inv);
  }

  const rows = [];

  for (const order of orders) {
    const dealer = dealerById.get(String(order.dealerId)) || {};
    const invs = invoicesByOrder.get(String(order._id)) || [];
    const ledger = ledgerByOrder.get(String(order._id)) || null;

    const net = num(order.netAmount);
    const isSplit =
      order.paymentMethod === 'split' ||
      num(order.splitCreditAmount) > 0 ||
      num(order.splitPayNowAmount) > 0;
    // Authoritative "pay now at checkout" amount for split orders — set once at
    // order placement and never revised. Kept separate from the credit/invoice
    // side below so it can be ADDED rather than reconciled via max(), since it
    // describes genuinely different money than the credit portion.
    const payNowComponent = isSplit ? num(order.splitPayNowAmount) : 0;

    const timeline = [];

    // ── 1. Gateway / direct payments that carry orderId (mostly D-BE) ──
    // For split orders, D-BE creates a Payment record for the pay-now leg at
    // order placement (routes/orders.js) with this same orderId, so it is
    // usually already included here.
    let gatewayPaid = 0;
    for (const p of payments) {
      if (!p.orderId || String(p.orderId) !== String(order._id)) continue;
      if (!PAID_PAYMENT_STATES.includes(String(p.status || '').toLowerCase())) continue;
      gatewayPaid += num(p.amount);
      timeline.push({
        date: p.processedAt || p.confirmedAt || p.createdAt,
        amount: num(p.amount),
        method: p.method,
        methodLabel: methodLabel(p.method),
        kind: 'gateway',
        source: 'system',
        reference: p.gatewayTransactionId || p.transactionId || p.reference || '',
      });
    }

    // ── 2. Split pay-now shortfall — only synthesize a line for the part NOT
    //      already covered by a real payment record above. On the S-BE mirror
    //      copy of a dealer-app order, the D-BE Payment for this leg carries the
    //      D-BE-native order's _id (not this mirror's), so gatewayPaid is often
    //      0 here even though the money was genuinely collected — this line
    //      makes sure it is still counted exactly once, either way.
    if (payNowComponent > gatewayPaid + 0.01) {
      timeline.push({
        date: order.createdAt,
        amount: +(payNowComponent - gatewayPaid).toFixed(2),
        method: order.paymentMethod || 'split',
        methodLabel: 'Split — Pay Now',
        kind: 'split-paynow',
        source: 'system',
        reference: '',
      });
    }

    // ── 3. S-BE payment allocations against this order's invoices ──
    const myInvoiceIds = new Set(invs.map((i) => String(i._id)));
    let allocationPaid = 0;
    for (const p of payments) {
      if (!Array.isArray(p.allocations) || !p.allocations.length) continue;
      if (String(p.status || '').toLowerCase() !== 'confirmed') continue;
      for (const a of p.allocations) {
        if (!myInvoiceIds.has(String(a.invoiceId))) continue;
        allocationPaid += num(a.amount);
        timeline.push({
          date: p.confirmedAt || p.createdAt,
          amount: num(a.amount),
          method: p.method,
          methodLabel: methodLabel(p.method),
          kind: 'invoice-allocation',
          source: 'system',
          reference: p.transactionId || p.chequeNumber || p.reference || '',
        });
      }
    }

    // ── 4. Invoice-recorded payments (fallback / reconciliation floor) ──
    let paidFromInvoices = 0;
    const invoiceNumbers = [];
    let earliestInvoiceDue = null;
    for (const inv of invs) {
      if (inv.invoiceNumber) invoiceNumbers.push(inv.invoiceNumber);
      else if (inv.invoiceId) invoiceNumbers.push(inv.invoiceId);
      if (inv.dueDate) {
        const d = new Date(inv.dueDate);
        if (!earliestInvoiceDue || d < earliestInvoiceDue) earliestInvoiceDue = d;
      }
      if (isSbeInvoice(inv)) {
        paidFromInvoices += num(inv.amountPaid);
      } else if (isDbeInvoice(inv)) {
        if (String(inv.status || '').toUpperCase() === 'PAID') paidFromInvoices += num(inv.amount);
      }
    }

    // Offline payments recorded through orderPayment.service were ALSO added to
    // the S-BE invoice's amountPaid. Take them back out here so everything below
    // sees exactly what it did before, and they're counted once — as manual
    // payments in step 6.
    const manualOnInvoice = (ledger?.manualPayments || [])
      .filter((mp) => !mp.reversedAt && mp.appliedToInvoiceId)
      .reduce((s, mp) => s + num(mp.amount), 0);
    paidFromInvoices = Math.max(0, paidFromInvoices - manualOnInvoice);

    // ── 5. Order flagged completed but no granular record found ──
    let markedPaid = 0;
    if (
      !isSplit &&
      gatewayPaid === 0 &&
      allocationPaid === 0 &&
      paidFromInvoices === 0 &&
      manualOnInvoice === 0 && // completed status may have been set BY those payments
      ['completed', 'paid'].includes(String(order.paymentStatus || '').toLowerCase())
    ) {
      markedPaid = net;
      timeline.push({
        date: order.updatedAt || order.createdAt,
        amount: net,
        method: order.paymentMethod || '',
        methodLabel: methodLabel(order.paymentMethod),
        kind: 'order-marked-paid',
        source: 'system',
        reference: '',
      });
    }

    // ── 6. Manual (offline) payments — never in `payments` ──
    // Reversed ones are kept for history but count for nothing.
    let manualPaid = 0;
    for (const mp of ledger?.manualPayments || []) {
      if (mp.reversedAt) continue;
      manualPaid += num(mp.amount);
      timeline.push({
        date: mp.paidOn,
        amount: num(mp.amount),
        method: mp.method,
        methodLabel: methodLabel(mp.method),
        kind: 'manual',
        source: 'ledger',
        reference: mp.reference || '',
        note: mp.note || '',
        screenshotUrl: mp.screenshotUrl || '',
        recordedByName: mp.recordedByName || '',
      });
    }

    // ── Combine ──
    // When an S-BE invoice exists for this order, order.service.js's confirm
    // flow already SEEDED its amountPaid with the split pay-now leg at
    // creation, and it is added to (never overwritten) as the credit portion
    // gets paid — so paidFromInvoices already represents the FULL total, not
    // just the credit slice. Adding payNowComponent again on top of it would
    // double-count. Use it as a safety floor instead (in case the invoice
    // hasn't caught up yet), not an addend.
    const hasSbeInvoice = invs.some(isSbeInvoice);
    const creditPaymentsSide = Math.max(0, gatewayPaid - payNowComponent) + allocationPaid;
    const systemPaid = hasSbeInvoice
      ? Math.max(paidFromInvoices, payNowComponent, creditPaymentsSide, markedPaid)
      : Math.max(payNowComponent + creditPaymentsSide, markedPaid);

    // Timeline entries pushed above already account for max(gatewayPaid,
    // payNowComponent) [branches 1+2] + allocationPaid [branch 3] + markedPaid
    // [branch 5]. If invoice bookkeeping shows more paid than that, add one
    // reconciling entry for the difference so totals still foot.
    const explainedViaTimeline = Math.max(gatewayPaid, payNowComponent) + allocationPaid + markedPaid;
    const unexplained = systemPaid - explainedViaTimeline;
    if (unexplained > 0.01) {
      timeline.push({
        date: earliestInvoiceDue || order.updatedAt || order.createdAt,
        amount: +unexplained.toFixed(2),
        method: '',
        methodLabel: 'Recorded against invoice',
        kind: 'invoice-recorded',
        source: 'system',
        reference: invoiceNumbers.join(', '),
      });
    }

    const paidAmount = +(systemPaid + manualPaid).toFixed(2);
    const outstanding = +Math.min(Math.max(net - paidAmount, 0), net).toFixed(2);

    const settled = outstanding <= 0.01;
    if (settled && !includeSettled) continue; // fully settled — not a ledger row

    timeline.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const lastPayment = [...timeline].reverse().find((t) => t.amount > 0);

    // ── Due / clear-by date resolution ──
    const creditDays = num(dealer.creditPeriodDays) || 30;
    const dueDate =
      (ledger && ledger.expectedClearanceDate && new Date(ledger.expectedClearanceDate)) ||
      earliestInvoiceDue ||
      (order.dueDate && new Date(order.dueDate)) ||
      addDays(new Date(order.createdAt), creditDays);

    const now = new Date();
    const overdue = dueDate < now;
    const overdueDays = overdue
      ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
      : 0;

    rows.push({
      orderId: order._id,
      orderNumber: order.orderNumber || '',
      dealerOrderNumber: order.dealerOrderNumber || '',
      orderDate: order.createdAt,
      source: order.dbeOrderId ? 'dealer-app' : 'supplier',

      dealerId: order.dealerId,
      dealerName: dealer.businessName || dealer.ownerName || '—',
      dealerCode: String(dealer.dealerCode || dealer.dealerId || ''),
      dealerEmail: dealer.email || '',
      dealerPhone: String(dealer.phone || dealer.mobile || ''),
      dealerOwnerName: dealer.ownerName || dealer.name || '',
      dealerGst: dealer.gstNumber || dealer.gstin || '',
      dealerAddress: formatAddress(dealer),

      paymentMethod: order.paymentMethod || '',
      paymentMethodLabel: methodLabel(order.paymentMethod),
      paymentType: paymentTypeOf(order, isSplit),
      paymentStatusRaw: order.paymentStatus || '',
      isSplit,
      splitPayNowAmount: num(order.splitPayNowAmount),
      splitCreditAmount: num(order.splitCreditAmount),

      totalAmount: +net.toFixed(2),
      systemPaid: +systemPaid.toFixed(2),
      manualPaid: +manualPaid.toFixed(2),
      paidAmount,
      outstanding,

      status: settled ? 'cleared' : paidAmount > 0.01 ? 'partial' : 'pending',
      settled,
      dueDate,
      overdue: settled ? false : overdue,
      overdueDays: settled ? 0 : overdueDays,
      lastPaymentDate: lastPayment ? lastPayment.date : null,

      invoiceNumbers,
      timeline,

      ledger: ledger
        ? {
            _id: ledger._id,
            expectedClearanceDate: ledger.expectedClearanceDate || null,
            remarks: ledger.remarks || '',
            proofScreenshots: ledger.proofScreenshots || [],
            manualPayments: ledger.manualPayments || [],
            notifyLog: ledger.notifyLog || [],
          }
        : null,
    });
  }

  return rows;
}

/**
 * Group flat rows by dealer with per-dealer subtotals.
 */
function groupByDealer(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r.dealerId);
    if (!map.has(k)) {
      map.set(k, {
        dealerId: r.dealerId,
        dealerName: r.dealerName,
        dealerCode: r.dealerCode,
        dealerEmail: r.dealerEmail,
        dealerPhone: r.dealerPhone,
        orderCount: 0,
        totalOutstanding: 0,
        totalBilled: 0,
        totalPaid: 0,
        partialCount: 0,
        pendingCount: 0,
        clearedCount: 0,
        overdueCount: 0,
        oldestDueDate: null,
        orders: [],
      });
    }
    const g = map.get(k);
    g.orderCount += 1;
    g.totalOutstanding += r.outstanding;
    g.totalBilled += r.totalAmount;
    g.totalPaid += r.paidAmount;
    if (r.status === 'partial') g.partialCount += 1;
    else if (r.status === 'pending') g.pendingCount += 1;
    else if (r.status === 'cleared') g.clearedCount += 1;
    if (r.overdue) g.overdueCount += 1;
    if (!g.oldestDueDate || new Date(r.dueDate) < new Date(g.oldestDueDate)) g.oldestDueDate = r.dueDate;
    g.orders.push(r);
  }
  const groups = [...map.values()].map((g) => ({
    ...g,
    totalOutstanding: +g.totalOutstanding.toFixed(2),
    totalBilled: +g.totalBilled.toFixed(2),
    totalPaid: +g.totalPaid.toFixed(2),
  }));
  groups.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  return groups;
}

/**
 * Portfolio-level totals for summary cards.
 */
function summarise(rows) {
  const dealerSet = new Set(rows.map((r) => String(r.dealerId)));
  return {
    totalOutstanding: +rows.reduce((s, r) => s + r.outstanding, 0).toFixed(2),
    totalBilled: +rows.reduce((s, r) => s + r.totalAmount, 0).toFixed(2),
    totalPaid: +rows.reduce((s, r) => s + r.paidAmount, 0).toFixed(2),
    orderCount: rows.length,
    dealerCount: dealerSet.size,
    partialCount: rows.filter((r) => r.status === 'partial').length,
    pendingCount: rows.filter((r) => r.status === 'pending').length,
    clearedCount: rows.filter((r) => r.status === 'cleared').length,
    creditCount: rows.filter((r) => r.paymentType === 'credit').length,
    cashCount: rows.filter((r) => r.paymentType === 'cash').length,
    overdueCount: rows.filter((r) => r.overdue).length,
    overdueOutstanding: +rows.filter((r) => r.overdue).reduce((s, r) => s + r.outstanding, 0).toFixed(2),
  };
}

module.exports = { buildLedgerRows, groupByDealer, summarise, methodLabel };
