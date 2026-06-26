import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchChallanById } from '../deliveryChallanSlice';
import { fetchSettings } from '../../notifications/settingsSlice';
import { format } from 'date-fns';
import { Printer, ArrowLeft } from 'lucide-react';

// ── Number to words (Indian system) ─────────────────────────────────────────
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS_W = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function numWords(n) {
  if (n === 0) return '';
  if (n < 20)  return ONES[n];
  if (n < 100) return TENS_W[Math.floor(n/10)] + (n%10 ? ' '+ONES[n%10] : '');
  if (n < 1000)     return ONES[Math.floor(n/100)]        +' Hundred'  +(n%100      ? ' '+numWords(n%100)      : '');
  if (n < 100000)   return numWords(Math.floor(n/1000))   +' Thousand' +(n%1000     ? ' '+numWords(n%1000)     : '');
  if (n < 10000000) return numWords(Math.floor(n/100000)) +' Lakh'     +(n%100000   ? ' '+numWords(n%100000)   : '');
  return               numWords(Math.floor(n/10000000))   +' Crore'    +(n%10000000 ? ' '+numWords(n%10000000) : '');
}
function toWords(amount) {
  const n = Math.round(Math.abs(amount || 0));
  return n === 0 ? 'Zero Rupees' : numWords(n) + ' Rupees';
}

const fmt     = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');

// ── colour constants ─────────────────────────────────────────────────────────
const NAVY = '#1e3a5f';
const NAVY2 = '#2d4f7c';

