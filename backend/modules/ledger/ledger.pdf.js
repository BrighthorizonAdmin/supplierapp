const PDFDocument = require('pdfkit');

/**
 * Ledger export — PDF, alongside the CSV/XLSX formatters in ledger.export.js.
 * Pure formatter over the rows produced by ledger.aggregator; no DB access.
 *
 * PDFKit's standard fonts (Helvetica etc.) use WinAnsi encoding, which has no
 * glyph for ₹ (U+20B9) — it prints as a blank box in every viewer. CSV/XLSX
 * keep the ₹ symbol (Excel supplies its own Unicode font); the PDF uses "Rs."
 * instead so it always renders correctly without bundling a custom font file.
 */

const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Built by hand rather than via toLocaleDateString('en-IN', {month:'short'}), which
// renders September as "Sept" (4 letters) — just wide enough to overflow the narrow
// table columns below and wrap onto a second line. This also matches the "dd MMM
// yyyy" style (always-3-letter month) the rest of the app already uses via date-fns.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};

const STATUS_LABEL = { cleared: 'Cleared', partial: 'Partial', pending: 'Pending' };
const STATUS_COLOR = { cleared: '#15803D', partial: '#1D4ED8', pending: '#B45309' };
const STATUS_BG = { cleared: '#DCFCE7', partial: '#DBEAFE', pending: '#FEF3C7' };

const KIND_LABEL = {
  'split-paynow': 'Split - pay now',
  gateway: 'Online payment',
  'invoice-allocation': 'Invoice payment',
  'invoice-recorded': 'Recorded on invoice',
  'order-marked-paid': 'Marked paid',
  manual: 'Offline (manual) entry',
};

/* ─────────────────────────── low-level table helper ─────────────────────────── */

// Plain ASCII "..." rather than a real ellipsis glyph — one less thing to verify
// renders under WinAnsi encoding (see the ₹ note above for why that matters here).
const ELLIPSIS = '...';

/**
 * Cuts `str` down (with a trailing "...") until it fits `maxWidth` under the doc's
 * CURRENTLY ACTIVE font/size. Needed because pdfkit's own `lineBreak: false` +
 * `ellipsis: true` options do not reliably suppress wrapping — verified directly:
 * a too-long string with both options set still wraps onto a second line instead of
 * truncating, which silently spilled into the row below in a fixed-height table.
 */
function truncateToWidth(doc, str, maxWidth) {
  str = String(str ?? '');
  if (doc.widthOfString(str) <= maxWidth) return str;
  if (doc.widthOfString(ELLIPSIS) > maxWidth) return ''; // column too narrow even for "..."
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.widthOfString(str.slice(0, mid) + ELLIPSIS) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return str.slice(0, lo) + ELLIPSIS;
}

/**
 * Draws a simple striped table starting at the doc's current y. Breaks to a new
 * page (redrawing the header row) whenever a row would cross the bottom margin —
 * pdfkit does not do this automatically for manually-positioned content.
 * Returns the y position immediately below the table.
 */
