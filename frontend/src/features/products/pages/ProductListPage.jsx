import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchProducts, fetchCategories } from '../productSlice';
import Pagination from '../../../components/ui/Pagination';
import { Plus, Search, Upload, Package, Pencil } from 'lucide-react';

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ product, onEdit }) => (
  <div className="card overflow-hidden group hover:shadow-md transition-shadow">
    {/* Image area */}
    <div className="relative bg-slate-100 h-44 flex items-center justify-center">
      <span className="absolute top-3 left-3 text-[10px] font-bold bg-white border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-500 shadow-sm tracking-wide">
        {product.isActive ? 'Instock' : 'outofstock'}
      </span>
     
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="h-28 w-28 object-contain" />
      ) : (
        <Package size={52} strokeWidth={1.2} className="text-slate-300" />
      )}
    </div>

    {/* Card body */}
    <div className="p-3">
      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">
        {product.category || 'GENERAL'}
      </p>
      <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-1">
        {product.name}
      </h3>
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3 min-h-[2.5rem]">
        {product.description || product.brand
          ? `${product.description || ''}${product.description && product.brand ? ' · ' : ''}${product.brand || ''}`
          : 'No description available.'}
      </p>

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

// ─── Main page ────────────────────────────────────────────────────────────────
const ProductListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, categories, pagination, loading } = useSelector((s) => s.product);
  console.log(list);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { dispatch(fetchCategories()); }, [dispatch]);
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
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

       {/* Footer note */}
      <p className="text-center text-xs text-slate-400 pt-2">
        Role-based access &bull; Supplier&apos;s View
      </p>
    </div>
  );
};

export default ProductListPage;
