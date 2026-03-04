import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Calendar, Download, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';

// ── Static mock data ──────────────────────────────────────────────────────────
const REVENUE_DATA = [
  { month: 'Sep', dealer: 140000, retail: 85000 },
  { month: 'Oct', dealer: 210000, retail: 95000 },
  { month: 'Nov', dealer: 195000, retail: 110000 },
  { month: 'Dec', dealer: 250000, retail: 130000 },
  { month: 'Jan', dealer: 280000, retail: 145000 },
  { month: 'Feb', dealer: 320000, retail: 160000 },
];

const SALES_MIX = [
  { name: 'Dealer', value: 62, color: '#3b82f6' },
  { name: 'Retail', value: 19, color: '#22c55e' },
  { name: 'Other',  value: 19, color: '#eab308' },
];

const TOP_PRODUCTS = [
  { rank: '01', name: 'Industrial Valve Kit', cat: 'Mechanical Parts', units: 312,  revenue: 68450, share: 48, status: 'In-Stock' },
  { rank: '02', name: 'Bearing Set 6205',     cat: 'Bearings',         units: 761,  revenue: 88800, share: 76, status: 'In-Stock' },
  { rank: '03', name: 'Hydraulic Seal Pack',  cat: 'Seals & Gaskets',  units: 361,  revenue: 62450, share: 17, status: 'Low-Stock' },
  { rank: '04', name: 'Industrial Valve Kit', cat: 'Actuators',        units: 998,  revenue: 6210,  share: 88, status: 'In-Stock' },
  { rank: '05', name: 'Industrial Valve Kit', cat: 'Fittings',         units: 112,  revenue: 21450, share: 38, status: 'Low-Stock' },
  { rank: '06', name: 'Industrial Valve Kit', cat: 'Fittings',         units: 100,  revenue: 68780, share: 48, status: 'Out off-Stock' },
  { rank: '07', name: 'Industrial Valve Kit', cat: 'Fittings',         units: 100,  revenue: 68780, share: 48, status: 'Low-Stock' },
];

const DELAY_REASONS = [
  { label: 'Logistics',    pct: 62, color: '#3b82f6' },
  { label: 'Out-of-Stock', pct: 29, color: '#93c5fd' },
  { label: 'Processing',   pct: 19, color: '#f87171' },
];

const STATUS_CLS = {
  'In-Stock':      'bg-green-100 text-green-700',
  'Low-Stock':     'bg-amber-100 text-amber-700',
  'Out off-Stock': 'bg-red-100   text-red-700',
};

const fmtY = (v) => `$${(v / 1000).toFixed(0)}k`;

// ── Component ─────────────────────────────────────────────────────────────────
const AuditPage = () => {
  const [salesTab, setSalesTab] = useState('dealer');

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track revenue, orders, and fulfilment performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-white">
            {[['dealer', 'Dealer Sales'], ['retail', 'Retail Sales']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSalesTab(val)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  salesTab === val
                    ? 'border border-blue-600 text-blue-600 bg-white'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',     value: '₹2,82,890.00', change: '+12.4% vs last Month', up: true },
          { label: 'Total orders',      value: '1500',          change: '+8.1% vs last Month',  up: true },
          { label: 'Avg. Order Value',  value: '₹239.00',       change: '-8.1% vs last Month',  up: false },
          { label: 'Fulfillment Rate',  value: '96.2 %',        change: null },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-sm text-slate-500 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900">{k.value}</p>
            {k.change && (
              <p className={`text-xs mt-1.5 flex items-center gap-1 ${k.up ? 'text-green-600' : 'text-red-500'}`}>
                {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {k.change}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Revenue Trend */}
        <div className="card p-4 col-span-2">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-slate-800">Revenue Trend</p>
              <p className="text-xs text-slate-400">Monthly over view – last 6 months</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-blue-500 inline-block rounded-full" /> Dealer
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-green-500 inline-block rounded-full" /> Retail
                </span>
              </div>
              <select className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-600">
                <option>Month</option><option>Quarter</option>
              </select>
              <select className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none bg-blue-600 text-white">
                <option>2025</option><option>2024</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={REVENUE_DATA} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
              <Line type="monotone" dataKey="dealer" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="retail" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Mix donut */}
        <div className="card p-4 flex flex-col">
          <p className="font-semibold text-slate-800 mb-1">Sales Mix</p>
          <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={SALES_MIX} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                  dataKey="value" startAngle={90} endAngle={-270}>
                  {SALES_MIX.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-lg font-bold text-slate-800 leading-none">62%</p>
              <p className="text-xs text-slate-500 mt-0.5">Dealer</p>
            </div>
          </div>
          <div className="space-y-2 mt-1">
            {SALES_MIX.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  {item.name}
                </span>
                <span className="font-medium text-slate-700">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Top Products */}
        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-800">Top Product</p>
              <p className="text-xs text-slate-400">By Revenue this period</p>
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
                <th className="pb-2 text-right">Units Sold</th>
                <th className="pb-2 text-right">Revenue</th>
                <th className="pb-2 text-center">Share</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((p) => (
                <tr key={p.rank} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 text-slate-400 font-mono">{p.rank}</td>
                  <td className="py-2">
                    <p className="font-medium text-slate-700">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.cat}</p>
                  </td>
                  <td className="py-2 text-right text-slate-600">{p.units}</td>
                  <td className="py-2 text-right font-medium text-slate-700">${p.revenue.toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.share}%` }} />
                      </div>
                      <span className="text-slate-500 w-7 text-right">{p.share}%</span>
                    </div>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Delivery Performance */}
        <div className="card p-4">
          <p className="font-semibold text-slate-800">Delivery Performance</p>
          <p className="text-xs text-slate-400 mb-3">Last 30 Days</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { val: '96.2 %',   label: 'On-Time Rate',     note: '+18% MoM', up: true,  accent: 'text-blue-600' },
              { val: '14.2 days',label: 'Avg. Lead time',   note: 'Faster',   up: true,  accent: 'text-blue-600' },
              { val: '57',       label: 'Delayed Orders',   note: '+3 vs Last', up: false, accent: 'text-slate-700' },
              { val: '1,454',    label: 'Delivered',        note: '96.4 Rate', up: true,  accent: 'text-slate-700' },
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

          <p className="text-sm font-semibold text-slate-700 mb-2">Delay Reasons</p>
          <div className="space-y-2.5">
            {DELAY_REASONS.map((r) => (
              <div key={r.label} className="flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="text-slate-600 w-24 flex-shrink-0">{r.label}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
                <span className="text-slate-500 w-8 text-right">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AuditPage;
