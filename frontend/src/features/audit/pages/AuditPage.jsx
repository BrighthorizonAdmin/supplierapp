import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Calendar, Download, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import {
  fetchAnalyticsKPIs,
  fetchAnalyticsSalesChart,
  fetchAnalyticsInventoryStats,
  fetchAnalyticsTopProducts,
  fetchAnalyticsDeliveredOrders,
  fetchRetailAnalytics,
  setChartPeriod,
} from '../auditSlice';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CLS = {
  'In-Stock':     'bg-green-100 text-green-700',
  'Low-Stock':    'bg-amber-100 text-amber-700',
  'Out-of-Stock': 'bg-red-100   text-red-700',
};

const fmtY  = (v) => `₹${(v / 1000).toFixed(0)}k`;
const fmtINR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const getStockStatus = (item) => {
  if (!item.quantityOnHand) return 'Out-of-Stock';
  const available = (item.quantityOnHand || 0) - (item.quantityAllocated || 0);
  if (available <= (item.reorderLevel || 0)) return 'Low-Stock';
  return 'In-Stock';
};

const toMonthLabel = (dateStr = '') => {
  const month = parseInt(dateStr.split('-')[1], 10);
  return MONTH_LABELS[month - 1] || dateStr;
};

const STORE_STATUS_CLS = {
  Active:  'bg-green-100 text-green-700',
  Review:  'bg-amber-100 text-amber-700',
  New:     'bg-blue-100 text-blue-700',
  Pending: 'bg-orange-100 text-orange-700',
};

const CHANNEL_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

