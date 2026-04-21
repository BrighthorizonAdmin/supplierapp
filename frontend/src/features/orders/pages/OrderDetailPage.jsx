import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrderById, confirmOrder, cancelOrder, clearSelected } from '../orderSlice';
import { ArrowLeft, Printer, FileText, CheckCircle, XCircle, Package, Truck, MapPin, CreditCard, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const STATUS_RANK = {
  draft: 0, pending: 1, confirmed: 2,
  processing: 3, shipped: 4, out_for_delivery: 5, delivered: 6, cancelled: 7,
};

const PROGRESS_STEPS = [
  { label: 'Confirm',          status: 'confirmed',        Icon: CheckCircle },
  { label: 'Mark Processing',  status: 'processing',       Icon: Package     },
  { label: 'Mark Shipped',     status: 'shipped',          Icon: Truck       },
  { label: 'Out for Delivery', status: 'out_for_delivery', Icon: MapPin      },
  { label: 'Mark Delivered',   status: 'delivered',        Icon: CheckCheck  },
];

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const OrderProgress = ({ order, onStatusUpdate, loading }) => {
  const currentRank = STATUS_RANK[order.status] ?? 0;
  if (order.status === 'cancelled') return null;

  const doneCount = PROGRESS_STEPS.filter(s => currentRank >= STATUS_RANK[s.status]).length;
  const pct = PROGRESS_STEPS.length > 1
    ? Math.min(100, ((doneCount - 1) / (PROGRESS_STEPS.length - 1)) * 100)
    : 0;

  return (
    <div className="mb-6">
      <div className="relative flex items-start justify-between">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0" />
        <div className="absolute top-5 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500" style={{ width: `${pct}%` }} />

        {PROGRESS_STEPS.map((step) => {
          const stepRank = STATUS_RANK[step.status];
          const done     = currentRank >= stepRank;
          const isNext   = stepRank === currentRank + 1;
          const { Icon } = step;

          return (
            <div key={step.status} className="flex flex-col items-center z-10 flex-1">
              <button
                onClick={() => isNext && onStatusUpdate(step.status)}
                disabled={!isNext || loading}
                title={isNext ? `Click to ${step.label}` : undefined}
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  done
                    ? 'bg-green-500 border-green-500 text-white'
                    : isNext
                    ? 'bg-white border-green-400 text-green-600 hover:bg-green-50 cursor-pointer'
                    : 'bg-white border-slate-200 text-slate-300 cursor-default',
                ].join(' ')}
              >
                <Icon size={17} strokeWidth={2.2} />
              </button>
              <span className={`mt-2 text-xs font-medium text-center leading-tight max-w-[72px] ${done ? 'text-green-600' : isNext ? 'text-green-500' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {order.status === 'delivered' && (
        <div className="mt-5 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <CheckCircle size={15} className="mt-0.5 shrink-0 text-green-600" />
          <span><strong>Delivered.</strong> The dealer&apos;s inventory has been updated with the quantities from this order.</span>
        </div>
      )}
    </div>
  );
};

const OrderDetailPage = () => {
  const { id }       = useParams();
  const dispatch     = useDispatch();
  const navigate     = useNavigate();
  const { selected: order, loading } = useSelector((s) => s.order);
  const [attempted, setAttempted]         = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

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

  const items    = order.items || [];
  const subtotal = order.subtotal || 0;
  const tax      = order.taxAmount || 0;
  const shipping = order.shippingCost || 0;
  const total    = order.netAmount || (subtotal + tax + shipping);
  const dealer   = order.dealerId || {};
  const addr     = order.deliveryAddress || {};
  const timeline = order.timeline || [];

  const statusColor =
    order.status === 'delivered'        ? 'bg-green-100 text-green-700'  :
    order.status === 'cancelled'        ? 'bg-red-100 text-red-700'      :
    order.status === 'shipped'          ? 'bg-blue-100 text-blue-700'    :
    order.status === 'out_for_delivery' ? 'bg-purple-100 text-purple-700':
    order.status === 'confirmed'        ? 'bg-teal-100 text-teal-700'    :
    order.status === 'processing'       ? 'bg-amber-100 text-amber-700'  :
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
            <h1 className="text-2xl font-bold text-slate-900">Order #{order.orderNumber}</h1>
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
          <button className="btn-secondary flex items-center gap-1.5 text-sm">
            <Printer size={14} /> Print
          </button>
          <button className="btn-danger flex items-center gap-1.5 text-sm">
            <FileText size={14} /> Invoice
          </button>
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

          {/* Timeline card — progress stepper + events */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Time Line</h2>
            </div>
            <div className="px-6 py-5">

              {/* ORDER PROGRESS stepper (Image 3) */}
              <OrderProgress order={order} onStatusUpdate={handleStatusUpdate} loading={statusLoading || loading} />

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
                <span className={`badge ${['paid','completed'].includes(order.paymentStatus) ? 'badge-green' : 'badge-yellow'}`}>
                  {order.paymentStatus || 'Pending'}
                </span>
              </div>
              {order.paymentMethod && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  {order.paymentMethod === 'net-30' ? 'Paid via Credit Limit · Net 30 Terms' : `Via ${order.paymentMethod}`}
                </p>
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
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Shipping Method</h2>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Truck size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-900">{order.carrier || 'Standard Shipping'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Tracking: {order.trackingId || 'Pending'}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;