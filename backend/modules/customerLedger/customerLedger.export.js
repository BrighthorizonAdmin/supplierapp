const PDFDocument = require('pdfkit');

/**
 * Customer ledger exports (CSV and PDF) over the order rows from
 * customerLedger.service. PDFKit's standard fonts have no ₹ glyph, so the PDF
 * uses "Rs." (same as the dealer ledger PDF).
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (n) => num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};
const STATUS_LABEL = { cleared: 'Paid', partial: 'Part paid', pending: 'Due' };

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows) => {
  const headers = ['Customer', 'Phone', 'Email', 'Address', 'Order No', 'Website Order No', 'Invoice No', 'Order Date',
    'Payment Method', 'Status', 'Order Total', 'Paid', 'Balance Due'];
  const lines = rows.map((r) => [
    r.customerName, r.customerPhone, r.customerEmail, r.customerAddress, r.orderNumber, r.websiteOrderNumber,
    r.invoiceNumber, fmtDate(r.orderDate), r.paymentMethodLabel, STATUS_LABEL[r.status] || r.status,
    money(r.totalAmount), money(r.paidAmount), money(r.outstanding),
  ].map(csvCell).join(','));
  return Buffer.from(`﻿${[headers.join(','), ...lines].join('\n')}`, 'utf8');
};

// rows → PDF buffer. `customer` set = one customer's statement, else all customers.
const toPdf = (rows, { customer, fromDate, toDate } = {}) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.font('Helvetica-Bold').fontSize(16).text(customer ? 'Customer Statement' : 'Buvvas Customer Ledger');
  doc.font('Helvetica').fontSize(9).fillColor('#555')
    .text(`Generated ${fmtDate(new Date())}${fromDate || toDate ? `  ·  Period: ${fromDate ? fmtDate(fromDate) : 'start'} to ${toDate ? fmtDate(toDate) : 'today'}` : ''}`);
  if (customer) {
    doc.moveDown(0.5).fillColor('#111').font('Helvetica-Bold').fontSize(11).text(customer.customerName);
    doc.font('Helvetica').fontSize(9)
      .text([customer.customerPhone, customer.customerEmail].filter(Boolean).join('  ·  '))
      .text(customer.customerAddress || '');
  }

  const totals = rows.reduce((t, r) => ({ total: t.total + r.totalAmount, paid: t.paid + r.paidAmount, due: t.due + r.outstanding }), { total: 0, paid: 0, due: 0 });
  doc.moveDown(0.5).fillColor('#111').font('Helvetica-Bold').fontSize(10)
    .text(`Orders: ${rows.length}    Total: Rs. ${money(totals.total)}    Paid: Rs. ${money(totals.paid)}    Balance due: Rs. ${money(totals.due)}`);
  doc.moveDown(0.6);

  const cols = customer
    ? [['Order No', 110], ['Website Order', 110], ['Invoice', 100], ['Date', 70], ['Payment', 110], ['Status', 60], ['Total', 75], ['Paid', 75], ['Due', 75]]
    : [['Customer', 120], ['Phone', 75], ['Order No', 105], ['Invoice', 95], ['Date', 65], ['Payment', 95], ['Status', 55], ['Total', 70], ['Paid', 70], ['Due', 70]];
  const right = new Set(['Total', 'Paid', 'Due']);
  const startX = doc.page.margins.left;

  const drawRow = (cells, { bold = false, fill } = {}) => {
    const y = doc.y;
    const h = 16;
    if (y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      return drawRow(cells, { bold, fill });
    }
    if (fill) doc.rect(startX, y, cols.reduce((s, c) => s + c[1], 0), h).fill(fill);
    let x = startX;
    doc.fillColor('#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    cells.forEach((v, i) => {
      const [name, w] = cols[i];
      doc.text(String(v ?? ''), x + 3, y + 4, { width: w - 6, height: h - 4, ellipsis: true, lineBreak: false, align: right.has(name) ? 'right' : 'left' });
      x += w;
    });
    doc.y = y + h;
    doc.x = startX;
    return undefined;
  };

  drawRow(cols.map((c) => c[0]), { bold: true, fill: '#F3F4F6' });
  rows.forEach((r) => {
    const common = [r.orderNumber, r.invoiceNumber, fmtDate(r.orderDate), r.paymentMethodLabel, STATUS_LABEL[r.status] || r.status,
      money(r.totalAmount), money(r.paidAmount), money(r.outstanding)];
    drawRow(customer
      ? [r.orderNumber, r.websiteOrderNumber, ...common.slice(1)]
      : [r.customerName, r.customerPhone, ...common]);
  });
  if (!rows.length) doc.font('Helvetica').fontSize(9).text('No orders in this period.', startX, doc.y + 6);

  doc.end();
});

module.exports = { toCsv, toPdf };