export default function DeliveryChallanPrintPage() {
  const { id }   = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedChallan: c, loading } = useSelector((s) => s.challans);
  const settings = useSelector((s) => s.settings?.data || {});

  useEffect(() => {
    dispatch(fetchChallanById(id));
    dispatch(fetchSettings());
  }, [dispatch, id]);

  if (loading || !c || c._id !== id) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#6b7280' }}>
        Loading…
      </div>
    );
  }

  // ── compute summary ────────────────────────────────────────────────────────
  let itemTaxable = 0;
  const taxByRate = {};
  (c.lineItems || []).forEach((it) => {
    const base = (it.quantity || 0) * (it.unitPrice || 0) - (it.discountAmount || 0);
    itemTaxable += base;
    const rate = it.taxRate || 0;
    if (rate > 0) taxByRate[rate] = (taxByRate[rate] || 0) + (it.taxAmount || 0);
  });
  const charges = c.additionalCharges || [];
  const chargeBase = charges.reduce((s, ch) => s + (ch.amount || 0), 0);
  charges.forEach((ch) => {
    const rate = ch.taxRate || 0;
    if (rate > 0 && ch.amount > 0) taxByRate[rate] = (taxByRate[rate] || 0) + (ch.taxAmount || 0);
  });
  const totalTaxable = itemTaxable + chargeBase;
  const itemTotals   = (c.lineItems || []).reduce(
    (acc, it) => ({ tax: acc.tax + (it.taxAmount || 0), total: acc.total + (it.lineTotal || 0) }),
    { tax: 0, total: 0 }
  );

  const co  = settings;
  const cName = co.companyName || 'Your Company';

  const metaRows = [
    { label: 'Courier Partner', value: c.courierPartner },
    { label: 'AWB Number',      value: c.awbNumber      },
    { label: 'Order ID',        value: c.orderId        },
    { label: 'Warranty Period', value: c.warrantyPeriod },
    { label: 'Salesman',        value: c.salesman       },
  ].filter((r) => r.value);

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, color: '#111', background: '#f3f4f6', minHeight: '100vh' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { margin: 10mm; size: A4; }
          .challan-doc { box-shadow: none !important; margin: 0 !important; border: none !important; }
        }
      `}</style>

      {/* ── Controls bar ── */}
      <div className="no-print" style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => navigate(-1)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280', background:'none', border:'none', cursor:'pointer' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', background:'#4f46e5', color:'#fff', fontSize:13, fontWeight:700, borderRadius:8, border:'none', cursor:'pointer' }}
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* ── Document ── */}
      <div className="challan-doc" style={{ maxWidth:860, margin:'24px auto', background:'#fff', padding:'28px 36px', boxShadow:'0 1px 8px rgba(0,0,0,.08)', borderRadius:4 }}>

        {/* Top label bar */}
        <div style={{ display:'flex', justifyContent:'space-between', borderBottom:`2px solid ${NAVY}`, paddingBottom:6, marginBottom:14 }}>
          <span style={{ fontSize:13, fontWeight:800, letterSpacing:1.2, color:NAVY }}>DELIVERY CHALLAN</span>
          {co.companyWebsite && <span style={{ fontSize:11, color:'#6b7280' }}>{co.companyWebsite}</span>}
        </div>

        {/* Company header */}
        <div style={{ display:'flex', gap:16, marginBottom:14 }}>
          <div style={{ width:60, height:60, background:NAVY, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'#fff', fontSize:26, fontWeight:900 }}>{cName.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:22, fontWeight:900, color:NAVY, lineHeight:1.1, marginBottom:4 }}>{cName}</div>
            {co.companyAddress && <div style={{ fontSize:10.5, color:'#374151', marginBottom:2 }}>{co.companyAddress}</div>}
            <div style={{ fontSize:10.5, color:'#374151' }}>
              {co.companyMobile  && <span>Mobile: <strong>{co.companyMobile}</strong></span>}
              {co.companyGSTIN   && <span style={{ marginLeft:14 }}>GSTIN: <strong>{co.companyGSTIN}</strong></span>}
              {co.companyPAN     && <span style={{ marginLeft:14 }}>PAN Number: <strong>{co.companyPAN}</strong></span>}
            </div>
            {(co.companyEmail || co.companyWebsite) && (
              <div style={{ fontSize:10.5, color:'#374151', marginTop:1 }}>
                {co.companyEmail   && <span>Email: {co.companyEmail}</span>}
                {co.companyWebsite && <span style={{ marginLeft:14 }}>{co.companyWebsite}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Challan No. & Date row */}
        <div style={{ display:'flex', justifyContent:'space-between', border:'1px solid #d1d5db', borderRadius:4, padding:'7px 14px', marginBottom:12, background:'#f9fafb', fontSize:12 }}>
          <div><span style={{ fontWeight:700 }}>Challan No.: </span>{c.challanNumber}</div>
          <div><span style={{ fontWeight:700 }}>Challan Date: </span>{fmtDate(c.challanDate)}</div>
        </div>

        {/* Bill To / Ship To / Meta */}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:0, fontSize:11 }}>
          <tbody>
            <tr style={{ verticalAlign:'top' }}>
              {/* Bill To */}
              <td style={{ width:'33%', border:'1px solid #d1d5db', padding:'9px 11px' }}>
                <div style={{ fontSize:9.5, fontWeight:700, color:'#6b7280', marginBottom:5, letterSpacing:0.5 }}>BILL TO</div>
                <div style={{ fontWeight:700, fontSize:12, marginBottom:3 }}>{c.partyName || '—'}</div>
                {c.partyAddress   && <div style={{ color:'#374151', marginBottom:2 }}>{c.partyAddress}</div>}
                {c.partyGST       && <div style={{ marginBottom:2 }}><strong>GSTIN:</strong> {c.partyGST}</div>}
                {c.partyPAN       && <div style={{ marginBottom:2 }}><strong>PAN Number:</strong> {c.partyPAN}</div>}
                {c.placeOfSupply  && <div><strong>Place of Supply:</strong> {c.placeOfSupply}</div>}
              </td>
              {/* Ship To */}
              <td style={{ width:'33%', border:'1px solid #d1d5db', borderLeft:'none', padding:'9px 11px' }}>
                <div style={{ fontSize:9.5, fontWeight:700, color:'#6b7280', marginBottom:5, letterSpacing:0.5 }}>SHIP TO</div>
                {c.shipTo?.name ? (
                  <>
                    <div style={{ fontWeight:700, fontSize:12, marginBottom:3 }}>{c.shipTo.name}</div>
                    {c.shipTo.address && <div style={{ color:'#374151', marginBottom:2 }}>{c.shipTo.address}</div>}
                    {c.shipTo.gstin   && <div><strong>GSTIN:</strong> {c.shipTo.gstin}</div>}
                  </>
                ) : c.partyName ? (
                  <>
                    <div style={{ fontWeight:700, fontSize:12, marginBottom:3 }}>{c.partyName}</div>
                    {c.partyAddress && <div style={{ color:'#374151' }}>{c.partyAddress}</div>}
                  </>
                ) : null}
              </td>
              {/* Delivery Meta */}
              <td style={{ width:'34%', border:'1px solid #d1d5db', borderLeft:'none', padding:'9px 11px' }}>
                {metaRows.map((row) => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ color:'#6b7280' }}>{row.label}</span>
                    <span style={{ fontWeight:600, textAlign:'right', maxWidth:'55%' }}>{row.value}</span>
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, marginTop:0 }}>
          <thead>
            <tr style={{ background:NAVY, color:'#fff' }}>
              <th style={{ padding:'7px 10px', textAlign:'left',   fontWeight:700, fontSize:10, letterSpacing:0.5, borderRight:`1px solid ${NAVY2}` }}>ITEMS</th>
              <th style={{ padding:'7px 8px',  textAlign:'center', fontWeight:700, fontSize:10, width:72,  borderRight:`1px solid ${NAVY2}` }}>HSN / SAC</th>
              <th style={{ padding:'7px 8px',  textAlign:'center', fontWeight:700, fontSize:10, width:68,  borderRight:`1px solid ${NAVY2}` }}>QTY.</th>
              <th style={{ padding:'7px 8px',  textAlign:'right',  fontWeight:700, fontSize:10, width:90,  borderRight:`1px solid ${NAVY2}` }}>RATE</th>
              <th style={{ padding:'7px 8px',  textAlign:'right',  fontWeight:700, fontSize:10, width:90,  borderRight:`1px solid ${NAVY2}` }}>TAX</th>
              <th style={{ padding:'7px 8px',  textAlign:'right',  fontWeight:700, fontSize:10, width:90  }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(c.lineItems || []).map((it, idx) => (
              <tr key={idx} style={{ borderBottom:'1px solid #e5e7eb', verticalAlign:'top' }}>
                <td style={{ padding:'8px 10px' }}>
                  <div style={{ fontWeight:700 }}>{it.productName}</div>
                  {it.description && <div style={{ color:'#6b7280', fontSize:10, marginTop:2 }}>{it.description}</div>}
                </td>
                <td style={{ padding:'8px 8px', textAlign:'center', color:'#374151' }}>{it.hsnCode || '-'}</td>
                <td style={{ padding:'8px 8px', textAlign:'center' }}>{it.quantity} {it.unit || 'PCS'}</td>
                <td style={{ padding:'8px 8px', textAlign:'right' }}>{fmt(it.unitPrice)}</td>
                <td style={{ padding:'8px 8px', textAlign:'right' }}>
                  <div>{fmt(it.taxAmount)}</div>
                  {it.taxRate > 0 && <div style={{ color:'#9ca3af', fontSize:9 }}>({it.taxRate}%)</div>}
                </td>
                <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:600 }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#f3f4f6', fontWeight:700, borderTop:`2px solid #d1d5db`, borderBottom:'1px solid #d1d5db' }}>
              <td style={{ padding:'7px 10px', fontSize:11 }}>SUBTOTAL</td>
              <td style={{ padding:'7px 8px', textAlign:'center' }}>{(c.lineItems || []).length}</td>
              <td></td>
              <td></td>
              <td style={{ padding:'7px 8px', textAlign:'right' }}>₹ {fmt(itemTotals.tax)}</td>
              <td style={{ padding:'7px 8px', textAlign:'right' }}>₹ {fmt(itemTotals.total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer: Bank + Terms (left) | Totals + Signature (right) */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <tbody>
            <tr style={{ verticalAlign:'top' }}>

              {/* Left column */}
              <td style={{ width:'50%', border:'1px solid #e5e7eb', borderTop:'none', padding:'12px 14px' }}>
                {(c.bankDetails?.name || c.bankDetails?.accountNumber) && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, marginBottom:6, fontSize:11, color:NAVY }}>BANK DETAILS</div>
                    {[
                      ['Name',       c.bankDetails.name         ],
                      ['IFSC Code',  c.bankDetails.ifscCode     ],
                      ['Account No', c.bankDetails.accountNumber],
                      ['Bank',       c.bankDetails.bankBranch   ],
                    ].filter(([,v]) => v).map(([label, val]) => (
                      <div key={label} style={{ marginBottom:3 }}>
                        <span style={{ color:'#6b7280' }}>{label}: </span>{val}
                      </div>
                    ))}
                  </div>
                )}
                {c.termsAndConditions && (
                  <div>
                    <div style={{ fontWeight:700, marginBottom:5, fontSize:11, color:NAVY }}>TERMS AND CONDITIONS</div>
                    <div style={{ color:'#374151', whiteSpace:'pre-wrap', fontSize:10.5, lineHeight:1.5 }}>{c.termsAndConditions}</div>
                  </div>
                )}
                {c.notes && (
                  <div style={{ marginTop: c.termsAndConditions ? 10 : 0 }}>
                    <div style={{ fontWeight:700, marginBottom:5, fontSize:11, color:NAVY }}>NOTES</div>
                    <div style={{ color:'#374151', whiteSpace:'pre-wrap', fontSize:10.5 }}>{c.notes}</div>
                  </div>
                )}
              </td>

              {/* Right column */}
              <td style={{ width:'50%', border:'1px solid #e5e7eb', borderTop:'none', borderLeft:'none', padding:'12px 14px' }}>

                {/* Additional charges */}
                {charges.filter((ch) => ch.amount > 0).map((ch, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ color:'#374151' }}>
                      {ch.label || 'Charge'}
                      {ch.taxRate > 0 ? ` (excl ${ch.taxRate}% GST)` : ''}
                    </span>
                    <span style={{ fontWeight:600 }}>₹ {fmt(ch.amount)}</span>
                  </div>
                ))}

                <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:6, marginTop: charges.filter((ch) => ch.amount > 0).length ? 4 : 0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span>Taxable Amount</span>
                    <span>₹ {fmt(totalTaxable)}</span>
                  </div>

                  {Object.entries(taxByRate).map(([rate, amt]) => (
                    <div key={rate} style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span>
                        {c.placeOfSupply && c.placeOfSupply !== (co.companyAddress || '').split(',').pop()?.trim()
                          ? `IGST @${rate}%`
                          : `GST @${rate}%`
                        }
                      </span>
                      <span>₹ {fmt(amt)}</span>
                    </div>
                  ))}

                  {c.overallDiscount?.amount > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, color:'#dc2626' }}>
                      <span>Discount</span>
                      <span>- ₹ {fmt(c.overallDiscount.amount)}</span>
                    </div>
                  )}

                  {c.autoRoundOff && c.roundOffAmount !== 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, color:'#6b7280' }}>
                      <span>Round Off</span>
                      <span>{c.roundOffAmount >= 0 ? '+ ' : ''}₹ {fmt(Math.abs(c.roundOffAmount))}</span>
                    </div>
                  )}
                </div>

                {/* Total Amount */}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, borderTop:`2px solid ${NAVY}`, paddingTop:7 }}>
                  <span style={{ fontWeight:800, fontSize:13 }}>Total Amount</span>
                  <span style={{ fontWeight:800, fontSize:13 }}>₹ {fmt(c.totalAmount)}</span>
                </div>

                {/* In words */}
                <div style={{ marginTop:6, fontSize:10.5 }}>
                  <span style={{ fontWeight:700 }}>Total Amount (in words)</span>
                  <div style={{ color:'#374151', marginTop:2 }}>{toWords(c.totalAmount)}</div>
                </div>

                {/* Authorized Signatory */}
                <div style={{ marginTop:28, textAlign:'right' }}>
                  <div style={{ height:52, border:'1px solid #d1d5db', borderRadius:4, marginBottom:6 }} />
                  <div style={{ fontSize:10, color:'#374151', lineHeight:1.6 }}>
                    <div style={{ fontWeight:700 }}>AUTHORISED SIGNATORY FOR</div>
                    <div style={{ fontWeight:800, textTransform:'uppercase', color:NAVY }}>{cName}</div>
                  </div>
                </div>

              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}
