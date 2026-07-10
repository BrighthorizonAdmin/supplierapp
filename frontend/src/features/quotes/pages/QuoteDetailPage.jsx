import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchQuoteById, deleteQuote } from '../quoteSlice';
import { fetchSettings } from '../../notifications/settingsSlice';
import { format } from 'date-fns';
import { Printer, ArrowLeft, Edit2, Trash2 } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDt  = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0,  maximumFractionDigits: 0 });

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (!num || num === 0) return 'Zero Rupees Only';
  function convert(n) {
    if (n < 20)      return ones[n];
    if (n < 100)     return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000)    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000)  return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000)return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);
  let result   = convert(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
}

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-orange-100 text-orange-700',
  deletedByDealer: 'bg-red-200 text-red-800',
};

const STATUS_LABELS = {
  deletedByDealer: 'Deleted by Dealer',
};

// ── Tax breakdown helper (CGST + SGST split) ──────────────────────────────────
function buildTaxBreakdown(lineItems = []) {
  const breakdown = {};
  lineItems.forEach((item) => {
    const rate = Number(item.taxRate) || 0;
    if (!rate) return;
    if (!breakdown[rate]) breakdown[rate] = { taxable: 0, tax: 0 };
    const taxable = Number(item.quantity) * Number(item.unitPrice);
    breakdown[rate].taxable += taxable;
    breakdown[rate].tax     += Number(item.taxAmount) || 0;
  });
  return breakdown;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function QuoteDetailPage() {
  const { id }   = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const printRef = useRef();

  const { selectedQuote: q, loading } = useSelector((s) => s.quotes);
  const settingsData = useSelector((s) => s.settings?.data || {});

  useEffect(() => {
    dispatch(fetchQuoteById(id));
    dispatch(fetchSettings());
  }, [dispatch, id]);

  // ── Company info from Settings ────────────────────────────────────
  const COMPANY = {
    name:    settingsData.companyName    || 'Your Company Name',
    address: settingsData.companyAddress || '',
    mobile:  settingsData.companyMobile  || '',
    gstin:   settingsData.companyGSTIN   || '',
    pan:     settingsData.companyPAN     || '',
    email:   settingsData.companyEmail   || '',
    website: settingsData.companyWebsite || '',
    bankName:   settingsData.bankName    || '',
    bankIFSC:   settingsData.bankIFSC    || '',
    bankAccount:settingsData.bankAccount || '',
    bankBranch: settingsData.bankBranch  || '',
  };

  // ── Print handler — opens new window, injects styles, triggers print ──────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    let allCSS = '';
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try { Array.from(sheet.cssRules || []).forEach((rule) => { allCSS += rule.cssText + '\n'; }); } catch (_) {}
      });
    } catch (_) {}
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Quotation ${q?.quoteNumber || ''}</title>
<style>
${allCSS}
*{box-sizing:border-box;}
body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@media print{body{padding:0;}@page{margin:8mm;size:A4;}}
</style>
</head><body>${el.outerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script>
</body></html>`);
    win.document.close();
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return;
    const res = await dispatch(deleteQuote(id));
    if (!res.error) navigate('/quotes');
  };

  if (loading || !q) return <div className="p-10 text-center text-slate-400">Loading quote...</div>;

  const taxBreakdown   = buildTaxBreakdown(q.lineItems || []);
  const totalTaxAmount = q.taxAmount || 0;
  const totalItems     = (q.lineItems || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  const inWords        = numberToWords(Math.round(q.totalAmount || 0));

  // Bank details: quote's own values first, fall back to company settings
  const BANK = {
    name:          q.bankDetails?.name          || COMPANY.bankName    || '',
    ifscCode:      q.bankDetails?.ifscCode       || COMPANY.bankIFSC    || '',
    accountNumber: q.bankDetails?.accountNumber  || COMPANY.bankAccount || '',
    bankBranch:    q.bankDetails?.bankBranch      || COMPANY.bankBranch  || '',
  };

  // ═══════════════════════════════════════════════════════════════════
  //  SCREEN LAYOUT (toolbar + print preview card)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-100 pb-10">

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotes')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">{q.quoteNumber}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[q.status] || q.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {q.source !== 'dealer' && (
            <>
              <button
                onClick={() => navigate(`/quotes/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow transition-colors"
          >
            <Printer size={14} /> Print / Download PDF
          </button>
        </div>
      </div>

      {/* ── Print-ready quotation card ── */}
      <div className="max-w-4xl mx-auto mt-6 px-4 pb-10">
        <div ref={printRef} style={{ background: '#fff', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111827', border: '1px solid #d1d5db' }}>

          {/* 1 ── Top strip ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px' }}>
            <span style={{ fontWeight: '700', fontSize: '11px', letterSpacing: '1px', color: '#111827' }}>QUOTATION</span>
            <span style={{ fontSize: '10.5px', color: '#111827' }}>One Stop For Billing Solutions</span>
          </div>

          {/* 2 ── Company header ── */}
          <div style={{ padding: '14px 16px 10px 16px', borderBottom: '3px solid #1e3a8a' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {/* Logo placeholder */}
              <div style={{ width: '64px', height: '64px', border: '1.5px dashed #9ca3af', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', color: '#9ca3af', letterSpacing: '0.5px' }}>LOGO</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#1e3a8a', lineHeight: '1.05', letterSpacing: '0.3px', marginBottom: '5px' }}>{COMPANY.name}</div>
                {COMPANY.address && <div style={{ fontSize: '10.5px', color: '#374151', marginBottom: '3px' }}>{COMPANY.address}</div>}
                <div style={{ fontSize: '10.5px', color: '#374151', display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '2px' }}>
                  {COMPANY.mobile  && <span><strong>Mobile:</strong> {COMPANY.mobile}</span>}
                  {COMPANY.gstin   && <span><strong>GSTIN:</strong> {COMPANY.gstin}</span>}
                  {COMPANY.pan     && <span><strong>PAN Number:</strong> {COMPANY.pan}</span>}
                </div>
                <div style={{ fontSize: '10.5px', color: '#374151', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {COMPANY.email   && <span><strong>Email:</strong> {COMPANY.email}</span>}
                  {COMPANY.website && <span><strong>Website:</strong> {COMPANY.website}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* 3 ── Quote No / Date / Expiry ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', background: '#f1f5f9' }}>
            {[
              { label: 'Quotation No.', value: q.quoteNumber || '—' },
              { label: 'Quotation Date', value: fmtDt(q.quoteDate) },
              { label: 'Expiry Date',   value: fmtDt(q.expiryDate) },
            ].map(({ label, value }, i) => (
              <div key={i} style={{ padding: '9px 14px', borderRight: i < 2 ? '1px solid #cbd5e1' : 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>{label}:</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#111827' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* 4 ── Bill To / Ship To / Salesman ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #d1d5db' }}>
            <div style={{ padding: '9px 14px', borderRight: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.6px', marginBottom: '4px' }}>BILL TO</div>
              <div style={{ fontWeight: '700', fontSize: '12px', color: '#111827', marginBottom: '2px' }}>{q.partyName || '—'}</div>
              {q.partyPhone    && <div style={{ fontSize: '10.5px', color: '#374151' }}>Mobile: {q.partyPhone}</div>}
              {q.placeOfSupply && <div style={{ fontSize: '10.5px', color: '#374151' }}>Place of Supply: {q.placeOfSupply}</div>}
            </div>
            <div style={{ padding: '9px 14px', borderRight: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.6px', marginBottom: '4px' }}>SHIP TO</div>
              <div style={{ fontWeight: '700', fontSize: '12px', color: '#111827' }}>{q.shippingName || q.partyName || '—'}</div>
            </div>
            <div style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.6px', paddingTop: '2px' }}>Salesman</div>
              <div style={{ fontSize: '12px', color: '#111827', fontWeight: '500' }}>{q.salesman || ''}</div>
            </div>
          </div>

          {/* 5 ── Items table ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #d1d5db' }}>
            <colgroup>
              <col style={{ width: '35%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                {[
                  { label: 'ITEMS',  align: 'left'   },
                  { label: 'HSN',    align: 'center' },
                  { label: 'QTY.',   align: 'center' },
                  { label: 'RATE',   align: 'right'  },
                  { label: 'TAX',    align: 'right'  },
                  { label: 'AMOUNT', align: 'right'  },
                ].map(({ label, align }, i, arr) => (
                  <th key={label} style={{ padding: '8px 10px', textAlign: align, fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.5px', borderRight: i < arr.length - 1 ? '1px solid #3b5fc0' : 'none' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(q.lineItems || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '9px 10px', fontSize: '11.5px', color: '#111827', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: '500' }}>{item.productName}</div>
                    {item.description && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.description}</div>}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '11px', color: '#374151', textAlign: 'center', verticalAlign: 'top' }}>
                    {item.hsnCode || '-'}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '11.5px', color: '#374151', textAlign: 'center', verticalAlign: 'top' }}>
                    {item.quantity} {item.unit || 'PCS'}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '11.5px', color: '#111827', textAlign: 'right', verticalAlign: 'top' }}>
                    {fmtNum(item.unitPrice)}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '11.5px', color: '#111827', textAlign: 'right', verticalAlign: 'top' }}>
                    <div>{fmtNum(item.taxAmount)}</div>
                    {item.taxRate > 0 && <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>({item.taxRate}%)</div>}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '11.5px', fontWeight: '600', color: '#111827', textAlign: 'right', verticalAlign: 'top' }}>
                    {fmtInt(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f3f4f6', borderTop: '2px solid #9ca3af', borderBottom: '2px solid #9ca3af' }}>
                <td style={{ padding: '7px 10px', fontWeight: '700', fontSize: '11.5px', color: '#111827', letterSpacing: '0.5px' }}>SUBTOTAL</td>
                <td></td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '700', fontSize: '11.5px', color: '#111827' }}>{totalItems}</td>
                <td></td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600', fontSize: '11.5px', color: '#374151' }}>₹ {fmtNum(totalTaxAmount)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: '#111827' }}>₹ {fmtInt(q.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>

          {/* 6 ── Bank Details + Tax Summary ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #d1d5db' }}>
            {/* Bank Details */}
            <div style={{ padding: '12px 14px', borderRight: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#111827', marginBottom: '7px', letterSpacing: '0.3px' }}>BANK DETAILS</div>
              {[
                { label: 'Name',       value: BANK.name          },
                { label: 'IFSC Code',  value: BANK.ifscCode      },
                { label: 'Account No', value: BANK.accountNumber },
                { label: 'Bank',       value: BANK.bankBranch    },
              ].filter((r) => r.value).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '10.5px' }}>
                  <span style={{ color: '#6b7280', minWidth: '76px', flexShrink: 0 }}>{label}:</span>
                  <span style={{ color: '#111827' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Tax Summary */}
            <div style={{ padding: '12px 14px' }}>
              {/* Taxable Amount — show once at top */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151', marginBottom: '4px' }}>
                <span>Taxable Amount</span>
                <span>₹ {fmtNum(q.subtotal)}</span>
              </div>
              {/* Per-rate CGST + SGST */}
              {Object.entries(taxBreakdown).map(([rate, { tax }]) => {
                const half = +(tax / 2).toFixed(2);
                return (
                  <div key={rate}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151', marginBottom: '4px' }}>
                      <span>CGST @{rate / 2}%</span>
                      <span>₹ {fmtNum(half)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151', marginBottom: '4px' }}>
                      <span>SGST @{rate / 2}%</span>
                      <span>₹ {fmtNum(half)}</span>
                    </div>
                  </div>
                );
              })}
              {/* Additional Charges */}
              {(q.additionalCharges || []).filter(c => Number(c.amount) > 0).map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151', marginBottom: '4px' }}>
                    <span>{c.label || 'Additional Charge'}</span>
                    <span>₹ {fmtNum(c.amount)}</span>
                  </div>
                  {Number(c.taxRate) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#6b7280', marginBottom: '4px' }}>
                      <span>GST @{c.taxRate}% on {c.label || 'charge'}</span>
                      <span>₹ {fmtNum(c.taxAmount)}</span>
                    </div>
                  )}
                </div>
              ))}
              {/* Overall Discount */}
              {q.overallDiscount && Number(q.overallDiscount.amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#dc2626', marginBottom: '4px' }}>
                  <span>Discount{q.overallDiscount.discountType === 'percent' ? ` (${q.overallDiscount.value}%)` : ''}</span>
                  <span>- ₹ {fmtNum(q.overallDiscount.amount)}</span>
                </div>
              )}
              {/* Total Amount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: '700', color: '#111827', borderTop: '1.5px solid #374151', paddingTop: '6px', marginTop: '4px' }}>
                <span>Total Amount</span>
                <span>₹ {fmtInt(q.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* 7 ── Total in words ── */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #d1d5db', textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#374151', marginBottom: '2px' }}>Total Amount (in words)</div>
            <div style={{ fontSize: '11px', color: '#111827' }}>{inWords}</div>
          </div>

          {/* 8 ── Notes / Terms ── */}
          {(q.notes || q.termsAndConditions) && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #d1d5db', display: 'grid', gridTemplateColumns: q.notes && q.termsAndConditions ? '1fr 1fr' : '1fr', gap: '14px' }}>
              {q.notes && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', marginBottom: '4px' }}>NOTES</div>
                  <div style={{ fontSize: '10.5px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{q.notes}</div>
                </div>
              )}
              {q.termsAndConditions && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.5px', marginBottom: '4px' }}>TERMS &amp; CONDITIONS</div>
                  <div style={{ fontSize: '10.5px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{q.termsAndConditions}</div>
                </div>
              )}
            </div>
          )}

          {/* 9 ── Authorised Signatory ── */}
          <div style={{ padding: '20px 16px 16px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
              <div style={{ height: '48px', marginBottom: '6px' }} />
              <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#374151', letterSpacing: '0.4px' }}>AUTHORISED SIGNATORY FOR</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#1e3a8a', marginTop: '3px' }}>{COMPANY.name}</div>
              </div>
            </div>
          </div>

        </div>{/* end printRef */}
      </div>
    </div>
  );
}
