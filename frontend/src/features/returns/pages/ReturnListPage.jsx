import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReturns, fetchReturnById, processReturn, updateReturnStatus } from '../returnSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Search, Filter, X } from 'lucide-react';

const STATUS_TABS = [
  { label: 'All Requests', value: '' },
  { label: 'Requested',    value: 'requested' },
  { label: 'Approved',     value: 'approved' },
  { label: 'Rejected',     value: 'rejected' },
  { label: 'Refunded',     value: 'refunded' },
];

const ReturnListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading, selected } = useSelector((s) => s.return);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('dealers');
  const [search, setSearch] = useState('');
  const [processModal, setProcessModal] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    dispatch(fetchReturns({ page, limit: 20, status: statusFilter }));
  }, [dispatch, page, statusFilter]);

  const onProcess = (data) => {
    dispatch(processReturn({ id: processModal._id, ...data })).then((res) => {
      if (!res.error) { setProcessModal(null); reset(); }
    });
  };

  const handleViewDetails = (row) => {
    setDetailsModal(row);
    dispatch(fetchReturnById(row._id));
  };

  const detailData = selected && selected._id === detailsModal?._id ? selected : detailsModal;

  const filtered = list.filter((r) =>
    !search ||
    r.rmaNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.dealerId?.businessName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Returns & Refunds</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review pending returns and manage refund approvals.</p>
        </div>
        <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-white">
          {['Dealers', 'Retails'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t.toLowerCase())}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === t.toLowerCase()
                  ? 'border border-blue-600 text-blue-600 bg-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {/* Filter tabs + Search row */}
        <div className="flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Return ID, Dealer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Return ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {typeFilter === 'retails' ? 'Customer' : 'Dealer'}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Items</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Payment</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">No returns found</td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                        {row.rmaNumber || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {typeFilter === 'retails' ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-pink-100 text-pink-700 uppercase tracking-wide">
                            Retail
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                            Dealer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {typeFilter === 'retails'
                          ? (row.customerId?.name || row.customerName || '—')
                          : (row.dealerId?.businessName || '—')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.createdAt ? format(new Date(row.createdAt), 'yyyy-MM-dd') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.items?.length ? `${row.items.length} Items` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                        {row.refundAmount ? `₹${row.refundAmount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.refundMethod || 'Credit'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status === 'requested' ? (
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => dispatch(updateReturnStatus({ id: row._id, status: 'approved' }))}
                              className="text-xs text-blue-600 hover:underline font-medium text-left"
                            >
                              Accept Return
                            </button>
                            <button
                              onClick={() => dispatch(updateReturnStatus({ id: row._id, status: 'rejected' }))}
                              className="text-xs text-red-500 hover:underline font-medium text-left"
                            >
                              Reject Return
                            </button>
                          </div>
                        ) : (
                          <StatusBadge status={row.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status === 'approved' ? (
                          <button
                            onClick={() => setProcessModal(row)}
                            className="text-xs text-blue-600 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            Process Refund
                          </button>
                        ) : (
                          <button
                            onClick={() => handleViewDetails(row)}
                            className="text-xs text-blue-600 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Process Refund Modal */}
      <Modal isOpen={!!processModal} onClose={() => { setProcessModal(null); reset(); }} title={`Process Return — ${processModal?.rmaNumber}`}>
        <form onSubmit={handleSubmit(onProcess)} className="space-y-4">
          <div>
            <label className="label">Refund Amount (₹)</label>
            <input type="number" step="0.01" className="input" {...register('refundAmount', { required: true, valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Refund Method</label>
            <select className="input" {...register('refundMethod', { required: true })}>
              {['bank-transfer', 'cheque', 'cash', 'upi'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setProcessModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Process Refund</button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={!!detailsModal} onClose={() => setDetailsModal(null)} title={`Return Details — ${detailsModal?.rmaNumber}`}>
        {detailData && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['RMA Number', detailData.rmaNumber],
                ['Status', detailData.status],
                ['Dealer', detailData.dealerId?.businessName || '—'],
                ['Order', detailData.orderId?.orderNumber || '—'],
                ['Reason', detailData.reason],
                ['Refund Amount', detailData.refundAmount ? `₹${detailData.refundAmount.toLocaleString('en-IN')}` : '—'],
                ['Refund Method', detailData.refundMethod || '—'],
                ['Date', detailData.createdAt ? format(new Date(detailData.createdAt), 'dd MMM yyyy') : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className="text-slate-800 mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </div>
            {detailData.items?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Items</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Product</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Qty</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailData.items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{item.productName || '—'}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2 capitalize">{item.condition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detailData.rejectionReason && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Rejection Reason</p>
                <p className="text-slate-800 mt-0.5">{detailData.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReturnListPage;
