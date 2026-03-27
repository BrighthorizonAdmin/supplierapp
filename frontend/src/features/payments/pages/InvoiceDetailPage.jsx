import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchInvoiceById, issueInvoice, cancelInvoice } from '../paymentSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Send, XCircle, Edit2 } from 'lucide-react';

const fmt   = (n) => `₹${(+n||0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDt = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

export default function InvoiceDetailPage() {
  const { id }      = useParams();
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const printRef    = useRef();
  const { selectedInvoice: inv, loading } = useSelector((s) => s.payment);

  useEffect(() => { dispatch(fetchInvoiceById(id)); }, [dispatch, id]);

  const handlePrint = () => {
    const invoiceEl = printRef.current;
    if (!invoiceEl) return;

    // Collect ALL stylesheet rules from the page into one <style> block
    let allCSS = '';
    try {
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          Array.from(sheet.cssRules || []).forEach(rule => {
            allCSS += rule.cssText + '\n';
          });
        } catch (_) { /* skip cross-origin sheets */ }
      });
    } catch (_) {}

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${inv.invoiceNumber}</title>
  <style>
    ${allCSS}
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #fff; font-family: ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; size: A4; }
    }
  </style>
</head>
<body>
  ${invoiceEl.outerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  <\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  if (loading || !inv) return <div className="p-10 text-center text-slate-400">Loading invoice...</div>;

  return (
    <div>
      {/* Action bar — hidden in print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium">
          <ArrowLeft size={16}/> Back to Invoices
        </button>
        <div className="flex gap-2">
          {inv.status === 'draft' && (
            <>
              <button onClick={() => navigate(`/invoices/${id}/edit`)} className="btn-outline flex items-center gap-1.5">
                <Edit2 size={14}/> Edit
              </button>
              <button onClick={() => dispatch(issueInvoice(id))} className="btn-primary flex items-center gap-1.5">
                <Send size={14}/> Issue Invoice
              </button>
            </>
          )}
          {!['paid','cancelled'].includes(inv.status) && inv.status !== 'draft' && (
            <button onClick={() => { if(window.confirm('Cancel invoice?')) dispatch(cancelInvoice(id)); }}
              className="btn-outline text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5">
              <XCircle size={14}/> Cancel
            </button>
          )}
          <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5">
            <Printer size={14}/> Print / PDF
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div ref={printRef} className="bg-white max-w-4xl mx-auto shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none print:max-w-full">
        {/* Top color band */}
        <div className="bg-blue-700 h-2"/>

        {/* Header */}
        <div className="px-10 py-8 flex items-start justify-between border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">INVOICE</h2>
            <p className="text-blue-700 font-mono font-bold text-sm mt-1">{inv.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800 text-base">Your Company Name</p>
            <p className="text-slate-500 text-xs mt-1">123, Industrial Area</p>
            <p className="text-slate-500 text-xs">Hyderabad, 500001</p>
            <p className="text-slate-500 text-xs">GSTIN: 36ABCDE1234F1Z5</p>
          </div>
        </div>

        {/* Party + Meta */}
        <div className="px-10 py-6 grid grid-cols-2 gap-8 bg-slate-50/50">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">Bill To</p>
            <p className="font-bold text-slate-900">{inv.partyName}</p>
            {inv.partyAddress && <p className="text-slate-500 text-sm mt-1">{inv.partyAddress}</p>}
            {inv.partyGST     && <p className="text-slate-500 text-sm">GSTIN: {inv.partyGST}</p>}
            {inv.partyPhone   && <p className="text-slate-500 text-sm">Ph: {inv.partyPhone}</p>}
          </div>
          <div className="text-right space-y-1.5 text-sm">
            <div className="flex justify-end gap-8">
              <span className="text-slate-400">Invoice Date</span>
              <span className="font-medium text-slate-800 w-28 text-right">{fmtDt(inv.invoiceDate)}</span>
            </div>
            {inv.dueDate && (
              <div className="flex justify-end gap-8">
                <span className="text-slate-400">Due Date</span>
                <span className="font-medium text-slate-800 w-28 text-right">{fmtDt(inv.dueDate)}</span>
              </div>
            )}
            {inv.paymentTerms && (
              <div className="flex justify-end gap-8">
                <span className="text-slate-400">Terms</span>
                <span className="font-medium text-slate-800 w-28 text-right">{inv.paymentTerms}</span>
              </div>
            )}
            <div className="flex justify-end gap-8 pt-2">
              <span className="text-slate-400">Status</span>
              <div className="w-28 text-right"><StatusBadge status={inv.status}/></div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="px-10 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs uppercase text-slate-400 tracking-wider">
                <th className="pb-3 text-left w-6">#</th>
                <th className="pb-3 text-left">Item</th>
                <th className="pb-3 text-center">HSN</th>
                <th className="pb-3 text-center">Qty</th>
                <th className="pb-3 text-right">Rate</th>
                <th className="pb-3 text-right">Disc</th>
                <th className="pb-3 text-right">GST</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.lineItems?.map((item, i) => (
                <tr key={i} className="text-slate-700">
                  <td className="py-3 text-slate-400 text-xs">{i+1}</td>
                  <td className="py-3">
                    <p className="font-medium">{item.productName}</p>
                    {item.productCode && <p className="text-xs text-slate-400">{item.productCode}</p>}
                  </td>
                  <td className="py-3 text-center text-slate-500 text-xs">{item.hsnCode || '—'}</td>
                  <td className="py-3 text-center">{item.quantity} {item.unit}</td>
                  <td className="py-3 text-right">{fmt(item.unitPrice)}</td>
                  <td className="py-3 text-right text-slate-500">{item.discount||0}%</td>
                  <td className="py-3 text-right text-slate-500">{item.taxRate||0}% ({fmt(item.taxAmount)})</td>
                  <td className="py-3 text-right font-semibold">{fmt(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-10 py-6 flex justify-end border-t border-slate-100">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{fmt(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST</span><span>{fmt(inv.taxAmount)}</span>
            </div>
            {inv.discountAmt > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span><span>- {fmt(inv.discountAmt)}</span>
              </div>
            )}
            <div className="border-t-2 border-blue-700 pt-3 flex justify-between font-black text-lg">
              <span className="text-slate-900">Total</span>
              <span className="text-blue-700">{fmt(inv.totalAmount)}</span>
            </div>
            {inv.amountPaid > 0 && (
              <>
                <div className="flex justify-between text-green-700">
                  <span>Amount Paid</span><span>{fmt(inv.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600">
                  <span>Balance Due</span><span>{fmt(inv.balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {(inv.notes || inv.termsAndConditions) && (
          <div className="px-10 py-6 border-t border-slate-100 grid grid-cols-2 gap-8 text-xs text-slate-500">
            {inv.notes && <div><p className="font-semibold text-slate-700 mb-1">Notes</p><p>{inv.notes}</p></div>}
            {inv.termsAndConditions && <div><p className="font-semibold text-slate-700 mb-1">Terms & Conditions</p><p>{inv.termsAndConditions}</p></div>}
          </div>
        )}

        <div className="bg-blue-700 h-1.5"/>
      </div>

      {/* Print styles handled via new print window */}
    </div>
  );
}