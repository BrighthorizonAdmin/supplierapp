// GSTR-1 style sales register (Analytics → "GST Report (PDF)").
// One row per invoice per GST rate, with place of supply and the CGST/SGST or
// IGST split — the same rules the invoice print uses (utils/gst.js).
import { format } from 'date-fns';
import { resolveStateCode, isInterState, derivedGstRate, stateName } from '../../utils/gst';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n) => r2(n).toFixed(2);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// { rate: { taxable, tax } } for one invoice
const taxByRate = (inv) => {
  const out = {};
  const add = (rate, taxable, tax) => {
    const k = +rate || 0;
    out[k] = out[k] || { taxable: 0, tax: 0 };
    out[k].taxable += taxable;
    out[k].tax += tax;
  };
  (inv.lineItems || []).forEach((li) => {
    const rate = +li.taxRate || 0;
    const tax = li.taxAmount != null ? +li.taxAmount : 0;
    const taxable = +li.lineTotal > 0 ? +li.lineTotal - tax : (+li.quantity || 0) * (+li.unitPrice || 0);
    add(rate, taxable, tax);
  });
  const charges = inv.chargeLines || [];
  charges.forEach((c) => add(+c.taxRate || 0, +c.amount || 0, +c.taxAmount || 0));
  if (!charges.length && +inv.additionalCharges > 0) add(0, +inv.additionalCharges, 0);

  // Dealer-app invoices with tax only at invoice level (0% on every line)
  const lineTax = Object.values(out).reduce((s, v) => s + v.tax, 0);
  if (lineTax === 0 && +inv.taxAmount > 0) {
    const taxable = Object.values(out).reduce((s, v) => s + v.taxable, 0) || +inv.subtotal || 0;
    return { [derivedGstRate(taxable, inv.taxAmount)]: { taxable, tax: +inv.taxAmount } };
  }
  return out;
};

export const buildGstRows = (invoices, sellerState) => {
  const rows = [];
  invoices.forEach((inv) => {
    const isRetail = inv.invoiceType === 'retail';
    const dealer = inv.dealerId && typeof inv.dealerId === 'object' ? inv.dealerId : null;
    const name = isRetail
      ? (inv.notes || '').replace('Retail sale to: ', '').split(' | ')[0] || inv.partyName || ''
      : inv.partyName || dealer?.businessName || dealer?.name || '';
    const gstin = (inv.partyGST || dealer?.gstin || dealer?.gstNumber || '').toUpperCase();
    const dealerState = dealer ? (dealer.address?.state || dealer.state || '') : '';
    const addr = typeof dealer?.address === 'string' ? dealer.address : '';
    // Unknown buyer state → supply inside the seller's own state (same as the invoice print)
    const buyerState = resolveStateCode({
      gstins: [gstin],
      texts: [inv.shippingAddress?.state, dealerState, inv.partyAddress, addr],
    }) || sellerState;
    const inter = !isRetail && isInterState(sellerState, buyerState);

    Object.entries(taxByRate(inv))
      .sort(([a], [b]) => +a - +b)
      .forEach(([rate, v]) => {
        const tax = r2(v.tax);
        rows.push({
          gstin, name,
          stateCode: buyerState || '',
          stateName: stateName(buyerState),
          invoiceNo: inv.invoiceNumber || '',
          invoiceDate: inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd/MM/yyyy') : '',
          invoiceValue: r2(inv.totalAmount),
          rate: +rate,
          taxable: r2(v.taxable),
          cgst: inter ? 0 : r2(tax / 2),
          sgst: inter ? 0 : r2(tax / 2),
          igst: inter ? tax : 0,
          cess: 0,
          totalTax: tax,
        });
      });
  });
  return rows;
};

// Opens the report in a print window — the browser's "Save as PDF" makes the file
export const printGstReport = ({ rows, company, fromDate, toDate }) => {
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const invoiceCount = new Set(rows.map((r) => r.invoiceNo)).size;
  const body = rows.map((r) => `<tr>
    <td>${esc(r.gstin)}</td><td>${esc(r.name)}</td><td>${esc(r.stateCode)}</td><td>${esc(r.stateName)}</td>
    <td>${esc(r.invoiceNo)}</td><td>${esc(r.invoiceDate)}</td><td class="n">${num(r.invoiceValue)}</td>
    <td class="n">${r.rate.toFixed(1)}</td><td class="n">${num(r.taxable)}</td><td class="n">${num(r.cgst)}</td>
    <td class="n">${num(r.sgst)}</td><td class="n">${num(r.igst)}</td><td class="n">${num(r.cess)}</td><td class="n">${num(r.totalTax)}</td>
  </tr>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>GSTR-1 ${esc(fromDate)} to ${esc(toDate)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 0 0 4px; } h3 { font-size: 13px; margin: 14px 0 6px; }
  .meta { font-size: 10px; margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 4px; vertical-align: top; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; }
  td.n { text-align: right; white-space: nowrap; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  tfoot td { font-weight: 700; background: #f9fafb; }
</style></head><body>
  <h1>GSTR-1</h1>
  <h2>${esc(company.name)}</h2>
  ${company.mobile ? `<p class="meta">Mobile: ${esc(company.mobile)}</p>` : ''}
  ${company.gstin ? `<p class="meta">GST No: ${esc(company.gstin)}</p>` : ''}
  <p class="meta" style="margin-top:8px"><b>Date Range:</b> ${esc(fromDate)} to ${esc(toDate)}</p>
  <h3>Sales</h3>
  <table>
    <thead>
      <tr>
        <th rowspan="2">GSTIN</th><th rowspan="2">Customer Name</th>
        <th colspan="2">Place of Supply</th><th colspan="3">Invoice Details</th>
        <th rowspan="2">Total Tax %</th><th rowspan="2">Taxable Value</th><th colspan="5">Amount of Tax</th>
      </tr>
      <tr>
        <th>State Code</th><th>State Name</th><th>Invoice No.</th><th>Invoice Date</th><th>Invoice Value</th>
        <th>Central Tax Amount</th><th>State/UT Tax Amount</th><th>Integrated Tax Amount</th><th>CESS</th><th>Total Tax</th>
      </tr>
    </thead>
    <tbody>${body || '<tr><td colspan="14" style="text-align:center;padding:12px">No invoices in this range</td></tr>'}</tbody>
    ${rows.length ? `<tfoot><tr>
      <td colspan="6">Total (${invoiceCount} invoices)</td>
      <td class="n"></td><td></td>
      <td class="n">${num(sum('taxable'))}</td><td class="n">${num(sum('cgst'))}</td><td class="n">${num(sum('sgst'))}</td>
      <td class="n">${num(sum('igst'))}</td><td class="n">${num(sum('cess'))}</td><td class="n">${num(sum('totalTax'))}</td>
    </tr></tfoot>` : ''}
  </table>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};
