import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Search, Filter, Download, AlertTriangle,
  TrendingUp, TrendingDown, Package, BarChart2, ChevronDown, Plus, X,
} from 'lucide-react';
import { fetchInventory, fetchInventoryStats, fetchWarehouses, adjustStock } from '../inventorySlice';
import { fetchProducts } from '../../products/productSlice';
import Pagination from '../../../components/ui/Pagination';
import { format } from 'date-fns';

const fmtNum = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
};
const fmtCurrency = (n) => (n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—');

const DONUT_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

const stockStatus = (item) => {
  const cur = item.currentStockQty ?? 0;
  const open = item.openingStockQty ?? 0;
  if (cur <= 0) return 'out-of-stock';
  if (open > 0 && cur < open * 0.2) return 'low stock';
  return 'in stock';
};

const StockChip = ({ item }) => {
  const s = stockStatus(item);
  if (s === 'out-of-stock') return <span className="badge-red">Out of Stock</span>;
  if (s === 'low stock') return <span className="badge-yellow">Low Stock</span>;
  return <span className="badge-green">In-Stock</span>;
};

const forecastLabel = (item) => {
  const s = stockStatus(item);
  if (s === 'out of stock') return 'Replenishment Required';
  if (s === 'low stock') return 'Projected to Spike – order soon';
  return 'Stable Demand – next 30 days';
};

const STOCK_TABS = [
  { id: '', label: 'All Items' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'high-stock', label: 'High Stock' },
  { id: 'out-of-stock', label: 'Out of Stock' },
];

const StatCard = ({ label, value, sub, subIcon: SubIcon, icon: Icon, iconBg, badge, badgeCls }) => (
  <div className="card p-4 flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value ?? '—'}</p>
        {badge && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>}
      </div>
      {sub && (
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 leading-tight">
          {SubIcon && <SubIcon size={11} />}{sub}
        </p>
      )}
    </div>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon size={18} />
    </div>
  </div>
);

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{payload[0].name}</p>
      <p className="text-slate-600">{payload[0].value.toLocaleString()} items</p>
    </div>
  );
};

