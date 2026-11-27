import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, IndianRupee, ShoppingCart, Store, UserPlus, ReceiptText, RotateCcw, Boxes,
  TrendingUp, Plus, PackageX, PackageMinus, Truck, LifeBuoy, ShieldCheck, CheckCircle2,
  FilePen, Trash2, BadgeCheck, XCircle, Ban, Undo2, Activity, CircleDot,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  fetchKPIs, fetchSalesChart, fetchTopDealers, fetchRecentOrders, fetchRecentActivity, setChartPeriod,
} from '../dashboardSlice';
import KPICard from '../../../components/ui/KPICard';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import StatusBadge from '../../../components/ui/StatusBadge';
import { usePermission } from '../../../routes/ProtectedRoute';
import { LOW_STOCK_THRESHOLD } from '../../../utils/stockLevels';

const CHART_PERIODS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

// ₹1.42 Cr / ₹39.4 L / ₹45K / ₹500 — Indian number units, as used across the business.
const fmtMoney = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};
const count = (v) => (Number(v) || 0).toLocaleString('en-IN');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Bar colours for the top-dealer ranking, in order.
const RANK_COLORS = ['bg-amber-600', 'bg-emerald-600', 'bg-primary-600', 'bg-violet-600', 'bg-teal-600', 'bg-rose-500'];
const RANK_CHIPS = [
  'bg-amber-50 text-amber-700 ring-amber-200/70',
  'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  'bg-primary-50 text-primary-700 ring-primary-200/70',
  'bg-violet-50 text-violet-700 ring-violet-200/70',
  'bg-teal-50 text-teal-700 ring-teal-200/70',
  'bg-rose-50 text-rose-700 ring-rose-200/70',
];

const ATTENTION_TONES = {
  red: 'bg-red-50 text-red-600 ring-red-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  blue: 'bg-primary-50 text-primary-600 ring-primary-100',
  teal: 'bg-teal-50 text-teal-600 ring-teal-100',
};

// Activity feed wording for audit log entries.
const ACTION_VERBS = {
  create: 'created', update: 'updated', delete: 'deleted', approve: 'approved', reject: 'rejected',
  suspend: 'suspended', confirm: 'confirmed', cancel: 'cancelled', allocate: 'allocated stock for',
  refund: 'refunded', logCall: 'logged a call on', requestDocuments: 'requested documents for',
  advancePipeline: 'moved forward', request_update: 'requested an update on',
  password_change: 'changed the password of', password_reset: 'reset the password of',
  'serial-soft-delete': 'removed a serial from', 'serial-restore': 'restored a serial on',
};
const ENTITY_LABELS = {
  dealer: 'dealer', order: 'order', payment: 'payment', return: 'return', product: 'product',
  inventory: 'inventory item', user: 'user', invoice: 'invoice', warehouse: 'warehouse',
  retailOrder: 'retail order', marketingLead: 'marketing lead', flashSale: 'flash sale',
};
const ACTION_ICONS = {
  create: { icon: Plus, tone: 'bg-primary-50 text-primary-600' },
  update: { icon: FilePen, tone: 'bg-amber-50 text-amber-600' },
  delete: { icon: Trash2, tone: 'bg-red-50 text-red-600' },
  approve: { icon: BadgeCheck, tone: 'bg-emerald-50 text-emerald-600' },
  confirm: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  reject: { icon: XCircle, tone: 'bg-red-50 text-red-600' },
  cancel: { icon: Ban, tone: 'bg-red-50 text-red-600' },
  suspend: { icon: Ban, tone: 'bg-red-50 text-red-600' },
  refund: { icon: Undo2, tone: 'bg-violet-50 text-violet-600' },
};

const DashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { kpis, salesChart, topDealers, recentOrders, activity, chartPeriod } = useSelector((s) => s.dashboard);
  const { hasPermission } = usePermission();
  const canReadOrders = hasPermission('orders:read');

  useEffect(() => {
    dispatch(fetchKPIs());
    dispatch(fetchTopDealers());
    dispatch(fetchRecentActivity(25));
    if (canReadOrders) dispatch(fetchRecentOrders());
  }, [dispatch, canReadOrders]);

  useEffect(() => {
    dispatch(fetchSalesChart(chartPeriod));
  }, [dispatch, chartPeriod]);

  const k = kpis || {};

  // Everything that needs a person to act, most urgent first.
  const attention = [
    k.outOfStockAlerts > 0 && {
      icon: PackageX, tone: 'red', to: '/inventory?status=out-of-stock', cta: 'Restock',
      title: `${plural(k.outOfStockAlerts, 'product')} out of stock`,
      detail: '0 pieces left — dealers cannot order these',
    },
    k.overdueInvoices > 0 && {
      icon: ReceiptText, tone: 'red', to: '/invoices', cta: 'Open',
      title: `${plural(k.overdueInvoices, 'invoice')} past due`,
      detail: k.overdueAmount > 0 ? `${fmtMoney(k.overdueAmount)} outstanding` : 'Follow up on payment',
    },
    k.delayedOrders > 0 && {
      icon: Truck, tone: 'amber', to: '/orders?status=processing', cta: 'Track',
      title: `${plural(k.delayedOrders, 'order')} stuck in processing`,
      detail: 'No movement for more than 3 days',
    },
    k.lowStockAlerts > 0 && {
      icon: PackageMinus, tone: 'amber', to: '/inventory?status=low-stock', cta: 'Review',
      title: `${plural(k.lowStockAlerts, 'product')} running low`,
      detail: `${LOW_STOCK_THRESHOLD} pieces or fewer left — reorder soon`,
    },
    k.pendingApprovals > 0 && {
      icon: UserPlus, tone: 'blue', to: '/onboarding', cta: 'Review',
      title: `${plural(k.pendingApprovals, 'dealer')} waiting for KYC approval`,
      detail: 'Documents submitted and ready to review',
    },
    k.serviceRequests > 0 && {
      icon: LifeBuoy, tone: 'blue', to: '/support', cta: 'Open',
      title: `${plural(k.serviceRequests, 'service request')} open`,
      detail: 'Dealers are waiting for a response',
    },
    k.pendingReturns > 0 && {
      icon: RotateCcw, tone: 'teal', to: '/returns', cta: 'Review',
      title: `${plural(k.pendingReturns, 'return')} to process`,
      detail: 'Inspect, approve or reject',
    },
    k.warrantyPending > 0 && {
      icon: ShieldCheck, tone: 'teal', to: '/warranty', cta: 'Review',
      title: `${plural(k.warrantyPending, 'warranty claim')} awaiting review`,
      detail: 'Check serials and approve replacements',
    },
  ].filter(Boolean);

  const feed = (activity || [])
    .filter((entry) => !['login', 'logout'].includes(entry.action))
    .slice(0, 7);

  const maxDealerRevenue = Math.max(...topDealers.map((d) => d.totalRevenue || 0), 1);

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Business overview"
        subtitle={`${format(new Date(), 'EEEE, d MMMM yyyy')} · all channels`}
      >
        <div className="segmented">
          {CHART_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => dispatch(setChartPeriod(p.value))}
              className={`segmented-item ${chartPeriod === p.value ? 'segmented-item-active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasPermission('invoices:write') && (
          <button onClick={() => navigate('/invoices/new')} className="btn-primary">
            <Plus size={16} /> New invoice
          </button>
        )}
      </PageHeader>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Revenue this month"
          value={fmtMoney(k.monthRevenue)}
          icon={IndianRupee}
          color="blue"
          trend={k.revenueTrend ?? undefined}
          trendLabel="vs last month"
        />
        <KPICard
          title="Revenue this year"
          value={fmtMoney(k.yearRevenue)}
          icon={TrendingUp}
          color="green"
          trend={k.yearRevTrend ?? undefined}
          trendLabel="vs last year"
        />
        <KPICard
          title="Total orders"
          value={count(k.totalOrders)}
          icon={ShoppingCart}
          color="purple"
          trend={k.ordersTrend ?? undefined}
          trendLabel="vs last month"
          onClick={canReadOrders ? () => navigate('/orders') : undefined}
        />
        <KPICard
          title="Active dealers"
          value={count(k.activeDealers)}
          icon={Store}
          color="yellow"
          subtitle={`${count(k.totalDealers)} dealers in total`}
          onClick={() => navigate('/dealers')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="KYC waiting for approval"
          value={count(k.pendingApprovals)}
          icon={UserPlus}
          color="blue"
          subtitle={k.pendingApprovals > 0 ? 'Dealers need review' : 'All dealers reviewed'}
          onClick={() => navigate('/onboarding')}
        />
        <KPICard
          title="Overdue invoices"
          value={count(k.overdueInvoices)}
          icon={ReceiptText}
          color="red"
          subtitle={k.overdueAmount > 0 ? `${fmtMoney(k.overdueAmount)} outstanding` : 'Nothing overdue'}
          onClick={() => navigate('/invoices')}
        />
        <KPICard
          title="Pending returns"
          value={count(k.pendingReturns)}
          icon={RotateCcw}
          color="orange"
          subtitle={k.pendingReturns > 0 ? 'Waiting to be processed' : 'No returns pending'}
          onClick={() => navigate('/returns')}
        />
        <KPICard
          title="Inventory value"
          value={fmtMoney(k.inventoryValue)}
          icon={Boxes}
          color="green"
          subtitle={k.outOfStockAlerts > 0 || k.lowStockAlerts > 0
            ? `${k.outOfStockAlerts || 0} out of stock · ${k.lowStockAlerts || 0} low`
            : 'All products in stock'}
          onClick={() => navigate(k.outOfStockAlerts > 0 ? '/inventory?status=out-of-stock' : k.lowStockAlerts > 0 ? '/inventory?status=low-stock' : '/inventory')}
        />
      </div>

      {/* Revenue + top dealers */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Revenue"
          subtitle={`${CHART_PERIODS.find((p) => p.value === chartPeriod)?.label} · orders net of returns`}
          action={k.revenueTrend !== null && k.revenueTrend !== undefined && (
            <span className={k.revenueTrend >= 0 ? 'badge-green' : 'badge-red'}>
              {k.revenueTrend >= 0 ? '↑' : '↓'} {Math.abs(k.revenueTrend)}% vs last month
            </span>
          )}
        >
          <div className="h-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesChart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2853e0" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#2853e0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56}
                tickFormatter={(v) => fmtMoney(v)}
              />
              <Tooltip
                cursor={{ stroke: '#c2d5ff', strokeWidth: 1 }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 12px 32px -8px rgba(16,24,40,0.18)', fontSize: 12 }}
                formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2853e0" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Top dealers"
          subtitle="By order value"
          action={<Link to="/dealers" className="link">All dealers</Link>}
        >
          {topDealers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No dealer orders yet</p>
          ) : (
            <ul className="space-y-4">
              {topDealers.slice(0, 6).map((dealer, i) => (
                <li key={dealer._id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`badge truncate ${RANK_CHIPS[i % RANK_CHIPS.length]}`} title={dealer.businessName}>
                      {dealer.businessName || 'Dealer'}
                    </span>
                    <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                      {fmtMoney(dealer.totalRevenue)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${RANK_COLORS[i % RANK_COLORS.length]}`}
                      style={{ width: `${Math.max(4, ((dealer.totalRevenue || 0) / maxDealerRevenue) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {plural(dealer.totalOrders || 0, 'order')}{dealer.pricingTier ? ` · ${dealer.pricingTier}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Needs attention + live activity */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Needs attention" subtitle="Things waiting on your team right now">
          {attention.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="icon-tile h-11 w-11 rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span>
              <p className="text-sm font-semibold text-slate-700">All clear</p>
              <p className="text-xs text-slate-400">No stock, payment or approval issues need action.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map(({ icon: Icon, tone, title, detail, to, cta }) => (
                <li key={title} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className={`icon-tile h-10 w-10 rounded-full ring-1 ring-inset ${ATTENTION_TONES[tone]}`}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                    <p className="truncate text-[13px] text-slate-500">{detail}</p>
                  </div>
                  <button onClick={() => navigate(to)} className="btn-secondary px-3.5 py-1.5">{cta}</button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Live team activity"
          subtitle="Latest changes across the portal"
          action={hasPermission('audit:read') && <Link to="/audit" className="link">Analytics</Link>}
        >
          {feed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
              <Activity size={22} className="opacity-40" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {feed.map((entry) => {
                const { icon: Icon, tone } = ACTION_ICONS[entry.action] || { icon: CircleDot, tone: 'bg-slate-100 text-slate-500' };
                const ref = entry.entityId ? ` #${String(entry.entityId).slice(-6).toUpperCase()}` : '';
                return (
                  <li key={entry._id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`icon-tile mt-0.5 h-9 w-9 rounded-full ${tone}`}><Icon size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-700">
                        <span className="font-semibold text-slate-900">{entry.performedBy?.name || 'System'}</span>{' '}
                        {ACTION_VERBS[entry.action] || entry.action}{' '}
                        {ENTITY_LABELS[entry.entity] || entry.entity}
                        <span className="font-medium text-slate-900">{ref}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {entry.createdAt ? `${formatDistanceToNowStrict(new Date(entry.createdAt))} ago` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Recent orders */}
      {canReadOrders && (
        <SectionCard
          title="Recent orders"
          subtitle="Latest dealer orders"
          action={<Link to="/orders" className="link">All orders</Link>}
          flush
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-5">Order</th>
                  <th>Dealer</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                  <th className="pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr className="hover:bg-transparent">
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-400">No recent orders</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order._id} className="cursor-pointer" onClick={() => navigate(`/orders/${order._id}`)}>
                      <td className="pl-5 font-semibold text-primary-700">#{order._id?.slice(-6).toUpperCase()}</td>
                      <td className="font-medium text-slate-900">{order.dealerId?.businessName || order.dealerId?.name || '—'}</td>
                      <td className="text-slate-500">{order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}</td>
                      <td className="text-right font-semibold tabular-nums">
                        ₹{(order.netAmount || order.total || order.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="pr-5"><StatusBadge status={order.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default DashboardPage;