function drawTable(doc, { columns, rows, headerBg = '#F1F5F9', headerFg = '#334155', zebra = '#FAFAFA' }) {
  const left = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const rowHeight = 18;
  const headerHeight = 20;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(left, y, totalWidth, headerHeight).fill(headerBg);
    doc.fillColor(headerFg).font('Helvetica-Bold').fontSize(8);
    let x = left;
    columns.forEach((c) => {
      const label = truncateToWidth(doc, c.header, c.width - 8);
      doc.text(label, x + 4, y + 6, { width: c.width - 8, align: c.align || 'left', lineBreak: false });
      x += c.width;
    });
    doc.y = y + headerHeight;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(8);

  rows.forEach((row, i) => {
    if (doc.y + rowHeight > bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeader();
      doc.font('Helvetica').fontSize(8);
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(left, y, totalWidth, rowHeight).fill(zebra);
    doc.fillColor('#1E293B');
    let x = left;
    columns.forEach((c) => {
      const raw = typeof c.value === 'function' ? c.value(row) : row[c.key];
      const str = raw === undefined || raw === null || raw === '' ? '—' : String(raw);
      const val = truncateToWidth(doc, str, c.width - 8);
      doc.text(val, x + 4, y + 5, { width: c.width - 8, align: c.align || 'left', lineBreak: false });
      x += c.width;
    });
    doc.y = y + rowHeight;
    doc.moveTo(left, doc.y).lineTo(left + totalWidth, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  });

  // Every cell above was drawn at an explicit x, which pdfkit then remembers as the
  // cursor for the NEXT plain `.text(str)` call with no x of its own — left uncorrected,
  // the next heading/paragraph would print starting from wherever the last column sits
  // instead of the left margin. Reset it so callers can go straight back to flowing text.
  doc.x = left;
  return doc.y;
}

const statusBadge = (doc, status, x, y) => {
  const label = STATUS_LABEL[status] || status;
  // widthOfString's `font`/`size` options are silently ignored — verified directly: it
  // only ever measures against whatever font/size is CURRENTLY ACTIVE on the document
  // (unlike, say, a CSS font shorthand). The box must be sized under the exact font/size
  // the label is then drawn with below, or a wider caller font (e.g. plain Helvetica used
  // just before this call, elsewhere in this file) leaves the box too narrow and the text
  // overflows it — set the font first, measure, draw, THEN let the caller's font stand.
  doc.font('Helvetica-Bold').fontSize(8);
  const w = doc.widthOfString(label) + 12;
  doc.roundedRect(x, y, w, 14, 3).fill(STATUS_BG[status] || '#F1F5F9');
  doc.fillColor(STATUS_COLOR[status] || '#475569')
    .text(label, x + 6, y + 3, { lineBreak: false });
  return w;
};

/* ─────────────────────────── shared header/footer ─────────────────────────── */

/**
 * Company letterhead — mirrors the layout the Invoice PDF already uses (see
 * InvoiceDetailPage.jsx's header block): a coloured logo box with the company's
 * initial, name/address/GSTIN/PAN, and a bordered document-type badge on the right,
 * under a coloured rule. Drawn from the same Settings fields the invoice reads
 * (companyName/Address/Mobile/GSTIN/PAN/Email/Website), fetched by the caller.
 */
const BRAND_BLUE = '#1A56A0';

const drawLetterhead = (doc, company = {}, badgeLabel = 'LEDGER STATEMENT') => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.y;
  const boxSize = 46;
  const badgeW = 130;

  doc.rect(left, top, boxSize, boxSize).fill(BRAND_BLUE);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
    .text((company.companyName || 'C').charAt(0).toUpperCase(), left, top + 12, { width: boxSize, align: 'center', lineBreak: false });

  const infoX = left + boxSize + 14;
  const infoWidth = right - infoX - badgeW - 10;
  doc.fillColor(BRAND_BLUE).font('Helvetica-Bold').fontSize(14)
    .text(company.companyName || 'Your Company Name', infoX, top, { width: infoWidth });
  if (company.companyAddress) {
    doc.fillColor('#444444').font('Helvetica').fontSize(8).text(company.companyAddress, infoX, doc.y + 2, { width: infoWidth });
  }
  const line2 = [
    company.companyMobile && `Mobile: ${company.companyMobile}`,
    company.companyGSTIN && `GSTIN: ${company.companyGSTIN}`,
    company.companyPAN && `PAN Number: ${company.companyPAN}`,
  ].filter(Boolean).join('   ');
  if (line2) doc.fillColor('#444444').font('Helvetica').fontSize(8).text(line2, infoX, doc.y + 2, { width: infoWidth });
  const line3 = [
    company.companyEmail && `Email: ${company.companyEmail}`,
    company.companyWebsite && `Website: ${company.companyWebsite}`,
  ].filter(Boolean).join('   ');
  if (line3) doc.fillColor('#444444').font('Helvetica').fontSize(8).text(line3, infoX, doc.y + 2, { width: infoWidth });
  const infoBottom = doc.y;

  const badgeX = right - badgeW;
  doc.rect(badgeX, top, badgeW, 20).lineWidth(1).strokeColor('#333333').stroke();
  doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9)
    .text(badgeLabel, badgeX, top + 6, { width: badgeW, align: 'center', lineBreak: false });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(7)
    .text('SUPPLIER COPY', badgeX, top + 24, { width: badgeW, align: 'center', lineBreak: false });

  const bottom = Math.max(infoBottom, top + boxSize, top + 24 + 10) + 10;
  doc.moveTo(left, bottom).lineTo(right, bottom).lineWidth(1.5).strokeColor(BRAND_BLUE).stroke();
  doc.y = bottom + 10;
  doc.x = left; // see drawTable's note — absolutely-positioned draws above leave a stale cursor
};

