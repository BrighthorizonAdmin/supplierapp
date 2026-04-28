import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchOrders, cancelOrder, fetchOrderById } from '../orderSlice';
import Pagination from '../../../components/ui/Pagination';
import {
  Search, Download, Eye,
  Clock, Truck, CheckCircle, XCircle, ShoppingBag, Package,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';
import { useMemo } from 'react';

// ─── Type tabs ────────────────────────────────────────────────────────────────
const TYPE_TABS = [
  { id: 'all',  label: 'All Orders'   },
  { id: 'b2b',  label: 'Dealer(B2B)'  },
  { id: 'b2c',  label: 'Retail(B2C)'  },
];

// ─── Status filter tabs ───────────────────────────────────────────────────────
const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'New Orders' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];
// ─── Type badge ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const isRetail = type === 'b2c';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
      isRetail ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'
    }`}>
      {isRetail ? 'Retail' : 'B2B'}
    </span>
  );
};

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
const StatusCell = ({ order, onView, onReject }) => {
  if (order.status === 'pending') {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => onView(order)}
          className="text-xs font-semibold text-primary-600 hover:underline text-left"
        >
          Accept Order
        </button>
        <button
          onClick={() => onReject(order._id)}
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
const RowActions = ({ row, onView }) => (
  <button
    onClick={() => onView(row)}
    className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-colors"
  >
    <Eye size={15} />
  </button>
);

// ─── Stats card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, cardCls, iconCls, valueCls, labelCls }) => (
  <div
    className={`flex items-center justify-between p-3 rounded-lg border ${cardCls}`}
  >
    <div className="flex flex-col">
      <p className={`text-xs font-medium ${labelCls}`}>{label}</p>
      <p className={`text-lg font-semibold ${valueCls}`}>{value ?? "—"}</p>
    </div>

    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center ml-3 ${iconCls}`}
    >
      <Icon size={16} />
    </div>
  </div>
);
// ─── Main page ────────────────────────────────────────────────────────────────
const OrderListPage = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.order);

  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
  const goToOrder = (id) => {
    if (!isValidObjectId(id._id)) {
      toast.error('Cannot open order details – invalid ID.');
      return;
    }
    navigate(`/orders/${id._id}`);
  };
  const [page,        setPage]        = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  // only pass one argument here; default to showing all orders
  const [typeTab,     setTypeTab]     = useState('all');
  const [statusTab,   setStatusTab]   = useState('');
  const [exporting,   setExporting]   = useState(false);
  const [counts,      setCounts]      = useState({
    confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0,
    total: 0, pending: 0,
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
      setPage(1);
    }
  };

  // Derive counts from the current list (no extra API call needed)
  useEffect(() => {
  if (!list) return;

  // filter orders according to active type tab so stats match the table
  let arr = list;
  if (typeTab === 'b2b') arr = arr.filter(o => o.orderType === 'b2b');
  else if (typeTab === 'b2c') arr = arr.filter(o => o.orderType === 'b2c');

  const newCounts = {
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    total: arr.length,
  };

  arr.forEach((order) => {
    const status = order.status?.toLowerCase();

    if (newCounts.hasOwnProperty(status)) {
      newCounts[status] += 1;
    }
  });

  setCounts(newCounts);
}, [list, typeTab]);

