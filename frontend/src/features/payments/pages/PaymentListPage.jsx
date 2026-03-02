import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayments, createPayment, confirmPayment } from '../paymentSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import Modal from '../../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

const PaymentListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.payment);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { dispatch(fetchPayments({ page, limit: 20 })); }, [dispatch, page]);

  const onSubmit = (data) => {
    dispatch(createPayment(data)).then((res) => { if (!res.error) { setShowCreate(false); reset(); } });
  };

  const columns = [
    { key: 'paymentNumber', label: 'Payment #', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'dealerId', label: 'Dealer', render: (v) => v?.businessName || '—' },
    { key: 'amount', label: 'Amount', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'method', label: 'Method', render: (v) => <span className="capitalize badge-gray">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'receivedBy', label: 'Received By', render: (v) => v?.name || '—' },
    { key: 'createdAt', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    {
      key: 'actions', label: 'Actions',
      render: (_, row) => row.status === 'pending' ? (
        <button onClick={() => dispatch(confirmPayment(row._id))} className="text-xs text-green-600 hover:text-green-700 font-medium">
          Confirm
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Record Payment</button>
      </div>
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="Record Payment">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Dealer ID</label>
            <input className="input" {...register('dealerId', { required: true })} placeholder="Dealer ObjectId" />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" step="0.01" className="input" {...register('amount', { required: true, valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" {...register('method', { required: true })}>
              {['bank-transfer','cheque','cash','upi','neft','rtgs'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" {...register('reference')} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PaymentListPage;
