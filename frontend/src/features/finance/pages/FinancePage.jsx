import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFinanceStats, fetchRevenueSummary, fetchPaymentReport } from '../financeSlice';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Download, Calendar, CheckCircle, Clock, AlertCircle,
  MoreVertical, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;
const fmtL = (v) => `₹${((v || 0) / 100000).toFixed(2)}L`;

// ─── Chart tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const FinancePage = () => {
  const dispatch = useDispatch();
  const { stats, revenue, paymentReport } = useSelector((s) => s.finance);

  const [chartView,    setChartView]    = useState('month');
  const [transactions, setTransactions] = useState([]);
  const [txnLoading,   setTxnLoading]   = useState(false);
  const [txnPage,      setTxnPage]      = useState(1);
  const [txnTotal,     setTxnTotal]     = useState(0);
  const TXN_LIMIT = 10;

  useEffect(() => {
    dispatch(fetchFinanceStats());
    dispatch(fetchRevenueSummary({ groupBy: 'month' }));
    dispatch(fetchPaymentReport());
  }, [dispatch]);

  // Fetch recent payments as transactions (payments endpoint is the source of truth)
  useEffect(() => {
    setTxnLoading(true);
    api.get('/payments', { params: { limit: TXN_LIMIT, page: txnPage } })
      .then((res) => {
        setTransactions(res.data.data || []);
        setTxnTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setTransactions([]))
      .finally(() => setTxnLoading(false));
  }, [txnPage]);

  // Derive payment status rows from available data
  const paidTotal   = paymentReport.reduce((a, r) => a + (r.total || 0), 0);
  const paidCount   = paymentReport.reduce((a, r) => a + (r.count || 0), 0);
  const outstanding = Math.max((stats?.totalRevenue || 0) - paidTotal, 0);

  const paymentRows = [
    {
      label: 'Paid',
      count: paidCount,
      amount: paidTotal,
      icon: CheckCircle,
      rowCls:    'border-l-4 border-green-500 bg-green-50',
      iconCls:   'text-green-500',
      amountCls: 'text-green-700',
    },
    {
      label: 'Pending',
      count: stats?.pendingPayments || 0,
      amount: outstanding,
      icon: Clock,
      rowCls:    'border-l-4 border-amber-400 bg-amber-50',
      iconCls:   'text-amber-500',
      amountCls: 'text-amber-600',
    },
    {
      label: 'Overdue',
      count: stats?.overdueInvoices || 0,
      amount: stats?.totalRefunds || 0,
      icon: AlertCircle,
      rowCls:    'border-l-4 border-red-400 bg-red-50',
      iconCls:   'text-red-500',
      amountCls: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Finance Overview</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm py-2 px-3">
            <Calendar size={14} /> Last 30 Days
          </button>
          <button className="btn-secondary flex items-center gap-2 text-sm py-2 px-3">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1 – Total Revenue (highlighted card) */}
        <div className="bg-primary-600 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-200 mb-2">
            Total Revenue
          </p>
          <p className="text-2xl font-bold leading-tight mb-3">
            {fmt(stats?.totalRevenue)}
          </p>
          <div className="flex items-center gap-1 text-xs text-primary-200">
            <TrendingUp size={12} />
            <span>+14.2% vs last month</span>
          </div>
        </div>

        {/* 2 – Outstanding */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Outstanding
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mb-3">
            {fmt(outstanding)}
          </p>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <TrendingUp size={12} />
            <span>+8.3% Pending</span>
          </div>
        </div>

        {/* 3 – Paid This Month */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Paid This Month
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mb-3">
            {fmt(stats?.netRevenue)}
          </p>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <TrendingUp size={12} />
            <span>+11.8% vs last month</span>
          </div>
        </div>

        {/* 4 – Credit Available */}
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Credit Available
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mb-3">
            {fmt((stats?.totalRevenue || 0) - (stats?.netRevenue || 0))}
          </p>
          <p className="text-xs text-slate-400">Limit unchanged</p>
        </div>
      </div>

      {/* ── Cash Flow + Payment Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Cash Flow chart */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Cash Flow</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              {['Month', 'Year'].map((v) => (
                <button
                  key={v}
                  onClick={() => setChartView(v.toLowerCase())}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartView === v.toLowerCase()
                      ? 'bg-white shadow-sm text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue} barSize={26} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="refunds"  name="Refunds"  fill="#93c5fd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Payment Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
          </div>
          <div className="space-y-3">
            {paymentRows.map(({ label, count, amount, icon: Icon, rowCls, iconCls, amountCls }) => (
              <div
                key={label}
                className={`flex items-center justify-between p-3 rounded-lg ${rowCls}`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className={iconCls} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{count} payments</p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${amountCls}`}>{fmtL(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
          <button className="text-sm font-medium text-primary-600 hover:underline">
            View All
          </button>
        </div>

        {txnLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Transaction ID','Date','Description','Type','Amount','Status','Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                      No transactions found
                    </td>
                  </tr>
                ) : transactions.map((txn) => {
                  const statusKey = (txn.status || '').toLowerCase();
                  return (
                    <tr key={txn._id} className="hover:bg-slate-50 transition-colors">

                      {/* Transaction ID */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {txn.paymentNumber || `#${txn._id?.slice(-8)}`}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {txn.createdAt ? format(new Date(txn.createdAt), 'dd MMM yyyy') : '—'}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{txn.dealerId?.businessName || '—'}</p>
                        {txn.invoiceId?.invoiceNumber && (
                          <p className="text-xs text-slate-400 mt-0.5">Invoice: {txn.invoiceId.invoiceNumber}</p>
                        )}
                      </td>

                      {/* Type (method) */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-blue-100 text-blue-700">
                          {txn.method || 'payment'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
                        {fmt(txn.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold ${
                          statusKey === 'confirmed' ? 'text-green-600' :
                          statusKey === 'pending'   ? 'text-amber-600' :
                          statusKey === 'rejected'  ? 'text-red-500'   :
                          'text-slate-500'
                        }`}>
                          {txn.status
                            ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
                            : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                          <MoreVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            {transactions.length === 0 ? '0' : `${(txnPage - 1) * TXN_LIMIT + 1}–${Math.min(txnPage * TXN_LIMIT, txnTotal)}`} of {txnTotal} items
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
              disabled={txnPage === 1}
              className="px-2 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
            >
              ‹
            </button>
            <span>Page {txnPage} of {Math.max(1, Math.ceil(txnTotal / TXN_LIMIT))}</span>
            <button
              onClick={() => setTxnPage((p) => p + 1)}
              disabled={txnPage * TXN_LIMIT >= txnTotal}
              className="px-2 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
