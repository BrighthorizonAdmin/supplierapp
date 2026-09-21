const mongoose = require('mongoose');
const { sendLedgerEmail } = require('./ledger.mailer');

/**
 * Dealer-facing notifications.
 *
 * S-BE and D-BE share the same MongoDB (`dealer_app`) and the same
 * `notifications` collection. D-BE dealer notifications are documents shaped
 * like { dealerId, type, title, message, isRead, data }. We insert exactly that
 * shape via the raw collection driver so we neither touch D-BE code nor trip the
 * S-BE Notification model's `recipientId` requirement.
 *
 * `PAYMENT_UPDATE` is already an allowed type in D-BE's Notification schema, so
 * the dealer app renders these with no change.
 */

const notificationsColl = () => mongoose.connection.collection('notifications');

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Build the dealer-facing summary text from computed ledger rows.
 */
const buildSummary = (dealerName, rows) => {
  const totalOutstanding = rows.reduce((s, r) => s + (r.outstanding || 0), 0);
  const partial = rows.filter((r) => r.status === 'partial');
  const pending = rows.filter((r) => r.status === 'pending');

  const orderWord = rows.length === 1 ? 'order' : `${rows.length} orders`;
  const lines = [];
  lines.push(`Dear ${dealerName || 'Dealer'},`);
  lines.push('');
  lines.push(`This is a reminder of your total outstanding balance with us — ${inr(totalOutstanding)} due across ${orderWord}.`);

  if (partial.length) {
    lines.push('');
    lines.push(`Partially paid orders (${partial.length}):`);
    partial.forEach((r) => {
      lines.push(
        `  • ${r.orderNumber || r.dealerOrderNumber || r.orderId} — order total ${inr(r.totalAmount)}, ` +
        `paid so far ${inr(r.paidAmount)} (last payment ${fmtDate(r.lastPaymentDate)}), ` +
        `balance ${inr(r.outstanding)} due by ${fmtDate(r.dueDate)}.`
      );
    });
  }

  if (pending.length) {
    lines.push('');
    lines.push(`Unpaid orders (${pending.length}):`);
    pending.forEach((r) => {
      lines.push(
        `  • ${r.orderNumber || r.dealerOrderNumber || r.orderId} — placed ${fmtDate(r.orderDate)}, ` +
        `amount ${inr(r.outstanding)} to be cleared by ${fmtDate(r.dueDate)}.`
      );
    });
  }

  lines.push('');
  lines.push('Please arrange payment before the due dates shown above. If you have already paid, kindly ignore this message.');
  lines.push('');
  lines.push('Thank you.');

  return { text: lines.join('\n'), totalOutstanding };
};

const buildEmailHtml = (dealerName, rows) => {
  const totalOutstanding = rows.reduce((s, r) => s + (r.outstanding || 0), 0);
  const rowHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb">${r.orderNumber || r.dealerOrderNumber || ''}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-transform:capitalize">${r.status}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right">${inr(r.totalAmount)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right">${inr(r.paidAmount)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${inr(r.outstanding)}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtDate(r.dueDate)}</td>
      </tr>`
    )
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#1d4ed8;margin:0 0 4px">Payment Reminder</h2>
    <p style="color:#334155">Dear <strong>${dealerName || 'Dealer'}</strong>,</p>
    <p style="color:#334155">You have a total outstanding balance of
      <strong>${inr(totalOutstanding)}</strong> across ${rows.length} order(s). Details below.</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;color:#334155;margin:12px 0">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left">Order</th>
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left">Status</th>
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right">Order Total</th>
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right">Paid</th>
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right">Outstanding</th>
          <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left">Clear By</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px">If you have already made these payments, please ignore this email.</p>
  </div>`;
};

/**
 * Insert one dealer-facing in-app notification.
 */
const pushDealerAppNotification = async ({ dealerId, title, message, data = {} }) => {
  const now = new Date();
  await notificationsColl().insertOne({
    dealerId: new mongoose.Types.ObjectId(dealerId),
    type: 'PAYMENT_UPDATE',
    title,
    message,
    isRead: false,
    data: { source: 'ledger', ...data },
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * Tell a dealer that the supplier moved the due date of one of their orders.
 * In-app only. Deliberately carries no supplier remarks — those are internal
 * notes and are stripped from everything the dealer sees.
 *
 * @param {object} p.row              the order's ledger row AFTER the change
 * @param {Date}   p.previousDueDate  the effective due date BEFORE the change
 */
const notifyDueDateChanged = async ({ row, previousDueDate }) => {
  // The dealer knows the order by their own (dealer-app) number, not the supplier copy's.
  const orderNo = row.dealerOrderNumber || row.orderNumber;
  await pushDealerAppNotification({
    dealerId: row.dealerId,
    title: 'Payment due date updated',
    message:
      `Order ${orderNo}: your remaining ${inr(row.outstanding)} is now due by ${fmtDate(row.dueDate)} ` +
      `(previously ${fmtDate(previousDueDate)}).`,
    data: {
      event: 'due-date-changed',
      orderNumbers: [orderNo],
      totalOutstanding: row.outstanding,
      dueDate: row.dueDate,
      previousDueDate,
    },
  });
};

/**
 * Notify one dealer about their outstanding ledger rows.
 * channel: 'app' | 'email' | 'both'
 * Returns { app: {ok}, email: {ok, error}, message, totalOutstanding }.
 */
const notifyDealer = async ({ dealer, rows, channel = 'both' }) => {
  const dealerName = dealer.businessName || dealer.ownerName || 'Dealer';
  const { text, totalOutstanding } = buildSummary(dealerName, rows);

  const orderWord = rows.length === 1 ? '1 order' : `${rows.length} orders`;
  const title = `Payment reminder — ${inr(totalOutstanding)} outstanding`;
  const appMessage = `You have a total outstanding balance of ${inr(totalOutstanding)} across ${orderWord}. Please review your payment schedule.`;
  const subject = `Payment Reminder — ${inr(totalOutstanding)} outstanding`;

  const result = { app: null, email: null, message: text, totalOutstanding, scope: 'dealer' };

  if (channel === 'app' || channel === 'both') {
    try {
      await pushDealerAppNotification({
        dealerId: dealer._id,
        title,
        message: appMessage,
        data: {
          totalOutstanding,
          orderNumbers: rows.map((r) => r.orderNumber || r.dealerOrderNumber).filter(Boolean),
        },
      });
      result.app = { ok: true };
    } catch (err) {
      console.error('[ledger.notify] app notification failed:', err.message);
      result.app = { ok: false, error: err.message };
    }
  }

  if (channel === 'email' || channel === 'both') {
    result.email = await sendLedgerEmail({
      to: dealer.email,
      subject,
      text,
      html: buildEmailHtml(dealerName, rows),
    });
  }

  return result;
};

module.exports = { notifyDealer, notifyDueDateChanged, buildSummary };
