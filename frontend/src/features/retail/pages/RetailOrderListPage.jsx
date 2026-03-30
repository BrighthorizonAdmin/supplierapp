import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRetailOrders } from '../retailOrderSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { Search, Wifi } from 'lucide-react';

// Badge showing whether a row came from an internal order or a dealer sync
const SourceBadge = ({ source }) =>
  source === 'dealer_sync' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
      <Wifi size={10} /> Dealer Sync
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
      Internal
    </span>
  );

const RetailOrderListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.retailOrder);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search — API call fires only after 400 ms of inactivity
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    dispatch(fetchRetailOrders({ page, limit: 20, status, search }));
  }, [dispatch, page, status, search]);

  const columns = [
    {
      key: 'source',
      label: 'Source',
      render: (v) => <SourceBadge source={v} />,
    },
    {
      key: 'orderNumber',
      label: 'Order / Invoice #',
      render: (v) => <span className="font-mono text-xs font-medium">{v}</span>,
    },
    {
      key: 'dealerName',
      label: 'Dealer',
      render: (v) => v || '—',
    },
    { key: 'customerName', label: 'Customer' },
    { key: 'customerPhone', label: 'Phone', render: (v) => v || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (v) => <span className="capitalize">{v || '—'}</span>,
    },
    { key: 'paymentStatus', label: 'Paid', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (v) => <span className="font-semibold">₹{(v || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => (v ? format(new Date(v), 'dd MMM yyyy') : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Retail Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Includes internal orders and invoices synced from dealers
          </p>
        </div>
      </div>

      <div className="card p-4 flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer, dealer or order #..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-9 text-sm w-72"
          />
        </div>
        <select
          className="input w-44"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        {status && (
          <button
            onClick={() => { setStatus(''); setPage(1); }}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default RetailOrderListPage;