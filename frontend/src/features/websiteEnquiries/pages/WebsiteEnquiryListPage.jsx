import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchEnquiries } from '../websiteEnquirySlice';
import { MessageSquare, Loader2, Search } from 'lucide-react';

const STATUS_COLOR = {
  NEW: 'bg-yellow-100 text-yellow-800',
  CONTACTED: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const SOURCE_LABEL = {
  support_page: 'Support Page',
  get_quote_page: 'Get a Quote',
  other: 'Other',
};

export default function WebsiteEnquiryListPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { enquiries, pagination, meta, loading } = useSelector(s => s.websiteEnquiries);

  const [filters, setFilters] = useState({ status: '', source: '', search: '', page: 1 });

  useEffect(() => {
    dispatch(fetchEnquiries({ ...filters, limit: 20 }));
  }, [filters, dispatch]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Enquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">Messages submitted from the Buvvas website's Support and Get a Quote forms</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-center">
          <p className="text-xl font-bold text-yellow-700">{meta?.newCount ?? '—'}</p>
          <p className="text-xs text-yellow-600">New</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by name, mobile, email, message…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.source} onChange={e => setFilter('source', e.target.value)}>
          <option value="">All Sources</option>
          <option value="support_page">Support Page</option>
          <option value="get_quote_page">Get a Quote</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CONVERTED">Converted</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading enquiries…
          </div>
        ) : enquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No website enquiries found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Enquiry #', 'Name', 'Mobile / Email', 'Business Type', 'Source', 'Status', 'Received'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enquiries.map(e => (
                <tr key={e._id} className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/website-enquiries/${e._id}`)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">
                    {e.enquiryNumber || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.name}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{e.mobile}</p>
                    {e.email && <p className="text-xs text-gray-400">{e.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{e.businessType || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      {SOURCE_LABEL[e.source] || e.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[e.status] || 'bg-gray-100 text-gray-600'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
