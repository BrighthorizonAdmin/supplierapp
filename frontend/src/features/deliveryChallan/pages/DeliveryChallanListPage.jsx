import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchChallans, deleteChallan } from '../deliveryChallanSlice';
import { Search, Eye, Edit2, Trash2, FileText, ChevronDown, Calendar, Printer } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  open:   'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const DATE_OPTIONS = [
  { label: 'Last 365 Days', value: '365d' },
  { label: 'Last 30 Days',  value: '30d'  },
  { label: 'Last 7 Days',   value: '7d'   },
  { label: 'All Time',      value: ''     },
];

const STATUS_OPTIONS = [
  { label: 'Show All Challans',    value: ''       },
  { label: 'Show Open Challans',   value: 'open'   },
  { label: 'Show Closed Challans', value: 'closed' },
];

const fmtDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');
const fmtAmt  = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function DeliveryChallanListPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.challans);

  const [showSearch, setShowSearch] = useState(false);
  const [search,     setSearch]     = useState('');
  const [dateRange,  setDateRange]  = useState('365d');
  const [statusFilt, setStatusFilt] = useState('open');
  const [page,       setPage]       = useState(1);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    dispatch(fetchChallans({
      search,
      status:    statusFilt || undefined,
      dateRange: dateRange  || undefined,
      page,
      limit: 20,
    }));
  }, [dispatch, search, statusFilt, dateRange, page]);

  const handleDelete = async (id) => {
    await dispatch(deleteChallan(id));
    setConfirmDel(null);
  };

  return (
    <div className="bg-white flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 148px)' }}>

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Delivery Challan</h1>
        <button
          onClick={() => navigate('/delivery-challan/new')}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow transition-colors"
        >
          Create Delivery Challan
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">

        {/* Search toggle */}
        <button
          onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearch(''); }}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
        >
          <Search size={16} />
        </button>
        {showSearch && (
          <input
            autoFocus
            className="w-56 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition-colors"
            placeholder="Search challan # or party…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        )}

        {/* Date range */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
          <Calendar size={14} className="text-gray-500 flex-shrink-0" />
          <select
            className="text-sm text-gray-700 outline-none bg-transparent cursor-pointer"
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
          >
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="text-gray-400 pointer-events-none flex-shrink-0" />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
          <select
            className="text-sm text-gray-700 outline-none bg-transparent cursor-pointer"
            value={statusFilt}
            onChange={(e) => { setStatusFilt(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="text-gray-400 pointer-events-none flex-shrink-0" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative mb-4">
              <FileText size={52} className="text-gray-300" />
              <span className="absolute -top-1 -right-2 text-gray-400 font-bold text-lg leading-none">×</span>
              <span className="absolute bottom-1 right-0 text-gray-300 font-bold text-base leading-none">₹</span>
            </div>
            <p className="text-sm text-gray-400">No Transactions Matching the current filter</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600">Delivery Challan Number</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600">Party Name</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-gray-600">{fmtDate(c.challanDate)}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-indigo-700">{c.challanNumber}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{c.partyName || '—'}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{fmtAmt(c.totalAmount)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigate(`/delivery-challan/${c._id}/print`)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="View / Print"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/delivery-challan/${c._id}/edit`)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDel(c._id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
          <span>Showing {list.length} of {pagination.total} challans</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <span className="px-3 py-1.5 font-semibold text-gray-700">{page} / {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-800 mb-2">Delete Delivery Challan?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDel)} className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-xl hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
