import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrderById, confirmOrder, cancelOrder, clearSelected } from '../orderSlice';
import { ArrowLeft, Printer, FileText, CheckCircle, XCircle, Truck, MapPin, CreditCard, CheckCheck, Hash, Save } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';
import toast from 'react-hot-toast';

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

const OrderProgress = ({ order, onStatusUpdate, loading, serialsComplete }) => {
  const currentRank = STATUS_RANK[order.status] ?? 0;
  if (order.status === 'cancelled') return null;

  const doneCount = PROGRESS_STEPS.filter(s => currentRank >= STATUS_RANK[s.status]).length;
  const pct = PROGRESS_STEPS.length > 1
    ? Math.min(100, ((doneCount - 1) / (PROGRESS_STEPS.length - 1)) * 100)
    : 0;

  // Serial numbers must be entered before moving from confirmed → shipped
  const serialsBlocking = (step) =>
    step.status === 'shipped' && order.status === 'confirmed' && !serialsComplete;

  return (
    <div className="mb-6">
      <div className="relative flex items-start justify-between">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0" />
        <div className="absolute top-5 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500" style={{ width: `${pct}%` }} />

        {PROGRESS_STEPS.map((step) => {
          const stepRank  = STATUS_RANK[step.status];
          const done      = currentRank >= stepRank;
          const isNext    = stepRank === currentRank + 1;
          const blocked   = isNext && serialsBlocking(step);
          const { Icon }  = step;

          return (
            <div key={step.status} className="flex flex-col items-center z-10 flex-1">
              <button
                onClick={() => isNext && onStatusUpdate(step.status)}
                disabled={!isNext || loading}
                title={
                  blocked
                    ? 'Enter/Scan serial numbers below before shipping'
                    : isNext ? `Click to ${step.label}` : undefined
                }
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  done
                    ? 'bg-green-500 border-green-500 text-white'
                    : blocked
                      ? 'bg-amber-50 border-amber-400 text-amber-500 cursor-pointer'
                      : isNext
                        ? 'bg-white border-green-400 text-green-600 hover:bg-green-50 cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-300 cursor-default',
                ].join(' ')}
              >
                <Icon size={17} strokeWidth={2.2} />
              </button>
              <span className={`mt-2 text-xs font-medium text-center leading-tight max-w-[72px] ${
                done ? 'text-green-600' : blocked ? 'text-amber-500' : isNext ? 'text-green-500' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
              {blocked && (
                <span className="mt-1 text-[10px] text-amber-500 font-semibold text-center leading-tight max-w-[80px]">
                  Serials required
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Serial numbers reminder banner — shown when confirmed and serials not yet entered */}
      {order.status === 'confirmed' && !serialsComplete && (
        <div className="mt-5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Hash size={15} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>Action required:</strong> Enter/Scan serial numbers for all items below before marking this order as Shipped.
          </span>
        </div>
      )}

      {order.status === 'delivered' && (
        <div className="mt-5 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <CheckCircle size={15} className="mt-0.5 shrink-0 text-green-600" />
          <span><strong>Delivered.</strong> The dealer&apos;s inventory has been updated with the quantities from this order.</span>
        </div>
      )}
    </div>
  );
};

// ── Serial Number Section ─────────────────────────────────────────────────────
const SerialNumberSection = ({ order, onSerialsComplete }) => {
  const [invoice, setInvoice]       = useState(null);
  const [inputs,  setInputs]        = useState({});   // { idx: "SN-001, SN-002" }
  const [saving,  setSaving]        = useState(false);
  const [saved,   setSaved]         = useState(false);
  const [errors,  setErrors]        = useState({});

  const markComplete = useCallback((val) => {
    setSaved(val);
    onSerialsComplete?.(val);
  }, [onSerialsComplete]);

  // Fetch the auto-generated invoice for this order
  const load = useCallback(async () => {
    if (!order?.invoiceId) return;
    try {
      const { data } = await api.get(`/invoices/${order.invoiceId}`);
      const inv = data.data;
      setInvoice(inv);
      // Pre-fill any serials already saved
      const pre = {};
      (inv.lineItems || []).forEach((li, i) => {
        if (li.serialNumbers?.length) pre[i] = li.serialNumbers.join(', ');
      });
      setInputs(pre);
      // Check if all items already have serials
      const allDone = (inv.lineItems || []).every(li => li.serialNumbers?.length === li.quantity);
      markComplete(allDone);
    } catch {
      // invoice not yet available — silently ignore
    }
  }, [order?.invoiceId, markComplete]);

  useEffect(() => { load(); }, [load]);

  if (!invoice) return null;

  const lineItems = invoice.lineItems || [];

  const getSerials = (idx) =>
    (inputs[idx] || '').split(',').map(s => s.trim()).filter(Boolean);

  const validate = () => {
    const e = {};
    const crossMap = new Map(); // uppercase serial → first field index

    lineItems.forEach((item, i) => {
      const serials = getSerials(i);
      if (serials.length === 0) {
        e[i] = `Enter ${item.quantity} serial(s) for "${item.productName}"`;
        return;
      }
      if (serials.length !== item.quantity) {
        e[i] = `"${item.productName}" needs ${item.quantity} serial(s), got ${serials.length}`;
      }

      // Intra-field duplicates
      const seen = new Set();
      const dupes = [];
      for (const sn of serials) {
        const upper = sn.toUpperCase();
        if (seen.has(upper)) dupes.push(sn);
        else seen.add(upper);
      }
      if (dupes.length) e[i] = `Duplicate serial(s): ${dupes.join(', ')}`;

      // Cross-field duplicates
      for (const sn of serials) {
        const upper = sn.toUpperCase();
        if (crossMap.has(upper)) {
          const otherIdx = crossMap.get(upper);
          e[i] = (e[i] ? e[i] + '; ' : '') + `"${sn}" also in another item`;
          if (!e[otherIdx]) e[otherIdx] = `"${sn}" also in another item`;
        } else {
          crossMap.set(upper, i);
        }
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const lineSerials = lineItems.map((_, i) => ({
        index: i,
        serialNumbers: getSerials(i),
      }));
      await api.patch(`/invoices/${invoice._id}/serials`, { lineSerials });
      toast.success('Serial numbers saved successfully');
      markComplete(true);
      setErrors({});
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save serial numbers';
      toast.error(msg);
      // Highlight inputs whose serials appear in the error message
      const dupMatch = msg.match(/Duplicate serial number\(s\)[^:]*:\s*(.+)/i);
      const usedMatch = msg.match(/already used[^:]*:\s*(.+)/i);
      const errorSerials = new Set(
        [...(dupMatch?.[1] || '').split(','), ...(usedMatch?.[1] || '').split(',')]
          .map(s => s.replace(/\s*\(.*?\)/g, '').trim().toUpperCase())
          .filter(Boolean)
      );
      if (errorSerials.size > 0) {
        const e = {};
        lineItems.forEach((_, i) => {
          if (getSerials(i).map(s => s.toUpperCase()).some(s => errorSerials.has(s)))
            e[i] = 'Contains invalid or already-used serial number(s)';
        });
        if (Object.keys(e).length > 0) setErrors(e);
      }
    } finally {
      setSaving(false);
    }
  };

  // Only show for confirmed/processing/shipped orders
  const showStatuses = ['confirmed', 'processing', 'shipped', 'out_for_delivery'];
  if (!showStatuses.includes(order.status)) return null;

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Serial Numbers</h2>
          {saved && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              All Saved ✓
            </span>
          )}
        </div>
        {!saved && (
          <p className="text-xs text-slate-400">Enter/Scan serial numbers for each item before dispatch</p>
        )}
      </div>

      <div className="px-6 py-4 space-y-4">
        {lineItems.map((item, i) => {
          const serials  = getSerials(i);
          const qty      = item.quantity;
          const count    = serials.length;
          const isOk     = count === qty;
          const alreadySaved = item.serialNumbers?.length === qty;

          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {item.productName}
                  <span className="ml-2 text-xs font-normal text-slate-400">× {qty} units</span>
                </p>
                {alreadySaved && !inputs[i] && (
                  <span className="text-xs text-green-600 font-semibold">Already saved ✓</span>
                )}
                {inputs[i] && (
                  <span className={`text-xs font-semibold ${isOk ? 'text-green-600' : 'text-orange-500'}`}>
                    {count} of {qty} {isOk ? '✓' : ''}
                  </span>
                )}
              </div>
              <input
                type="text"
                className={`w-full text-sm border rounded-lg px-3 py-2 outline-none transition-colors placeholder-slate-300 ${
                  errors[i]
                    ? 'border-red-400 focus:border-red-500 bg-red-50'
                    : isOk && inputs[i]
                    ? 'border-green-400 bg-green-50 focus:border-green-500'
                    : 'border-slate-200 focus:border-blue-400'
                }`}
                placeholder={`e.g. SN-001, SN-002${qty > 1 ? `, … (${qty} required)` : ''}`}
                value={inputs[i] || ''}
                onChange={(e) => {
                  setInputs(p => ({ ...p, [i]: e.target.value }));
                  setErrors(p => { const n = { ...p }; delete n[i]; return n; });
                  markComplete(false);
                }}
              />
              {errors[i] && <p className="text-xs text-red-500">{errors[i]}</p>}
            </div>
          );
        })}

        {!saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Serial Numbers'}
          </button>
        )}

        {saved && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
            All serial numbers saved. DispatchedUnit records created for warranty tracking.
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
  const [attempted,       setAttempted]       = useState(false);
  const [statusLoading,   setStatusLoading]   = useState(false);
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
<div class="label">Name</div><div class="value">${order.dealerId?.businessName || order.dealerId?.name || '—'}</div>
<div class="label">Email</div><div class="value">${order.dealerId?.email || order.email || '—'}</div>
<div class="label">Phone</div><div class="value">${order.dealerId?.phone || order.phone || '—'}</div>
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
<tr class="total-final"><td>Total</td><td>₹${(order.netAmount || (order.subtotal || 0) + (order.taxAmount || 0) + (order.shippingAmount || 0)).toLocaleString('en-IN')}</td></tr>
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

  const handleInvoice = () => {
    navigate('/invoices/new', { state: { fromOrder: order } });
  };

  useEffect(() => {
    dispatch(clearSelected());
    dispatch(fetchOrderById(id)).then(() => setAttempted(true));
  }, [dispatch, id]);

  useEffect(() => {
    if (attempted && !loading && !order) navigate('/orders');
  }, [attempted, loading, order, navigate]);

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
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-5 py-4 flex flex-col gap-3 min-w-[260px]">
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
  const total = order.netAmount || (subtotal + tax + shipping);
  const dealer = order.dealerId || {};
  const addr = order.deliveryAddress || {};
  const timeline = order.timeline || [];

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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-slate-100 rounded-lg mt-0.5">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">{order.orderNumber}</h1>
            {order.dealerOrderNumber && (
              <p className="text-xs text-slate-400 mt-0.5">
                Dealer Order: <span className="font-medium text-slate-600">{order.dealerOrderNumber}</span>
              </p>
            )}
            <p className="text-sm text-slate-500 mt-0.5">
              Placed on {format(new Date(order.createdAt), 'MMM dd, yyyy')}
            </p>
            <span className={`inline-flex items-center mt-1.5 px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor}`}>
              {order.status?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex gap-2 items-center">
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
              <button type='button' onClick={handleInvoice} className="btn-danger flex items-center gap-1.5 text-sm">
                <FileText size={14} /> Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* LEFT */}
        <div className="space-y-5">

          {/* Order Items card */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Order Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{item.productName || item.name || item.productId?.name || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">SKU: {item.productCode || item.sku || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">₹{(item.unitPrice || item.basePrice || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{item.quantity}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{fmt(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="px-6 py-4 border-t border-slate-100 space-y-2 bg-slate-50 rounded-b-2xl">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax{order.taxRate ? ` (${Math.round((order.taxRate || 0) * 100)}%)` : ''}</span>
                <span>{fmt(tax)}</span>
              </div>
              {shipping > 0 && (
                <div className="flex justify-between text-sm text-slate-600"><span>Shipping</span><span>{fmt(shipping)}</span></div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-base">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Serial Numbers — shown after order is confirmed */}
          <SerialNumberSection order={order} onSerialsComplete={setSerialsComplete} />

          {/* Timeline card — progress stepper + events */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Time Line</h2>
            </div>
            <div className="px-6 py-5">

              {/* ORDER PROGRESS stepper (Image 3) */}
              <OrderProgress order={order} onStatusUpdate={handleStatusUpdate} loading={statusLoading || loading} serialsComplete={serialsComplete} />

              {/* Timeline events */}
              {timeline.length > 0 ? (
                <div className="relative pl-5 mt-2">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-100" />
                  {timeline.map((event, i) => (
                    <div key={i} className="relative mb-4 last:mb-0">
                      <div className="absolute -left-3.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white" />
                      <p className="font-medium text-sm text-slate-800">{event.description || event.status}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {event.timestamp ? format(new Date(event.timestamp), 'MMMM dd, yyyy · hh:mm a') : ''}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-2">No events yet</p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Customer Details */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Customer Details</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="font-semibold text-slate-900">{dealer.businessName || dealer.name || '—'}</p>
                {dealer.email && <p className="text-sm text-slate-500 mt-0.5">{dealer.email}</p>}
                {dealer.phone && <p className="text-sm text-slate-500">{dealer.phone}</p>}
              </div>
              {(addr.fullAddress || addr.city) && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1.5">Shipping Address</p>
                  {addr.fullAddress && <p className="text-sm text-slate-700">{addr.fullAddress}</p>}
                  <p className="text-sm text-slate-500">
                    {[addr.city, addr.postalCode].filter(Boolean).join(', ')}
                    {addr.country ? `, ${addr.country}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Payment Info</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CreditCard size={14} className="text-slate-400" />
                  <span>Payment Status</span>
                </div>
                <span className={`badge ${['paid', 'completed'].includes(order.paymentStatus) ? 'badge-green' : 'badge-yellow'}`}>
                  {order.paymentStatus || 'Pending'}
                </span>
              </div>
              {(order.paymentMethod) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {/^net-\d+$/.test(order.paymentMethod)
                      ? `Credit Limit · ${order.paymentMethod.replace('net-', 'Net ')}`
                      : order.paymentMethod}
                  </span>
                </div>
              )}
              {!order.paymentMethod && (
                <p className="text-xs text-slate-400">Payment method not recorded</p>
              )}
              {order.pricingTier && (
                <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Pricing Tier</span>
                  <span className="font-medium capitalize text-slate-700">{order.pricingTier}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Method */}
          {/* <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Shipping Method</h2>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Truck size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-900">
                  {order.carrier || 'Standard Shipping'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tracking: {order.trackingId || 'Pending'}
                </p>
                {(order.shippingCost > 0) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Shipping Cost: ₹{order.shippingCost.toLocaleString('en-')}
                  </p>
                )}
              </div>
            </div>
          </div> */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Return Details</h2>
            </div>
            <div className="px-6 py-5">
              {order.returns && order.returns.length > 0 ? (
                order.returns.map((ret, idx) => (
                  <div key={idx} className="mb-4 last:mb-0">
                    <p className="font-medium text-sm text-slate-800">RMA: {ret.rmaNumber || ret.returnId}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status: {ret.status} · Refund: ₹{(ret.refundAmount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400">
                      Refund Status: {ret.refundStatus || '—'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-2">No returns found</p>
              )}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;