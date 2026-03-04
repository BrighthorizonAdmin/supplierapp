import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayments, confirmPayment } from '../paymentSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { format } from 'date-fns';
import { Search, SlidersHorizontal, Download } from 'lucide-react';

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

  useEffect(() => { dispatch(fetchPayments({ page, limit: 50 })); }, [dispatch, page]);

  const filtered = list.filter((p) =>
    !search ||
    p.paymentNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.dealerId?.businessName?.toLowerCase().includes(search.toLowerCase())
  );

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
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <SlidersHorizontal size={14} />
              Filters
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download size={14} />
              Export
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