const AddStockModal = ({ warehouses, onClose, onSubmit, saving }) => {
  const { list: products } = useSelector((s) => s.product);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState({ productId: '', warehouseId: '', quantity: '', type: 'add' });
  const [touched, setTouched] = useState(false);

  const filtered = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!form.productId || !form.warehouseId || !form.quantity) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Adjust Stock</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product</label>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setF('productId', ''); }}
              className="input mb-1"
            />
            {productSearch && !form.productId && (
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 px-3 py-2">No products found</p>
                ) : filtered.slice(0, 8).map((p) => (
                  <button key={p._id} type="button"
                    onClick={() => { setF('productId', p._id); setProductSearch(p.name); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    {p.sku && <span className="text-slate-400 ml-2 text-xs">{p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
            {touched && !form.productId && <p className="text-red-500 text-xs mt-1">Product is required</p>}
          </div>
          <div>
            <label className="label">Warehouse</label>
            <select className="input" value={form.warehouseId} onChange={(e) => setF('warehouseId', e.target.value)}>
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} {w.code ? `(${w.code})` : ''}</option>)}
            </select>
            {touched && !form.warehouseId && <p className="text-red-500 text-xs mt-1">Warehouse is required</p>}
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" className="input" value={form.quantity}
              onChange={(e) => setF('quantity', e.target.value)} placeholder="Enter quantity" />
            {touched && !form.quantity && <p className="text-red-500 text-xs mt-1">Quantity is required</p>}
          </div>
          <div>
            <label className="label">Operation</label>
            <div className="flex gap-3">
              {[{ v: 'add', l: 'Add Stock' }, { v: 'remove', l: 'Remove Stock' }].map(({ v, l }) => (
                <label key={v} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="radio" name="type" value={v} checked={form.type === v} onChange={() => setF('type', v)} className="text-blue-600" />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InventoryPage = () => {
  const dispatch = useDispatch();
  const { list, warehouses, stats, pagination, loading } = useSelector((s) => s.inventory);
  const { list: products } = useSelector((s) => s.product);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stockTab, setStockTab] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    dispatch(fetchInventoryStats());
    dispatch(fetchWarehouses());
    dispatch(fetchProducts({ limit: 200 }));
  }, [dispatch]);

  useEffect(() => {
    const params = { page, limit: 20 };
    if (stockTab) params.status = stockTab;
    if (warehouseId) params.warehouseId = warehouseId;
    if (search) params.search = search;
    if (category) params.category = category;
    dispatch(fetchInventory(params));
  }, [dispatch, page, stockTab, warehouseId, search, category]);

  const categories = useMemo(
    () => [...new Set(products?.map((p) => p?.category)?.filter(Boolean))]?.sort(),
    [products]
  );

  const donutData = stats ? [
    { name: 'In Stock', value: stats.distribution?.inStock || 0 },
    { name: 'Low Stock', value: stats.distribution?.lowStock || 0 },
    { name: 'Out of Stock', value: stats.distribution?.outOfStock || 0 },
  ] : [];
  const totalItems = donutData.reduce((s, d) => s + d.value, 0);
  const forecastPct = stats?.totalSKUs
    ? Math.round((stats.fastMovingCount / stats.totalSKUs) * 100)
    : 0;

  const switchTab = (id) => { setStockTab(id); setPage(1); };

  const handleAdjustStock = async (form) => {
    setAdjusting(true);
    const res = await dispatch(adjustStock({ productId: form.productId, warehouseId: form.warehouseId, quantity: Number(form.quantity), type: form.type }));
    setAdjusting(false);
    if (!res.error) {
      setShowModal(false);
      dispatch(fetchInventoryStats());
    }
  };

  const handleExport = () => {
    if (!list.length) return;
    const headers = ['Product', 'SKU', 'Category', 'Warehouse', 'Available', 'Allocated', 'Total', 'Unit Price', 'Status'];
    const rows = list.map((item) => {
      const prod = item.productId || {};
      const wh = item.warehouseId || {};
      const s = stockStatus(item);
      const status = s === 'no-stock' ? 'Out of Stock' : s === 'low-stock' ? 'Low Stock' : 'In Stock';
      return [
        prod.name || '—', prod.productCode || '—', prod.category || '—',
        wh.name || '—',
        item.currentStockQty ?? 0, item.quantityAllocated ?? 0, item.quantityOnHand ?? 0,
        prod.basePrice ?? 0, status,
      ];
    });
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {showModal && (
        <AddStockModal
          warehouses={warehouses}
          onClose={() => setShowModal(false)}
          onSubmit={handleAdjustStock}
          saving={adjusting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <Plus size={14} /> Add Stock
        </button>
      </div>

      {/* ── Top section: donut + stat cards, equal height ── */}
      {/* FIX 1: items-stretch so the donut card grows to match the stat-cards grid height */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">

        {/* Donut chart card — h-full makes it fill the row height */}
        <div className="card p-5 lg:col-span-2 flex flex-col items-center h-full">
          <p className="text-xs font-bold text-slate-600 tracking-widest uppercase mb-3">
            Inventory Distribution
          </p>

          {totalItems === 0 ? (
            <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">No data</div>
          ) : (
            <div className="w-full flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend pushed to bottom */}
          <div className="flex items-center gap-5 mt-auto pt-3">
            {[
              { label: 'In Stock', color: 'bg-green-500' },
              { label: 'Low Stock', color: 'bg-amber-500' },
              { label: 'Out of Stock', color: 'bg-red-500' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6 stat cards */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-3 content-start">
          <StatCard
            label="Total Network Stocks"
            value={fmtNum(stats?.totalOnHand)}
            badge="+5% YOY"
            badgeCls="bg-green-100 text-green-700"
            sub={`Value: ${fmtCurrency((stats?.totalOnHand || 0) * 50)}`}
            subIcon={TrendingUp}
            icon={BarChart2}
            iconBg="bg-primary-100 text-primary-600"
          />
          <StatCard
            label="Total SKU's"
            value={fmtNum(stats?.totalSKUs)}
            sub={`${stats?.fastMovingCount ?? 0} new this month`}
            subIcon={Package}
            icon={Package}
            iconBg="bg-green-100 text-green-600"
          />
          <StatCard
            label="Low Stock Alert"
            value={stats?.lowStockCount ?? '—'}
            sub="need replenishment"
            subIcon={AlertTriangle}
            icon={AlertTriangle}
            iconBg="bg-red-100 text-red-500"
          />
          <StatCard
            label="Forecast Demand"
            value={`+${forecastPct}%`}
            sub="next 30 days"
            subIcon={TrendingUp}
            icon={TrendingUp}
            iconBg="bg-amber-100 text-amber-600"
          />
          <StatCard
            label="Fast-Moving Items"
            value={fmtNum(stats?.fastMovingCount)}
            badge="+1.4%"
            badgeCls="bg-green-100 text-green-700"
            sub="vs last year"
            subIcon={TrendingUp}
            icon={TrendingUp}
            iconBg="bg-green-100 text-green-600"
          />
          <StatCard
            label="Slow-Moving Items"
            value={fmtNum(stats?.slowMovingCount)}
            badge="-2%"
            badgeCls="bg-red-100 text-red-700"
            sub="vs last year"
            subIcon={TrendingDown}
            icon={TrendingDown}
            iconBg="bg-slate-100 text-slate-500"
          />
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="card overflow-hidden">

        <div className="flex items-center px-4 py-3 gap-4 w-full border-b border-slate-100">

          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search Product Name, Dealer, SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-8 py-2 text-sm w-64"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center border-b border-slate-100 overflow-x-auto">
            {STOCK_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${stockTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Push right side */}
          <div className="ml-auto flex items-center gap-3">

            {/* Category */}
            <div className="relative">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className={`input w-36 py-2 text-sm appearance-none pr-8 cursor-pointer ${!category ? 'text-slate-400' : 'text-slate-700'
                  }`}
              >
                <option value="" disabled hidden>
                  Select Category
                </option>

                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Dropdown icon */}
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />

              {/* Clear icon */}
              {category && (
                <button
                  onClick={() => { setCategory(''); setPage(1); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
                >
                  <X size={12} className="text-slate-500" />
                </button>
              )}
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              <Download size={13} /> Export
            </button>

          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Stock Details</p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['PRODUCT / SKU', 'LOCATION', 'AVAILABLE', 'ALLOCATED', 'TOTAL', 'UNIT PRICE', 'STOCK STATUS', 'FORECAST & DEMAND'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                      No inventory records found
                    </td>
                  </tr>
                ) : list.map((item) => {
                  const prod = item.productId || {};
                  const wh = item.warehouseId || {};
                  const loc = [wh.address?.city, wh.address?.state].filter(Boolean).join(' • ');

                  return (
                    <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 leading-snug">{prod.name || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          SKU: {prod.productCode || '—'}
                          {prod.category ? ` | Category: ${prod.category}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700 leading-snug">{wh.name || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{loc || wh.code || ''}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">
                          {(item.currentStockQty ?? 0).toLocaleString('en-IN')}
                        </p>
                        {prod.unit && <p className="text-xs text-slate-400 mt-0.5">{prod.unit}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">
                          {(item.quantityAllocated ?? 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Reserved</p>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {(item.quantityOnHand ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {fmtCurrency(prod.basePrice)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StockChip item={item} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[160px] leading-relaxed">
                        {forecastLabel(item)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default InventoryPage;