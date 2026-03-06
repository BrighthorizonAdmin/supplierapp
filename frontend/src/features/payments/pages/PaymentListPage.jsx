import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayments, confirmPayment } from '../paymentSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { format } from 'date-fns';
import { Search, Download } from 'lucide-react';
import api from '../../../services/api';

const METHOD_LABELS_FOR_EXPORT = {
  'bank-transfer': 'Bank Transfer', upi: 'UPI', cash: 'Cash',
  cheque: 'Cheque', neft: 'NEFT', rtgs: 'RTGS',
};

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
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    dispatch(fetchPayments({ page, limit: 20, search }));
  }, [dispatch, page, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/payments', { params: { limit: 10000 } });
      const rows = (res.data.data || []).map((p) => [
        p.paymentNumber || '',
        p.dealerId?.businessName || '',
        p.invoiceId?.invoiceNumber || '',
        p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd') : '',
        METHOD_LABELS_FOR_EXPORT[p.method] || p.method || '',
        p.amount || 0,
        p.status || '',
      ]);
      const headers = ['Payment ID', 'Dealer', 'Invoice', 'Date', 'Method', 'Amount', 'Status'];
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Export failed', err); }
    finally { setExporting(false); }
  };

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
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <Download size={14} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
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
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  list.map((row, idx) => (
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
                          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors">
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
    </div>
  );
};

export default PaymentListPage;
