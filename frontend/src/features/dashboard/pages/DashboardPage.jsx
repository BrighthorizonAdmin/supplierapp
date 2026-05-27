import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShoppingCart, DollarSign, Package, RotateCcw,
  AlertTriangle, TrendingUp, AlertCircle, ArrowRight,
  ChevronRight, FileText, UserCheck, ShieldAlert,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  fetchKPIs, fetchSalesChart, fetchTopDealers, fetchRecentOrders, setChartPeriod,
} from '../dashboardSlice';
import KPICard from '../../../components/ui/KPICard';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { usePermission } from '../../../routes/ProtectedRoute';

const CHART_PERIODS = [
  { value: 'week',  label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'year',  label: 'This year' },
];

const ORDER_STATUS_CLASS = {
  pending:    'badge-solid-amber',
  confirmed:  'badge-solid-blue',
  processing: 'badge-solid-purple',
  shipped:    'badge-solid-blue',
  delivered:  'badge-solid-green',
  cancelled:  'badge-solid-red',
  draft:      'badge-solid-gray',
};

// Format a rupee amount: ₹1.2M / ₹45K / ₹500
const fmtMoney = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

// Render trend chip — green for positive, red for negative
const Trend = ({ value, label }) => {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value)}% {label}
    </span>
  );
};

const DashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { kpis, salesChart, topDealers, recentOrders, loading, chartPeriod } = useSelector(
    (s) => s.dashboard
  );
  const { hasPermission } = usePermission();

  useEffect(() => {
    dispatch(fetchKPIs());
    dispatch(fetchSalesChart(chartPeriod));
    dispatch(fetchTopDealers());
    if (hasPermission('orders:read')) {
      dispatch(fetchRecentOrders());
    }
  }, [dispatch, chartPeriod]);

  return (
    <div className="space-y-6 pb-6">

      {/* ── Row 1: Revenue + Inventory + Orders + Dealers ──────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Year Revenue"
          value={fmtMoney(kpis?.yearRevenue)}
          icon={DollarSign}
          color="green"
          subtitle={<Trend value={kpis?.yearRevTrend} label="vs last year" />}
        />
        <KPICard
          title="Inventory Value"
          value={fmtMoney(kpis?.inventoryValue)}
          icon={Package}
          color="red"
        />
        <KPICard
          title="Total Orders"
          value={(kpis?.totalOrders ?? 0).toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          subtitle={<Trend value={kpis?.ordersTrend} label="vs last month" />}
        />
        <KPICard
          title="Active Dealers"
          value={(kpis?.activeDealers ?? 0).toLocaleString()}
          icon={Users}
          color="orange"
          subtitle={
            (kpis?.serviceRequests ?? 0) > 0
              ? `${kpis.serviceRequests} service request${kpis.serviceRequests > 1 ? 's' : ''} pending`
              : 'No open service requests'
          }
        />
      </div>

      {/* ── Row 2: KYC + Total Dealers + Returns + Outstanding ─────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pending KYCs"
          value={(kpis?.pendingApprovals ?? 0).toLocaleString()}
          icon={AlertTriangle}
          color="yellow"
          subtitle={
            (kpis?.pendingApprovals ?? 0) > 0
              ? `${kpis.pendingApprovals} dealer${kpis.pendingApprovals > 1 ? 's' : ''} need review`
              : 'All dealers reviewed'
          }
        />
        <KPICard
          title="Total Dealers"
          value={(kpis?.totalDealers ?? 0).toLocaleString()}
          icon={UserCheck}
          color="blue"
          subtitle={<Trend value={kpis?.dealersTrend} label="vs last month" />}
        />
        <KPICard
          title="Pending Returns"
          value={(kpis?.pendingReturns ?? 0).toLocaleString()}
          icon={RotateCcw}
          color="red"
        />
        <KPICard
          title="Overdue Invoices"
          value={(kpis?.overdueInvoices ?? 0).toLocaleString()}
          icon={TrendingUp}
          color="purple"
          subtitle={
            (kpis?.overdueAmount ?? 0) > 0
              ? `${fmtMoney(kpis.overdueAmount)} outstanding`
              : undefined
          }
        />
      </div>

      {/* ── Main content: Chart + Table | Alerts + Actions ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Revenue chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Revenue Forecast</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  This month: <span className="font-semibold text-slate-600">{fmtMoney(kpis?.monthRevenue)}</span>
                  {kpis?.revenueTrend !== null && kpis?.revenueTrend !== undefined && (
                    <span className={`ml-2 font-semibold ${kpis.revenueTrend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {kpis.revenueTrend >= 0 ? '↑' : '↓'}{Math.abs(kpis.revenueTrend)}% vs last month
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {CHART_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => dispatch(setChartPeriod(p.value))}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      chartPeriod === p.value
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Orders table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Recent Orders</h2>
              <button
                onClick={() => navigate('/orders')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Order ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Dealer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                        No recent orders
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr
                        key={order._id}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                        onClick={() => navigate(`/orders/${order._id}`)}
                      >
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-600">
                          #{order._id?.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 font-medium">
                          {order.dealerId?.businessName || order.dealerId?.name || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">
                          {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                          ₹{(order.netAmount || order.total || order.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={ORDER_STATUS_CLASS[order.status?.toLowerCase()] || 'badge-solid-gray'}>
                            {order.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">

          {/* Alerts */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <AlertCircle size={17} className="text-red-500 flex-shrink-0" />
              <h2 className="text-base font-bold text-slate-800">Alerts</h2>
            </div>
            <div className="divide-y divide-slate-50">

              {/* Low stock */}
              {(kpis?.lowStockAlerts ?? 0) > 0 ? (
                <div className="flex items-center gap-3 px-5 py-3.5 bg-red-50/60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700 truncate">Low Stock Warning</p>
                    <p className="text-xs text-red-400 mt-0.5">{kpis.lowStockAlerts} item{kpis.lowStockAlerts > 1 ? 's' : ''} critically low</p>
                  </div>
                  <button
                    onClick={() => navigate('/inventory')}
                    className="text-xs font-bold text-red-600 hover:text-red-700 whitespace-nowrap underline underline-offset-2"
                  >
                    Restock
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <p className="text-sm text-slate-400">No low stock alerts</p>
                </div>
              )}

              {/* Delayed shipments */}
              {(kpis?.delayedOrders ?? 0) > 0 ? (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 bg-amber-50/60 cursor-pointer hover:bg-amber-50"
                  onClick={() => navigate('/orders?status=processing')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-700 truncate">Delayed Shipments</p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      {kpis.delayedOrders} order{kpis.delayedOrders > 1 ? 's' : ''} stuck &gt; 3 days
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-amber-500 flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <p className="text-sm text-slate-400">No delayed shipments</p>
                </div>
              )}

              {/* Overdue invoices */}
              {(kpis?.overdueInvoices ?? 0) > 0 && (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 bg-orange-50/60 cursor-pointer hover:bg-orange-50"
                  onClick={() => navigate('/invoices')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-orange-700 truncate">Overdue Invoices</p>
                    <p className="text-xs text-orange-400 mt-0.5">
                      {kpis.overdueInvoices} invoice{kpis.overdueInvoices > 1 ? 's' : ''} past due
                      {kpis.overdueAmount > 0 ? ` · ${fmtMoney(kpis.overdueAmount)}` : ''}
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-orange-500 flex-shrink-0" />
                </div>
              )}

              {/* Warranty claims */}
              {(kpis?.warrantyPending ?? 0) > 0 && (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 bg-blue-50/60 cursor-pointer hover:bg-blue-50"
                  onClick={() => navigate('/warranty')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-700 truncate">Warranty Claims</p>
                    <p className="text-xs text-blue-400 mt-0.5">
                      {kpis.warrantyPending} claim{kpis.warrantyPending > 1 ? 's' : ''} awaiting review
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-blue-500 flex-shrink-0" />
                </div>
              )}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Actions</p>
            </div>
            <div className="p-4 space-y-3">

              {/* Review KYC */}
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <FileText size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">Review KYC Docs</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(kpis?.pendingApprovals ?? 0) > 0
                      ? `${kpis.pendingApprovals} dealer${kpis.pendingApprovals > 1 ? 's' : ''} awaiting approval`
                      : 'No pending approvals'}
                  </p>
                </div>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
              </button>

              {/* Service Requests */}
              {(kpis?.serviceRequests ?? 0) > 0 && (
                <button
                  onClick={() => navigate('/support')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                    <AlertTriangle size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Open Service Requests</p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpis.serviceRequests} request{kpis.serviceRequests > 1 ? 's' : ''} need attention</p>
                  </div>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-amber-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {/* Pending Returns */}
              {(kpis?.pendingReturns ?? 0) > 0 && (
                <button
                  onClick={() => navigate('/returns')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50/40 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                    <RotateCcw size={16} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Process Returns</p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpis.pendingReturns} return{kpis.pendingReturns > 1 ? 's' : ''} need review</p>
                  </div>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-red-500 flex-shrink-0 transition-colors" />
                </button>
              )}

              {/* Warranty Claims */}
              {(kpis?.warrantyPending ?? 0) > 0 && (
                <button
                  onClick={() => navigate('/warranty')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                    <ShieldAlert size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Warranty Claims</p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpis.warrantyPending} claim{kpis.warrantyPending > 1 ? 's' : ''} pending review</p>
                  </div>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
                </button>
              )}
            </div>
          </div>

          {/* Top Dealers */}
          {topDealers.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Top Dealers</h2>
              </div>
              <div className="p-4 space-y-3">
                {topDealers.slice(0, 4).map((dealer, i) => (
                  <div key={dealer._id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{dealer.businessName}</p>
                      <p className="text-xs text-slate-400">₹{(dealer.totalRevenue || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <span className="badge-blue text-xs">{dealer.pricingTier}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
