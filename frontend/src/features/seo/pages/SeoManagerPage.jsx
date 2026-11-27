import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, Loader2, Pencil, Plus, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import Pagination from '../../../components/ui/Pagination';
import PageHeader from '../../../components/ui/PageHeader';

const PAGE_TYPE_LABELS = {
  home: 'Home',
  about: 'About',
  products: 'Products',
  'product-detail': 'Product details',
  solutions: 'Solutions',
  dealers: 'Dealers',
  blog: 'Blog',
  'blog-post': 'Blog post',
  faq: 'FAQs',
  custom: 'Custom page',
};

const SeoManagerPage = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ search: '', pageType: '', status: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/seo', { params: { ...filters, limit: 20 } })
      .then(({ data }) => {
        if (!active) return;
        setPages(data.data);
        setPagination(data.pagination);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Unable to load SEO pages.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters, refreshKey]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const handleDelete = async (page) => {
    if (!window.confirm(`Delete SEO settings for "${page.pageName}"?`)) return;
    setDeletingId(page._id);
    try {
      await api.delete(`/seo/${page._id}`);
      toast.success('SEO page deleted.');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete SEO page.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={Search} title="SEO manager" subtitle="Metadata, page copy and image alt text for the Buvvas website">
        <button onClick={() => navigate('/seo/new')} className="btn-primary">
          <Plus size={16} /> Add SEO page
        </button>
      </PageHeader>

      <div className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm text-primary-900">
        These settings apply to existing Buvvas pages; they do not create ecommerce pages.
        The site loads a published record for the current route at
        {' '}<code className="font-semibold">GET /api/seo/public?path=/page-path</code>.
        Dynamic routes include <code>/products/:categorySlug/:productSlug</code> and <code>/blog/:slug</code>.
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input min-w-[220px] flex-1"
          placeholder="Search pages or routes…"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
        />
        <select className="input w-full sm:w-48" value={filters.pageType}
          onChange={(event) => updateFilter('pageType', event.target.value)}>
          <option value="">All page types</option>
          {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className="input w-full sm:w-40" value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={22} className="mr-2 animate-spin" /> Loading SEO pages…
          </div>
        ) : error ? (
          <p className="px-5 py-12 text-center text-sm text-red-600">{error}</p>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileSearch size={34} className="mb-3 opacity-40" />
            <p className="text-sm">No SEO settings match these filters.</p>
            <p className="mt-1 text-center text-xs">
              Existing website pages appear here after you add SEO settings for their routes.
            </p>
            <button
              onClick={() => navigate('/seo/new')}
              className="btn-primary mt-4 text-sm py-2 px-4"
            >
              Add settings for an existing page
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Website route</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pages.map((page) => (
                  <tr key={page._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{page.pageName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{page.routePath}</td>
                    <td className="px-4 py-3 text-slate-600">{PAGE_TYPE_LABELS[page.pageType] || page.pageType}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        page.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {page.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(page.updatedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/seo/${page._id}/edit`)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                          title="Edit SEO page"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(page)}
                          disabled={deletingId === page._id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Delete SEO page"
                        >
                          {deletingId === page._id
                            ? <Loader2 size={15} className="animate-spin" />
                            : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && <Pagination pagination={pagination} onPageChange={(page) => {
          setFilters((current) => ({ ...current, page }));
        }} />}
      </div>
    </div>
  );
};

export default SeoManagerPage;