const filteredOrders = useMemo(() => {
  if (!list) return [];

  let result = list;

  // type filter
  if (typeTab === "b2b") {
    result = result.filter(o => o.orderType?.toLowerCase() === "b2b");
  } else if (typeTab === "b2c") {
    result = result.filter(o => o.orderType?.toLowerCase() === "b2c");
  }

  // status filter
  if (statusTab) {
    result = result.filter(
      order => order.status?.toLowerCase() === statusTab.toLowerCase()
    );
  }

  return result;
}, [list, statusTab, typeTab]);
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { page: 1, limit: 10000 };
      if (statusTab)         params.status    = statusTab;
      if (search)            params.search    = search;
      if (typeTab === 'b2b') params.orderType = 'b2b';
      if (typeTab === 'b2c') params.orderType = 'b2c';

      const res = await api.get('/orders', { params });
      const orders = res.data.orders || res.data.data || [];

      const isRetail = typeTab === 'b2c';

      // Headers mirror exactly the visible table columns (excluding Actions)
      const headers = isRetail
        ? ['Order ID', 'Type', 'Customer', 'Date', 'Time', 'Items', 'Amount', 'Payment', 'Status']
        : ['Order ID', 'Dealer', 'Date', 'Time', 'Items', 'Amount', 'Payment', 'Priority', 'Status'];

      const rows = orders.map((o) => {
        const date   = format(new Date(o.createdAt), 'yyyy-MM-dd');
        const time   = format(new Date(o.createdAt), 'hh:mm a');
        // Match table: orderNumber first, then orderId suffix, then _id suffix
        const orderId = `Order #${o.orderNumber || o.orderId?.slice(-4) || o._id?.slice(-4)}`;
        const amount  = (o.netAmount || 0).toLocaleString('en-IN');
        const items   = `${o.items?.length ?? 0} Items`;

        if (isRetail) {
          // Mirrors B2C table columns: ORDER ID, TYPE, CUSTOMER, DATE & TIME, ITEMS, AMOUNT, PAYMENT, STATUS
          return [
            orderId,
            o.orderType || 'b2c',
            o.customerId?.name || o.customerName || o.dealerId?.businessName || o.dealerId?.name || '—',
            date, time, items, amount,
            o.paymentMethod || o.pricingTier || '—',
            o.status || '—',
          ];
        }

        // Mirrors B2B / All table columns: ORDER ID, DEALER, DATE & TIME, ITEMS, AMOUNT, PAYMENT, PRIORITY, STATUS
        return [
          orderId,
          o.dealerId?.businessName || o.dealerId?.name || '—',
          date, time, items, amount,
          o.paymentMethod || o.pricingTier || '—',
          o.priority || 'Normal',
          o.status || '—',
        ];
      });

      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `orders-${typeTab}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  // Fetch orders list
  useEffect(() => {
    const params = { page, limit: 20 };
    if (statusTab)         params.status    = statusTab;
    if (search)            params.search    = search;
    if (typeTab === 'b2b') params.orderType = 'b2b';
    if (typeTab === 'b2c') params.orderType = 'b2c';
    dispatch(fetchOrders(params));
  }, [dispatch, page, statusTab, search, typeTab]);

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
                onClick={() => { setTypeTab(t.id); setPage(1); }}
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

          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={14} /> {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          label="Confirmed" value={counts.confirmed} icon={Package}
          cardCls="bg-indigo-50 border-indigo-100"
          iconCls="bg-indigo-500 text-white"
          valueCls="text-indigo-700" labelCls="text-indigo-600"
        />
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
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value === '') { setSearch(''); setPage(1); }
              }}
              onKeyDown={handleSearchKeyDown}
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
                {t.id === 'pending' && counts.pending > 0 ? `(${counts.pending})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : typeTab === 'b2c' ? (
          /* ── Retail (B2C) table ── */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['ORDER ID','TYPE','CUSTOMER','DATE & TIME','ITEMS','AMOUNT','PAYMENT','STATUS','ACTIONS'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400">No orders found</td>
                  </tr>
                ) : filteredOrders.map((order) => (
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

                    {/* Type badge */}
                    <td className="px-4 py-3.5">
                      <TypeBadge type={order.orderType || 'b2c'} />
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {order.customerId?.name || order.customerName || order.dealerId?.businessName || '—'}
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
                      {order.paymentMethod || order.pricingTier || '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusCell order={order} onView={goToOrder} onReject={(id) => dispatch(cancelOrder({ id, reason: 'Rejected by admin' }))} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <RowActions row={order} onView={goToOrder} />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Dealer (B2B) / All table ── */
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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-slate-400">No orders found</td>
                  </tr>
                ) : filteredOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50 transition-colors">

                    {/* Order ID */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => navigate(`/orders/${order._id}`)}
                        className="text-left"
                      >
                        <p className="font-semibold text-slate-800 hover:text-primary-600 transition-colors">
                          {order.orderNumber}
                        </p>
                        {order.dealerOrderNumber && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Dealer: {order.dealerOrderNumber}
                          </p>
                        )}
                      </button>
                    </td>

                    {/* Dealer */}
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {order.dealerId?.businessName || order.dealerId?.name || '—'}
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
                      {order.paymentMethod || '—'}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={order.priority || 'Normal'} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusCell order={order} onView={goToOrder} onReject={(id) => dispatch(cancelOrder({ id, reason: 'Rejected by admin' }))} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <RowActions row={order} onView={goToOrder} />
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