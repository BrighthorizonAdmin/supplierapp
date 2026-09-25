import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, ReferenceLine,
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { RefreshCw, Download, X, ChevronDown, Search, Check } from 'lucide-react';
import api from '../../../services/api';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtL  = (v) => `₹${((v || 0) / 100000).toFixed(2)}L`;
const fmtRs = (v) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

const PAYMENT_MODE_LABELS = {
  upi: 'UPI', gpay: 'Google Pay', googlepay: 'Google Pay',
  phonepay: 'PhonePe', phonepe: 'PhonePe',
  paytm: 'Paytm', razorpay: 'Razorpay',
  cod: 'COD', cash: 'Cash', card: 'Card', cheque: 'Cheque',
  bank: 'Bank Transfer', banktransfer: 'Bank Transfer', 'bank-transfer': 'Bank Transfer',
  neft: 'NEFT', rtgs: 'RTGS', imps: 'IMPS',
  split: 'Split Payment', splitpayment: 'Split Payment', 'split-payment': 'Split Payment',
  credit: 'Credit',
  'net-45': 'Net-45', net45: 'Net-45',
  'net-30': 'Net-30', net30: 'Net-30',
  'net-60': 'Net-60', net60: 'Net-60',
  'net-90': 'Net-90', net90: 'Net-90',
  'net-15': 'Net-15', net15: 'Net-15',
  online: 'Online', b2c: 'B2C', unknown: 'Unknown',
};
const fmtPayMode = (v) => {
  if (!v) return 'Unknown';
  const lower = v.toLowerCase().trim();
  if (PAYMENT_MODE_LABELS[lower]) return PAYMENT_MODE_LABELS[lower];
  // Try without spaces and hyphens (e.g. "bank transfer" → "banktransfer")
  const stripped = lower.replace(/[\s-]/g, '');
  if (PAYMENT_MODE_LABELS[stripped]) return PAYMENT_MODE_LABELS[stripped];
  // Fallback: title-case each word, replace hyphens with spaces
  return lower.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
const TABS = ['Overview', 'Weekly', 'Heatmap', 'Products', 'Channels', 'Invoices'];

const DATE_PRESETS = [
  { label: 'All Time',    value: 'all' },
  { label: 'This Month',  value: 'this_month' },
  { label: 'Last Month',  value: 'last_month' },
  { label: 'Last Week',   value: 'last_week' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days',value: '30d' },
  { label: 'Custom',      value: 'custom' },
];

const getPresetDates = (preset) => {
  const now = new Date();
  switch (preset) {
    case 'this_month': return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'last_month': { const lm = subMonths(now, 1); return { startDate: format(startOfMonth(lm), 'yyyy-MM-dd'), endDate: format(endOfMonth(lm), 'yyyy-MM-dd') }; }
    case 'last_week':  { const lw = subDays(now, 7); return { startDate: format(startOfWeek(lw), 'yyyy-MM-dd'), endDate: format(endOfWeek(lw), 'yyyy-MM-dd') }; }
    case '7d':         return { startDate: format(subDays(now, 7), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
    case '30d':        return { startDate: format(subDays(now, 30), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
    default:           return { startDate: null, endDate: null };
  }
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs space-y-1">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {fmtRs(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Searchable Customer Multi-Select ─────────────────────────────────────────
const SearchableCustomerSelect = ({ customers = [], selected = [], onChange }) => {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [draft, setDraft]     = useState(selected);
  const ref = useRef(null);

  useEffect(() => { setDraft(selected); }, [selected]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() =>
    customers.filter(c => c.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  const toggle = (name) => {
    setDraft(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const handleDone = () => { onChange(draft); setOpen(false); };
  const handleClear = () => { setDraft([]); };

  const label = selected.length === 0
    ? 'All Customers'
    : selected.length === 1
      ? selected[0].length > 18 ? selected[0].slice(0, 18) + '…' : selected[0]
      : `${selected.length} customers`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); setDraft(selected); setSearch(''); }}
        className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 pr-2 focus:outline-none bg-white transition-colors ${selected.length > 0 ? 'border-blue-400 text-blue-700' : 'border-slate-200 text-slate-600'}`}
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search size={12} className="text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400"
              />
              {search && <button onClick={() => setSearch('')}><X size={11} className="text-slate-400" /></button>}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No customers found</p>
            ) : filtered.map(c => (
              <button
                key={c}
                onClick={() => toggle(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${draft.includes(c) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                  {draft.includes(c) && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-slate-700 leading-snug">{c}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between p-2 border-t border-slate-100">
            <button onClick={handleClear} className="text-xs text-slate-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              Clear
            </button>
            <button onClick={handleDone} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AuditPage = () => {
  const [activeTab,         setActiveTab]         = useState('Overview');
  const [datePreset,        setDatePreset]        = useState('all');
  const [customStart,       setCustomStart]       = useState('');
  const [customEnd,         setCustomEnd]         = useState('');
  const [showCustom,        setShowCustom]        = useState(false);
  const [invoiceType,       setInvoiceType]       = useState('all');
  const [status,            setStatus]            = useState('all');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [paymentMode,       setPaymentMode]       = useState('all');
  const [salesman,          setSalesman]          = useState('all');
  const [loading,           setLoading]           = useState(false);
  const [invoicePage,       setInvoicePage]       = useState(1);

  const [kpis,          setKpis]          = useState(null);
  const [typeSplit,     setTypeSplit]     = useState([]);
  const [paymentMix,    setPaymentMix]    = useState([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState([]);
  const [dailyStats,    setDailyStats]    = useState({ daily: [], monthly: [], byDayOfWeek: [], top10: [] });
  const [topProducts,     setTopProducts]     = useState([]);
  const [topChannels,     setTopChannels]     = useState([]);
  const [statusSplit,     setStatusSplit]     = useState([]);
  const [topSalespeople,  setTopSalespeople]  = useState([]);
  const [customerRevenue, setCustomerRevenue] = useState([]);
  const [invoices,      setInvoices]      = useState([]);
  const [invoiceTotal,  setInvoiceTotal]  = useState(0);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [filterOptions,      setFilterOptions]      = useState({ salesmen: [], customers: [] });
  const [dateRange,          setDateRange]          = useState({ minDate: null, maxDate: null });
  const [allPaymentModes,    setAllPaymentModes]    = useState([]);
  const [productSort,   setProductSort]   = useState({ field: 'revenue', dir: 'desc' });

  const activeFilters = useMemo(() => {
    const dates = datePreset === 'custom'
      ? { startDate: customStart || null, endDate: customEnd || null }
      : getPresetDates(datePreset);
    let partyNames = 'all';
    let dealerIds  = 'all';
    if (selectedCustomers.length > 0) {
      partyNames = selectedCustomers.join(',');
      const ids = selectedCustomers
        .map(name => filterOptions.customers.find(c => c.name === name)?.dealerId)
        .filter(Boolean);
      if (ids.length > 0) dealerIds = ids.join(',');
    }
    return { ...dates, invoiceType, status, paymentMode, salesmanName: salesman, partyNames, dealerIds };
  }, [datePreset, customStart, customEnd, invoiceType, status, paymentMode, salesman, selectedCustomers, filterOptions.customers]);

  const buildParams = useCallback((extra = {}) => {
    const p = { ...activeFilters, ...extra };
    return Object.fromEntries(Object.entries(p).filter(([, v]) => v && v !== 'all' && v !== null));
  }, [activeFilters]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [kpiRes, typeRes, pmRes, wkRes, dsRes, prodRes, chRes, ssRes, spRes, crRes] = await Promise.all([
        api.get('/audit/kpis',               { params }),
        api.get('/audit/invoice-type-split', { params }),
        api.get('/audit/payment-method-mix', { params }),
        api.get('/audit/weekly-revenue',     { params }),
        api.get('/audit/daily-stats',        { params }),
        api.get('/audit/top-products',       { params }),
        api.get('/audit/top-channels',       { params }),
        api.get('/audit/status-split',       { params }),
        api.get('/audit/top-salespeople',    { params }),
        api.get('/audit/customer-revenue',   { params }),
      ]);
      setKpis(kpiRes.data.data);
      setTypeSplit(typeRes.data.data || []);
      const pmData = pmRes.data.data || [];
      setPaymentMix(pmData);
      // Accumulate all payment modes ever seen so the dropdown always shows every option
      setAllPaymentModes(prev => {
        const merged = [...new Set([...prev, ...pmData.map(m => m.mode).filter(Boolean)])];
        return merged;
      });
      setWeeklyRevenue(wkRes.data.data || []);
      setDailyStats(dsRes.data.data || { daily: [], monthly: [], byDayOfWeek: [], top10: [] });
      setTopProducts(prodRes.data.data || []);
      setTopChannels(chRes.data.data || []);
      setStatusSplit(ssRes.data.data || []);
      setTopSalespeople(spRes.data.data || []);
      setCustomerRevenue(crRes.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchInvoices = useCallback(async (page = 1) => {
    const params = buildParams({ page, limit: 20 });
    const res = await api.get('/audit/invoices', { params });
    setInvoices(res.data.data?.data || []);
    setInvoiceTotal(res.data.data?.total || 0);
    setInvoiceTotalPages(res.data.data?.totalPages || 1);
    setInvoicePage(page);
  }, [buildParams]);

  useEffect(() => {
    api.get('/audit/filter-options').then(r => setFilterOptions(r.data.data || { salesmen: [], customers: [] })).catch(() => {});
    api.get('/audit/date-range').then(r => setDateRange(r.data.data || {})).catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (activeTab === 'Invoices') fetchInvoices(1); }, [activeTab, fetchAll]);

  const resetFilters = () => {
    setDatePreset('all'); setCustomStart(''); setCustomEnd(''); setShowCustom(false);
    setInvoiceType('all'); setStatus('all'); setSelectedCustomers([]); setPaymentMode('all'); setSalesman('all');
  };

  const handleExportCSV = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const download = (csv, name) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${name}-${today}.csv`; a.click();
      URL.revokeObjectURL(url);
    };

    try {
      if (activeTab === 'Invoices' || activeTab === 'Overview') {
        const params = buildParams({ page: 1, limit: 10000 });
        const res = await api.get('/audit/invoices', { params });
        const rows = res.data.data?.data || [];
        if (!rows.length) return;
        const headers = ['Invoice No','Date','Party','Type','Status','Payment Mode','Total','Paid','Balance','Salesman'];
        const csv = [headers.join(','), ...rows.map(r => [
          r.invoiceNumber, r.invoiceDate ? format(new Date(r.invoiceDate), 'dd/MM/yyyy') : '',
          `"${r.partyName || ''}"`, r.invoiceType, r.status, r.paymentMode,
          r.totalAmount, r.amountPaid, r.balance, `"${r.salesmanName || ''}"`,
        ].join(','))].join('\n');
        download(csv, 'invoices');

      } else if (activeTab === 'Weekly') {
        if (!weeklyRevenue.length) return;
        const headers = ['Week Start','Revenue','Invoice Count','WoW Change %'];
        const withWoW = weeklyRevenue.map((w, i) => {
          const prev = weeklyRevenue[i - 1];
          const wow = prev && prev.revenue > 0 ? (((w.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1) : '';
          return [w.weekStart ? format(new Date(w.weekStart), 'dd/MM/yyyy') : '', w.revenue, w.count ?? '', wow];
        });
        const csv = [headers.join(','), ...withWoW.map(r => r.join(','))].join('\n');
        download(csv, 'weekly-revenue');

      } else if (activeTab === 'Heatmap') {
        const { daily = [], top10 = [] } = dailyStats;
        if (!daily.length) return;
        const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const headers = ['Date','Day','Revenue','Invoice Count','Avg Per Invoice'];
        const rows = daily.map(d => {
          const dt = new Date(d.date);
          return [
            format(dt, 'dd/MM/yyyy'), DOW[dt.getDay()],
            d.revenue, d.count, d.count > 0 ? Math.round(d.revenue / d.count) : 0,
          ];
        });
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        download(csv, 'daily-heatmap');

      } else if (activeTab === 'Products') {
        if (!topProducts.length) return;
        const headers = ['Product','Revenue','Units','Invoices','Avg Per Unit','Revenue Share %'];
        const rows = topProducts.map(p => [
          `"${p.name || ''}"`, p.revenue, p.quantity, p.invoiceCount ?? '',
          p.avgPerUnit ?? '', (p.share || 0).toFixed(1),
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        download(csv, 'top-products');

      } else if (activeTab === 'Channels') {
        if (!customerRevenue.length && !topSalespeople.length) return;
        // Export two sections: Customer Revenue then Salespeople
        const custHeaders = ['Customer','Invoices','Revenue','Collected','Collection %','Revenue Share %'];
        const custRows = customerRevenue.map(c => [
          `"${c.name || ''}"`, c.invoiceCount, c.revenue, c.collected, c.collectionPct, (c.share || 0).toFixed(1),
        ]);
        const spHeaders = ['Salesperson','Revenue','Invoice Count'];
        const spRows = topSalespeople.map(s => [`"${s.name || ''}"`, s.revenue, s.count ?? '']);
        const csv = [
          'Customer Revenue',
          custHeaders.join(','),
          ...custRows.map(r => r.join(',')),
          '',
          'Top Salespeople',
          spHeaders.join(','),
          ...spRows.map(r => r.join(',')),
        ].join('\n');
        download(csv, 'channels');
      }
    } catch {}
  };

  const heatmapStats = useMemo(() => {
    const { daily = [], monthly = [], byDayOfWeek = [], top10 = [] } = dailyStats;
    const peakDay    = daily.reduce((b, d) => d.revenue > (b?.revenue || 0) ? d : b, null);
    const activeDays = daily.filter(d => d.revenue > 0).length;
    const totalRev   = daily.reduce((s, d) => s + d.revenue, 0);
    const avgDaily   = activeDays > 0 ? totalRev / activeDays : 0;
    const bestMonth  = monthly.reduce((b, m) => m.revenue > (b?.revenue || 0) ? m : b, null);
    const bestWeekday = byDayOfWeek.reduce((b, d) => d.avgPerDay > (b?.avgPerDay || 0) ? d : b, null);

    const DOW_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTH_COLORS = ['#10b981','#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4'];

    const dowMap = {};
    byDayOfWeek.forEach(d => { dowMap[d.dayOfWeek] = d; });
    // Mon(2)…Sat(7) then Sun(1)
    const dowChartData = [2,3,4,5,6,7,1].map(dow => ({
      day: DOW_NAMES[dow],
      revenue: dowMap[dow]?.revenue || 0,
      avgPerDay: dowMap[dow]?.avgPerDay || 0,
      count: dowMap[dow]?.count || 0,
    }));

    const monthChartData = monthly.map((m, i) => ({
      label: `${MONTH_NAMES[m.month]} ${m.year}`,
      revenue: m.revenue, count: m.count,
      color: MONTH_COLORS[i % MONTH_COLORS.length],
    }));

    return { peakDay, activeDays, avgDaily, bestMonth, bestWeekday, dowChartData, monthChartData, DOW_NAMES, MONTH_NAMES, top10, daily };
  }, [dailyStats]);

  const weeklyStats = useMemo(() => {
    if (!weeklyRevenue.length) return { withWoW: [], peak: null, avg: 0, bestWoW: null, activeWeeks: 0 };
    const withWoW = weeklyRevenue.map((w, i) => {
      const prev = weeklyRevenue[i - 1];
      const wow = prev && prev.revenue > 0 ? ((w.revenue - prev.revenue) / prev.revenue) * 100 : null;
      return { ...w, wow };
    });
    const totalRev = weeklyRevenue.reduce((s, w) => s + w.revenue, 0);
    const avg = totalRev / weeklyRevenue.length;
    const peak = weeklyRevenue.reduce((b, w) => w.revenue > (b?.revenue || 0) ? w : b, null);
    const bestWoW = withWoW.reduce((b, w) => w.wow !== null && w.wow > (b?.wow ?? -Infinity) ? w : b, null);
    const activeWeeks = weeklyRevenue.filter(w => w.revenue > 0).length;
    return { withWoW, peak, avg, bestWoW, activeWeeks };
  }, [weeklyRevenue]);

  const sortedProducts = useMemo(() => {
    const { field, dir } = productSort;
    return [...topProducts].sort((a, b) => {
      const av = a[field] ?? 0, bv = b[field] ?? 0;
      return dir === 'desc' ? bv - av : av - bv;
    });
  }, [topProducts, productSort]);

  const displayDateRange = useMemo(() => {
    const { startDate, endDate } = activeFilters;
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    if (dateRange.minDate && dateRange.maxDate)
      return `${format(new Date(dateRange.minDate), 'yyyy-MM-dd')} → ${format(new Date(dateRange.maxDate), 'yyyy-MM-dd')}`;
    return 'All time';
  }, [activeFilters, dateRange]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">{kpis?.invoiceCount ?? '—'} invoices · {displayDateRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Live Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Date Range</span>
          {DATE_PRESETS.map(p => (
            <button key={p.value}
              onClick={() => { setDatePreset(p.value); setShowCustom(p.value === 'custom'); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${datePreset === p.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p.label}
            </button>
          ))}
          {showCustom && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
              <span className="text-slate-400">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select label="Invoice Type" value={invoiceType} onChange={setInvoiceType}
            options={[{ value: 'all', label: 'All Types' }, { value: 'b2b', label: 'B2B' }, { value: 'retail', label: 'Retail' }]} />
          <Select label="Status" value={status} onChange={setStatus}
            options={[{ value: 'all', label: 'All Statuses' }, { value: 'issued', label: 'Issued' }, { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }]} />

          <SearchableCustomerSelect
            customers={filterOptions.customers.map(c => c.name || c)}
            selected={selectedCustomers}
            onChange={setSelectedCustomers}
          />

          <Select label="Payment Mode" value={paymentMode} onChange={setPaymentMode}
            options={[
              { value: 'all', label: 'All Modes' },
              ...allPaymentModes.map(m => ({ value: m, label: fmtPayMode(m) })),
            ]} />
          <Select label="Salesperson" value={salesman} onChange={setSalesman}
            options={[{ value: 'all', label: 'All' }, ...filterOptions.salesmen.map(s => ({ value: s, label: s }))]} />
          <button onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            <X size={12} /> Reset All
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{kpis?.invoiceCount ?? 0}</span> invoices ·
        Total <span className="font-semibold text-blue-600">{fmtL(kpis?.totalRevenue)}</span> ·
        {displayDateRange}
        {selectedCustomers.length > 0 && (
          <span className="ml-2 text-blue-600 font-medium">· {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected</span>
        )}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total Revenue" value={fmtL(kpis?.totalRevenue)}  sub={`${kpis?.invoiceCount ?? 0} invoices`}      color="blue" />
            <KpiCard label="Collected"     value={fmtL(kpis?.collected)}      sub={`${kpis?.collectionPct ?? 0}% collection`}  color="green" />
            <KpiCard label="Outstanding"   value={fmtL(kpis?.outstanding)}    sub="Issued + unpaid"                             color="orange" />
            <KpiCard label="GST Collected" value={fmtL(kpis?.gstCollected)}   sub="18%"                                         color="red" />
            <KpiCard label="Invoices"      value={kpis?.invoiceCount ?? 0}    sub={`${kpis?.customerCount ?? 0} customers`}     color="purple" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Donut — Invoice Type Split */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Invoice Type Split</h3>
              <p className="text-xs text-slate-400 mb-2">Revenue by B2B vs Retail</p>
              {typeSplit.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart margin={{ top: 20, right: 60, bottom: 30, left: 60 }}>
                    <Pie
                      data={typeSplit}
                      dataKey="revenue"
                      nameKey="type"
                      cx="50%"
                      cy="45%"
                      outerRadius={85}
                      innerRadius={45}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      label={({ cx, cy, midAngle, outerRadius, type, revenue, percent }) => {
                        if (percent < 0.005) return null;
                        const RADIAN = Math.PI / 180;
                        const r = outerRadius + 28;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        return (
                          <text fontSize={11} fill="#334155" textAnchor={x > cx ? 'start' : 'end'}>
                            <tspan x={x} y={y - 5} fontWeight="600">{(type || 'Unknown').toUpperCase()}</tspan>
                            <tspan x={x} y={y + 10} fill="#64748b">₹{(revenue || 0).toLocaleString('en-IN')}</tspan>
                          </text>
                        );
                      }}
                    >
                      {typeSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [fmtRs(v), (name || 'Unknown').toUpperCase()]} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      formatter={(value) => <span style={{ color: '#475569' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            {/* Payment Method Mix — horizontal bars */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Payment Method Mix</h3>
              <p className="text-xs text-slate-400 mb-2">Revenue by payment mode</p>
              {paymentMix.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(220, paymentMix.length * 40 + 50)}>
                  <BarChart layout="vertical" data={paymentMix} margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => fmtL(v)} />
                    <YAxis type="category" dataKey="mode" tick={{ fontSize: 11, fill: '#334155' }} width={120} axisLine={false} tickLine={false}
                      tickFormatter={fmtPayMode} />
                    <Tooltip content={<ChartTooltip />} labelFormatter={fmtPayMode} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} barSize={22}>
                      {paymentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Weekly Revenue */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Weekly Revenue</h3>
            <p className="text-xs text-slate-400 mb-4">Total invoiced per week</p>
            {weeklyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyRevenue} margin={{ top: 4, right: 8, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy'); } catch { return v; } }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      )}

      {/* ── Weekly ── */}
      {activeTab === 'Weekly' && (
        <div className="space-y-4">
          {/* Weekly KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Peak Week"
              value={weeklyStats.peak ? format(new Date(weeklyStats.peak.weekStart), 'MMM d') : '—'}
              sub={weeklyStats.peak ? fmtL(weeklyStats.peak.revenue) : '—'}
              color="blue"
            />
            <KpiCard label="Avg Weekly" value={fmtL(weeklyStats.avg)} sub="Filtered range" color="green" />
            <KpiCard
              label="Best WoW Growth"
              value={weeklyStats.bestWoW?.wow != null ? `+${weeklyStats.bestWoW.wow.toFixed(1)}%` : '—'}
              sub={weeklyStats.bestWoW ? format(new Date(weeklyStats.bestWoW.weekStart), 'MMM d') : '—'}
              color="orange"
            />
            <KpiCard label="Active Weeks" value={weeklyStats.activeWeeks} sub="In range" color="purple" />
          </div>

          {/* Chart 1: Revenue bars + WoW % line */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Weekly Revenue + WoW Change</h3>
            <p className="text-xs text-slate-400 mb-4">Columns = revenue · Line = WoW %</p>
            {weeklyStats.withWoW.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={weeklyStats.withWoW} margin={{ top: 30, right: 55, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <YAxis yAxisId="wow" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v.toFixed(0)}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs space-y-1">
                          <p className="font-semibold text-slate-700 mb-1">
                            {label ? (() => { try { return format(new Date(label), 'MMM d, yyyy'); } catch { return label; } })() : ''}
                          </p>
                          {payload.map(p => (
                            <p key={p.dataKey} style={{ color: p.color }}>
                              {p.name}: {p.dataKey === 'revenue' ? fmtRs(p.value) : p.value != null ? `${p.value.toFixed(1)}%` : '—'}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Line
                    yAxisId="wow"
                    dataKey="wow"
                    name="WoW %"
                    type="monotone"
                    stroke="#f97316"
                    strokeWidth={2}
                    connectNulls={false}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.wow == null) return <g key={`dot-${cx}`} />;
                      const color = payload.wow >= 0 ? '#10b981' : '#ef4444';
                      return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
                    }}
                    label={(props) => {
                      const { x, y, value } = props;
                      if (value == null) return null;
                      const color = value >= 0 ? '#10b981' : '#ef4444';
                      return (
                        <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fill={color} fontWeight="600">
                          {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                        </text>
                      );
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>

          {/* Chart 2: Sales by Week with average line */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Sales by Week</h3>
            <p className="text-xs text-slate-400 mb-4">Revenue per week as individual columns — compare weeks side by side</p>
            {weeklyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyRevenue} margin={{ top: 30, right: 20, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmtL(v)} />
                  <Tooltip content={<ChartTooltip />} labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy'); } catch { return v; } }} />
                  <ReferenceLine
                    y={weeklyStats.avg}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{ value: fmtL(weeklyStats.avg), position: 'insideBottomRight', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fontSize: 10, fill: '#475569', formatter: v => fmtL(v) }}
                  >
                    {weeklyRevenue.map((w, i) => (
                      <Cell key={i} fill={w.revenue >= weeklyStats.avg ? '#3b82f6' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      )}

      {/* ── Heatmap ── */}
      {activeTab === 'Heatmap' && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Peak Day"
              value={heatmapStats.peakDay ? format(new Date(heatmapStats.peakDay.date), 'MMM d') : '—'}
              sub={heatmapStats.peakDay ? `${fmtL(heatmapStats.peakDay.revenue)} · ${heatmapStats.peakDay.count} inv` : '—'}
              color="blue"
            />
            <KpiCard
              label="Avg Daily"
              value={fmtRs(heatmapStats.avgDaily)}
              sub={`${heatmapStats.activeDays} active days`}
              color="green"
            />
            <KpiCard
              label="Best Month"
              value={heatmapStats.bestMonth ? heatmapStats.MONTH_NAMES[heatmapStats.bestMonth.month] : '—'}
              sub={heatmapStats.bestMonth ? fmtL(heatmapStats.bestMonth.revenue) : '—'}
              color="orange"
            />
            <KpiCard
              label="Best Weekday"
              value={heatmapStats.bestWeekday ? heatmapStats.DOW_NAMES[heatmapStats.bestWeekday.dayOfWeek] : '—'}
              sub={heatmapStats.bestWeekday ? `${fmtL(heatmapStats.bestWeekday.avgPerDay)} avg/day` : '—'}
              color="purple"
            />
          </div>

          {/* Calendar heatmap */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Daily Sales Calendar</h3>
            <p className="text-xs text-slate-400 mb-4">Each cell = one day · colour = revenue · hover for details</p>
            <CalendarHeatmap daily={heatmapStats.daily} />
          </div>

          {/* Monthly Revenue + Sales by Day of Week */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Monthly Revenue</h3>
              <p className="text-xs text-slate-400 mb-4">Month comparison</p>
              {heatmapStats.monthChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={heatmapStats.monthChartData} margin={{ top: 24, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtL(v)} />
                    <Tooltip formatter={v => [fmtRs(v), 'Revenue']} />
                    <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}
                      label={{ position: 'top', fontSize: 11, fill: '#475569', formatter: v => fmtL(v) }}>
                      {heatmapStats.monthChartData.map((m, i) => <Cell key={i} fill={m.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Sales by Day of Week</h3>
              <p className="text-xs text-slate-400 mb-4">Total + avg/active day</p>
              {heatmapStats.dowChartData.some(d => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={heatmapStats.dowChartData} margin={{ top: 10, right: 50, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtL(v)} />
                    <YAxis yAxisId="avg" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtRs(v)} />
                    <Tooltip formatter={(v, name) => [name === 'Avg/Day' ? fmtRs(v) : fmtL(v), name]} />
                    <Bar yAxisId="rev" dataKey="revenue" name="Total" fill="#3b82f6" opacity={0.75} radius={[4,4,0,0]} />
                    <Line yAxisId="avg" dataKey="avgPerDay" name="Avg/Day" type="monotone" stroke="#f97316" strokeWidth={2}
                      dot={{ fill: '#f97316', r: 4 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Top 10 Revenue Days */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Top 10 Revenue Days</h3>
              <p className="text-xs text-slate-400">Ranked by daily total</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['#','Date','Day','Revenue','Invoices','Avg/Invoice'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {heatmapStats.top10.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No data</td></tr>
                  ) : (() => {
                    const maxRev = heatmapStats.top10[0]?.revenue || 1;
                    const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                    return heatmapStats.top10.map((d, i) => {
                      const dt = new Date(d.date);
                      const badgeColors = ['bg-yellow-400','bg-slate-300','bg-orange-400'];
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold text-white ${badgeColors[i] || 'bg-slate-200 text-slate-600'}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{format(dt, 'MMM d, yyyy')}</td>
                          <td className="px-4 py-3 text-slate-500">{DOW_SHORT[dt.getDay()]}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{fmtRs(d.revenue)}</div>
                            <div className="h-1 mt-1 rounded-full bg-slate-100 w-40">
                              <div className="h-1 rounded-full bg-blue-500" style={{ width: `${(d.revenue / maxRev) * 100}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{d.count}</td>
                          <td className="px-4 py-3 text-slate-600">{fmtRs(Math.round(d.revenue / d.count))}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {activeTab === 'Products' && (
        <div className="space-y-4">
          {/* Chart: Revenue bars + Units line */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Top Products — Revenue &amp; Units</h3>
            <p className="text-xs text-slate-400 mb-3">Bar = revenue · Line = units · hover for unit economics</p>
            {topProducts.length > 0 ? (
              <>
                <div className="flex justify-end gap-5 mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                    <span>Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className="w-3 h-3 rounded-full bg-orange-400" />
                    <span>Units</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(300, topProducts.slice(0, 12).length * 34 + 70)}>
                  <ComposedChart layout="vertical" data={topProducts.slice(0, 12)} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={true} horizontal={false} />
                    <XAxis xAxisId="rev" type="number" orientation="bottom"
                      tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => fmtL(v)} label={{ value: 'Revenue (₹)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }} />
                    <XAxis xAxisId="unit" type="number" orientation="top"
                      tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      label={{ value: 'Units', position: 'insideTop', offset: 10, fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" width={170} axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      tickFormatter={v => v && v.length > 22 ? v.slice(0, 22) + '...' : (v || '')} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const rev = payload.find(p => p.dataKey === 'revenue');
                        const qty = payload.find(p => p.dataKey === 'quantity');
                        const prod = topProducts.find(p => p.name === label) || {};
                        return (
                          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs space-y-1 max-w-[240px]">
                            <p className="font-semibold text-slate-700 mb-1 leading-snug">{label}</p>
                            {rev && <p className="text-blue-600">Revenue: {fmtRs(rev.value)}</p>}
                            {qty && <p className="text-orange-500">Units: {qty.value}</p>}
                            {prod.invoiceCount != null && <p className="text-slate-500">Invoices: {prod.invoiceCount}</p>}
                            {prod.avgPerUnit != null && <p className="text-slate-500">Avg/Unit: {fmtRs(prod.avgPerUnit)}</p>}
                          </div>
                        );
                      }}
                    />
                    <Bar xAxisId="rev" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                    <Line xAxisId="unit" dataKey="quantity" name="Units" type="linear" stroke="#f97316" strokeWidth={2}
                      dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }}
                      activeDot={{ r: 7 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            ) : <EmptyChart />}
          </div>

          {/* Product Ranking table */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Product Ranking</h3>
              <p className="text-xs text-slate-400">Click headers to sort</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PRODUCT</th>
                    {[
                      { label: 'REVENUE',  field: 'revenue' },
                      { label: 'UNITS',    field: 'quantity' },
                      { label: 'INVOICES', field: 'invoiceCount' },
                    ].map(({ label, field }) => (
                      <th key={field}
                        onClick={() => setProductSort(s => ({ field, dir: s.field === field && s.dir === 'desc' ? 'asc' : 'desc' }))}
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap">
                        {label}
                        <span className="ml-1 text-slate-300">
                          {productSort.field === field ? (productSort.dir === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">AVG/UNIT</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SHARE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedProducts.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No data</td></tr>
                  ) : (() => {
                    const maxRev = topProducts[0]?.revenue || 1;
                    const badgeCls = ['bg-yellow-400 text-white', 'bg-slate-300 text-white', 'bg-orange-400 text-white'];
                    return sortedProducts.map((p, i) => (
                      <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${i < 3 ? badgeCls[i] : 'bg-slate-100 text-slate-500'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{fmtRs(p.revenue)}</div>
                          <div className="h-0.5 mt-1.5 rounded-full bg-slate-100 w-28">
                            <div className="h-0.5 rounded-full bg-blue-500" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.quantity}</td>
                        <td className="px-4 py-3 text-slate-600">{p.invoiceCount ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtRs(p.avgPerUnit)}</td>
                        <td className="px-4 py-3 text-slate-600">{(p.share || 0).toFixed(1)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Channels ── */}
      {activeTab === 'Channels' && (() => {
        const STATUS_COLORS = { issued: '#f97316', paid: '#10b981', unpaid: '#3b82f6', partial: '#ef4444', overdue: '#8b5cf6' };
        const SP_COLORS = ['#3b82f6','#10b981','#f97316','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#84cc16','#ec4899','#6366f1'];
        const badgeCls = ['bg-yellow-400 text-white','bg-slate-300 text-white','bg-orange-400 text-white'];
        return (
          <div className="space-y-4">
            {/* Row 1: Invoice Status donut + Top Salespeople bar */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Invoice Status */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Invoice Status</h3>
                <p className="text-xs text-slate-400 mb-2">Revenue by status</p>
                {statusSplit.length > 0 ? (
                  <ResponsiveContainer width="100%" height={290}>
                    <PieChart margin={{ top: 20, right: 50, bottom: 20, left: 50 }}>
                      <Pie
                        data={statusSplit}
                        dataKey="revenue"
                        nameKey="status"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        innerRadius={46}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        label={({ cx, cy, midAngle, outerRadius, status, percent }) => {
                          if (percent < 0.005) return null;
                          const RADIAN = Math.PI / 180;
                          const r = outerRadius + 30;
                          const x = cx + r * Math.cos(-midAngle * RADIAN);
                          const y = cy + r * Math.sin(-midAngle * RADIAN);
                          return (
                            <text fontSize={11} fill="#334155" textAnchor={x > cx ? 'start' : 'end'}>
                              <tspan x={x} y={y - 5} fontWeight="600" style={{ textTransform: 'capitalize' }}>
                                {status ? status.charAt(0).toUpperCase() + status.slice(1) : ''}
                              </tspan>
                              <tspan x={x} y={y + 10} fill="#64748b">{(percent * 100).toFixed(1)}%</tspan>
                            </text>
                          );
                        }}
                      >
                        {statusSplit.map((s, i) => (
                          <Cell key={i} fill={STATUS_COLORS[s.status] || COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [fmtRs(v), name ? name.charAt(0).toUpperCase() + name.slice(1) : name]} />
                      <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                        formatter={(value) => <span style={{ color: '#475569', textTransform: 'capitalize' }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Top Salespeople */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Top Salespeople</h3>
                <p className="text-xs text-slate-400 mb-4">By attributed revenue</p>
                {topSalespeople.length > 0 ? (
                  <ResponsiveContainer width="100%" height={290}>
                    <BarChart layout="vertical" data={topSalespeople} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                        tickFormatter={v => fmtL(v)} />
                      <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        tickFormatter={v => v && v.length > 18 ? v.slice(0, 18) + '...' : (v || '')} />
                      <Tooltip formatter={(v, name) => [fmtRs(v), 'Revenue']}
                        labelFormatter={v => v} />
                      <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} barSize={18}>
                        {topSalespeople.map((_, i) => <Cell key={i} fill={SP_COLORS[i % SP_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Customer Revenue table */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Customer Revenue</h3>
                <p className="text-xs text-slate-400">By total invoiced value</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['#','CUSTOMER','INVOICES','REVENUE','COLLECTED','COLLECTION%','SHARE'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerRevenue.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No data</td></tr>
                    ) : customerRevenue.map((c, i) => (
                      <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${i < 3 ? badgeCls[i] : 'bg-slate-100 text-slate-500'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.invoiceCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{fmtRs(c.revenue)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtRs(c.collected)}</td>
                        <td className="px-4 py-3 text-slate-600">{c.collectionPct}%</td>
                        <td className="px-4 py-3 text-slate-600">{(c.share || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Invoices ── */}
      {activeTab === 'Invoices' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">
              Invoice List <span className="text-slate-400 font-normal ml-1">({invoiceTotal})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Invoice No','Date','Party','Type','Status','Mode','Total','Paid','Balance','Salesman'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">No invoices found</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-[160px] truncate">{inv.partyName || inv.dealerId?.businessName || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${inv.invoiceType === 'b2b' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{inv.invoiceType}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{inv.paymentMode || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{fmtRs(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-green-600 whitespace-nowrap">{fmtRs(inv.amountPaid)}</td>
                    <td className="px-4 py-3 text-red-500 whitespace-nowrap">{fmtRs(inv.balance)}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.salesmanName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoiceTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">Page {invoicePage} of {invoiceTotalPages}</p>
              <div className="flex gap-2">
                <button disabled={invoicePage <= 1} onClick={() => fetchInvoices(invoicePage - 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Prev</button>
                <button disabled={invoicePage >= invoiceTotalPages} onClick={() => fetchInvoices(invoicePage + 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color }) => {
  const borders = { blue: 'border-t-blue-500', green: 'border-t-green-500', orange: 'border-t-orange-500', red: 'border-t-red-500', purple: 'border-t-purple-500' };
  const texts   = { blue: 'text-blue-600', green: 'text-green-600', orange: 'text-orange-600', red: 'text-red-600', purple: 'text-purple-600' };
  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-t-4 ${borders[color]} p-4`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-xl font-bold ${texts[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
};

const Select = ({ value, onChange, options }) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() =>
    options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );
  const selectedOpt = options.find(o => o.value === value);
  const isFiltered  = value && value !== 'all';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 pr-2 bg-white transition-colors focus:outline-none whitespace-nowrap ${isFiltered ? 'border-blue-400 text-blue-700' : 'border-slate-200 text-slate-600'}`}
      >
        <span className="max-w-[130px] truncate">{selectedOpt?.label || 'Select…'}</span>
        <ChevronDown size={11} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search size={12} className="text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="text-xs bg-transparent outline-none flex-1 text-slate-700 placeholder-slate-400"
              />
              {search && (
                <button onClick={() => setSearch('')}>
                  <X size={11} className="text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No results</p>
            ) : filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${value === o.value ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                  {value === o.value && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-slate-700 leading-snug">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const conf = {
    issued: 'bg-blue-100 text-blue-700', partial: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700',
    draft: 'bg-slate-100 text-slate-500', cancelled: 'bg-slate-100 text-slate-500',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${conf[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
};

const EmptyChart = () => (
  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data for selected filters</div>
);

// ── Calendar Heatmap (GitHub-style) ─────────────────────────────────────────
const CAL_COLORS = ['#dbeafe','#bfdbfe','#93c5fd','#3b82f6','#1d4ed8'];
// Rows top→bottom: Sat(6), Fri(5), Thu(4), Wed(3), Tue(2), Mon(1) — Sunday excluded
const CAL_ROWS = [6, 5, 4, 3, 2, 1];
const CAL_ROW_LABELS = ['Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon'];

const CalendarHeatmap = ({ daily }) => {
  const [hoveredRev, setHoveredRev] = useState(null);

  const dayMap = useMemo(() => {
    const m = {};
    daily.forEach(d => { m[format(new Date(d.date), 'yyyy-MM-dd')] = d; });
    return m;
  }, [daily]);

  if (!daily.length) return <EmptyChart />;

  const dates = daily.map(d => new Date(d.date));
  // Cap end at today so future-dated invoices don't add empty weeks
  const today = new Date();
  const rawMax = new Date(Math.max(...dates.map(d => d.getTime())));
  const maxDate = rawMax > today ? today : rawMax;
  // Cap start to 26 weeks back so old sparse data doesn't create a huge empty stretch
  const rawMin = new Date(Math.min(...dates.map(d => d.getTime())));
  const twentySixWeeksAgo = new Date(maxDate.getTime() - 26 * 7 * 24 * 60 * 60 * 1000);
  const minDate = rawMin > twentySixWeeksAgo ? rawMin : twentySixWeeksAgo;
  // Weeks start on Sunday (weekStartsOn: 0)
  const firstSunday = startOfWeek(minDate, { weekStartsOn: 0 });
  const lastSunday  = startOfWeek(maxDate, { weekStartsOn: 0 });
  const maxRev = Math.max(...daily.map(d => d.revenue), 1);

  const getColor = (rev) => {
    if (!rev) return '#f1f5f9';
    const t = rev / maxRev;
    if (t < 0.1) return CAL_COLORS[0];
    if (t < 0.25) return CAL_COLORS[1];
    if (t < 0.5) return CAL_COLORS[2];
    if (t < 0.75) return CAL_COLORS[3];
    return CAL_COLORS[4];
  };

  const weeks = [];
  let cur = new Date(firstSunday);
  while (cur <= lastSunday) {
    // days[0]=Sun, days[1]=Mon, ..., days[6]=Sat
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(cur, i);
      const key = format(d, 'yyyy-MM-dd');
      return { date: d, key, data: dayMap[key] || null };
    });
    weeks.push({ weekStart: new Date(cur), days });
    cur = addDays(cur, 7);
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-500">
        <span>Less</span>
        {CAL_COLORS.map(c => <div key={c} className="w-4 h-4 rounded-sm" style={{ background: c }} />)}
        <span>More</span>
        <span className="ml-3 mr-1">No data</span>
        <div className="w-4 h-4 rounded-sm border border-slate-200" style={{ background: '#f1f5f9' }} />
      </div>

      <div className="flex">
        {/* Row labels */}
        <div className="flex flex-col gap-1 mr-2 pt-0">
          {CAL_ROW_LABELS.map(l => (
            <div key={l} className="h-11 flex items-center justify-end w-8 text-xs text-slate-500 font-medium">{l}</div>
          ))}
        </div>

        {/* Grid + week labels */}
        <div className="overflow-x-auto">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
                {CAL_ROWS.map(dow => {
                  const cell = week.days[dow];
                  return (
                    <div key={dow}
                      title={cell.data
                        ? `${format(cell.date, 'MMM d, yyyy')}: ${fmtRs(cell.data.revenue)} · ${cell.data.count} inv`
                        : format(cell.date, 'MMM d, yyyy')}
                      className="w-16 h-11 rounded cursor-pointer hover:ring-2 hover:ring-blue-400"
                      style={{ background: getColor(cell.data?.revenue || 0) }}
                      onMouseEnter={() => setHoveredRev(cell.data?.revenue ?? null)}
                      onMouseLeave={() => setHoveredRev(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Week labels */}
          <div className="flex gap-1 mt-1.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="w-16 flex-shrink-0 text-center">
                <span className="text-xs text-slate-400 whitespace-nowrap">{format(week.weekStart, 'MMM d')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gradient scale */}
        <div className="ml-4 flex flex-col items-center gap-1" style={{ minHeight: 160 }}>
          <span className="text-xs text-slate-400">{fmtL(maxRev)}</span>
          <div className="relative flex-1 flex items-stretch">
            <div className="w-4 rounded" style={{ background: 'linear-gradient(to bottom, #1d4ed8, #3b82f6, #93c5fd, #bfdbfe, #dbeafe)' }} />
            {hoveredRev !== null && (
              <div
                className="absolute -translate-y-1/2 pointer-events-none select-none"
                style={{
                  top: `${Math.max(2, Math.min(98, (1 - hoveredRev / maxRev) * 100))}%`,
                  right: '100%',
                  marginRight: 2,
                }}
              >
                <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid #475569' }} />
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400">₹0</span>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