const drawDocHeader = (doc, title, subtitle) => {
  // No `lineBreak: false` here: that option also stops pdfkit from advancing `doc.y`
  // afterwards, which made the next line print on top of the title instead of below it.
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0F172A').text(title);
  doc.font('Helvetica').fontSize(9).fillColor('#64748B')
    .text(`${subtitle} · generated ${fmtDate(new Date())}`);
  doc.moveDown(1);
};

const addFootersAndPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // The footer sits inside the bottom margin by design, but pdfkit auto-inserts a
    // fresh page the moment ANY text is placed below `page.height - margins.bottom`
    // (it treats that as an overflow, even for absolutely-positioned text) — silently
    // producing a trailing blank page. Zeroing this page's bottom margin just for the
    // footer draw lifts that limit without touching the margin real content used above.
    const restoreBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - restoreBottom + 14;
    doc.font('Helvetica').fontSize(7).fillColor('#94A3B8')
      .text('Buvvas Supplier - Ledger', doc.page.margins.left, y, { lineBreak: false })
      .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = restoreBottom;
  }
};

const finish = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    addFootersAndPageNumbers(doc);
    doc.end();
  });

/* ─────────────────────────── kv (label/value) box ─────────────────────────── */

const drawKvGrid = (doc, pairs, { cols = 2, width } = {}) => {
  const colWidth = width / cols;
  const startX = doc.page.margins.left;
  let x = startX;
  let rowTop = doc.y;
  let maxRowHeight = 0;

  pairs.forEach(([label, value], i) => {
    doc.font('Helvetica').fontSize(7).fillColor('#94A3B8').text(label.toUpperCase(), x, rowTop, { width: colWidth - 10 });
    doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(value || '—', x, doc.y, { width: colWidth - 10 });
    maxRowHeight = Math.max(maxRowHeight, doc.y - rowTop);
    if ((i + 1) % cols === 0) {
      x = startX;
      rowTop += maxRowHeight + 8;
      maxRowHeight = 0;
    } else {
      x += colWidth;
    }
  });
  doc.y = rowTop + (pairs.length % cols === 0 ? 0 : maxRowHeight + 8);
  doc.x = startX; // see the matching note in drawTable — same stale-cursor issue
};

/* ─────────────────────────── scope: order (single-order statement) ─────────────────────────── */

async function buildOrderPdf(row, company) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  drawLetterhead(doc, company);
  drawDocHeader(doc, `Ledger Statement — ${row.orderNumber || row.dealerOrderNumber}`, row.dealerName);

  // dealer + order info
  drawKvGrid(doc, [
    ['Dealer', row.dealerName], ['Dealer Code', row.dealerCode],
    ['Owner Name', row.dealerOwnerName], ['Phone', row.dealerPhone],
    ['Email', row.dealerEmail], ['GST Number', row.dealerGst],
    ['Address', row.dealerAddress], ['Payment Method', row.paymentMethodLabel],
  ], { cols: 2, width: pageWidth });
  doc.moveDown(0.5);

  // totals band
  const bandY = doc.y;
  doc.rect(doc.page.margins.left, bandY, pageWidth, 44).fill(row.settled ? '#F0FDF4' : '#FEF2F2');
  const cellW = pageWidth / 4;
  const cell = (i, label, value, color) => {
    const x = doc.page.margins.left + i * cellW;
    doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(label.toUpperCase(), x + 8, bandY + 6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color || '#0F172A').text(value, x + 8, bandY + 18);
  };
  cell(0, 'Order Total', inr(row.totalAmount));
  cell(1, 'Paid', inr(row.paidAmount), '#15803D');
  cell(2, row.settled ? 'Balance' : 'Outstanding', inr(row.outstanding), row.settled ? '#15803D' : '#DC2626');
  doc.font('Helvetica').fontSize(7).fillColor('#64748B').text('STATUS', doc.page.margins.left + 3 * cellW + 8, bandY + 6);
  statusBadge(doc, row.status, doc.page.margins.left + 3 * cellW + 8, bandY + 18);
  doc.y = bandY + 44 + 10;
  doc.x = doc.page.margins.left; // see drawTable's note — cell() left the cursor at the last column's x

  doc.font('Helvetica').fontSize(9).fillColor('#475569').text(
    row.settled
      ? `Cleared${row.lastPaymentDate && new Date(row.lastPaymentDate) <= new Date() ? ` on ${fmtDate(row.lastPaymentDate)}` : ''} — this order is fully paid.`
      : `${row.overdue ? `Overdue by ${row.overdueDays} day(s) — ` : ''}Due by ${fmtDate(row.dueDate)}.`
  );
  doc.moveDown(1);

  // payment timeline
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('Payment Timeline');
  doc.moveDown(0.3);
  if (!row.timeline.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#94A3B8').text('No payments recorded yet.');
  } else {
    drawTable(doc, {
      columns: [
        { header: 'Date', key: 'date', width: 70, value: (t) => fmtDate(t.date) },
        { header: 'Type', width: 130, value: (t) => KIND_LABEL[t.kind] || t.kind },
        { header: 'Method', width: 90, value: (t) => t.methodLabel || t.method },
        { header: 'Amount', width: 90, align: 'right', value: (t) => inr(t.amount) },
        { header: 'Reference', width: pageWidth - 70 - 130 - 90 - 90, value: (t) => t.reference },
      ],
      rows: row.timeline,
    });
  }
  doc.moveDown(1);

  // manual payment log (supplier-internal — includes who recorded it)
  const manualPayments = row.ledger?.manualPayments || [];
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('Manual Payment Log (book-keeping only)');
  doc.moveDown(0.3);
  if (!manualPayments.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#94A3B8').text('No manual (offline) payments logged.');
  } else {
    drawTable(doc, {
      columns: [
        { header: 'Date', width: 60, value: (p) => fmtDate(p.paidOn) },
        { header: 'Amount', width: 75, align: 'right', value: (p) => inr(p.amount) },
        { header: 'Method', width: 65, value: (p) => p.method },
        { header: 'Reference', width: 90, value: (p) => p.reference },
        { header: 'Recorded By', width: 90, value: (p) => p.recordedByName },
        { header: 'Note', width: pageWidth - 60 - 75 - 65 - 90 - 90, value: (p) => p.note },
      ],
      rows: manualPayments,
    });
  }

  if (row.ledger?.remarks) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text('Internal Remarks (not shown to dealer)');
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(row.ledger.remarks);
  }

  return finish(doc);
}

