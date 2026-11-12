const mongoose = require('mongoose');
const CustomerLedgerEntry = require('./model/CustomerLedgerEntry.model');
const { PAYMENT_METHODS } = require('./model/CustomerLedgerEntry.model');
const { AppError } = require('../../middlewares/error.middleware');
const { proofUrl } = require('../ledger/ledger.upload');
const { sendLedgerEmail } = require('../ledger/ledger.mailer');

/**
 * Customer ledger for Buvvas website (b2c) orders. Read-only over the shared
 * `orders` / `invoices` collections; the only writes go to
 * `customerledgerentries` (COD collections recorded by staff, reminder log).
 *
 * An order counts as paid in full when it was paid online (Razorpay) — on the
 * supplier copy or on the dealer-backend copy it mirrors (shared DB, linked
 * by dbeOrderId). Otherwise (COD) it is paid by what is recorded on its
 * invoice plus the collections recorded here.
 */

const coll = (name) => mongoose.connection.collection(name);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n) => Math.round(num(n) * 100) / 100;
const toOid = (v) => {
  try { return new mongoose.Types.ObjectId(String(v)); } catch { return null; }
};

// Same rule as the dealer ledger: nothing is owed until the supplier accepts the order
const EXCLUDED_ORDER_STATUS = ['draft', 'pending', 'cancelled', 'rejected', 'refunded', 'returned'];
const ONLINE_PAID = ['completed', 'paid', 'success', 'captured'];

const METHOD_LABELS = {
  razorpay: 'Online (Razorpay)', cod: 'Cash on Delivery', cash: 'Cash', upi: 'UPI', neft: 'NEFT',
  rtgs: 'RTGS', imps: 'IMPS', 'bank-transfer': 'Bank Transfer', cheque: 'Cheque', card: 'Card', other: 'Other',
};
const methodLabel = (m) => METHOD_LABELS[String(m || '').toLowerCase()] || (m ? String(m) : '—');

const phone10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const customerKeyOf = (o) => phone10(o.customerPhone)
  || String(o.customerEmail || '').trim().toLowerCase()
  || `name:${String(o.customerName || 'Unknown').trim().toLowerCase()}`;

const formatAddress = (a = {}) =>
  [a.fullAddress || a.street || a.address, a.city, a.state, a.postalCode || a.pincode].filter(Boolean).join(', ');

const isOnlinePaid = (o) => Boolean(o) && (ONLINE_PAID.includes(String(o.paymentStatus || '').toLowerCase()) || Boolean(o.razorpayPaymentId));

/* ───────────────────────────── rows ───────────────────────────── */

async function buildOrderRows({ startDate, endDate, orderId } = {}) {
  const match = {
    orderType: 'b2c',
    dbeOrderId: { $exists: true, $nin: [null, ''] }, // the supplier's copy, not the mirrored one
    status: { $nin: EXCLUDED_ORDER_STATUS },
  };
  if (orderId) match._id = toOid(orderId);
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  const orders = await coll('orders').find(match).sort({ createdAt: -1 }).toArray();
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o._id);
  const dbeIds = orders.map((o) => toOid(o.dbeOrderId)).filter(Boolean);
  const [mirrors, invoices, entries] = await Promise.all([
    dbeIds.length ? coll('orders').find({ _id: { $in: dbeIds } }).toArray() : [],
    coll('invoices').find({ orderId: { $in: orderIds }, status: { $ne: 'cancelled' } }).toArray(),
    CustomerLedgerEntry.find({ orderId: { $in: orderIds } }).lean(),
  ]);
  const mirrorById = new Map(mirrors.map((m) => [String(m._id), m]));
  const entryByOrder = new Map(entries.map((e) => [String(e.orderId), e]));
  const invByOrder = new Map();
  invoices.forEach((inv) => {
    const k = String(inv.orderId);
    const prev = invByOrder.get(k);
    if (!prev || num(inv.amountPaid) > num(prev.amountPaid)) invByOrder.set(k, inv);
  });

  return orders.map((o) => {
    const mirror = mirrorById.get(String(o.dbeOrderId)) || null;
    const inv = invByOrder.get(String(o._id)) || null;
    const entry = entryByOrder.get(String(o._id)) || { payments: [], reminders: [] };
    const total = r2(o.netAmount);
    const method = String(o.paymentMethod || mirror?.paymentMethod || '').toLowerCase();
    const online = isOnlinePaid(o) || isOnlinePaid(mirror);
    const activePayments = (entry.payments || []).filter((p) => !p.reversedAt);
    const recorded = r2(activePayments.reduce((s, p) => s + num(p.amount), 0));
    const invoicePaid = r2(inv?.amountPaid);

    const paid = online ? total : Math.min(total, r2(invoicePaid + recorded));
    const outstanding = r2(Math.max(0, total - paid));
    const status = outstanding <= 0.009 ? 'cleared' : paid > 0 ? 'partial' : 'pending';

    const sources = [];
    if (online) sources.push({ kind: 'online', label: 'Paid online (Razorpay)', amount: total, reference: o.razorpayPaymentId || mirror?.razorpayPaymentId || '' });
    else if (invoicePaid > 0) sources.push({ kind: 'invoice', label: `Recorded on invoice ${inv.invoiceNumber || ''}`.trim(), amount: invoicePaid });

    return {
      orderId: o._id,
      orderNumber: o.orderNumber,
      websiteOrderNumber: o.dealerOrderNumber || '',
      orderDate: o.createdAt,
      orderStatus: o.status,
      invoiceNumber: inv?.invoiceNumber || '',
      invoiceId: inv?._id || null,
      customerKey: customerKeyOf(o),
      customerName: o.customerName || 'Customer',
      customerPhone: o.customerPhone || '',
      customerEmail: o.customerEmail || '',
      customerAddress: formatAddress(o.deliveryAddress || {}),
      paymentMethod: method,
      paymentMethodLabel: methodLabel(method),
      paidOnline: online,
      totalAmount: total,
      paidAmount: r2(paid),
      outstanding,
      status,
      sources,
      payments: (entry.payments || []).map((p) => ({ ...p, methodLabel: methodLabel(p.method) })),
      reminders: entry.reminders || [],
    };
  });
}

