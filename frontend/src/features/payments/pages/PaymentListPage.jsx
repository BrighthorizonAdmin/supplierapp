import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayments, confirmPayment } from '../paymentSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import { format } from 'date-fns';
import { Search, SlidersHorizontal, Download, X } from 'lucide-react';

const METHOD_LABELS = {
  'bank-transfer': 'Bank Transfer',
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  neft: 'NEFT',
  rtgs: 'RTGS',
};

const PaymentListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.payment);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewModal, setViewModal] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  useEffect(() => {
    dispatch(fetchPayments({ page, limit: 50, status: filterStatus || undefined, method: filterMethod || undefined }));
  }, [dispatch, page, filterStatus, filterMethod]);

  const filtered = list.filter((p) =>
    !search ||
    p.paymentNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.dealerId?.businessName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const headers = ['Payment ID', 'Distributor', 'Invoice', 'Date', 'Method', 'Amount', 'Status'];
    const rows = filtered.map((p) => [
      p.paymentNumber || '',
      p.dealerId?.businessName || '',
      p.invoiceId?.invoiceNumber || '',
      p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd') : '',
      METHOD_LABELS[p.method] || p.method || '',
      p.amount || 0,
      p.status || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = filterStatus || filterMethod;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Payments & Collections</h1>

      <div className="card">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search payment ID or dealer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                hasFilters
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filters{hasFilters ? ' •' : ''}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="flex items-end gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Method</label>
              <select
                value={filterMethod}
                onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Methods</option>
                {Object.entries(METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilterStatus(''); setFilterMethod(''); setPage(1); }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}

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
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Payment ID</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Distributor Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Linked Invoice(S)</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Payment Date</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Payment Method</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Amount Received</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">
                        {row.paymentNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {row.dealerId?.businessName || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {row.invoiceId?.invoiceNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {row.createdAt ? format(new Date(row.createdAt), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {METHOD_LABELS[row.method] || row.method || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-medium">
                        ₹{(row.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status === 'pending' ? (
                          <button
                            onClick={() => dispatch(confirmPayment(row._id))}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setViewModal(row)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            View
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

      {/* View Payment Modal */}
      <Modal isOpen={!!viewModal} onClose={() => setViewModal(null)} title={`Payment — ${viewModal?.paymentNumber}`}>
        {viewModal && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Payment ID', viewModal.paymentNumber],
                ['Status', viewModal.status],
                ['Distributor', viewModal.dealerId?.businessName || '—'],
                ['Invoice', viewModal.invoiceId?.invoiceNumber || '—'],
                ['Method', METHOD_LABELS[viewModal.method] || viewModal.method || '—'],
                ['Amount', `₹${(viewModal.amount || 0).toLocaleString('en-IN')}`],
                ['Date', viewModal.createdAt ? format(new Date(viewModal.createdAt), 'dd MMM yyyy') : '—'],
                ['Reference', viewModal.reference || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className="text-slate-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {viewModal.notes && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Notes</p>
                <p className="text-slate-800 mt-0.5">{viewModal.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentListPage;
