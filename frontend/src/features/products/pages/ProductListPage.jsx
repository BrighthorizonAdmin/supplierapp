import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchProducts, fetchCategories } from '../productSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';

const ProductListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, categories, pagination, loading } = useSelector((s) => s.product);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { dispatch(fetchCategories()); }, [dispatch]);
  useEffect(() => {
    dispatch(fetchProducts({ page, limit: 20, search, category, isActive: 'true' }));
  }, [dispatch, page, search, category]);

  const columns = [
    { key: 'productCode', label: 'Code', render: (v) => <span className="font-mono text-xs text-slate-600">{v}</span> },
    { key: 'name', label: 'Name', render: (v, row) => (
      <button onClick={() => navigate(`/products/${row._id}/edit`)} className="text-primary-600 hover:underline font-medium">{v}</button>
    )},
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand', render: (v) => v || '—' },
    { key: 'unit', label: 'Unit' },
    { key: 'basePrice', label: 'Base Price', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'taxRate', label: 'GST %', render: (v) => `${v}%` },
    { key: 'isActive', label: 'Status', render: (v) => <span className={v ? 'badge-green' : 'badge-red'}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'createdAt', label: 'Added', render: (v) => format(new Date(v), 'dd MMM yyyy') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
        <button onClick={() => navigate('/products/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search products..." className="input pl-9"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-44" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default ProductListPage;
