import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRetailOrders } from '../retailOrderSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';

const RetailOrderListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.retailOrder);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    dispatch(fetchRetailOrders({ page, limit: 20, status }));
  }, [dispatch, page, status]);

  const columns = [
    { key: 'orderNumber', label: 'Order #', render: (v) => <span className="font-mono text-xs font-medium">{v}</span> },
    { key: 'dealerId', label: 'Dealer', render: (v) => v?.businessName || '—' },
    { key: 'customerName', label: 'Customer' },
    { key: 'customerPhone', label: 'Phone', render: (v) => v || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'paymentMethod', label: 'Payment', render: (v) => <span className="capitalize">{v}</span> },
    { key: 'paymentStatus', label: 'Paid', render: (v) => <StatusBadge status={v} /> },
    { key: 'totalAmount', label: 'Total', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'createdAt', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Retail Orders</h1>
      </div>
      <div className="card p-4 flex gap-3">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['pending','confirmed','shipped','delivered','cancelled'].map((s) => (
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

export default RetailOrderListPage;
