import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInvoices } from '../paymentSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';

const InvoiceListPage = () => {
  const dispatch = useDispatch();
  const { invoices, invoicePagination, loading } = useSelector((s) => s.payment);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);

  useEffect(() => {
    dispatch(fetchInvoices({ page, limit: 20, status, overdue: overdue ? 'true' : '' }));
  }, [dispatch, page, status, overdue]);

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span className="font-mono text-xs font-medium">{v}</span> },
    { key: 'dealerId', label: 'Dealer', render: (v) => v?.businessName || '—' },
    { key: 'orderId', label: 'Order', render: (v) => v?.orderNumber || '—' },
    { key: 'totalAmount', label: 'Total', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'amountPaid', label: 'Paid', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'balance', label: 'Balance', render: (v) => <span className={v > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>₹{(v || 0).toLocaleString('en-IN')}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'dueDate', label: 'Due Date', render: (v) => v ? format(new Date(v), 'dd MMM yyyy') : '—' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
      <div className="card p-4 flex gap-3">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['draft','issued','partial','paid','overdue','cancelled'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />
          Overdue only
        </label>
      </div>
      <div className="card">
        <Table columns={columns} data={invoices} loading={loading} />
        <Pagination pagination={invoicePagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default InvoiceListPage;
