import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchBlogs, deleteBlog } from '../blogSlice';
import { FileText, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-800',
};

const CATEGORIES = ['Retail', 'Restaurant', 'Pharmacy', 'Hospitality', 'Cafe', 'Supermarket', 'Warehouse', 'General'];

export default function BlogListPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { posts, pagination, loading } = useSelector((s) => s.blog);

  const [filters, setFilters] = useState({ status: '', category: '', search: '', page: 1 });

  useEffect(() => {
    dispatch(fetchBlogs({ ...filters, limit: 20 }));
  }, [filters, dispatch]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await dispatch(deleteBlog(id)).unwrap();
      toast.success('Blog post deleted.');
    } catch { toast.error('Failed to delete post.'); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and publish posts shown on the Buvvas website's Blog section</p>
        </div>
        <button onClick={() => navigate('/blog/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={16} /> New Post
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by title, excerpt, tags…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No blog posts yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Title', 'Category', 'Author', 'Status', 'Updated', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map((p) => (
                <tr key={p._id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 cursor-pointer" onClick={() => navigate(`/blog/${p._id}/edit`)}>
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-gray-600">{p.author}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(p.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/blog/${p._id}/edit`)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(p._id, p.title)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
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
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing page {filters.page} of {pagination.pages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
              ← Prev
            </button>
            <button disabled={filters.page >= pagination.pages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