/* ─────────────────────────── scope: dealer (one dealer, all their orders) ─────────────────────────── */

async function buildDealerPdf(rows, company) {
  // Landscape: 9 columns (no Dealer column needed — it's one dealer) still don't fit
  // A4 portrait's ~515pt width without cramming Status down to an unreadable sliver
  // (measured and confirmed — see the truncateToWidth() note above for how that showed up).
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const r0 = rows[0];

  drawLetterhead(doc, company);
  drawDocHeader(doc, `Ledger Statement — ${r0.dealerName}`, `${rows.length} order(s)`);
  drawKvGrid(doc, [
    ['Dealer Code', r0.dealerCode], ['Owner Name', r0.dealerOwnerName],
    ['Phone', r0.dealerPhone], ['Email', r0.dealerEmail],
    ['GST Number', r0.dealerGst], ['Address', r0.dealerAddress],
  ], { cols: 2, width: pageWidth });
  doc.moveDown(0.5);

  const totalBilled = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const bandY = doc.y;
  doc.rect(doc.page.margins.left, bandY, pageWidth, 40).fill('#F8FAFC');
  const cellW = pageWidth / 3;
  const cell = (i, label, value, color) => {
    const x = doc.page.margins.left + i * cellW;
    doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(label.toUpperCase(), x + 8, bandY + 6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color || '#0F172A').text(value, x + 8, bandY + 18);
  };
  cell(0, 'Total Billed', inr(totalBilled));
  cell(1, 'Total Paid', inr(totalPaid), '#15803D');
  cell(2, 'Outstanding', inr(totalOutstanding), totalOutstanding > 0 ? '#DC2626' : '#15803D');
  doc.y = bandY + 40 + 12;
  doc.x = doc.page.margins.left; // see drawTable's note — cell() left the cursor at the last column's x

  // Widths chosen from actual pdfkit-measured string widths (Helvetica 8pt) for the
  // longest realistic value per column, plus a safety margin — not eyeballed. A
  // rare, unusually long value (e.g. the dealer-app's long-form order number, or the
  // "Split (Pay Now + Credit)" method label) still can't break the layout: drawTable
  // truncates with "..." instead of overflowing into the row below.
  const dealerColWidths = [110, 70, 45, 90, 85, 85, 90, 75];
  drawTable(doc, {
    columns: [
      { header: 'Order No', width: dealerColWidths[0], value: (r) => r.orderNumber || r.dealerOrderNumber },
      { header: 'Date', width: dealerColWidths[1], value: (r) => fmtDate(r.orderDate) },
      { header: 'Type', width: dealerColWidths[2], value: (r) => (r.paymentType === 'credit' ? 'Credit' : 'Cash') },
      { header: 'Method', width: dealerColWidths[3], value: (r) => r.paymentMethodLabel },
      { header: 'Total', width: dealerColWidths[4], align: 'right', value: (r) => inr(r.totalAmount) },
      { header: 'Paid', width: dealerColWidths[5], align: 'right', value: (r) => inr(r.paidAmount) },
      { header: 'Outstanding', width: dealerColWidths[6], align: 'right', value: (r) => inr(r.outstanding) },
      { header: 'Due / Cleared', width: dealerColWidths[7], value: (r) => fmtDate(r.settled ? r.lastPaymentDate : r.dueDate) },
      { header: 'Status', width: pageWidth - dealerColWidths.reduce((s, w) => s + w, 0), value: (r) => STATUS_LABEL[r.status] },
    ],
    rows,
  });

  return finish(doc);
}

