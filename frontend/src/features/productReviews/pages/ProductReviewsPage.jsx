import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, MessageSquareText, PlayCircle, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import Pagination from '../../../components/ui/Pagination';
import { usePermission } from '../../../routes/ProtectedRoute';

// Reviews written by customers on the Buvvas website. Nothing shows on the
// website until it is approved here.
const WEBSITE_URL = 'https://buvvas.com';

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

const Stars = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={14} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
    ))}
  </span>
);

const MediaPreview = ({ media, onOpen }) => (
  <div className="flex flex-wrap gap-2">
    {media.map((item) => (
      <button key={item.url} type="button" onClick={() => onOpen(item)}
        className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        title={item.type === 'video' ? 'Play video' : 'View photo'}>
        {item.type === 'video' ? (
          <>
            <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
            <PlayCircle size={26} className="absolute inset-0 m-auto text-white drop-shadow" />
          </>
        ) : (
          <img src={item.url} alt="Customer upload" loading="lazy" className="h-full w-full object-cover" />
        )}
      </button>
    ))}
  </div>
);

const ProductReviewsPage = () => {
  const { hasPermission } = usePermission();
  const canModerate = hasPermission('reviews:write');
  const [filters, setFilters] = useState({ status: 'pending', search: '', rating: '', page: 1 });
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/product-reviews', { params: { ...filters, limit: 20 } })
      .then(({ data }) => {
        if (!active) return;
        setReviews(data.data || []);
        setPagination(data.pagination);
        setStatusCounts(data.statusCounts || { pending: 0, approved: 0, rejected: 0 });
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Unable to load reviews.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, refreshKey]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  const setStatus = async (review, status) => {
    let reason = '';
    if (status === 'rejected') {
      reason = window.prompt('Reason for rejecting (internal note, optional):', '') ?? null;
      if (reason === null) return;
    }
    setBusyId(review._id);
    try {
      await api.patch(`/product-reviews/${review._id}/status`, { status, reason });
      toast.success(status === 'approved' ? 'Review approved. It is now on the website.' : `Review ${status}.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update review.');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (review) => {
    if (!window.confirm(`Delete this review by ${review.name}? This cannot be undone.`)) return;
    setBusyId(review._id);
    try {
      await api.delete(`/product-reviews/${review._id}`);
      toast.success('Review deleted.');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete review.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reviews customers write on the Buvvas website. Approve a review to show it, with its photos and videos,
          on the product page and in Google results.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => updateFilter('status', value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filters.status === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {label} <span className="ml-1 opacity-75">{statusCounts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input min-w-[220px] flex-1" placeholder="Search product, customer or text…"
          value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <select className="input w-full sm:w-40" value={filters.rating} onChange={(e) => updateFilter('rating', e.target.value)}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={22} className="mr-2 animate-spin" /> Loading reviews…
          </div>
        ) : error ? (
          <p className="px-5 py-12 text-center text-sm text-red-600">{error}</p>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <MessageSquareText size={34} className="mb-3 opacity-40" />
            <p className="text-sm">No {filters.status} reviews.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reviews.map((review) => (
              <li key={review._id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={review.productPath ? `${WEBSITE_URL}${review.productPath}` : WEBSITE_URL}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
                      {review.productName || 'Product'} <ExternalLink size={13} />
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Stars value={review.rating} />
                      <span className="font-semibold text-slate-700">{review.name}</span>
                      {review.location && <span>· {review.location}</span>}
                      {review.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700">
                          <ShieldCheck size={12} /> Verified purchase
                        </span>
                      )}
                      <span>· {new Date(review.createdAt).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {[review.email, review.phone].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {canModerate && (
                    <div className="flex items-center gap-2">
                      {review.status !== 'approved' && (
                        <button type="button" disabled={busyId === review._id} onClick={() => setStatus(review, 'approved')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                          <Check size={14} /> Approve
                        </button>
                      )}
                      {review.status !== 'rejected' && (
                        <button type="button" disabled={busyId === review._id} onClick={() => setStatus(review, 'rejected')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          <X size={14} /> {review.status === 'approved' ? 'Hide' : 'Reject'}
                        </button>
                      )}
                      <button type="button" disabled={busyId === review._id} onClick={() => remove(review)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete review">
                        {busyId === review._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  )}
                </div>
                {review.title && <p className="font-semibold text-slate-800">{review.title}</p>}
                <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{review.comment}</p>
                {review.media?.length > 0 && <MediaPreview media={review.media} onOpen={setViewer} />}
                {review.status === 'rejected' && review.rejectionReason && (
                  <p className="text-xs text-slate-400">Rejected: {review.rejectionReason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && (
          <Pagination pagination={pagination} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
        )}
      </div>

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewer(null)}
          role="dialog" aria-modal="true" aria-label="Review media">
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
            <X size={20} />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-4xl">
            {viewer.type === 'video'
              ? <video src={viewer.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
              : <img src={viewer.url} alt="Customer upload" className="max-h-[85vh] max-w-full rounded-lg" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductReviewsPage;
