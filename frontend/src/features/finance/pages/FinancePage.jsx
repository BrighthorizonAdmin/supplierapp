import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFinanceStats, fetchRevenueSummary, fetchPaymentReport } from '../financeSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import KPICard from '../../../components/ui/KPICard';
import { DollarSign, TrendingDown, FileText, Clock } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const FinancePage = () => {
  const dispatch = useDispatch();
  const { stats, revenue, paymentReport, loading } = useSelector((s) => s.finance);

  useEffect(() => {
    dispatch(fetchFinanceStats());
    dispatch(fetchRevenueSummary({ groupBy: 'month' }));
    dispatch(fetchPaymentReport());
  }, [dispatch]);

  const fmt = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Finance Overview</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={fmt(stats?.totalRevenue)} icon={DollarSign} color="green" />
        <KPICard title="Total Refunds" value={fmt(stats?.totalRefunds)} icon={TrendingDown} color="red" />
        <KPICard title="Net Revenue" value={fmt(stats?.netRevenue)} icon={DollarSign} color="blue" />
        <KPICard title="Overdue Invoices" value={stats?.overdueInvoices} icon={FileText} color="yellow" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Monthly Revenue vs Refunds</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`]} />
              <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="refunds" name="Refunds" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Distribution */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Payment Methods</h2>
          {paymentReport.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={paymentReport} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={90} label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}>
                  {paymentReport.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400">No payment data available</div>
          )}
        </div>
      </div>

      {/* Revenue Table */}
      <div className="card">
        <div className="p-4 border-b border-slate-200"><h2 className="font-semibold text-slate-900">Revenue Breakdown</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Period', 'Revenue', 'Refunds', 'Net Revenue', 'Orders'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-600">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {revenue.map((row) => (
                <tr key={row.period} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.period}</td>
                  <td className="px-4 py-3 text-green-600">{fmt(row.revenue)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(row.refunds)}</td>
                  <td className="px-4 py-3 font-bold">{fmt(row.netRevenue)}</td>
                  <td className="px-4 py-3">{row.orderCount}</td>
                </tr>
              ))}
              {revenue.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No revenue data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
