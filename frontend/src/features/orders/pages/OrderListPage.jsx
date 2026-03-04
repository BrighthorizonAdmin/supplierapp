import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchOrders } from '../orderSlice';
import Pagination from '../../../components/ui/Pagination';
import {
  Search, Download, Eye, MoreVertical,
  Clock, Truck, CheckCircle, XCircle, ShoppingBag,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';

// ─── Type tabs ────────────────────────────────────────────────────────────────
const TYPE_TABS = [
  { id: 'all',  label: 'All Orders'   },
  { id: 'b2b',  label: 'Dealer(B2B)'  },
  { id: 'b2c',  label: 'Retail(B2C)'  },
];

// ─── Status filter tabs ───────────────────────────────────────────────────────
const STATUS_TABS = [
  { id: '',           label: 'All'         },
  { id: 'draft',      label: 'New Orders'  },
  { id: 'processing', label: 'Processing'  },
  { id: 'shipped',    label: 'Shipped'     },
  { id: 'delivered',  label: 'Delivered'   },
  { id: 'cancelled',  label: 'Cancelled'   },
];

// ─── Priority badge ───────────────────────────────────────────────────────────
const PRIORITY_CLS = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  normal: 'bg-green-100 text-green-700',
};
const PriorityBadge = ({ priority = 'Normal' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
    PRIORITY_CLS[priority.toLowerCase()] || PRIORITY_CLS.normal
  }`}>
    {priority}
  </span>
);

// ─── Status cell ─────────────────────────────────────────────────────────────
const STATUS_CLS = {
  confirmed:  'badge-solid-blue',
  processing: 'badge-solid-purple',
  shipped:    'badge-solid-blue',
  delivered:  'badge-solid-green',
  cancelled:  'badge-solid-red',
};
const StatusCell = ({ order, onView }) => {
  if (order.status === 'draft') {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => onView(order._id)}
          className="text-xs font-semibold text-primary-600 hover:underline text-left"
        >
          Accept Order
        </button>
        <button
          onClick={() => onView(order._id)}
          className="text-xs font-semibold text-red-500 hover:underline text-left"
        >
          Reject Order
        </button>
      </div>
    );
  }
  const cls = STATUS_CLS[order.status] || 'badge-gray';
  return (
    <span className={`${cls} uppercase text-[10px] tracking-wide`}>
      {order.status}
    </span>
  );
};

// ─── Row action menu ──────────────────────────────────────────────────────────
const RowActions = ({ row, onView }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="flex items-center gap-1" ref={ref}>
      <button
        onClick={() => onView(row._id)}
        className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-colors"
      >
        <Eye size={15} />
      </button>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <MoreVertical size={15} />
        </button>
        {open && (
          <div className="absolute right-0 top-8 w-36 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden py-1">
            <button
              onClick={() => { setOpen(false); onView(row._id); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Stats card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, cardCls, iconCls, valueCls, labelCls }) => (
  <div className={`card p-4 flex items-center justify-between ${cardCls}`}>
    <div>
      <p className={`text-sm font-medium leading-snug ${labelCls}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 leading-tight ${valueCls}`}>{value ?? '—'}</p>
    </div>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
      <Icon size={20} />
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const OrderListPage = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.order);

  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [typeTab,   setTypeTab]   = useState('all');
  const [statusTab, setStatusTab] = useState('');
  const [counts,    setCounts]    = useState({
    processing: 0, shipped: 0, delivered: 0, cancelled: 0,
    total: 0, draft: 0,
  });

  // Fetch aggregate counts
  useEffect(() => {
    Promise.all([
      api.get('/orders', { params: { limit: 1, status: 'processing' } }),
      api.get('/orders', { params: { limit: 1, status: 'shipped'     } }),
      api.get('/orders', { params: { limit: 1, status: 'delivered'   } }),
      api.get('/orders', { params: { limit: 1, status: 'cancelled'   } }),
      api.get('/orders', { params: { limit: 1                        } }),
      api.get('/orders', { params: { limit: 1, status: 'draft'       } }),
    ]).then(([proc, ship, delv, canc, tot, drft]) => {
      setCounts({
        processing: proc.data.pagination?.total ?? 0,
        shipped:    ship.data.pagination?.total ?? 0,
        delivered:  delv.data.pagination?.total ?? 0,
        cancelled:  canc.data.pagination?.total ?? 0,
        total:      tot.data.pagination?.total  ?? 0,
        draft:      drft.data.pagination?.total ?? 0,
      });
    }).catch(() => {});
  }, []);

  // Fetch orders list
  useEffect(() => {
    const params = { page, limit: 20 };
    if (statusTab) params.status = statusTab;
    if (search)    params.search = search;
    dispatch(fetchOrders(params));
  }, [dispatch, page, statusTab, search]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage all dealers orders</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Type tab group */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 gap-0.5">
            {TYPE_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  typeTab === t.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Processing" value={counts.processing} icon={Clock}
          cardCls="bg-blue-50 border-blue-100"
          iconCls="bg-blue-500 text-white"
          valueCls="text-blue-700" labelCls="text-blue-600"
        />
        <StatCard
          label="Shipped" value={counts.shipped} icon={Truck}
          cardCls="bg-purple-50 border-purple-100"
          iconCls="bg-purple-500 text-white"
          valueCls="text-purple-700" labelCls="text-purple-600"
        />
        <StatCard
          label="Delivered" value={counts.delivered} icon={CheckCircle}
          cardCls="bg-green-50 border-green-100"
          iconCls="bg-green-500 text-white"
          valueCls="text-green-700" labelCls="text-green-600"
        />
        <StatCard
          label="Cancelled" value={counts.cancelled} icon={XCircle}
          cardCls=""
          iconCls="bg-slate-100 text-slate-500"
          valueCls="text-slate-900" labelCls="text-slate-500"
        />
        <StatCard
          label="Total Orders" value={counts.total} icon={ShoppingBag}
          cardCls="bg-primary-50 border-primary-100"
          iconCls="bg-primary-100 text-primary-600"
          valueCls="text-primary-700" labelCls="text-primary-600"
        />
      </div>

      {/* ── Table card ── */}
      <div className="card overflow-hidden">

        {/* Search + status tabs */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 flex-wrap">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order ID, Dealer name..."
              className="input pl-9 text-sm py-1.5"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setStatusTab(t.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  statusTab === t.id
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {t.label}
                {t.id === 'draft' && counts.draft > 0 ? `(${counts.draft})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['ORDER ID','DEALER','DATE & TIME','ITEMS','AMOUNT','PAYMENT','PRIORITY','STATUS','ACTIONS'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400">No orders found</td>
                  </tr>
                ) : list.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50 transition-colors">

                    {/* Order ID */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => navigate(`/orders/${order._id}`)}
                        className="font-semibold text-slate-800 hover:text-primary-600 transition-colors"
                      >
                        Order #{order.orderNumber || order._id?.slice(-4)}
                      </button>
                    </td>

                    {/* Dealer */}
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {order.dealerId?.businessName || '—'}
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-700 leading-snug">
                        {format(new Date(order.createdAt), 'yyyy-MM-dd')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(order.createdAt), 'hh:mm a')}
                      </p>
                    </td>

                    {/* Items */}
                    <td className="px-4 py-3.5 text-slate-600">
                      {order.items?.length ?? 0} Items
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      ₹{(order.netAmount || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3.5 text-slate-600 capitalize">
                      {order.pricingTier || '—'}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={order.priority || 'Normal'} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusCell order={order} onView={(id) => navigate(`/orders/${id}`)} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <RowActions row={order} onView={(id) => navigate(`/orders/${id}`)} />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default OrderListPage;
