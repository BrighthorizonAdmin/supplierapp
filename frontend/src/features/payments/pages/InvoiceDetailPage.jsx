import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchInvoiceById, issueInvoice, cancelInvoice } from '../paymentSlice';
import { fetchSettings } from '../../notifications/settingsSlice';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Send, XCircle, Edit2 } from 'lucide-react';

const fmtDt = (d) => d ? format(new Date(d), 'dd/MM/yyyy') : '—';

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const printRef = useRef();

  const { selectedInvoice: inv, loading } = useSelector((s) => s.payment);
  const settingsData = useSelector((s) => s.settings?.data || {});

  useEffect(() => {
    dispatch(fetchInvoiceById(id));
    dispatch(fetchSettings());
  }, [dispatch, id]);

  const COMPANY = {
    name: settingsData.companyName || 'Your Company Name',
    address: settingsData.companyAddress || '',
    mobile: settingsData.companyMobile || '',
    gstin: settingsData.companyGSTIN || '',
    pan: settingsData.companyPAN || '',
    email: settingsData.companyEmail || '',
    website: settingsData.companyWebsite || '',
    bank: {
      name: settingsData.bankName || '',
      ifsc: settingsData.bankIFSC || '',
      account: settingsData.bankAccount || '',
      bank: settingsData.bankBranch || '',
    },
  };

  const handlePrint = () => {
    const invoiceEl = printRef.current;
    if (!invoiceEl) return;
    let allCSS = '';
    try {
      Array.from(document.styleSheets).forEach(sheet => {
        try { Array.from(sheet.cssRules || []).forEach(rule => { allCSS += rule.cssText + '\n'; }); } catch (_) { }
      });
    } catch (_) { }
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Invoice ${inv?.invoiceNumber}</title>
<style>${allCSS}*{box-sizing:border-box;}body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@media print{body{padding:0;}@page{margin:10mm;size:A4;}}</style>
</head><body>${invoiceEl.outerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script>
</body></html>`);
    printWindow.document.close();
  };

  if (loading || !inv) return <div className="p-10 text-center text-slate-400">Loading invoice...</div>;

  const isRetail = inv.invoiceType === 'retail';
  const noteParts = (inv.notes || '').replace('Retail sale to: ', '').split(' | ');
  const custName = isRetail ? noteParts[0] : inv.partyName;
  const custPhone = isRetail ? noteParts[1] : inv.partyPhone;
  const cgst = +((inv.taxAmount || 0) / 2).toFixed(2);
  const sgst = cgst;
  const taxableAmount = inv.subtotal || 0;

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Invoices
        </button>
        <div className="flex gap-2">
          {inv.status === 'draft' && (
            <>
              <button onClick={() => navigate(`/invoices/${id}/edit`)} className="btn-outline flex items-center gap-1.5">
                <Edit2 size={14} /> Edit
              </button>
              <button onClick={() => dispatch(issueInvoice(id))} className="btn-primary flex items-center gap-1.5">
                <Send size={14} /> Issue Invoice
              </button>
            </>
          )}
          {!['paid', 'cancelled'].includes(inv.status) && inv.status !== 'draft' && (
            <button onClick={() => { if (window.confirm('Cancel invoice?')) dispatch(cancelInvoice(id)); }}
              className="btn-outline text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5">
              <XCircle size={14} /> Cancel
            </button>
          )}
          <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5">
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div ref={printRef} className="bg-white max-w-4xl mx-auto shadow-lg print:shadow-none print:max-w-full"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', border: '1px solid #ccc' }}>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #1a56a0', padding: '16px 24px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ width: '60px', height: '60px', background: '#1a56a0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '24px' }}>{COMPANY.name?.charAt(0) || 'C'}</span>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a56a0', letterSpacing: '0.5px' }}>{COMPANY.name}</div>
                {COMPANY.address && <div style={{ fontSize: '11px', color: '#444', marginTop: '3px' }}>{COMPANY.address}</div>}
                <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                  {COMPANY.mobile && <span>Mobile: {COMPANY.mobile}</span>}
                  {COMPANY.gstin && <span style={{ margin: '0 12px' }}>GSTIN: {COMPANY.gstin}</span>}
                  {COMPANY.pan && <span>PAN Number: {COMPANY.pan}</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                  {COMPANY.email && <span>Email: {COMPANY.email}</span>}
                  {COMPANY.website && <span style={{ marginLeft: '12px' }}>Website: {COMPANY.website}</span>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ border: '1px solid #333', padding: '4px 10px', fontWeight: 'bold', fontSize: '13px', display: 'inline-block' }}>TAX INVOICE</div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>ORIGINAL FOR RECIPIENT</div>
            </div>
          </div>
        </div>

        {/* Invoice No + Date */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
          <div style={{ flex: 1, padding: '8px 24px', borderRight: '1px solid #ccc' }}>
            <span style={{ color: '#666', fontSize: '11px' }}>Invoice No.: </span>
            <span style={{ fontWeight: 'bold' }}>{inv.invoiceNumber}</span>
          </div>
          <div style={{ flex: 1, padding: '8px 24px' }}>
            <span style={{ color: '#666', fontSize: '11px' }}>Invoice Date: </span>
            <span style={{ fontWeight: 'bold' }}>{fmtDt(inv.invoiceDate)}</span>
          </div>
        </div>

        {/* Bill To / Ship To / Warranty / Salesman */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
          <div style={{ flex: 1, padding: '10px 24px', borderRight: '1px solid #ccc' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>BILL TO</div>
            <div style={{ fontWeight: 'bold' }}>{custName || inv.partyName}</div>
            {custPhone && <div style={{ fontSize: '11px', color: '#444' }}>Mobile: {custPhone}</div>}
            {inv.partyAddress && <div style={{ fontSize: '11px', color: '#444' }}>{inv.partyAddress}</div>}
            {inv.partyGST && <div style={{ fontSize: '11px', color: '#444' }}>GSTIN: {inv.partyGST}</div>}
            {inv.shippingAddress?.state && <div style={{ fontSize: '11px', color: '#444' }}>Place of Supply: {inv.shippingAddress.state}</div>}
          </div>
          <div style={{ flex: 1, padding: '10px 24px', borderRight: '1px solid #ccc' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>SHIP TO</div>
            <div style={{ fontWeight: 'bold' }}>{inv.shippingAddress?.label || custName || inv.partyName}</div>
            {inv.shippingAddress?.street && <div style={{ fontSize: '11px', color: '#444' }}>{inv.shippingAddress.street}</div>}
          </div>
          <div style={{ flex: 1, padding: '10px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '11px' }}>Warranty Period</span>
              <span style={{ fontSize: '11px' }}>—</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold', fontSize: '11px' }}>Salesman</span>
              <span style={{ fontSize: '11px' }}>—</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '0 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', width: '40%' }}>ITEMS</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>HSN</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>QTY.</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>RATE</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>TAX</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {inv.lineItems?.length > 0 ? inv.lineItems.map((item, i) => {
                const base = item.unitPrice * item.quantity;
                const taxAmt = +(base * (item.taxRate || 0) / 100).toFixed(2);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px 6px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                      {item.productCode && <div style={{ fontSize: '11px', color: '#666' }}>SKU: {item.productCode}</div>}
                      {item.description && <div style={{ fontSize: '11px', color: '#666' }}>{item.description}</div>}
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'top' }}>{item.hsnCode || '—'}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity} {item.unit || 'PCS'}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', verticalAlign: 'top' }}>
                      {item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', verticalAlign: 'top' }}>
                      <div>{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>({item.taxRate || 0}%)</div>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>
                      {(+item.lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No items</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #ccc', background: '#f9f9f9' }}>
                <td colSpan={2} style={{ padding: '8px 6px', fontWeight: 'bold' }}>SUBTOTAL</td>
                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                  {inv.lineItems?.reduce((s, i) => s + i.quantity, 0) || 0}
                </td>
                <td></td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                  ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                  ₹{(+inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bank Details + Tax Summary */}
        <div style={{ display: 'flex', borderTop: '1px solid #ccc', marginTop: '8px' }}>
          <div style={{ flex: 1.2, padding: '12px 24px', borderRight: '1px solid #ccc' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px' }}>BANK DETAILS</div>
            <table style={{ fontSize: '11px', width: '100%' }}>
              <tbody>
                <tr><td style={{ color: '#666', paddingRight: '8px', paddingBottom: '3px' }}>Name:</td><td style={{ fontWeight: 'bold' }}>{COMPANY.bank.name}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: '8px', paddingBottom: '3px' }}>IFSC Code:</td><td>{COMPANY.bank.ifsc}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: '8px', paddingBottom: '3px' }}>Account No:</td><td>{COMPANY.bank.account}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: '8px' }}>Bank:</td><td>{COMPANY.bank.bank}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, padding: '12px 24px' }}>
            <table style={{ width: '100%', fontSize: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ paddingBottom: '4px', color: '#444' }}>Taxable Amount</td>
                  <td style={{ paddingBottom: '4px', textAlign: 'right' }}>₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '4px', color: '#444' }}>CGST @9%</td>
                  <td style={{ paddingBottom: '4px', textAlign: 'right' }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '4px', color: '#444' }}>SGST @9%</td>
                  <td style={{ paddingBottom: '4px', textAlign: 'right' }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {inv.discountAmt > 0 && (
                  <tr>
                    <td style={{ paddingBottom: '4px', color: '#444' }}>Discount</td>
                    <td style={{ paddingBottom: '4px', textAlign: 'right', color: 'green' }}>- ₹{(+inv.discountAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
                  <td style={{ paddingTop: '6px', paddingBottom: '4px' }}>Total Amount</td>
                  <td style={{ paddingTop: '6px', paddingBottom: '4px', textAlign: 'right' }}>₹{(+inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '4px', color: '#444' }}>Received Amount</td>
                  <td style={{ paddingBottom: '4px', textAlign: 'right' }}>₹{(+inv.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                </tr>
                <tr style={{ fontWeight: 'bold' }}>
                  <td>Balance</td>
                  <td style={{ textAlign: 'right' }}>₹{(+inv.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount in Words */}
        <div style={{ borderTop: '1px solid #ccc', padding: '8px 24px', fontSize: '12px' }}>
          <span style={{ fontWeight: 'bold' }}>Total Amount (in words) </span>
          <span style={{ color: '#444' }}>{numberToWords(+inv.totalAmount || 0)}</span>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '12px 24px 16px' }}>
          <div style={{ fontSize: '10px', color: '#666' }}>One Stop For Billing Solutions</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '120px', height: '60px', border: '1px dashed #ccc', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: '#ccc' }}>Seal / Stamp</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>AUTHORISED SIGNATORY FOR</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{COMPANY.name}</div>
          </div>
        </div>

      </div>
    </div>
  );
}