/* ─────────────────────────── scope: all (portfolio) ─────────────────────────── */

async function buildPortfolioPdf(rows, summary, company) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  drawLetterhead(doc, company);
  drawDocHeader(doc, 'Ledger — All Transactions', `${summary.dealerCount} dealer(s) · ${summary.orderCount} order(s)`);

  const bandY = doc.y;
  doc.rect(doc.page.margins.left, bandY, pageWidth, 40).fill('#F8FAFC');
  const cellW = pageWidth / 4;
  const cell = (i, label, value, color) => {
    const x = doc.page.margins.left + i * cellW;
    doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(label.toUpperCase(), x + 8, bandY + 6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color || '#0F172A').text(value, x + 8, bandY + 18);
  };
  cell(0, 'Total Billed', inr(summary.totalBilled));
  cell(1, 'Total Collected', inr(summary.totalPaid), '#15803D');
  cell(2, 'Outstanding', inr(summary.totalOutstanding), summary.totalOutstanding > 0 ? '#DC2626' : '#15803D');
  cell(3, 'Overdue', `${summary.overdueCount} (${inr(summary.overdueOutstanding)})`, summary.overdueCount > 0 ? '#DC2626' : '#0F172A');
  doc.y = bandY + 40 + 12;
  doc.x = doc.page.margins.left; // see drawTable's note — cell() left the cursor at the last column's x

  drawTable(doc, {
    columns: [
      { header: 'Dealer', width: 130, value: (r) => r.dealerName },
      { header: 'Dealer Code', width: 65, value: (r) => r.dealerCode },
      { header: 'Order No', width: 90, value: (r) => r.orderNumber || r.dealerOrderNumber },
      { header: 'Date', width: 55, value: (r) => fmtDate(r.orderDate) },
      { header: 'Type', width: 40, value: (r) => (r.paymentType === 'credit' ? 'Credit' : 'Cash') },
      { header: 'Method', width: 65, value: (r) => r.paymentMethodLabel },
      { header: 'Total', width: 60, align: 'right', value: (r) => inr(r.totalAmount) },
      { header: 'Paid', width: 60, align: 'right', value: (r) => inr(r.paidAmount) },
      { header: 'Outstanding', width: 65, align: 'right', value: (r) => inr(r.outstanding) },
      { header: 'Status', width: pageWidth - 130 - 65 - 90 - 55 - 40 - 65 - 60 - 60 - 65, value: (r) => STATUS_LABEL[r.status] },
    ],
    rows,
  });

  return finish(doc);
}

/**
 * @param {object[]} rows   ledger rows (as produced by ledger.aggregator)
 * @param {object} opts
 * @param {'all'|'dealer'|'order'} opts.scope
 * @param {object} [opts.summary]  required for scope 'all' (from ledger.aggregator.summarise)
 * @param {object} [opts.company] Settings doc (companyName/Address/Mobile/GSTIN/PAN/Email/Website)
 *                                 for the letterhead — same fields the Invoice PDF reads.
 */
async function toPdf(rows, { scope, summary, company } = {}) {
  if (scope === 'order') return buildOrderPdf(rows[0], company);
  if (scope === 'dealer') return buildDealerPdf(rows, company);
  return buildPortfolioPdf(rows, summary || {}, company);
}

module.exports = { toPdf };
