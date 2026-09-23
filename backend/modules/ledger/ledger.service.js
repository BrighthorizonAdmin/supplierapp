const mongoose = require('mongoose');
const LedgerEntry = require('./model/LedgerEntry.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { buildLedgerRows, groupByDealer, summarise } = require('./ledger.aggregator');
const { toCsv, toXlsx } = require('./ledger.export');
const { toPdf } = require('./ledger.pdf');
const { notifyDealer, notifyDueDateChanged } = require('./ledger.notify');
const { proofUrl } = require('./ledger.upload');

const coll = (name) => mongoose.connection.collection(name);
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/* ────────────────────────────── read / list ────────────────────────────── */

// Fully-paid orders are hidden from the main outstanding list. They are pulled in
// for the "Cleared" view (status=cleared) and the "All transactions" view
// (includeSettled=true), which also carries fully-paid cash orders.
const wantsSettled = (query = {}) =>
  query.status === 'cleared' || String(query.includeSettled) === 'true';

const applyRowFilters = (rows, query = {}) => {
  let out = rows;
  if (query.status === 'pending' || query.status === 'partial' || query.status === 'cleared') {
    out = out.filter((r) => r.status === query.status);
  }
  if (query.paymentType === 'credit' || query.paymentType === 'cash') {
    out = out.filter((r) => r.paymentType === query.paymentType);
  }
  if (String(query.overdue) === 'true') out = out.filter((r) => r.overdue);
  if (query.search) {
    const q = query.search.toLowerCase();
    out = out.filter(
      (r) =>
        r.dealerName.toLowerCase().includes(q) ||
        r.dealerCode.toLowerCase().includes(q) ||
        (r.orderNumber || '').toLowerCase().includes(q) ||
        (r.dealerOrderNumber || '').toLowerCase().includes(q) ||
        (r.invoiceNumbers || []).some((n) => String(n).toLowerCase().includes(q))
    );
  }
  return out;
};

/**
 * Dealer-grouped, paginated ledger list. Pagination is applied over dealer
 * groups (one card per dealer), not individual orders.
 */
const getLedger = async (query = {}) => {
  const rows = applyRowFilters(
    await buildLedgerRows({
      dealerId: query.dealerId,
      startDate: query.startDate,
      endDate: query.endDate,
      includeSettled: wantsSettled(query),
    }),
    query
  );

  const groups = groupByDealer(rows);
  const { page, limit, skip } = getPagination(query);
  const pageGroups = groups.slice(skip, skip + limit);

  return {
    data: pageGroups,
    summary: summarise(rows),
    pagination: buildMeta(groups.length, page, limit),
  };
};

const getSummary = async (query = {}) => {
  const rows = applyRowFilters(
    await buildLedgerRows({
      dealerId: query.dealerId,
      startDate: query.startDate,
      endDate: query.endDate,
      includeSettled: wantsSettled(query),
    }),
    query
  );
  return summarise(rows);
};

const getOrderLedger = async (orderId) => {
  // includeSettled: after a final payment the balance is 0 but callers (esp. the
  // mutation endpoints) still need the updated row back rather than a 404.
  const rows = await buildLedgerRows({ orderId, includeSettled: true });
  if (!rows.length) {
    const exists = await coll('orders').findOne({ _id: oid(orderId) }, { projection: { _id: 1 } });
    if (!exists) throw new AppError('Order not found', 404);
    throw new AppError('This order is not eligible for the ledger (cancelled, draft, or non-dealer order)', 409);
  }
  return rows[0];
};

/* ─────────────────────── ledger-entry mutations (isolated) ─────────────────────── */

const ensureEntry = async (orderId, user) => {
  const order = await coll('orders').findOne(
    { _id: oid(orderId) },
    { projection: { dealerId: 1 } }
  );
  if (!order) throw new AppError('Order not found', 404);

  let entry = await LedgerEntry.findOne({ orderId: oid(orderId) });
  if (!entry) {
    entry = await LedgerEntry.create({
      orderId: oid(orderId),
      dealerId: order.dealerId,
      createdBy: user?.id,
    });
  }
  return entry;
};

/**
 * Append a manual (book-keeping) payment. This writes ONLY to `ledgerentries`
 * — the real `payments` collection is never touched, so existing reconciliation
 * and dealer-credit logic are unaffected.
 */
const addManualPayment = async (orderId, body, file, user) => {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('A positive amount is required', 400);
  if (!body.paidOn) throw new AppError('paidOn (payment date) is required', 400);

  // Nothing left to collect on a fully-paid order — another payment would only push
  // "paid" past the order total. (Deleting a wrong entry is still allowed, see
  // deleteManualPayment.) Enforced here as well as in the UI so it can't be bypassed.
  const current = await getOrderLedger(orderId);
  if (current.settled) throw new AppError('This order is already fully paid — no further payment can be recorded', 409);

  const entry = await ensureEntry(orderId, user);
  entry.manualPayments.push({
    amount,
    paidOn: new Date(body.paidOn),
    method: body.method || 'other',
    reference: body.reference || '',
    note: body.note || '',
    screenshotUrl: file ? proofUrl(file.filename) : (body.screenshotUrl || ''),
    recordedBy: user?.id,
    recordedByName: user?.name || '',
    recordedAt: new Date(),
  });
  await entry.save();
  return getOrderLedger(orderId);
};

const deleteManualPayment = async (orderId, paymentId) => {
  const entry = await LedgerEntry.findOne({ orderId: oid(orderId) });
  if (!entry) throw new AppError('Ledger entry not found', 404);
  const before = entry.manualPayments.length;
  entry.manualPayments = entry.manualPayments.filter((p) => String(p._id) !== String(paymentId));
  if (entry.manualPayments.length === before) throw new AppError('Manual payment not found', 404);
  await entry.save();
  return getOrderLedger(orderId);
};

// Calendar-day key so a save that leaves the due date on the same day is not "a change".
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const patchEntry = async (orderId, body, user) => {
  // Effective due date BEFORE the change, so the dealer can be told what it moved from.
  // (Failure here just means no notification — it must not block the save itself.)
  const before =
    body.expectedClearanceDate !== undefined ? await getOrderLedger(orderId).catch(() => null) : null;

  const entry = await ensureEntry(orderId, user);
  if (body.expectedClearanceDate !== undefined) {
    entry.expectedClearanceDate = body.expectedClearanceDate
      ? new Date(body.expectedClearanceDate)
      : undefined;
  }
  if (body.remarks !== undefined) entry.remarks = String(body.remarks);
  await entry.save();
  const row = await getOrderLedger(orderId);

  // Heads-up to the dealer when the due date actually moved. Skipped for remarks-only
  // saves (same effective date) and for fully-paid orders (no due date left to change).
  // Best-effort: a failed notification must not fail the save.
  if (before && !row.settled && dayKey(before.dueDate) !== dayKey(row.dueDate)) {
    try {
      await notifyDueDateChanged({ row, previousDueDate: before.dueDate });
    } catch (err) {
      console.error('[ledger] due-date notification failed:', err.message);
    }
  }

  return row;
};

const addScreenshot = async (orderId, body, file, user) => {
  if (!file) throw new AppError('No file uploaded', 400);
  const entry = await ensureEntry(orderId, user);
  entry.proofScreenshots.push({
    url: proofUrl(file.filename),
    label: body.label || '',
    uploadedAt: new Date(),
    uploadedBy: user?.id,
  });
  await entry.save();
  return getOrderLedger(orderId);
};

const deleteScreenshot = async (orderId, screenshotId) => {
  const entry = await LedgerEntry.findOne({ orderId: oid(orderId) });
  if (!entry) throw new AppError('Ledger entry not found', 404);
  const before = entry.proofScreenshots.length;
  entry.proofScreenshots = entry.proofScreenshots.filter((s) => String(s._id) !== String(screenshotId));
  if (entry.proofScreenshots.length === before) throw new AppError('Screenshot not found', 404);
  await entry.save();
  return getOrderLedger(orderId);
};

/* ────────────────────────────── exports ────────────────────────────── */

const exportLedger = async (query = {}) => {
  const scope = query.scope || 'all';
  const format = (query.format || 'csv').toLowerCase();

  let rows = await buildLedgerRows({
    dealerId: scope === 'dealer' ? query.dealerId : undefined,
    orderId: scope === 'order' ? query.orderId : undefined,
    startDate: query.startDate,
    endDate: query.endDate,
    // A single-order export should still work right after that order is fully
    // settled (e.g. downloading the receipt for the payment you just recorded),
    // and the "Cleared" / "All transactions" exports need settled rows too.
    includeSettled: scope === 'order' || wantsSettled(query),
  });
  rows = applyRowFilters(rows, query);

  if (!rows.length) throw new AppError('Nothing to export for the given selection', 404);

  const stamp = new Date().toISOString().slice(0, 10);
  const scopeName =
    scope === 'dealer'
      ? (rows[0].dealerName || 'dealer').replace(/[^\w-]+/g, '_')
      : scope === 'order'
      ? (rows[0].orderNumber || rows[0].dealerOrderNumber || 'order').replace(/[^\w-]+/g, '_')
      : 'all';
  const base = `ledger_${scopeName}_${stamp}`;

  if (format === 'xlsx') {
    const buffer = await toXlsx(rows, {
      includeTimeline: scope === 'order' || scope === 'dealer',
    });
    return {
      filename: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
    };
  }

  if (format === 'pdf') {
    // Portfolio-level totals (scope 'all') must reflect the SAME filtered rows being
    // exported, not the unfiltered ledger — summarise() over `rows` does that.
    // Company letterhead: the same Settings fields (companyName/Address/Mobile/GSTIN/
    // PAN/Email/Website) the Invoice PDF's letterhead already reads (settings.service.js
    // getSettings()), read here via the raw collection rather than the Settings model to
    // avoid depending on that module — read raw, like every other cross-cutting lookup
    // in this file (dealers, orders, invoices).
    const company = (await coll('settings').findOne({ key: 'global' })) || {};
    const buffer = await toPdf(rows, { scope, summary: scope === 'all' ? summarise(rows) : undefined, company });
    return {
      filename: `${base}.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  return {
    filename: `${base}.csv`,
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from('﻿' + toCsv(rows), 'utf8'),
  };
};

/* ────────────────────────────── notify ────────────────────────────── */

// Append a reminder entry to every affected order's ledger entry.
const logReminder = async (rows, { channel, dealer, result, user }) => {
  const now = new Date();
  await Promise.all(
    rows.map(async (r) => {
      const entry = await ensureEntry(r.orderId, user);
      entry.notifyLog.push({
        channel,
        sentAt: now,
        sentBy: user?.id,
        sentByName: user?.name || '',
        outstandingAtSend: r.outstanding,
        dueDateAtSend: r.dueDate,
        message: result.message,
        emailTo: dealer.email || '',
        ok: (result.app?.ok ?? true) && (result.email?.ok ?? true),
        errorText: result.email?.error || result.app?.error || '',
      });
      await entry.save();
    })
  );
};

const notifyOneDealer = async ({ dealerId, channel = 'both', orderIds, user }) => {
  if (!dealerId) throw new AppError('dealerId is required', 400);

  let rows = await buildLedgerRows({ dealerId });
  if (Array.isArray(orderIds) && orderIds.length) {
    const want = new Set(orderIds.map(String));
    rows = rows.filter((r) => want.has(String(r.orderId)));
  }
  if (!rows.length) throw new AppError('This dealer has no outstanding balance to notify about', 409);

  const dealer = await coll('dealers').findOne({ _id: oid(dealerId) });
  if (!dealer) throw new AppError('Dealer not found', 404);

  const result = await notifyDealer({ dealer, rows, channel });
  await logReminder(rows, { channel, dealer, result, user });

  return {
    dealerId,
    dealerName: dealer.businessName || dealer.ownerName,
    channel,
    orderCount: rows.length,
    totalOutstanding: result.totalOutstanding,
    app: result.app,
    email: result.email,
  };
};

const notifyAllDealers = async ({ channel = 'both', user }) => {
  const rows = await buildLedgerRows({});
  const groups = groupByDealer(rows);
  const results = [];
  for (const g of groups) {
    try {
      results.push(await notifyOneDealer({ dealerId: g.dealerId, channel, user }));
    } catch (err) {
      results.push({ dealerId: g.dealerId, dealerName: g.dealerName, error: err.message });
    }
  }
  return { notified: results.length, results };
};

module.exports = {
  getLedger,
  getSummary,
  getOrderLedger,
  addManualPayment,
  deleteManualPayment,
  patchEntry,
  addScreenshot,
  deleteScreenshot,
  exportLedger,
  notifyOneDealer,
  notifyAllDealers,
};
