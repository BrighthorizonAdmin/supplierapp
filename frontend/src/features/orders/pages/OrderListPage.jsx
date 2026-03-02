import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, setFilters } from '../orderSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';

const OrderListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, pagination, loading, filters } = useSelector((s) => s.order);
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchOrders({ page, limit: 20, ...filters }));
  }, [dispatch, page, filters]);

  const columns = [
    { key: 'orderNumber', label: 'Order #', render: (v, row) => (
      <button onClick={() => navigate(`/orders/${row._id}`)} className="text-primary-600 hover:underline font-mono font-medium">{v}</button>
    )},
    { key: 'dealerId', label: 'Dealer', render: (v) => v?.businessName || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'pricingTier', label: 'Tier', render: (v) => <span className="capitalize badge-blue">{v}</span> },
    { key: 'netAmount', label: 'Amount', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'confirmedBy', label: 'Confirmed By', render: (v) => v?.name || '—' },
    { key: 'createdAt', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">B2B Orders</h1>
      </div>
      <div className="card p-4 flex gap-3">
        <select className="input w-40" value={filters.status} onChange={(e) => dispatch(setFilters({ status: e.target.value }))}>
          <option value="">All Status</option>
          {['draft','confirmed','processing','shipped','delivered','cancelled'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default OrderListPage;
