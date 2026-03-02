import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Users, ShoppingCart, AlertTriangle, DollarSign, Clock, FileText, RotateCcw, Package } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { fetchKPIs, fetchRecentActivity, fetchSalesChart, fetchTopDealers, setChartPeriod } from '../dashboardSlice';
import KPICard from '../../../components/ui/KPICard';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';

const PERIODS = ['week', 'month', 'year'];

const DashboardPage = () => {
  const dispatch = useDispatch();
  const { kpis, activity, salesChart, topDealers, loading, chartPeriod } = useSelector((s) => s.dashboard);

  useEffect(() => {
    dispatch(fetchKPIs());
    dispatch(fetchRecentActivity());
    dispatch(fetchSalesChart(chartPeriod));
    dispatch(fetchTopDealers());
  }, [dispatch, chartPeriod]);

  const formatCurrency = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {kpis?.updatedAt ? `Last updated: ${format(new Date(kpis.updatedAt), 'dd MMM yyyy, hh:mm a')}` : 'Loading...'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Dealers" value={kpis?.totalDealers} icon={Users} color="blue" subtitle={`${kpis?.activeDealers} active`} />
        <KPICard title="Pending Approvals" value={kpis?.pendingApprovals} icon={Clock} color="yellow" />
        <KPICard title="Active Orders" value={kpis?.activeOrders} icon={ShoppingCart} color="purple" />
        <KPICard title="Month Revenue" value={formatCurrency(kpis?.monthRevenue)} icon={DollarSign} color="green" />
        <KPICard title="Overdue Invoices" value={kpis?.overdueInvoices} icon={FileText} color="red" />
        <KPICard title="Low Stock Alerts" value={kpis?.lowStockAlerts} icon={AlertTriangle} color="yellow" />
        <KPICard title="Pending Returns" value={kpis?.pendingReturns} icon={RotateCcw} color="red" />
        <KPICard title="Active Dealers" value={kpis?.activeDealers} icon={Package} color="green" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Revenue Trend</h2>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => dispatch(setChartPeriod(p))}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    chartPeriod === p ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Dealers */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Top Dealers</h2>
          <div className="space-y-3">
            {topDealers.map((dealer, i) => (
              <div key={dealer._id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{dealer.businessName}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(dealer.totalRevenue)}</p>
                </div>
                <span className="badge-blue text-xs">{dealer.pricingTier}</span>
              </div>
            ))}
            {topDealers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data available</p>}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {activity.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">No recent activity</p>
          ) : (
            activity.map((log) => (
              <div key={log._id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{log.performedBy?.name}</span>{' '}
                    {log.action} {log.entity}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(new Date(log.createdAt), 'dd MMM, hh:mm a')}
                  </p>
                </div>
                <span className="badge-gray text-xs capitalize">{log.entity}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