const groupByCustomer = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.customerKey)) {
      map.set(r.customerKey, {
        customerKey: r.customerKey,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerEmail: r.customerEmail,
        customerAddress: r.customerAddress,
        orderCount: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0,
        lastOrderDate: r.orderDate,
        orders: [],
      });
    }
    const g = map.get(r.customerKey);
    g.orders.push(r);
    g.orderCount += 1;
    g.totalAmount = r2(g.totalAmount + r.totalAmount);
    g.totalPaid = r2(g.totalPaid + r.paidAmount);
    g.totalOutstanding = r2(g.totalOutstanding + r.outstanding);
    if (!g.customerEmail && r.customerEmail) g.customerEmail = r.customerEmail;
    if (new Date(r.orderDate) > new Date(g.lastOrderDate)) g.lastOrderDate = r.orderDate;
  });
  return [...map.values()].map((g) => ({ ...g, status: g.totalOutstanding > 0.009 ? 'due' : 'paid' }));
};

const summarize = (groups) => ({
  customers: groups.length,
  customersWithDues: groups.filter((g) => g.status === 'due').length,
  totalAmount: r2(groups.reduce((s, g) => s + g.totalAmount, 0)),
  totalPaid: r2(groups.reduce((s, g) => s + g.totalPaid, 0)),
  totalOutstanding: r2(groups.reduce((s, g) => s + g.totalOutstanding, 0)),
});

