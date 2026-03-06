import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Search, Filter, Download, AlertTriangle,
  TrendingUp, TrendingDown, Package, BarChart2, ChevronDown,
} from 'lucide-react';
import { fetchInventory, fetchInventoryStats, fetchWarehouses } from '../inventorySlice';
import Pagination from '../../../components/ui/Pagination';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
};
const fmtCurrency = (n) => (n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—');

// ─── Chart colours (green-500, amber-500, red-500) ────────────────────────────
const DONUT_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

// ─── Stock status chip ────────────────────────────────────────────────────────
const StockChip = ({ item }) => {
  if (!item.quantityOnHand) return <span className="badge-red">Out of Stock</span>;
  if (item.isLowStock)      return <span className="badge-yellow">Low Stock</span>;
  return <span className="badge-green">In-Stock</span>;
};

const forecastLabel = (item) => {
  if (!item.quantityOnHand) return 'Replenishment Required';
  if (item.isLowStock)      return 'Projected to Spike – order soon';
  return 'Stable Demand – next 30 days';
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const STOCK_TABS = [
  { id: '',             label: 'All Items' },
  { id: 'low-stock',    label: 'Low Stock' },
  { id: 'high-stock',   label: 'High Stock' },
  { id: 'out-of-stock', label: 'Out of Stock' },
];

// ─── Stat card ────────────────────────────────────────────────────────────────
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

// ─── Donut tooltip ────────────────────────────────────────────────────────────
const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{payload[0].name}</p>
      <p className="text-slate-600">{payload[0].value.toLocaleString()} items</p>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const InventoryPage = () => {
  const dispatch = useDispatch();
  const { list, warehouses, stats, pagination, loading } = useSelector((s) => s.inventory);

  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [stockTab,    setStockTab]    = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [category,    setCategory]    = useState('');

  // Fetch stats & warehouses once
  useEffect(() => {
    dispatch(fetchInventoryStats());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // Fetch list on filter change
  useEffect(() => {
    const params = { page, limit: 20 };
    if (stockTab)    params.status      = stockTab;
    if (warehouseId) params.warehouseId = warehouseId;
    if (search)      params.search      = search;
    if (category)    params.category    = category;
    dispatch(fetchInventory(params));
  }, [dispatch, page, stockTab, warehouseId, search, category]);

  // Distinct categories from current list
  const categories = useMemo(
    () => [...new Set(list.map((i) => i.productId?.category).filter(Boolean))],
    [list]
  );

  // Donut data
  const donutData = stats ? [
    { name: 'In Stock',     value: stats.distribution?.inStock    || 0 },
    { name: 'Low Stock',    value: stats.distribution?.lowStock   || 0 },
    { name: 'Out of Stock', value: stats.distribution?.outOfStock || 0 },
  ] : [];
  const totalItems   = donutData.reduce((s, d) => s + d.value, 0);
  const forecastPct  = stats?.totalSKUs
    ? Math.round((stats.fastMovingCount / stats.totalSKUs) * 100)
    : 0;

  const switchTab = (id) => { setStockTab(id); setPage(1); };

  return (
    <div className="space-y-5">

      {/* ── Top section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* Donut chart card */}
        <div className="card p-5 lg:col-span-2 flex flex-col items-center">
          <p className="text-xs font-bold text-slate-600 tracking-widest uppercase mb-3">
            Inventory Distribution
          </p>

          {totalItems === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data</div>
          ) : (
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
          )}

          {/* Legend */}
          <div className="flex items-center gap-5 mt-1">
            {[
              { label: 'In Stock',     color: 'bg-green-500' },
              { label: 'Low Stock',    color: 'bg-amber-500' },
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
        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
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

        {/* Search + controls row */}
<div className="flex items-center justify-between gap-4 w-full">

  {/* Search Input */}
  <div className="relative w-64">
    <Search
      size={13}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
    />
    <input
      type="text"
      placeholder="Search Product Name, Dealer, SKU..."
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setPage(1);
      }}
      className="input pl-8 py-2 text-sm w-full"
    />
  </div>

  {/* Tab Bar */}
  <div className="flex items-center border-b border-slate-100 overflow-x-auto">
    {STOCK_TABS.map((tab) => (
      <button
        key={tab.id}
        onClick={() => switchTab(tab.id)}
        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
          stockTab === tab.id
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>

</div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
          {/* Category select */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="input w-36 py-2 text-sm appearance-none pr-7 cursor-pointer"
            >
              <option value="">Category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex-1" />

          <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter size={13} /> Saved Filters
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            <Download size={13} /> Export
          </button>
        </div>

      

        {/* Table header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Stock Details</p>
          <button className="text-xs text-primary-600 font-medium hover:underline">View All</button>
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
                  const wh   = item.warehouseId || {};
                  const loc  = [wh.address?.city, wh.address?.state].filter(Boolean).join(' • ');

                  return (
                    <tr key={item._id} className="hover:bg-slate-50 transition-colors">

                      {/* Product / SKU */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 leading-snug">{prod.name || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          SKU: {prod.productCode || '—'}
                          {prod.category ? ` | Category: ${prod.category}` : ''}
                        </p>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700 leading-snug">{wh.name || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{loc || wh.code || ''}</p>
                      </td>

                      {/* Available */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">
                          {(item.quantityAvailable ?? 0).toLocaleString('en-IN')}
                        </p>
                        {prod.unit && <p className="text-xs text-slate-400 mt-0.5">{prod.unit}</p>}
                      </td>

                      {/* Allocated */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">
                          {(item.quantityAllocated ?? 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Reserved</p>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {(item.quantityOnHand ?? 0).toLocaleString('en-IN')}
                      </td>

                      {/* Unit Price */}
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {fmtCurrency(prod.basePrice)}
                      </td>

                      {/* Stock Status */}
                      <td className="px-4 py-3.5">
                        <StockChip item={item} />
                      </td>

                      {/* Forecast & Demand */}
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

        {/* Footer links */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
          <button className="text-xs text-primary-600 hover:underline">Role - based access</button>
          <span className="text-slate-300">·</span>
          <button className="text-xs text-primary-600 hover:underline">Supplier's View</button>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
