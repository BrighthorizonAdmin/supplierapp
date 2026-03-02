import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReturns, processReturn } from '../returnSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import Modal from '../../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

const ReturnListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.return);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [processModal, setProcessModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { dispatch(fetchReturns({ page, limit: 20, status })); }, [dispatch, page, status]);

  const onProcess = (data) => {
    dispatch(processReturn({ id: processModal._id, ...data })).then((res) => {
      if (!res.error) { setProcessModal(null); reset(); }
    });
  };

  const columns = [
    { key: 'rmaNumber', label: 'RMA #', render: (v) => <span className="font-mono text-xs font-medium">{v}</span> },
    { key: 'dealerId', label: 'Dealer', render: (v) => v?.businessName || '—' },
    { key: 'orderId', label: 'Order', render: (v) => v?.orderNumber || '—' },
    { key: 'reason', label: 'Reason', render: (v) => <span className="truncate max-w-32 block">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'refundAmount', label: 'Refund', render: (v) => v ? `₹${v.toLocaleString('en-IN')}` : '—' },
    { key: 'createdAt', label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    {
      key: 'actions', label: 'Actions',
      render: (_, row) => ['requested','approved','received'].includes(row.status) ? (
        <button onClick={() => setProcessModal(row)} className="text-xs text-green-600 hover:text-green-700 font-medium">
          Process Refund
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Returns & RMA</h1>
      <div className="card p-4">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['requested','approved','received','refunded','rejected'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <Modal isOpen={!!processModal} onClose={() => { setProcessModal(null); reset(); }} title={`Process Return — ${processModal?.rmaNumber}`}>
        <form onSubmit={handleSubmit(onProcess)} className="space-y-4">
          <div>
            <label className="label">Refund Amount (₹)</label>
            <input type="number" step="0.01" className="input" {...register('refundAmount', { required: true, valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Refund Method</label>
            <select className="input" {...register('refundMethod', { required: true })}>
              {['bank-transfer','cheque','cash','upi'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setProcessModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Process Refund</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReturnListPage;
