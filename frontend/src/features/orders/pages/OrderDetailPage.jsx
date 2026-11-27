import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrderById, confirmOrder, cancelOrder, clearSelected } from '../orderSlice';
import { ArrowLeft, Printer, FileText, CheckCircle, XCircle, Truck, MapPin, CreditCard, CheckCheck, Hash, Save, ChevronDown, Check, Search, ShoppingCart, IndianRupee, Package, Mail, Phone, Store, RotateCcw, Clock, ArrowRight, AlertTriangle, Wallet, Activity } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import KPICard from '../../../components/ui/KPICard';
import SectionCard from '../../../components/ui/SectionCard';

const STATUS_RANK = {
  draft: 0, pending: 1, confirmed: 2,
  processing: 2, shipped: 3, out_for_delivery: 4, delivered: 5, cancelled: 6,
};

const PROGRESS_STEPS = [
  { label: 'Confirm', status: 'confirmed', Icon: CheckCircle },
  { label: 'Mark Shipped', status: 'shipped', Icon: Truck },
  { label: 'Out for Delivery', status: 'out_for_delivery', Icon: MapPin },
  { label: 'Mark Delivered', status: 'delivered', Icon: CheckCheck },
];

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const METHOD_LABELS = {
  cash: 'Cash', upi: 'UPI', neft: 'NEFT', rtgs: 'RTGS', imps: 'IMPS', 'bank-transfer': 'Bank Transfer',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

// When each step happened, from the order's timeline (latest matching event).
const stepDate = (timeline, status) => {
  const hit = [...(timeline || [])].reverse().find((e) => e.status === status);
  return hit?.timestamp ? format(new Date(hit.timestamp), 'dd MMM, hh:mm a') : null;
};

const OrderProgress = ({ order, onStatusUpdate, loading, serialsComplete }) => {
  const currentRank = STATUS_RANK[order.status] ?? 0;

  if (order.status === 'cancelled') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <XCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
        <span><strong>Cancelled.</strong> This order will not be fulfilled.</span>
      </div>
    );
  }

  const doneCount = PROGRESS_STEPS.filter((s) => currentRank >= STATUS_RANK[s.status]).length;
  const pct = PROGRESS_STEPS.length > 1
    ? Math.max(0, Math.min(100, ((doneCount - 1) / (PROGRESS_STEPS.length - 1)) * 100))
    : 0;
  const nextStep = PROGRESS_STEPS.find((s) => STATUS_RANK[s.status] === currentRank + 1);

  // Serial numbers must be entered before moving from confirmed → shipped
  const serialsBlocking = (step) =>
    step.status === 'shipped' && order.status === 'confirmed' && !serialsComplete;
  const nextBlocked = nextStep && serialsBlocking(nextStep);

  return (
    <div>
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[12.5%] right-[12.5%] top-5 h-1 rounded-full bg-slate-100" />
        <div
          className="absolute left-[12.5%] top-5 h-1 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct * 0.75}%` }}
        />

        {PROGRESS_STEPS.map((step) => {
          const stepRank = STATUS_RANK[step.status];
          const done = currentRank >= stepRank;
          const isNext = stepRank === currentRank + 1;
          const blocked = isNext && serialsBlocking(step);
          const when = done ? stepDate(order.timeline, step.status) : null;
          const { Icon } = step;

          return (
            <div key={step.status} className="relative z-10 flex flex-1 flex-col items-center text-center">
              <button
                onClick={() => isNext && onStatusUpdate(step.status)}
                disabled={!isNext || loading}
                title={blocked ? 'Enter or scan serial numbers before shipping' : isNext ? `Click to ${step.label}` : undefined}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all',
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : blocked
                      ? 'cursor-pointer border-amber-400 bg-amber-50 text-amber-600'
                      : isNext
                        ? 'cursor-pointer border-primary-500 bg-white text-primary-600 ring-4 ring-primary-100 hover:bg-primary-50'
                        : 'cursor-default border-slate-200 bg-white text-slate-300',
                ].join(' ')}
              >
                {done ? <Check size={18} strokeWidth={2.6} /> : <Icon size={18} strokeWidth={2.2} />}
              </button>
              <span className={`mt-2 text-xs font-semibold ${done ? 'text-emerald-700' : blocked ? 'text-amber-600' : isNext ? 'text-primary-700' : 'text-slate-400'}`}>
                {step.label.replace(/^Mark /, '')}
              </span>
              <span className="mt-0.5 min-h-[16px] text-[11px] text-slate-400">
                {when || (blocked ? 'Serials required' : isNext ? 'Next step' : '')}
              </span>
            </div>
          );
        })}
      </div>

      {nextStep && (
        <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          nextBlocked ? 'border-amber-200 bg-amber-50' : 'border-primary-100 bg-primary-50/60'
        }`}>
          <p className={`flex items-center gap-2 text-sm ${nextBlocked ? 'text-amber-800' : 'text-slate-700'}`}>
            {nextBlocked ? <AlertTriangle size={16} className="shrink-0 text-amber-500" /> : <ArrowRight size={16} className="shrink-0 text-primary-600" />}
            {nextBlocked
              ? <span><strong>Before shipping:</strong> select serial numbers for every item below and save them.</span>
              : <span>Next step: <strong>{nextStep.label}</strong></span>}
          </p>
          <button
            onClick={() => onStatusUpdate(nextStep.status)}
            disabled={loading}
            className={nextBlocked ? 'btn-secondary' : 'btn-primary'}
          >
            <nextStep.Icon size={15} /> {nextStep.label}
          </button>
        </div>
      )}

      {order.status === 'delivered' && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <span><strong>Delivered.</strong> The dealer&apos;s inventory has been updated with the quantities from this order.</span>
        </div>
      )}
    </div>
  );
};

// ── Serial Number Section ─────────────────────────────────────────────────────
const SerialNumberSection = ({ order, onSerialsComplete }) => {
  const [selections, setSelections] = useState({});  // { idx: ['SN001', 'SN002'] }
  const [serialOptions, setSerialOptions] = useState({});  // { productId: ['SN001', ...] }
  const [openDropdown,  setOpenDropdown]  = useState(null);
  const [searchTerms,   setSearchTerms]   = useState({});  // { idx: 'search text' }
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [errors,        setErrors]        = useState({});
  const [loadingOpts,   setLoadingOpts]   = useState(false);

  const lineItems = order?.items || [];

  const markComplete = useCallback((val) => {
    setSaved(val);
    onSerialsComplete?.(val);
  }, [onSerialsComplete]);

  // Pre-load already-saved serial selections
  useEffect(() => {
    if (!order?._id || !lineItems.length) return;
    const loadPre = async () => {
      try {
        if (order.invoiceId) {
          // Invoice exists (delivered orders): load from invoice line items
          const { data } = await api.get(`/invoices/${order.invoiceId}`);
          const inv = data.data;
          const pre = {};
          (inv.lineItems || []).forEach((li, i) => {
            if (li.serialNumbers?.length) pre[i] = li.serialNumbers;
          });
          setSelections(pre);
          markComplete((inv.lineItems || []).every(li => (li.serialNumbers || []).length === li.quantity));
        } else {
          // No invoice yet: load from dispatched units assigned to this order
          const { data } = await api.get(`/dispatched-units/for-order?orderId=${order._id}`);
          const units = data.data || [];
          const pre = {};
          lineItems.forEach((item, i) => {
            const pid = (item.productId?._id || item.productId)?.toString();
            const itemUnits = units.filter(u => u.productId?.toString() === pid);
            if (itemUnits.length) pre[i] = itemUnits.map(u => u.serialNumber);
          });
          setSelections(pre);
          markComplete(lineItems.every((item, i) => (pre[i] || []).length === item.quantity));
        }
      } catch { /* ignore */ }
    };
    loadPre();
  }, [order?._id, order?.invoiceId]); // eslint-disable-line

  // Fetch in-stock serial options for each product
  useEffect(() => {
    if (!lineItems.length || order?.status === 'delivered') return;
    const fetchOptions = async () => {
      setLoadingOpts(true);
      const opts = {};
      const uniqueProducts = [...new Set(
        lineItems.map(item => (item.productId?._id || item.productId)?.toString()).filter(Boolean)
      )];
      await Promise.all(uniqueProducts.map(async (productId) => {
        try {
          const { data } = await api.get(`/dispatched-units/in-stock?productId=${productId}`);
          opts[productId] = (data.data || []).map(u => u.serialNumber);
        } catch { opts[productId] = []; }
      }));
      setSerialOptions(opts);
      setLoadingOpts(false);
    };
    fetchOptions();
  }, [order?.status]); // eslint-disable-line

  const showStatuses = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  if (!showStatuses.includes(order?.status)) return null;
  if (!lineItems.length) return null;

  const getSerials = (idx) => selections[idx] || [];

  const toggleSerial = (idx, sn, qty) => {
    const current = getSerials(idx);
    const next = current.includes(sn)
      ? current.filter(s => s !== sn)
      : current.length < qty ? [...current, sn] : current;
    setSelections(p => ({ ...p, [idx]: next }));
    setErrors(p => { const n = { ...p }; delete n[idx]; return n; });
    markComplete(false);
  };

  const validate = () => {
    const e = {};
    lineItems.forEach((item, i) => {
      const serials = getSerials(i);
      if (serials.length !== item.quantity)
        e[i] = `Select exactly ${item.quantity} serial number${item.quantity > 1 ? 's' : ''} for "${item.productName || item.name}"`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (order.invoiceId) {
        // Invoice exists: save via invoice endpoint (existing flow)
        const { data: invData } = await api.get(`/invoices/${order.invoiceId}`);
        const inv = invData.data;
        const lineSerials = (inv.lineItems || []).map((_, i) => ({
          index: i,
          serialNumbers: getSerials(i),
        }));
        await api.patch(`/invoices/${order.invoiceId}/serials`, { lineSerials });
      } else {
        // No invoice yet: save via order serials endpoint
        const lineSerials = lineItems.map((item, i) => ({
          productId: (item.productId?._id || item.productId)?.toString(),
          serialNumbers: getSerials(i),
        }));
        await api.patch(`/orders/${order._id}/serials`, { lineSerials });
      }
      toast.success('Serial numbers saved successfully');
      markComplete(true);
      setErrors({});
      setOpenDropdown(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save serial numbers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="section-title">Serial numbers</h2>
            {saved && <span className="badge-green"><Check size={12} /> All saved</span>}
          </div>
          <p className="section-subtitle">
            {saved ? 'Recorded for warranty tracking' : 'Select the serial number of every unit before dispatch'}
          </p>
        </div>
      </div>

      {/* Overlay to close dropdown on outside click */}
      {openDropdown !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
      )}

      <div className="space-y-5 border-t border-slate-100 px-5 py-4">
        {lineItems.map((item, i) => {
          const selected = getSerials(i);
          const qty = item.quantity;
          const isOk = selected.length === qty;
          const productId = (item.productId?._id || item.productId)?.toString();
          const options = serialOptions[productId] || [];

          return (
            <div
              key={i}
              className={`space-y-1.5 relative ${openDropdown === i ? "z-50" : "z-0"
                }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {item.productName || item.name || "—"}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    × {qty} units
                  </span>
                </p>

                <span
                  className={`text-xs font-semibold ${isOk ? "text-green-600" : "text-orange-500"
                    }`}
                >
                  {selected.length} / {qty} {isOk ? "✓" : "selected"}
                </span>
              </div>

              <div
                className={`relative ${openDropdown === i ? "z-[9999]" : "z-10"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(openDropdown === i ? null : i);
                    setSearchTerms(p => ({ ...p, [i]: '' }));
                  }}
                  disabled={order.status === "delivered"}
                  className={`w-full text-left text-sm border rounded-lg px-3 py-2 transition-colors flex items-center justify-between ${errors[i]
                      ? "border-red-400 bg-red-50"
                      : isOk
                        ? "border-green-400 bg-green-50"
                        : "border-slate-200 bg-white hover:border-blue-400"
                    }`}
                >
                  <span
                    className={
                      selected.length === 0
                        ? "text-slate-400"
                        : "text-slate-700 truncate pr-2"
                    }
                  >
                    {selected.length === 0
                      ? `Select ${qty} serial number${qty > 1 ? "s" : ""
                      }…`
                      : selected.join(", ")}
                  </span>

                  <ChevronDown
                    size={14}
                    className="text-slate-400 shrink-0"
                  />
                </button>

                {openDropdown === i && (
                  <div
                    className="
              absolute
              top-full
              left-0
              mt-1
              w-full
              z-[9999]
              bg-white
              border
              border-slate-200
              rounded-xl
              shadow-xl
              max-h-52
              overflow-y-auto
            "
                  >
                    {!loadingOpts && options.length > 0 && (
                      <div className="sticky top-0 bg-white border-b border-slate-100 px-2 py-2">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            value={searchTerms[i] || ''}
                            onChange={(e) => setSearchTerms(p => ({ ...p, [i]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Search serial number…"
                            className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    )}
                    {loadingOpts ? (
                      <p className="px-3 py-3 text-sm text-slate-400">
                        Loading serial numbers…
                      </p>
                    ) : options.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-400">
                        No in-stock serial numbers found for this product
                      </p>
                    ) : options.filter((sn) =>
                        sn.toLowerCase().includes((searchTerms[i] || '').toLowerCase())
                      ).length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-400">
                        No serial numbers match "{searchTerms[i]}"
                      </p>
                    ) : (
                      options.filter((sn) =>
                        sn.toLowerCase().includes((searchTerms[i] || '').toLowerCase())
                      ).map((sn) => {
                        const isSelected = selected.includes(sn);
                        const isDisabled =
                          !isSelected && selected.length >= qty;

                        return (
                          <button
                            key={sn}
                            type="button"
                            onClick={() =>
                              toggleSerial(i, sn, qty)
                            }
                            disabled={isDisabled}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors border-b border-slate-50 last:border-0 ${isSelected
                                ? "bg-blue-50 text-blue-700"
                                : isDisabled
                                  ? "text-slate-300 cursor-not-allowed bg-white"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "border-slate-300"
                                }`}
                            >
                              {isSelected && <Check size={10} />}
                            </span>

                            {sn}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {errors[i] && (
                <p className="text-xs text-red-500">
                  {errors[i]}
                </p>
              )}
            </div>
          );
        })}

        {!saved && order.status !== 'delivered' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary mt-2"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Serial Numbers'}
          </button>
        )}

        {saved && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle size={16} className="shrink-0" />
            All serial numbers saved and recorded for warranty tracking.
          </div>
        )}
      </div>
    </div>
  );
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected: order, loading } = useSelector((s) => s.order);
  const [attempted, setAttempted] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [serialsComplete, setSerialsComplete] = useState(false);

  const handlePrint = () => {
    const printContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Order ${order.orderNumber || `#${order._id?.slice(-6).toUpperCase()}`}</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif;font-size:13px;color:#222;}
  @media print{body{padding:0;}@page{margin:10mm;size:A4;}}
  .header{border-bottom:2px solid #BE474B;padding-bottom:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;}
  .order-title{font-size:22px;font-weight:bold;color:#BE474B;}
  .badge{display:inline-block;padding:3px 10px;border-radius:12px;background:#f3f3f3;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .section-title{font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#BE474B;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:8px;}
  .label{color:#888;font-size:11px;}
  .value{font-weight:500;margin-bottom:4px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#f5f5f5;padding:8px 10px;text-align:left;font-weight:bold;border:1px solid #ddd;}
  td{padding:8px 10px;border:1px solid #eee;vertical-align:top;}
  .text-right{text-align:right;}
  .text-center{text-align:center;}
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:12px;}
  .totals-table{width:280px;}
  .totals-table td{border:none;padding:4px 8px;}
  .totals-table td:last-child{text-align:right;font-weight:500;}
  .total-final td{border-top:2px solid #333;font-weight:bold;padding-top:8px;}
  .timeline{margin-top:16px;}
  .timeline-item{display:flex;gap:10px;margin-bottom:8px;align-items:flex-start;}
  .dot{width:10px;height:10px;border-radius:50%;background:#BE474B;flex-shrink:0;margin-top:3px;}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center;}
</style>
</head><body>
<div class="header">
<div>
<div class="order-title">Order ${order.orderNumber || `#${order._id?.slice(-6).toUpperCase()}`}</div>
<div style="color:#666;font-size:12px;margin-top:4px;">Placed on ${format(new Date(order.createdAt), 'dd MMM yyyy')}</div>
<span class="badge">${(order.status || '').replace(/_/g, ' ')}</span>
</div>
<div style="text-align:right;font-size:11px;color:#888;">Printed on ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
</div>
 
<div class="grid2">
<div>
<div class="section-title">Customer Details</div>
<div class="label">Name</div><div class="value">${order.customerName ||'—'}</div>
<div class="label">Email</div><div class="value">${order.dealerId?.email || order.email || order.customerEmail || '—'}</div>
<div class="label">Phone</div><div class="value">${order.dealerId?.phone || order.phone || order.customerPhone || '—'}</div>
<div class="label">Shipping Address</div>
<div class="value">${[order.deliveryAddress?.fullAddress, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.postalCode, order.deliveryAddress?.country].filter(Boolean).join(', ') || order.dealerId?.address || '—'}</div>
</div>
<div>
<div class="section-title">Payment & Shipping</div>
<div class="label">Payment Status</div><div class="value">${order.paymentStatus || 'Pending'}</div>
<div class="label">Payment Method</div><div class="value">${/^net-\d+$/.test(order.paymentMethod) ? order.paymentMethod.replace('net-', 'Credit Limit · Net ') : (order.paymentMethod || 'Credit Card')}</div>
<div class="label">Credit Terms</div><div class="value">${/^net-\d+$/.test(order.paymentMethod) ? order.paymentMethod.replace('net-', 'Net ') : (order.paymentTerms || '—')}</div>
<div class="label">Carrier</div><div class="value">${order.shippingMethod || order.deliveryMethod || '—'}</div>
<div class="label">Tracking No.</div><div class="value">${order.trackingNumber || 'Pending'}</div>
</div>
</div>
 
<div class="section-title">Order Items</div>
<table>
<thead>
<tr>
<th>Product</th>
<th>SKU</th>
<th class="text-center">Qty</th>
<th class="text-right">Unit Price</th>
<th class="text-right">Line Total</th>
</tr>
</thead>
<tbody>
    ${(order.items || []).map(item => `
<tr>
<td><strong>${item.productName || item.name || '—'}</strong></td>
<td style="color:#666">${item.sku || '—'}</td>
<td class="text-center">${item.quantity}</td>
<td class="text-right">₹${(item.unitPrice || 0).toLocaleString('en-IN')}</td>
<td class="text-right"><strong>₹${(item.lineTotal || 0).toLocaleString('en-IN')}</strong></td>
</tr>`).join('')}
</tbody>
</table>
 
<div class="totals-wrap">
<table class="totals-table">
<tbody>
<tr><td style="color:#666">Subtotal</td><td>₹${(order.subtotal || 0).toLocaleString('en-IN')}</td></tr>
<tr><td style="color:#666">Tax</td><td>₹${(order.taxAmount || 0).toLocaleString('en-IN')}</td></tr>
<tr><td style="color:#666">Shipping</td><td>₹${(order.shippingAmount || 0).toLocaleString('en-IN')}</td></tr>
${(order.discountAmount || 0) > 0 ? `<tr><td style="color:#666">Flash sale discount${order.discountPercent ? ` (${order.discountPercent}%)` : ''}</td><td>-₹${order.discountAmount.toLocaleString('en-IN')}</td></tr>` : ''}
<tr class="total-final"><td>Total</td><td>₹${(order.netAmount || (order.subtotal || 0) + (order.taxAmount || 0) + (order.shippingAmount || 0) - (order.discountAmount || 0)).toLocaleString('en-IN')}</td></tr>
</tbody>
</table>
</div>
 
${[{ label: 'Order Placed', value: order.createdAt }, ...(order.confirmedAt ? [{ label: 'Confirmed', value: order.confirmedAt }] : []), ...(order.shippedAt ? [{ label: 'Shipped', value: order.shippedAt }] : []), ...(order.deliveredAt ? [{ label: 'Delivered', value: order.deliveredAt }] : [])].map(e => `
<div class="timeline-item"><div class="dot"></div><div><strong>${e.label}:</strong> ${format(new Date(e.value), 'dd MMM yyyy, hh:mm a')}</div></div>`).join('')}
 
<div class="footer">This is a system-generated order summary.</div>
<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Orders get their invoice at confirmation (serials attached on delivery) —
  // open that one (the printable view; it has its own Edit for corrections)
  // instead of starting a duplicate. Only orders without an invoice fall back
  // to a pre-filled new invoice.
  const orderInvoiceId = order?.invoiceId?._id || order?.invoiceId;
  const handleInvoice = () => {
    if (orderInvoiceId) navigate(`/invoices/${orderInvoiceId}`);
    else navigate('/invoices/new', { state: { fromOrder: order } });
  };

  useEffect(() => {
    dispatch(clearSelected());
    dispatch(fetchOrderById(id)).then(() => setAttempted(true));
  }, [dispatch, id]);

  useEffect(() => {
    if (attempted && !loading && !order) navigate('/orders');
  }, [attempted, loading, order, navigate]);

  // Ledger view of this order — offline payments recorded after checkout (Finance →
  // Ledger) and what's still owed. Only confirmed dealer orders have a ledger row;
  // for anything else this stays null and nothing extra is shown.
  const [ledgerRow, setLedgerRow] = useState(null);
  useEffect(() => {
    if (!order?._id) return;
    let cancelled = false;
    api.get(`/ledger/order/${order._id}`)
      .then(({ data }) => { if (!cancelled) setLedgerRow(data.data || null); })
      .catch(() => { if (!cancelled) setLedgerRow(null); });
    return () => { cancelled = true; };
  }, [order?._id, order?.paymentStatus]);
  const laterPayments = (ledgerRow?.ledger?.manualPayments || []).filter((p) => !p.reversedAt);
  const isFullyPaid = ['paid', 'completed'].includes(order?.paymentStatus) || Boolean(ledgerRow?.settled);
  const isPartPaid = !isFullyPaid && laterPayments.length > 0;
  const isCreditOrder = order?.paymentMethod === 'split' || /^net-\d+$/.test(order?.paymentMethod || '');

  const executeStatusUpdate = async (status) => {
    setStatusLoading(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success(`Order marked as ${status.replace(/_/g, ' ')}`);
      dispatch(fetchOrderById(id));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStatusUpdate = (status) => {
    // Block moving to shipped if serials are not yet saved
    if (status === 'shipped' && order.status === 'confirmed' && !serialsComplete) {
      toast.error('Enter serial numbers for all items before marking as Shipped.', { duration: 4000 });
      return;
    }
    if (status !== 'confirmed') {
      executeStatusUpdate(status);
      return;
    }
    toast.custom((t) => (
      <div className="card shadow-lg px-5 py-4 flex flex-col gap-3 min-w-[260px]">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500 shrink-0" />
          <p className="font-semibold text-slate-800 text-sm">Confirm this order?</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          This will confirm the order and notify the dealer to proceed.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { toast.dismiss(t.id); executeStatusUpdate('confirmed'); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors font-medium"
          >
            Yes, Confirm
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  if (loading || !attempted) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!order) return null;

  const items = order.items || [];
  const subtotal = order.subtotal || 0;
  const tax = order.taxAmount || 0;
  const shipping = order.shippingCost || 0;
  const discount = order.discountAmount || 0;
  const total = order.netAmount || (subtotal + tax + shipping - discount);
  const dealer = order.dealerId || {};
  // b2c (Buvvas Ecommerce) orders have no dealerId — customer identity lives
  // directly on the order instead, same fallback the print template below uses.
  const customerName = dealer.businessName || dealer.name || order.customerName || '—';
  const customerEmail = dealer.email || order.customerEmail || '';
  const customerPhone = dealer.phone || order.customerPhone || '';
  const addr = order.deliveryAddress || {};
  const timeline = order.timeline || [];
  const lastEvent = timeline[timeline.length - 1];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const paymentLabel = isPartPaid ? 'partly paid' : (order.paymentStatus || 'pending');
  const paymentMethodLabel = !order.paymentMethod
    ? ''
    : /^net-\d+$/.test(order.paymentMethod)
      ? `Credit limit · ${order.paymentMethod.replace('net-', 'Net ')}`
      : order.paymentMethod;

  const statusColor =
    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
        order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
          order.status === 'out_for_delivery' ? 'bg-purple-100 text-purple-700' :
            order.status === 'confirmed' ? 'bg-teal-100 text-teal-700' :
              order.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                'bg-yellow-100 text-yellow-700';

  return (
    <div>
      <div className="mb-5">
        <PageHeader
          compact
          icon={ShoppingCart}
          title={order.orderNumber}
          badge={(
            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${statusColor}`}>
              {order.status?.replace(/_/g, ' ')}
            </span>
          )}
          subtitle={(
            <>
              Placed on {format(new Date(order.createdAt), 'dd MMM yyyy')}
              {order.dealerOrderNumber && <> · Dealer order <span className="font-medium text-slate-700">{order.dealerOrderNumber}</span></>}
            </>
          )}
          back={{ label: 'Orders', onClick: () => navigate('/orders') }}
        >
        {['draft', 'pending'].includes(order.status) && (
          <>
            <button onClick={() => dispatch(confirmOrder(id))} disabled={loading} className="btn-primary flex items-center gap-1.5 text-sm">
              <CheckCircle size={14} /> Accept Order
            </button>
            <button onClick={() => dispatch(cancelOrder({ id, reason: 'Rejected by supplier' }))} className="btn-danger flex items-center gap-1.5 text-sm">
              <XCircle size={14} /> Reject
            </button>
          </>
        )}
        {!['draft', 'pending'].includes(order.status) && (
          <>
            <button type='button' onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Printer size={14} /> Print
            </button>
            <button type='button' onClick={handleInvoice} className="btn-primary flex items-center gap-1.5 text-sm">
              <FileText size={14} /> {orderInvoiceId ? 'View Invoice' : 'Create Invoice'}
            </button>
          </>
        )}
        </PageHeader>
      </div>

      {/* ── At a glance ─────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KPICard
          title="Order total"
          value={fmt(total)}
          icon={IndianRupee}
          color="blue"
          subtitle={tax > 0 ? `Includes ${fmt(tax)} tax` : 'No tax applied'}
        />
        <KPICard
          title="Items"
          value={totalUnits.toLocaleString('en-IN')}
          icon={Package}
          color="purple"
          subtitle={`${items.length} product${items.length === 1 ? '' : 's'} · ${totalUnits === 1 ? '1 unit' : `${totalUnits} units`}`}
        />
        <KPICard
          title="Payment"
          value={<span className="capitalize">{paymentLabel}</span>}
          icon={Wallet}
          color={isFullyPaid ? 'green' : isPartPaid ? 'blue' : 'yellow'}
          subtitle={ledgerRow && ledgerRow.outstanding > 0.01 ? `${fmt(ledgerRow.outstanding)} still due` : paymentMethodLabel || 'Method not recorded'}
        />
        <KPICard
          title="Fulfilment"
          value={<span className="capitalize">{order.status?.replace(/_/g, ' ')}</span>}
          icon={order.status === 'cancelled' ? XCircle : Truck}
          color={order.status === 'cancelled' ? 'red' : order.status === 'delivered' ? 'green' : 'orange'}
          subtitle={lastEvent?.timestamp ? `Updated ${format(new Date(lastEvent.timestamp), 'dd MMM, hh:mm a')}` : `Placed ${format(new Date(order.createdAt), 'dd MMM yyyy')}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">

        {/* ── Main column ───────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">

          <SectionCard title="Fulfilment" subtitle="Move the order forward one step at a time">
            <OrderProgress order={order} onStatusUpdate={handleStatusUpdate} loading={statusLoading || loading} serialsComplete={serialsComplete} />
          </SectionCard>

          <SectionCard
            title="Order items"
            subtitle={`${items.length} product${items.length === 1 ? '' : 's'} · ${totalUnits} unit${totalUnits === 1 ? '' : 's'}`}
            flush
          >
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-5">Product</th>
                    <th className="text-right">Price</th>
                    <th className="text-center">Qty</th>
                    <th className="pr-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const name = item.productName || item.name || item.productId?.name || '—';
                    return (
                      <tr key={i}>
                        <td className="pl-5 whitespace-normal">
                          <div className="flex items-center gap-3">
                            <span className="icon-tile h-10 w-10 rounded-xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
                              <Package size={17} />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{name}</p>
                              <p className="text-xs text-slate-400">SKU {item.productCode || item.sku || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">₹{(item.unitPrice || item.basePrice || 0).toLocaleString('en-IN')}</td>
                        <td className="text-center">
                          <span className="inline-flex min-w-[32px] justify-center rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-slate-700">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="pr-5 text-right font-semibold tabular-nums text-slate-900">{fmt(item.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <dl className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="tabular-nums">{fmt(subtotal)}</dd></div>
                <div className="flex justify-between text-slate-600">
                  <dt>Tax{order.taxRate ? ` (${Math.round((order.taxRate || 0) * 100)}%)` : ''}</dt>
                  <dd className="tabular-nums">{fmt(tax)}</dd>
                </div>
                {shipping > 0 && (
                  <div className="flex justify-between text-slate-600"><dt>Shipping</dt><dd className="tabular-nums">{fmt(shipping)}</dd></div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Flash sale discount{order.flashSaleApplied && order.discountPercent ? ` (${order.discountPercent}%)` : ''}</dt>
                    <dd className="tabular-nums">-{fmt(discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                  <dt>Total</dt><dd className="tabular-nums">{fmt(total)}</dd>
                </div>
              </dl>
            </div>
          </SectionCard>

          {/* Serial Numbers — shown after order is confirmed */}
          <SerialNumberSection order={order} onSerialsComplete={setSerialsComplete} />

          <SectionCard title="Activity" subtitle="Everything that has happened on this order">
            {timeline.length > 0 ? (
              <ol className="relative space-y-4 pl-6">
                <span className="absolute bottom-1 left-[7px] top-1 w-px bg-slate-200" />
                {[...timeline].reverse().map((event, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${i === 0 ? 'bg-primary-600 ring-4 ring-primary-100' : 'bg-slate-300'}`} />
                    <p className={`text-sm font-medium text-slate-800 ${event.description ? '' : 'capitalize'}`}>{event.description || event.status?.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {event.timestamp ? format(new Date(event.timestamp), 'dd MMM yyyy · hh:mm a') : ''}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                <Activity size={20} className="opacity-50" />
                <p className="text-sm">No activity yet</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Side column ───────────────────────────────────────────────── */}
        <div className="space-y-5">

          <SectionCard
            title={order.dealerId ? 'Dealer' : 'Customer'}
            action={dealer._id && (
              <button type="button" onClick={() => navigate(`/dealers/${dealer._id}`)} className="link text-xs">View dealer</button>
            )}
          >
            <div className="flex items-center gap-3">
              <span className="icon-tile h-11 w-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-base font-bold text-white shadow-brand">
                {(customerName || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{customerName}</p>
                <p className="text-xs text-slate-500">{order.dealerId ? 'Dealer order (B2B)' : 'Buvvas website order'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5 text-sm">
              {customerEmail && (
                <a href={`mailto:${customerEmail}`} className="flex items-center gap-2.5 text-slate-600 hover:text-primary-700">
                  <Mail size={15} className="shrink-0 text-slate-400" /> <span className="truncate">{customerEmail}</span>
                </a>
              )}
              {customerPhone && (
                <a href={`tel:${customerPhone}`} className="flex items-center gap-2.5 text-slate-600 hover:text-primary-700">
                  <Phone size={15} className="shrink-0 text-slate-400" /> {customerPhone}
                </a>
              )}
            </div>
            {(addr.fullAddress || addr.city) && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin size={13} /> Shipping address
                </p>
                {addr.fullAddress && <p className="text-sm text-slate-700">{addr.fullAddress}</p>}
                <p className="text-sm text-slate-500">
                  {[addr.city, addr.postalCode].filter(Boolean).join(', ')}
                  {addr.country ? `, ${addr.country}` : ''}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Payment"
            action={(
              <span className={isFullyPaid ? 'badge-green' : isPartPaid ? 'badge-blue' : 'badge-yellow'}>
                <span className="capitalize">{paymentLabel}</span>
              </span>
            )}
          >
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500"><CreditCard size={14} className="text-slate-400" /> Method</dt>
                <dd className="font-medium capitalize text-slate-800">{paymentMethodLabel || 'Not recorded'}</dd>
              </div>
              {order.pricingTier && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Pricing tier</dt>
                  <dd className="font-medium capitalize text-slate-800">{order.pricingTier}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <dt className="text-slate-500">Order total</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{fmt(total)}</dd>
              </div>
              {/* Split orders: "pending" only means the credit portion is outstanding —
                  the pay-now portion was collected at checkout. */}
              {order.paymentMethod === 'split' && (
                <>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Paid at checkout</dt>
                    <dd className="font-medium tabular-nums text-emerald-700">{fmt(order.splitPayNowAmount)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">On credit</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{fmt(order.splitCreditAmount)}</dd>
                  </div>
                </>
              )}
              {/* Payments made after checkout — cash / UPI / cheque recorded in Finance → Ledger */}
              {laterPayments.map((pay) => (
                <div key={pay._id} className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">
                    {isCreditOrder ? 'Credit paid' : 'Paid'}
                    <span className="text-slate-400"> · {METHOD_LABELS[pay.method] || pay.method} · {format(new Date(pay.paidOn), 'dd MMM yyyy')}</span>
                  </dt>
                  <dd className="font-medium tabular-nums text-emerald-700">{fmt(pay.amount)}</dd>
                </div>
              ))}
              {ledgerRow && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="font-semibold text-slate-700">Balance due</dt>
                  <dd className={`text-base font-bold tabular-nums ${ledgerRow.outstanding > 0.01 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmt(ledgerRow.outstanding)}
                  </dd>
                </div>
              )}
            </dl>
            {ledgerRow && !ledgerRow.settled && ledgerRow.outstanding > 0.01 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                Dealer paid outside the app (cash, UPI, cheque)?
                <button
                  type="button"
                  className="btn-secondary mt-2 w-full py-1.5 text-xs"
                  onClick={() => navigate('/finance/ledger', { state: { openOrderId: order._id } })}
                >
                  <Wallet size={13} /> Record payment in Ledger
                </button>
                <p className="mt-1.5 text-amber-700/80">It updates this order, its invoice, the dealer's credit and the dealer app.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Returns" subtitle={order.returns?.length ? `${order.returns.length} on this order` : undefined}>
            {order.returns && order.returns.length > 0 ? (
              <ul className="space-y-3">
                {order.returns.map((ret, idx) => (
                  <li key={idx} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="icon-tile h-9 w-9 rounded-lg bg-rose-50 text-rose-600"><RotateCcw size={15} /></span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold text-slate-800">RMA {ret.rmaNumber || ret.returnId}</p>
                      <p className="text-xs capitalize text-slate-500">{ret.status} · refund {ret.refundStatus || '—'}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">₹{(ret.refundAmount || 0).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle size={15} /> No returns on this order</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;