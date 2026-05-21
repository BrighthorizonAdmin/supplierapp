import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchWarrantyRequests } from '../warrantySlice';
import { format } from 'date-fns';
import { Search, ShieldCheck } from 'lucide-react';

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  repaired: 'bg-blue-100 text-blue-800',
  replaced: 'bg-purple-100 text-purple-800',
};

const STATUSES = ['', 'pending', 'approved', 'rejected', 'repaired', 'replaced'];

export default function WarrantyListPage() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.warranty);

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  useEffect(() => {
    dispatch(fetchWarrantyRequests({ page, limit: 20, status: status || undefined, search: search || undefined }));
  }, [dispatch, page, status, search]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Warranty Requests</h1>
          {pagination?.total !== undefined && (
            <span className="ml-2 text-sm text-slate-500">({pagination.total} total)</span>
          )}
        </div>
        <button
          onClick={() => navigate('/warranty-lookup')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          Warranty Lookup
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search claim, customer, invoice…"
            value={search}
            onChange={handleSearch}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-64"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No warranty requests found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <th className="px-4 py-3">Claim #</th>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Warranty</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map((w) => (
                <tr
                  key={w._id}
                  onClick={() => navigate(`/warranty/${w._id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-blue-600 font-semibold text-xs">{w.claimNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{w.dealerId?.businessName || '—'}</div>
                    <div className="text-xs text-slate-500">{w.dealerId?.dealerCode || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{w.customerName || '—'}</div>
                    {w.customerPhone && <div className="text-xs text-slate-500">{w.customerPhone}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{w.invoiceNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{w.warrantyPeriod || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{w.items?.length || 0} item(s)</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {w.createdAt ? format(new Date(w.createdAt), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[w.status] || 'bg-slate-100 text-slate-600'}`}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-blue-400 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">Page {page} of {pagination.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-blue-400 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