const filterGroups = (groups, { status, search } = {}) => {
  let out = groups;
  if (status === 'due' || status === 'paid') out = out.filter((g) => g.status === status);
  const q = String(search || '').trim().toLowerCase();
  if (q) {
    out = out.filter((g) => [g.customerName, g.customerPhone, g.customerEmail, ...g.orders.map((o) => o.orderNumber), ...g.orders.map((o) => o.websiteOrderNumber)]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }
  return out.sort((a, b) => b.totalOutstanding - a.totalOutstanding || new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
};

/* ───────────────────────────── reads ───────────────────────────── */

const getCustomers = async (query = {}) => {
  const groups = filterGroups(groupByCustomer(await buildOrderRows(query)), query);
  return { data: groups.map(({ orders, ...g }) => g), summary: summarize(groups) };
};

const getCustomer = async (customerKey, query = {}) => {
  const group = groupByCustomer(await buildOrderRows(query)).find((g) => g.customerKey === customerKey);
  if (!group) throw new AppError('Customer not found in the ledger', 404);
  return group;
};

const getOrderRow = async (orderId) => {
  const [row] = await buildOrderRows({ orderId });
  if (!row) throw new AppError('Buvvas order not found in the customer ledger', 404);
  return row;
};

/* ───────────────────────────── payments ───────────────────────────── */

const readPaymentBody = (body = {}, file) => {
  const amount = r2(body.amount);
  if (!(amount > 0)) throw new AppError('Enter an amount greater than 0', 400);
  const method = String(body.method || 'cash').toLowerCase();
  if (!PAYMENT_METHODS.includes(method)) throw new AppError(`Invalid payment method: ${method}`, 400);
  const paidOn = body.paidOn ? new Date(body.paidOn) : new Date();
  if (Number.isNaN(paidOn.getTime())) throw new AppError('Invalid payment date', 400);
  const out = { amount, method, paidOn, reference: String(body.reference || '').trim(), note: String(body.note || '').trim() };
  if (file) out.screenshotUrl = proofUrl(file.filename);
  return out;
};

const userName = (user) => user?.name || user?.fullName || user?.email || '';

const addPayment = async (orderId, body, file, user) => {
  const row = await getOrderRow(orderId);
  if (row.paidOnline) throw new AppError('This order was already paid online', 400);
  const p = readPaymentBody(body, file);
  if (p.amount > row.outstanding + 0.01) throw new AppError(`Amount is more than the balance due (₹${row.outstanding})`, 400);

  await CustomerLedgerEntry.updateOne(
    { orderId: row.orderId },
    { $push: { payments: { ...p, recordedBy: user?._id, recordedByName: userName(user), recordedAt: new Date() } } },
    { upsert: true, runValidators: true }
  );
  return getOrderRow(orderId);
};

const editPayment = async (orderId, paymentId, body, file, user) => {
  const row = await getOrderRow(orderId);
  const existing = row.payments.find((x) => String(x._id) === String(paymentId));
  if (!existing) throw new AppError('Payment not found', 404);
  if (existing.reversedAt) throw new AppError('This payment was undone and cannot be edited', 400);
  const p = readPaymentBody(body, file);
  if (p.amount > row.outstanding + num(existing.amount) + 0.01) {
    throw new AppError(`Amount is more than the balance due (₹${r2(row.outstanding + num(existing.amount))})`, 400);
  }

  const set = {
    'payments.$.amount': p.amount,
    'payments.$.method': p.method,
    'payments.$.paidOn': p.paidOn,
    'payments.$.reference': p.reference,
    'payments.$.note': p.note,
    'payments.$.editedBy': user?._id,
    'payments.$.editedByName': userName(user),
    'payments.$.editedAt': new Date(),
  };
  if (p.screenshotUrl) set['payments.$.screenshotUrl'] = p.screenshotUrl;
  await CustomerLedgerEntry.updateOne({ orderId: row.orderId, 'payments._id': toOid(paymentId) }, { $set: set }, { runValidators: true });
  return getOrderRow(orderId);
};

const reversePayment = async (orderId, paymentId, reason, user) => {
  const row = await getOrderRow(orderId);
  const existing = row.payments.find((x) => String(x._id) === String(paymentId));
  if (!existing) throw new AppError('Payment not found', 404);
  if (existing.reversedAt) throw new AppError('This payment was already undone', 400);
  await CustomerLedgerEntry.updateOne(
    { orderId: row.orderId, 'payments._id': toOid(paymentId) },
    { $set: {
      'payments.$.reversedAt': new Date(),
      'payments.$.reversedBy': user?._id,
      'payments.$.reversedByName': userName(user),
      'payments.$.reversalReason': String(reason || '').trim(),
    } }
  );
  return getOrderRow(orderId);
};

/* ───────────────────────────── reminder email ───────────────────────────── */

const inr = (n) => `₹${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const remindCustomer = async (customerKey, user) => {
  const group = await getCustomer(customerKey);
  const due = group.orders.filter((o) => o.outstanding > 0.009);
  if (!due.length) throw new AppError('This customer has no pending dues', 400);
  if (!group.customerEmail) throw new AppError('This customer has no email address on file', 400);

  const rowsHtml = due.map((o) => `<tr>
    <td style="padding:6px 10px;border:1px solid #e5e7eb">${esc(o.websiteOrderNumber || o.orderNumber)}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb">${esc(fmtDate(o.orderDate))}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${esc(inr(o.totalAmount))}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${esc(inr(o.paidAmount))}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${esc(inr(o.outstanding))}</td>
  </tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <p>Dear ${esc(group.customerName)},</p>
    <p>Thank you for shopping with Buvvas. Our records show the following amount is still due on your order(s):</p>
    <table style="border-collapse:collapse;margin:12px 0">
      <tr style="background:#f3f4f6"><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Order</th><th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Date</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Amount</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Paid</th><th style="padding:6px 10px;border:1px solid #e5e7eb">Due</th></tr>
      ${rowsHtml}
    </table>
    <p><b>Total due: ${esc(inr(group.totalOutstanding))}</b></p>
    <p>If you have already paid, please ignore this email. For any questions, just reply to this message.</p>
    <p>Regards,<br/>Team Buvvas</p>
  </div>`;
  const text = `Dear ${group.customerName}, the total due on your Buvvas order(s) is ${inr(group.totalOutstanding)}. `
    + due.map((o) => `${o.websiteOrderNumber || o.orderNumber}: ${inr(o.outstanding)}`).join('; ');

  const result = await sendLedgerEmail({ to: group.customerEmail, subject: 'Buvvas — payment due on your order', html, text });
  if (!result.ok) throw new AppError(`Email not sent: ${result.error}`, 502);

  await Promise.all(due.map((o) => CustomerLedgerEntry.updateOne(
    { orderId: o.orderId },
    { $push: { reminders: { sentAt: new Date(), sentBy: user?._id, sentByName: userName(user), emailTo: group.customerEmail, outstandingAtSend: o.outstanding } } },
    { upsert: true }
  )));
  return { emailTo: group.customerEmail, outstanding: group.totalOutstanding, orders: due.length };
};

module.exports = {
  buildOrderRows, groupByCustomer, filterGroups, summarize,
  getCustomers, getCustomer, getOrderRow,
  addPayment, editPayment, reversePayment, remindCustomer,
  methodLabel,
};
