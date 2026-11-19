import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, History, User, Clock, ArrowRight } from 'lucide-react';
import api from '../../../services/api';
import Pagination from '../../../components/ui/Pagination';

const ACTIONS = {
  edit:    { label: 'Edited',              cls: 'badge-blue' },
  serials: { label: 'Serial numbers saved', cls: 'badge-purple' },
  issue:   { label: 'Issued',              cls: 'badge-green' },
  cancel:  { label: 'Cancelled',           cls: 'badge-orange' },
  delete:  { label: 'Deleted',             cls: 'badge-red' },
};

const TYPE_LABEL = { b2b: 'B2B', retail: 'Retail', b2c: 'B2C' };
const TYPE_CLS = {
  b2b: 'bg-blue-100 text-blue-800',
  retail: 'bg-green-100 text-green-800',
  b2c: 'bg-purple-100 text-purple-800',
};

// Show a stored value the way the rest of the app does (₹ amounts, dd MMM yyyy dates)
const showValue = (value, kind) => {
  if (value === undefined || value === null || value === '') return <span className="text-slate-400">—</span>;
  if (kind === 'money') return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (kind === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : format(d, 'dd MMM yyyy');
  }
  return <span className="break-words whitespace-pre-wrap">{value}</span>;
};

const roleText = (role) => [].concat(role || []).join(', ').replace(/-/g, ' ');

const ChangesTable = ({ changes, muted = false }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm min-w-[560px]">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="pb-2 pr-4 font-semibold w-1/3">Field</th>
          <th className="pb-2 pr-4 font-semibold">Before</th>
          <th className="pb-2 w-6" aria-hidden="true"></th>
          <th className="pb-2 font-semibold">After</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={`${c.field}-${i}`} className="border-t border-slate-100 align-top">
            <td className={`py-2 pr-4 font-medium ${muted ? 'text-slate-500' : 'text-slate-700'}`}>{c.label || c.field}</td>
            <td className={`py-2 pr-4 ${muted ? 'text-slate-500' : 'text-red-700'}`}>{showValue(c.from, c.kind)}</td>
            <td className="py-2 text-slate-400"><ArrowRight size={14} /></td>
            <td className={`py-2 ${muted ? 'text-slate-500' : 'text-green-700'}`}>{showValue(c.to, c.kind)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HistoryEntry = ({ entry }) => {
  const action = ACTIONS[entry.action] || { label: entry.action, cls: 'badge-gray' };
  const who = entry.performedBy || {};
  const [showAuto, setShowAuto] = useState(false);
  const changes = entry.changes || [];
  const own = changes.filter((c) => !c.auto);
  const auto = changes.filter((c) => c.auto);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {entry.action === 'delete' || !entry.invoiceId ? (
            <span className="font-mono text-sm font-semibold text-slate-700">{entry.invoiceNumber || '—'}</span>
          ) : (
            <Link to={`/invoices/${entry.invoiceId}`} className="font-mono text-sm font-semibold text-blue-700 hover:underline">
              {entry.invoiceNumber || 'View invoice'}
            </Link>
          )}
          {entry.invoiceType && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_CLS[entry.invoiceType] || 'bg-slate-100 text-slate-700'}`}>
              {TYPE_LABEL[entry.invoiceType] || entry.invoiceType}
            </span>
          )}
          <span className={action.cls}>{action.label}</span>
          {entry.partyName && <span className="text-sm text-slate-600 truncate">{entry.partyName}</span>}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <User size={13} /> {who.name || who.email || 'Unknown user'}
            {who.role && <span className="font-normal text-slate-500 capitalize">({roleText(who.role)})</span>}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13} /> {format(new Date(entry.createdAt), 'dd MMM yyyy, hh:mm a')}
          </span>
        </div>
      </div>

      {entry.source && <p className="px-4 pt-2 text-xs text-slate-500">Changed from: {entry.source}</p>}

      {!changes.length && <p className="px-4 py-3 text-sm text-slate-500">No field details recorded.</p>}

      {own.length > 0 && <div className="px-4 py-3"><ChangesTable changes={own} /></div>}
      {changes.length > 0 && !own.length && (
        <p className="px-4 pt-3 text-sm text-slate-500">No fields were changed by hand in this edit.</p>
      )}

      {auto.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setShowAuto((v) => !v)}
            className="text-xs font-medium text-blue-600 hover:underline"
            aria-expanded={showAuto}
          >
            {showAuto ? 'Hide' : 'Show'} {auto.length} field{auto.length === 1 ? '' : 's'} filled in automatically by the edit form
          </button>
          {showAuto && (
            <div className="mt-2 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs text-slate-500">
                These were empty on the saved invoice (the invoice screen shows them from the dealer, order or product),
                or had GST stored for the whole invoice. The form saved them as shown; the invoice total did not change because of them.
              </p>
              <ChangesTable changes={auto} muted />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InvoiceHistoryPage = () => {
  const [entries,     setEntries]     = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [page,        setPage]        = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [action,      setAction]      = useState('');
  const [invoiceType, setInvoiceType] = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  // Search waits until typing pauses
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (action) params.action = action;
    if (invoiceType) params.invoiceType = invoiceType;
    if (dateFrom) params.startDate = dateFrom;
    if (dateTo) params.endDate = dateTo;
    api.get('/invoices/history', { params })
      .then(({ data }) => {
        if (cancelled) return;
        setEntries(data.data || []);
        setPagination(data.pagination || null);
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load invoice history'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search, action, invoiceType, dateFrom, dateTo]);

  const hasFilters = searchInput || action || invoiceType || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setAction(''); setInvoiceType(''); setDateFrom(''); setDateTo(''); setPage(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History size={24} className="text-slate-500" /> Invoice History
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every change made to a sales invoice: what changed, from what to what, who changed it and when.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="history-search"
            className="input pl-9 w-full"
            placeholder="Search invoice #, customer or user..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <select id="history-action" className="input w-48" value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All changes</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select id="history-type" className="input w-40" value={invoiceType}
          onChange={(e) => { setInvoiceType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="b2b">B2B</option>
          <option value="retail">Retail</option>
          <option value="b2c">B2C</option>
        </select>

        <div className="flex items-center gap-2">
          <input id="history-from" type="date" className="input w-40" value={dateFrom} max={dateTo || undefined}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="text-slate-400 text-sm">to</span>
          <input id="history-to" type="date" className="input w-40" value={dateTo} min={dateFrom || undefined}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 underline">
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {loading && !entries.length ? (
        <div className="card p-8 text-center text-sm text-slate-500">Loading history…</div>
      ) : !entries.length && !error ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          {hasFilters
            ? 'No changes match these filters.'
            : 'No invoice changes yet. Edits made from now on will appear here.'}
        </div>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {entries.map((e) => <HistoryEntry key={e._id} entry={e} />)}
        </div>
      )}

      {pagination?.totalPages > 1 && (
        <div className="card">
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};

export default InvoiceHistoryPage;
