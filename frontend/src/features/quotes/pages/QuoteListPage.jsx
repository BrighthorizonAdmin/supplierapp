import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchQuotes, deleteQuote } from '../quoteSlice';
import { Plus, Search, Eye, Edit2, Trash2, FileText, Lock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-orange-100 text-orange-700',
  deletedByDealer: 'bg-red-200 text-red-800',
};

const STATUS_LABELS = {
  deletedByDealer: 'Deleted by Dealer',
};

const TABS = [
  { key: 'all',      label: 'All Quotes' },
  { key: 'supplier', label: 'My Quotes' },
  { key: 'dealer',   label: 'Dealer Quotes' },
];

const fmtDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');
const fmtAmt  = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function QuoteListPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.quotes);

  const [activeTab,  setActiveTab]  = useState('all');
  const [search,     setSearch]     = useState('');
  const [statusFilt, setStatusFilt] = useState('');
  const [page,       setPage]       = useState(1);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    dispatch(fetchQuotes({
      search,
      status: statusFilt,
      source: activeTab === 'all' ? undefined : activeTab,
      page,
      limit: 20,
    }));
  }, [dispatch, search, statusFilt, activeTab, page]);

  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); };

  const handleDelete = async (id) => {
    await dispatch(deleteQuote(id));
    setConfirmDel(null);
    dispatch(fetchQuotes({ search, status: statusFilt, source: activeTab === 'all' ? undefined : activeTab, page, limit: 20 }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage quotations for your customers and view dealer quotes</p>
        </div>
        <button
          onClick={() => navigate('/quotes/new')}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow transition-colors"
        >
          <Plus size={16} /> Create Quote
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.key === 'dealer' && (
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                Synced
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dealer Quotes notice */}
      {activeTab === 'dealer' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <Lock size={14} />
          Dealer quotes are read-only. Only the dealer can edit or delete them.
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
            placeholder="Search quote # or party..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400"
          value={statusFilt}
          onChange={(e) => { setStatusFilt(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading quotes...</div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <FileText size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm font-medium">
              {activeTab === 'dealer' ? 'No dealer quotes synced yet' : 'No quotes found'}
            </p>
            {activeTab !== 'dealer' && (
              <button
                onClick={() => navigate('/quotes/new')}
                className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
              >
                Create your first quote
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quote No.</th>
                {activeTab === 'all' && (
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                )}
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {activeTab === 'dealer' ? 'Customer / Dealer' : 'Party'}
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quote Date</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry Date</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((q) => {
                const isDealer = q.source === 'dealer';
                return (
                  <tr key={q._id} className={`hover:bg-gray-50/60 transition-colors ${isDealer ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-blue-700">{q.quoteNumber}</span>
                    </td>
                    {activeTab === 'all' && (
                      <td className="px-5 py-3.5">
                        {isDealer ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Dealer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Supplier
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-800">{q.partyName || '—'}</p>
                      {isDealer && q.dealerId?.businessName && (
                        <p className="text-xs text-orange-500 font-medium">via {q.dealerId.businessName}</p>
                      )}
                      {!isDealer && q.dealerId?.dealerCode && (
                        <p className="text-xs text-gray-400">{q.dealerId.dealerCode}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{fmtDate(q.quoteDate)}</td>
                    <td className="px-5 py-3.5 text-gray-600">{fmtDate(q.expiryDate)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{fmtAmt(q.totalAmount)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/quotes/${q._id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        {!isDealer && (
                          <>
                            <button
                              onClick={() => navigate(`/quotes/${q._id}/edit`)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setConfirmDel(q._id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {isDealer && (
                          <span className="p-1.5 text-gray-300" title="Read-only — dealer managed">
                            <Lock size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Showing {list.length} of {pagination.total} quotes</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-semibold text-gray-700">
              {page} / {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-800 mb-2">Delete Quote?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDel)} className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-xl hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
