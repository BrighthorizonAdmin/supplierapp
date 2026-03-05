import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrderById, confirmOrder, cancelOrder } from '../orderSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const OrderDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected: order, loading, error } = useSelector((s) => s.order);

  useEffect(() => { dispatch(fetchOrderById(id)); }, [dispatch, id]);

  useEffect(() => {
    if (!loading && error) navigate('/orders');
  }, [loading, error, navigate]);

  if (loading || !order) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/orders')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-slate-500 text-sm">{order.dealerId?.businessName} · {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
        </div>
        <div className="flex gap-2">
          {order.status === 'draft' && (
            <>
              <button onClick={() => dispatch(confirmOrder(id))} disabled={loading} className="btn-primary flex items-center gap-2">
                <CheckCircle size={16} /> Confirm Order
              </button>
              <button onClick={() => dispatch(cancelOrder({ id, reason: 'Cancelled by admin' }))} className="btn-danger flex items-center gap-2">
                <XCircle size={16} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['Dealer', order.dealerId?.businessName],
          ['Pricing Tier', order.pricingTier],
          ['Subtotal', `₹${(order.subtotal || 0).toLocaleString('en-IN')}`],
          ['Tax', `₹${(order.taxAmount || 0).toLocaleString('en-IN')}`],
          ['Discount', `₹${(order.discountAmount || 0).toLocaleString('en-IN')}`],
          ['Net Amount', `₹${(order.netAmount || 0).toLocaleString('en-IN')}`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-sm text-slate-500">{k}</p>
            <p className="font-bold text-slate-900 mt-1">{v || '—'}</p>
          </div>
        ))}
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="p-4 border-b border-slate-200"><h2 className="font-semibold text-slate-900">Order Items</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Product', 'Warehouse', 'Qty', 'Unit Price', 'Discount %', 'Tax %', 'Line Total'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-slate-600 font-medium">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(order.items || []).map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{item.productName || item.productId?.name}</td>
                  <td className="px-4 py-3">{item.warehouseId?.name}</td>
                  <td className="px-4 py-3 font-medium">{item.quantity}</td>
                  <td className="px-4 py-3">₹{(item.unitPrice || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{item.discount}%</td>
                  <td className="px-4 py-3">{item.taxRate}%</td>
                  <td className="px-4 py-3 font-bold">₹{(item.lineTotal || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