// ── Component ────────────────────────────────────────────────────────────────
const AuditPage = () => {
  const dispatch = useDispatch();
  const {
    analyticsKPIs,
    analyticsSalesChart,
    analyticsInventoryStats,
    analyticsTopProducts,
    deliveredCount,
    analyticsLoading,
    chartPeriod,
    retailAnalytics,
    retailAnalyticsLoading,
  } = useSelector((s) => s.audit);

  const [activeTab, setActiveTab] = useState('dealer');

  useEffect(() => {
    dispatch(fetchAnalyticsKPIs());
    dispatch(fetchAnalyticsInventoryStats());
    dispatch(fetchAnalyticsTopProducts());
    dispatch(fetchAnalyticsDeliveredOrders());
  }, [dispatch]);

  useEffect(() => {
    if (activeTab === 'retail' && !retailAnalytics) {
      dispatch(fetchRetailAnalytics());
    }
  }, [dispatch, activeTab, retailAnalytics]);

  useEffect(() => {
    dispatch(fetchAnalyticsSalesChart(chartPeriod));
  }, [dispatch, chartPeriod]);

  // ── Dealer derived values ────────────────────────────────────────────────
  const monthRevenue  = analyticsKPIs?.monthRevenue  || 0;
  const activeOrders  = analyticsKPIs?.activeOrders  || 0;
  const avgOrderValue = activeOrders > 0 ? Math.round(monthRevenue / activeOrders) : 0;

  const invStats  = analyticsInventoryStats;
  const totalInv  = (invStats?.inStockCount || 0) + (invStats?.lowStockCount || 0) + (invStats?.outOfStockCount || 0);
  const fulfillmentRate = totalInv > 0
    ? ((invStats?.inStockCount || 0) / totalInv * 100).toFixed(1)
    : '—';

  const chartData = useMemo(() =>
    (analyticsSalesChart || []).map((item) => ({
      month:   toMonthLabel(item.date),
      revenue: item.revenue,
      orders:  item.orders,
    })),
  [analyticsSalesChart]);

  const salesMix = invStats ? [
    { name: 'In-Stock',     value: invStats.inStockCount,     color: '#22c55e' },
    { name: 'Low-Stock',    value: invStats.lowStockCount,    color: '#eab308' },
    { name: 'Out-of-Stock', value: invStats.outOfStockCount,  color: '#ef4444' },
  ] : [];
  const dominantMix = salesMix.reduce((a, b) => (b.value > a.value ? b : a), salesMix[0] || {});

  const maxUnits = Math.max(...(analyticsTopProducts || []).map((i) => i.quantityOnHand || 0), 1);
  const topProducts = (analyticsTopProducts || []).map((item, i) => ({
    rank:    String(i + 1).padStart(2, '0'),
    name:    item.productId?.name    || 'Unknown',
    cat:     item.productId?.category || '—',
    units:   item.quantityOnHand || 0,
    revenue: Math.round((item.quantityOnHand || 0) * (item.productId?.basePrice || 0)),
    share:   Math.round(((item.quantityOnHand || 0) / maxUnits) * 100),
    status:  getStockStatus(item),
  }));

  const delivered    = deliveredCount;
  const delayed      = analyticsKPIs?.overdueInvoices || 0;
  const onTimeRate   = delivered > 0
    ? ((delivered / (delivered + delayed)) * 100).toFixed(1)
    : '—';

  const totalIssues  = (invStats?.outOfStockCount || 0) + delayed + (analyticsKPIs?.pendingReturns || 0);
  const delayReasons = [
    { label: 'Out-of-Stock',    pct: totalIssues > 0 ? Math.round((invStats?.outOfStockCount || 0) / totalIssues * 100) : 0, color: '#3b82f6' },
    { label: 'Overdue Invoice', pct: totalIssues > 0 ? Math.round(delayed / totalIssues * 100) : 0, color: '#93c5fd' },
    { label: 'Pending Returns', pct: totalIssues > 0 ? Math.round((analyticsKPIs?.pendingReturns || 0) / totalIssues * 100) : 0, color: '#f87171' },
  ];

  // ── Retail derived values ──────────────────────────────────────────────────
  const retailKPIs = retailAnalytics?.kpis || {};
  const retailChannels = (retailAnalytics?.channels || []).map((c, i) => ({
    ...c,
    color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
  }));
  const retailChannelTotal = retailChannels.reduce((s, c) => s + c.amount, 0);

  // Merge dealer sales chart with retail trend by date
  const retailChartData = useMemo(() => {
    const retailTrendMap = Object.fromEntries(
      (retailAnalytics?.trend || []).map((t) => [t.date, t.retail])
    );
    return (analyticsSalesChart || []).map((item) => ({
      month:  toMonthLabel(item.date),
      dealer: item.revenue,
      retail: retailTrendMap[item.date] || 0,
    }));
  }, [analyticsSalesChart, retailAnalytics]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monitor sales performance, inventory levels, and delivery metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Dealer / Retail Sales toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-white">
            {[{ label: 'Dealer Sales', value: 'dealer' }, { label: 'Retail Sales', value: 'retail' }].map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === t.value
                    ? 'border border-blue-600 text-blue-600 bg-white'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600">
            <Calendar size={14} /> Last 30 Days
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DEALER SALES TAB (existing content — unchanged)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dealer' && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue (Month)', value: fmtINR(monthRevenue), change: null, up: true },
              { label: 'Active Orders',         value: activeOrders.toLocaleString(), change: null, up: true },
              { label: 'Avg. Order Value',       value: fmtINR(avgOrderValue), change: null, up: true },
              { label: 'Inventory In-Stock Rate', value: fulfillmentRate !== '—' ? `${fulfillmentRate} %` : '—', change: null },
            ].map((k) => (
              <div key={k.label} className="card p-4">
                {analyticsLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-24" />
                    <div className="h-7 bg-slate-200 rounded w-32" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 mb-1">{k.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                    {k.change && (
                      <p className={`text-xs mt-1.5 flex items-center gap-1 ${k.up ? 'text-green-600' : 'text-red-500'}`}>
                        {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {k.change}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 col-span-2">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-800">Revenue Trend</p>
                  <p className="text-xs text-slate-400">Monthly overview – current year</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-blue-500 inline-block rounded-full" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-green-500 inline-block rounded-full" /> Orders
                    </span>
                  </div>
                  <select
                    value={chartPeriod}
                    onChange={(e) => dispatch(setChartPeriod(e.target.value))}
                    className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-600"
                  >
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                    <option value="week">Week</option>
                  </select>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, name) => name === 'revenue' ? fmtINR(v) : v} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="orders"  stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4 flex flex-col">
              <p className="font-semibold text-slate-800 mb-1">Inventory Mix</p>
              <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={salesMix} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                      dataKey="value" startAngle={90} endAngle={-270}>
                      {salesMix.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {dominantMix && totalInv > 0 ? (
                    <>
                      <p className="text-lg font-bold text-slate-800 leading-none">
                        {Math.round((dominantMix.value / totalInv) * 100)}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{dominantMix.name}</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">No data</p>
                  )}
                </div>
              </div>
              <div className="space-y-2 mt-1">
                {salesMix.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-medium text-slate-700">
                      {totalInv > 0 ? `${Math.round((item.value / totalInv) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">Product Inventory</p>
                  <p className="text-xs text-slate-400">Recent inventory levels by product</p>
                </div>
                <button className="flex items-center gap-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50">
                  View <ChevronDown size={11} />
                </button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="pb-2 text-left">#</th>
                    <th className="pb-2 text-left">Product</th>
                    <th className="pb-2 text-right">On Hand</th>
                    <th className="pb-2 text-right">Est. Value</th>
                    <th className="pb-2 text-center">Level</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        {analyticsLoading ? 'Loading…' : 'No data'}
                      </td>
                    </tr>
                  ) : topProducts.map((p) => (
                    <tr key={p.rank} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-400 font-mono">{p.rank}</td>
                      <td className="py-2">
                        <p className="font-medium text-slate-700">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.cat}</p>
                      </td>
                      <td className="py-2 text-right text-slate-600">{p.units.toLocaleString()}</td>
                      <td className="py-2 text-right font-medium text-slate-700">{fmtINR(p.revenue)}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.share}%` }} />
                          </div>
                          <span className="text-slate-500 w-7 text-right">{p.share}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[p.status] || ''}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-4">
              <p className="font-semibold text-slate-800">Delivery Performance</p>
              <p className="text-xs text-slate-400 mb-3">Current period</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { val: onTimeRate !== '—' ? `${onTimeRate} %` : '—', label: 'On-Time Rate', note: delivered > 0 ? `${delivered.toLocaleString()} delivered` : 'No data', up: true, accent: 'text-blue-600' },
                  { val: analyticsKPIs?.lowStockAlerts ?? '—', label: 'Low-Stock Alerts', note: analyticsKPIs?.lowStockAlerts > 0 ? 'Needs restock' : 'All good', up: (analyticsKPIs?.lowStockAlerts || 0) === 0, accent: 'text-slate-700' },
                  { val: delayed.toLocaleString(), label: 'Overdue Invoices', note: delayed > 0 ? 'Payment delayed' : 'All clear', up: delayed === 0, accent: 'text-slate-700' },
                  { val: delivered.toLocaleString(), label: 'Delivered Orders', note: `${onTimeRate !== '—' ? onTimeRate + '% rate' : 'calculating'}`, up: true, accent: 'text-slate-700' },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                    <p className={`text-xl font-bold ${m.accent}`}>{m.val}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
                    <p className={`text-xs mt-1 flex items-center gap-1 ${m.up ? 'text-green-600' : 'text-red-500'}`}>
                      {m.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {m.note}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Issue Breakdown</p>
              <div className="space-y-2.5">
                {delayReasons.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                    <span className="text-slate-600 w-28 flex-shrink-0">{r.label}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <span className="text-slate-500 w-8 text-right">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RETAIL SALES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'retail' && (
        <>
          {retailAnalyticsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
          <>
          {/* ── Retail KPI Cards ── */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Retail Revenue',    value: fmtINR(retailKPIs.monthRevenue), up: true },
              { label: 'Retail Orders',     value: (retailKPIs.monthOrders || 0).toLocaleString(), up: true },
              { label: 'Avg. Order Value',  value: fmtINR(retailKPIs.avgOrderValue), up: true },
              { label: 'Delivery Rate',     value: retailKPIs.deliveryRate != null ? `${retailKPIs.deliveryRate} %` : '—', up: true },
            ].map((k) => (
              <div key={k.label} className="card p-4">
                <p className="text-sm text-slate-500 mb-1">{k.label}</p>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
              </div>
            ))}
          </div>

          {/* ── Retail Charts row ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Retail Revenue Trend */}
            <div className="card p-4 col-span-2">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-800">Retail Revenue Trend</p>
                  <p className="text-xs text-slate-400">Monthly overview – current year</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-blue-500 inline-block rounded-full" /> Dealer
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-green-500 inline-block rounded-full" /> Retail
                  </span>
                  <select
                    value={chartPeriod}
                    onChange={(e) => dispatch(setChartPeriod(e.target.value))}
                    className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-600"
                  >
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                    <option value="week">Week</option>
                  </select>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={retailChartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Line type="monotone" dataKey="dealer" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="retail" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sales Channel */}
            <div className="card p-4 flex flex-col">
              <p className="font-semibold text-slate-800">Sales Channel</p>
              <p className="text-xs text-slate-400 mb-4">Sourced by Channel</p>
              {retailChannels.length === 0 ? (
                <p className="text-sm text-slate-400 flex-1 flex items-center justify-center">No data</p>
              ) : (
                <div className="flex flex-col gap-4 flex-1 justify-center">
                  {retailChannels.map((ch) => {
                    const pct = retailChannelTotal > 0 ? Math.round((ch.amount / retailChannelTotal) * 100) : 0;
                    return (
                      <div key={ch.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ch.color }} />
                            <span className="text-sm text-slate-700">{ch.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-slate-800">{fmtINR(ch.amount)}</span>
                            <span className="text-xs text-slate-400 ml-1">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ch.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Retail Bottom row ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Top Retail Stores */}
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">Top Retail Stores / Outlets</p>
                  <p className="text-xs text-slate-400">By revenue performance</p>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="pb-2 text-left">#</th>
                    <th className="pb-2 text-left">Store</th>
                    <th className="pb-2 text-right">Orders</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(retailAnalytics?.topDealers || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">No data</td>
                    </tr>
                  ) : (retailAnalytics?.topDealers || []).map((s) => (
                    <tr key={s.rank} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-400 font-mono">{s.rank}</td>
                      <td className="py-2 font-medium text-slate-700">{s.name}</td>
                      <td className="py-2 text-right text-slate-600">{s.orders}</td>
                      <td className="py-2 text-right font-medium text-slate-700">{fmtINR(s.revenue)}</td>
                      <td className="py-2 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STORE_STATUS_CLS[s.status] || ''}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Customer Insights */}
            <div className="card p-4">
              <p className="font-semibold text-slate-800">Customer Insights</p>
              <p className="text-xs text-slate-400 mb-4">Retail buyer behaviour</p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  {
                    val:    (retailAnalytics?.customerInsights?.totalCustomers || 0).toLocaleString(),
                    label:  'Total Customers',
                    accent: 'text-slate-800',
                  },
                  {
                    val:    retailAnalytics?.customerInsights?.repeatBuyerPct != null
                              ? `${retailAnalytics.customerInsights.repeatBuyerPct} %`
                              : '—',
                    label:  'Repeat Buyers',
                    accent: 'text-blue-600',
                  },
                  {
                    val:    (retailKPIs.monthOrders || 0).toLocaleString(),
                    label:  'Month Orders',
                    accent: 'text-slate-800',
                  },
                  {
                    val:    retailKPIs.deliveryRate != null ? `${retailKPIs.deliveryRate} %` : '—',
                    label:  'Delivery Rate',
                    accent: 'text-slate-800',
                  },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                    <p className={`text-xl font-bold ${m.accent}`}>{m.val}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* New vs Repeat Buyers */}
              {retailAnalytics?.customerInsights && (
                <>
                  <p className="text-sm font-semibold text-slate-700 mb-1.5">New vs Repeat Buyers</p>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500 rounded-l-full"
                        style={{ width: `${retailAnalytics.customerInsights.newBuyerPct}%` }} />
                      <div className="h-full bg-green-500 rounded-r-full"
                        style={{ width: `${retailAnalytics.customerInsights.repeatBuyerPct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      Repeat: {retailAnalytics.customerInsights.repeatBuyerPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      New: {retailAnalytics.customerInsights.newBuyerPct}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Repeat: {retailAnalytics.customerInsights.repeatBuyerPct}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          </>
          )}
        </>
      )}

 {/* Footer note */}
      <p className="text-center text-xs text-slate-400 pt-2">
        Role-based access &bull; Supplier&apos;s View
      </p>
    </div>
  );
};

export default AuditPage;
