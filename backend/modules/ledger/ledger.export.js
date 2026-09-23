const ExcelJS = require('exceljs');

/**
 * Ledger exports — CSV (dependency-free) and XLSX (exceljs).
 * Pure formatters over the rows produced by ledger.aggregator; no DB access.
 */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const COLUMNS = [
  { header: 'Dealer', key: 'dealerName', width: 26 },
  { header: 'Dealer Code', key: 'dealerCode', width: 14 },
  { header: 'Owner Name', key: 'dealerOwnerName', width: 22 },
  { header: 'Phone', key: 'dealerPhone', width: 16 },
  { header: 'Email', key: 'dealerEmail', width: 28 },
  { header: 'GST Number', key: 'dealerGst', width: 20 },
  { header: 'Address', key: 'dealerAddress', width: 40 },
  { header: 'Order No', key: 'orderNumber', width: 18 },
  { header: 'Dealer Order No', key: 'dealerOrderNumber', width: 18 },
  { header: 'Order Date', key: 'orderDate', width: 14 },
  { header: 'Source', key: 'source', width: 12 },
  { header: 'Payment Method', key: 'paymentMethodLabel', width: 18 },
  { header: 'Payment Type', key: 'paymentTypeLabel', width: 14 },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Order Total', key: 'totalAmount', width: 14 },
  { header: 'Paid', key: 'paidAmount', width: 14 },
  { header: 'Outstanding', key: 'outstanding', width: 14 },
  { header: 'Due / Clear By', key: 'dueDate', width: 14 },
  { header: 'Overdue Days', key: 'overdueDays', width: 13 },
  { header: 'Last Payment', key: 'lastPaymentDate', width: 14 },
  { header: 'Invoice No(s)', key: 'invoiceNumbers', width: 22 },
  { header: 'Remarks', key: 'remarks', width: 30 },
];

const toFlat = (r) => ({
  dealerName: r.dealerName,
  dealerCode: r.dealerCode,
  dealerOwnerName: r.dealerOwnerName,
  dealerPhone: r.dealerPhone,
  dealerEmail: r.dealerEmail,
  dealerGst: r.dealerGst,
  dealerAddress: r.dealerAddress,
  orderNumber: r.orderNumber,
  dealerOrderNumber: r.dealerOrderNumber,
  orderDate: fmtDate(r.orderDate),
  source: r.source,
  paymentMethodLabel: r.paymentMethodLabel,
  paymentTypeLabel: r.paymentType === 'credit' ? 'Credit' : 'Cash',
  status: r.status,
  totalAmount: r.totalAmount,
  paidAmount: r.paidAmount,
  outstanding: r.outstanding,
  dueDate: fmtDate(r.dueDate),
  overdueDays: r.overdueDays || 0,
  lastPaymentDate: fmtDate(r.lastPaymentDate),
  invoiceNumbers: (r.invoiceNumbers || []).join(', '),
  remarks: r.ledger?.remarks || '',
});

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function toCsv(rows) {
  const header = COLUMNS.map((c) => c.header);
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    const f = toFlat(r);
    lines.push(COLUMNS.map((c) => csvEscape(f[c.key])).join(','));
  }
  // Totals row
  const totOut = rows.reduce((s, r) => s + r.outstanding, 0);
  const totPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
  const totBill = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totals = new Array(COLUMNS.length).fill('');
  totals[0] = 'TOTAL';
  totals[COLUMNS.findIndex((c) => c.key === 'totalAmount')] = totBill.toFixed(2);
  totals[COLUMNS.findIndex((c) => c.key === 'paidAmount')] = totPaid.toFixed(2);
  totals[COLUMNS.findIndex((c) => c.key === 'outstanding')] = totOut.toFixed(2);
  lines.push(totals.map(csvEscape).join(','));
  return lines.join('\r\n');
}

async function toXlsx(rows, { title = 'Ledger', includeTimeline = false } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Buvvas Supplier — Ledger';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ledger');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  rows.forEach((r) => ws.addRow(toFlat(r)));

  const totalRow = ws.addRow({
    dealerName: 'TOTAL',
    totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
    paidAmount: rows.reduce((s, r) => s + r.paidAmount, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  });
  totalRow.font = { bold: true };

  ['totalAmount', 'paidAmount', 'outstanding'].forEach((key) => {
    ws.getColumn(key).numFmt = '#,##0.00';
  });

  if (includeTimeline) {
    const tw = wb.addWorksheet('Payment Timeline');
    tw.columns = [
      { header: 'Order No', key: 'orderNumber', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'kind', width: 18 },
      { header: 'Method', key: 'methodLabel', width: 16 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Reference', key: 'reference', width: 24 },
      { header: 'Note', key: 'note', width: 30 },
      { header: 'Recorded By', key: 'recordedByName', width: 18 },
    ];
    tw.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      (r.timeline || []).forEach((t) => {
        tw.addRow({
          orderNumber: r.orderNumber || r.dealerOrderNumber,
          date: fmtDate(t.date),
          kind: t.kind,
          methodLabel: t.methodLabel || t.method || '',
          amount: t.amount,
          reference: t.reference || '',
          note: t.note || '',
          recordedByName: t.recordedByName || '',
        });
      });
    });
    tw.getColumn('amount').numFmt = '#,##0.00';
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { toCsv, toXlsx, COLUMNS };
