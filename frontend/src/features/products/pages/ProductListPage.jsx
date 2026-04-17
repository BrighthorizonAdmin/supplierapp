import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchProducts, fetchCategories } from '../productSlice';
import Pagination from '../../../components/ui/Pagination';
import { Plus, Search, Upload, Package, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';

// Build a URL from a single image object (handles Windows backslashes, leading "./")
const buildSrc = (img) => {
  if (!img) return null;
  if (img.filePath) {
    const clean = img.filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    return '/' + clean;
  }
  if (img.fileName) return '/uploads/products/' + img.fileName;
  if (img.url) return img.url;
  return null;
};

// Returns all valid image URLs for a product (images is an array in the schema)
const getImageSrcs = (product) => {
  const images = product.images;
  if (!Array.isArray(images) || images.length === 0) return [];
  // Put primary image first
  const sorted = [...images].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  return sorted.map(buildSrc).filter(Boolean);
};

const ImageCarousel = ({ srcs, name }) => {
  const [idx, setIdx] = useState(0);
  const [errors, setErrors] = useState(new Set());

  const validSrcs = srcs.filter((_, i) => !errors.has(i));
  const safeIdx = validSrcs.length > 0 ? idx % validSrcs.length : 0;

  if (srcs.length === 0 || validSrcs.length === 0) {
    return <Package size={52} strokeWidth={1.2} className="text-slate-300" />;
  }

  const prev = (e) => {
    e.stopPropagation();
    setIdx((i) => (i - 1 + validSrcs.length) % validSrcs.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setIdx((i) => (i + 1) % validSrcs.length);
  };

  return (
    <div className="relative w-full h-full">
      <img
        key={validSrcs[safeIdx]}
        src={validSrcs[safeIdx]}
        alt={`${name} ${safeIdx + 1}`}
        className="w-full h-full object-cover"
        onError={() => {
          const originalIdx = srcs.indexOf(validSrcs[safeIdx]);
          setErrors((prev) => new Set([...prev, originalIdx]));
        }}
      />

      {validSrcs.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronRight size={14} />
          </button>

          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
            {validSrcs.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`rounded-full transition-all ${
                  i === safeIdx
                    ? 'w-3 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/60 hover:bg-white/90'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
// ─── Product Card ─────────────────────────────────────────────────────────────

// Stock thresholds:
//   No Stock  → currentStockQty <= 0
//   Low Stock → > 0 but ≤ 25% of openingStockQty (or ≤ 10 when no opening qty set)
//   In Stock  → everything else
const getStockStatus = (cur = 0, open = 0) => {
  if (cur <= 0) return 'no-stock';
  if (open > 0 && cur <= open * 0.25) return 'low-stock';
  if (open === 0 && cur <= 10) return 'low-stock';
  return 'in-stock';
};

const StockBadge = ({ product }) => {
  const cur  = product.currentStockQty ?? 0;
  const open = product.openingStockQty ?? 0;
  const status = getStockStatus(cur, open);

  const label = status === 'no-stock' ? 'No Stock' : status === 'low-stock' ? 'Low Stock' : 'In Stock';
  const cls   = status === 'no-stock' ? 'badge-red' : status === 'low-stock' ? 'badge-yellow' : 'badge-green';

  return <span className={cls}>{label}</span>;
};

const ProductCard = ({ product, onEdit }) => {
  const srcs = getImageSrcs(product);
  const cur  = product.currentStockQty ?? 0;
  const open = product.openingStockQty ?? 0;
  const status = getStockStatus(cur, open);

  return (
    <div className="card overflow-hidden group hover:shadow-md transition-shadow">
      {/* Image area */}
      <div className="relative bg-slate-100 h-44 flex items-center justify-center overflow-hidden">
        <div className="absolute top-2 right-2 z-10">
          <StockBadge product={product} />
        </div>

        <ImageCarousel srcs={srcs} name={product.name} />
      </div>

      {/* Card body */}
      <div className="p-3">
        <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-1">
          {product.category || 'GENERAL'}
        </p>
        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2 min-h-[2.5rem]">
          {product.description || product.brand
            ? `${product.description || ''}${product.description && product.brand ? ' · ' : ''}${product.brand || ''}`
            : 'No description available.'}
        </p>

        {/* Stock quantity row */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            status === 'in-stock' ? 'bg-green-500' : status === 'low-stock' ? 'bg-amber-400' : 'bg-red-500'
          }`} />
          <span className="text-[11px] text-slate-500">
            {cur > 0
              ? <>{cur} <span className="text-slate-400">/ {open} units</span></>
              : <span className="text-red-500 font-medium">Out of stock</span>
            }
          </span>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium">Dealer Price</p>
            <p className="text-sm font-bold text-slate-900">
              ₹{(product.basePrice || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <button
            onClick={() => onEdit(product._id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const ProductListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, categories, pagination, loading } = useSelector((s) => s.product);
 
  
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { dispatch(fetchCategories()); }, [dispatch]);

  // Debounce search — API call fires only after 400 ms of inactivity
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    dispatch(fetchProducts({ page, limit: 20, search, category }));
  }, [dispatch, page, search, category]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <Upload size={14} /> Bulk Upload
          </button>
          <button
            onClick={() => navigate('/products/new')}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            className="input pl-9 text-sm"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="input w-44 text-sm"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="card flex items-center justify-center h-64 text-slate-400 text-sm">
          No products found
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {list.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onEdit={(id) => navigate(`/products/${id}/edit`)}
              />
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}


    </div>
  );
};

export default ProductListPage;