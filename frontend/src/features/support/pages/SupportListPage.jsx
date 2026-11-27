import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchTickets } from '../supportSlice';
import { Headphones, Wrench, Clock, AlertCircle, CheckCircle2, Loader2, Search } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';

const STATUS_COLOR = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  AWAITING_DEALER: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLOR = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-700',
};

export default function SupportListPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tickets, pagination, meta, loading } = useSelector(s => s.support);

  const [filters, setFilters] = useState({ status: '', type: '', search: '', page: 1 });

  useEffect(() => {
    dispatch(fetchTickets({ ...filters, limit: 20 }));
  }, [filters, dispatch]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  return (
    <div className="space-y-5">
      <PageHeader icon={Headphones} title="Support tickets" subtitle="Dealer support requests and service tickets">
        <span className="badge-yellow px-3 py-1.5 text-sm">
          <span className="font-bold">{meta?.openCount ?? '—'}</span> open
        </span>
        <span className="badge-blue px-3 py-1.5 text-sm">
          <span className="font-bold">{meta?.inProgressCount ?? '—'}</span> in progress
        </span>
      </PageHeader>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by ticket #, dealer, message…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.type} onChange={e => setFilter('type', e.target.value)}>
          <option value="">All Types</option>
          <option value="GENERAL">💬 General Support</option>
          <option value="SERVICE_REQUEST">🔧 Service Request</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="AWAITING_DEALER">Awaiting Dealer</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Headphones size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No support tickets found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ticket #', 'Type', 'Dealer', 'Subject', 'Priority', 'Status', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map(t => (
                <tr key={t._id} className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/support/${t._id}`)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">
                    {t.ticketNumber || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {t.type === 'SERVICE_REQUEST'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"><Wrench size={11} /> Service</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full"><Headphones size={11} /> General</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">
                      {t.dealerName || t.name || '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.dealerPhone || t.dealerEmail || ''}
                    </p>
                    {t.type !== 'SERVICE_REQUEST' && t.name && (
                      <p className="text-xs text-blue-500">
                        Submitted by: {t.name} {t.phone ? `· ${t.phone}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-800 truncate">
                      {t.type === 'SERVICE_REQUEST' ? (t.issueType?.replace(/_/g, ' ') || 'Service') : (t.topic || 'General Support')}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {t.type === 'SERVICE_REQUEST' ? t.productName : t.message}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                      {t.priority || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing page {filters.page} of {pagination.totalPages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
              ← Prev
            </button>
            <button disabled={filters.page >= pagination.totalPages}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}