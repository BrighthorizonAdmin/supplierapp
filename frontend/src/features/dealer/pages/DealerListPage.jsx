import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Download, Eye, MoreVertical,
  TrendingUp, CheckCircle, Clock, AlertTriangle,
  MapPin, ChevronDown, Store, X,
} from 'lucide-react';
import { fetchDealers, approveDealer, rejectDealer, suspendDealer } from '../dealerSlice';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import api from '../../../services/api';
import { format } from 'date-fns';

// ─── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',       label: 'All Dealers',       status: '' },
  { id: 'active',    label: 'Active Dealers',     status: 'active' },
  { id: 'suspended', label: 'Suspended Dealers',  status: 'suspended' },
  { id: 'new',       label: 'New Applications',   status: 'pending' },
];

// ─── Status chip ───────────────────────────────────────────────────────────────
const STATUS_CLS = {
  active:    'badge-green',
  pending:   'badge-yellow',
  suspended: 'badge-red',
  rejected:  'badge-red',
};
const STATUS_LABEL = {
  active: 'Active', pending: 'Pending', suspended: 'Suspended', rejected: 'Rejected',
};
const StatusChip = ({ status }) => {
  const key = status?.toLowerCase();
  return (
    <span className={STATUS_CLS[key] || 'badge-gray'}>
      {STATUS_LABEL[key] || status}
    </span>
  );
};

// ─── Stats card ────────────────────────────────────────────────────────────────
const StatsCard = ({ label, value, icon: Icon, cardCls, iconCls, valueCls }) => (
  <div className={`card p-4 flex items-center gap-4 ${cardCls}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className={`text-2xl font-bold leading-tight ${valueCls}`}>{value ?? '—'}</p>
      <p className="text-xs font-medium mt-0.5 text-slate-500 leading-tight">{label}</p>
    </div>
  </div>
);

// ─── Per-row action menu ───────────────────────────────────────────────────────
const RowActions = ({ row, onView, onApprove, onReject, onSuspend }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="flex items-center gap-1" ref={ref}>
      <button
        onClick={() => onView(row)}
        title="View details"
        className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-colors"
      >
        <Eye size={15} />
      </button>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <MoreVertical size={15} />
        </button>
        {open && (
          <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden py-1">
            <button
              onClick={() => { setOpen(false); onView(row); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View Details
            </button>
            {row.status === 'pending' && <>
              <button
                onClick={() => { setOpen(false); onApprove(row); }}
                className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => { setOpen(false); onReject(row); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Reject
              </button>
            </>}
            {row.status === 'active' && (
              <button
                onClick={() => { setOpen(false); onSuspend(row); }}
                className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Suspend
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────
const DealerListPage = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { list, pagination, loading } = useSelector((s) => s.dealer);

  const [activeTab,    setActiveTab]    = useState('all');
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [bizType,      setBizType]      = useState('');
  const [selected,     setSelected]     = useState(new Set());
  const [approvalModal,setApprovalModal]= useState(null);
  const [rejectModal,  setRejectModal]  = useState(null);
  const [counts, setCounts] = useState({ total: 0, active: 0, pending: 0, suspended: 0 });

  const { register, handleSubmit, reset } = useForm();
  const tabStatus = TABS.find((t) => t.id === activeTab)?.status ?? '';

  // Fetch list
  useEffect(() => {
    const params = { page, limit: 20 };
    if (tabStatus)  params.status       = tabStatus;
    if (search)     params.search       = search;
    if (bizType)    params.businessType = bizType;
    dispatch(fetchDealers(params));
    setSelected(new Set());
  }, [dispatch, activeTab, page, search, bizType]);

  // Fetch aggregate counts (limit:1 → just reads pagination.total)
  useEffect(() => {
    Promise.all([
      api.get('/dealers', { params: { limit: 1 } }),
      api.get('/dealers', { params: { limit: 1, status: 'active' } }),
      api.get('/dealers', { params: { limit: 1, status: 'pending' } }),
      api.get('/dealers', { params: { limit: 1, status: 'suspended' } }),
    ]).then(([tot, act, pnd, sus]) => {
      setCounts({
        total:     tot.data.pagination?.total ?? 0,
        active:    act.data.pagination?.total ?? 0,
        pending:   pnd.data.pagination?.total ?? 0,
        suspended: sus.data.pagination?.total ?? 0,
      });
    }).catch(() => {});
  }, []);

  // Approve handler
  const handleApprove = (data) => {
    dispatch(approveDealer({ id: approvalModal._id, ...data })).then(() => {
      setApprovalModal(null);
      reset();
    });
  };

  // Reject handler
  const handleReject = (data) => {
    dispatch(rejectDealer({ id: rejectModal._id, reason: data.reason })).then(() => {
      setRejectModal(null);
      reset();
    });
  };

  // Bulk selection
  const allIds       = list.map((d) => d._id);
  const allSelected  = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const fmt = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;

  const handleExport = async () => {
    try {
      const res = await api.get('/dealers', { params: { limit: 10000 } });
      const dealers = res.data.data || [];
      const headers = ['Dealer Code', 'Business Name', 'Owner', 'Email', 'Phone', 'City', 'State', 'Credit Limit', 'Status'];
      const rows = dealers.map((d) => [
        d.dealerCode || '',
        d.businessName || '',
        d.ownerName || '',
        d.email || '',
        d.phone || '',
        d.address?.city || '',
        d.address?.state || '',
        d.creditLimit || 0,
        d.status || '',
      ]);
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dealers-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Export failed', err); }
  };

  return (
    <div className="space-y-5">

      {/* ── Page title ── */}
      <h1 className="text-2xl font-bold text-slate-900">Dealer Management</h1>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Dealers"
          value={counts.total}
          icon={TrendingUp}
          cardCls=""
          iconCls="bg-primary-100 text-primary-600"
          valueCls="text-slate-900"
        />
        <StatsCard
          label="Active Dealers"
          value={counts.active}
          icon={CheckCircle}
          cardCls="bg-green-50 border-green-100"
          iconCls="bg-green-600 text-white"
          valueCls="text-green-700"
        />
        <StatsCard
          label="Pending Applications"
          value={counts.pending}
          icon={Clock}
          cardCls="bg-amber-50 border-amber-100"
          iconCls="bg-amber-100 text-amber-600"
          valueCls="text-amber-700"
        />
        <StatsCard
          label="Suspended Dealers"
          value={counts.suspended}
          icon={AlertTriangle}
          cardCls="bg-red-50 border-red-100"
          iconCls="bg-red-100 text-red-600"
          valueCls="text-red-700"
        />
      </div>

      {/* ── Table card ── */}
      <div className="card overflow-hidden">

        {/* Tabs */}
        <div className="flex items-center border-b border-slate-200 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); setSearch(''); setBizType(''); }}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Filter size={13} />
            Filters
            <ChevronDown size={13} className={`transition-transform duration-150 ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID or contact..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-8 py-1.5 text-sm"
            />
          </div>

          <div className="flex-1" />

          <button
            title="Export dealers to CSV"
            onClick={handleExport}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Download size={14} />
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {showFilters && (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
            <select
              value={bizType}
              onChange={(e) => { setBizType(e.target.value); setPage(1); }}
              className="input w-44 py-1.5 text-sm"
            >
              <option value="">All Business Types</option>
              <option value="retailer">Retailer</option>
              <option value="wholesaler">Wholesaler</option>
              <option value="distributor">Distributor</option>
            </select>
            {bizType && (
              <button
                onClick={() => setBizType('')}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X size={11} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 border-b border-primary-100">
            <span className="text-sm font-medium text-primary-700">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-primary-600 hover:underline"
            >
              Clear
            </button>
          </div>
        )}

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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Dealer ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Dealer Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Location</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Contact</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Credit limit</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                      No dealers found
                    </td>
                  </tr>
                ) : list.map((dealer) => (
                  <tr
                    key={dealer._id}
                    className={`transition-colors hover:bg-slate-50 ${selected.has(dealer._id) ? 'bg-primary-50/60' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(dealer._id)}
                        onChange={() => toggleRow(dealer._id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                    </td>

                    {/* Dealer ID */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        {dealer.dealerCode || '—'}
                      </span>
                    </td>

                    {/* Dealer Name */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => navigate(`/dealers/${dealer._id}`)}
                        className="flex items-start gap-2.5 text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Store size={14} className="text-primary-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-primary-600 group-hover:underline leading-snug">
                            {dealer.businessName}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                            {dealer.address?.street || dealer.ownerName || '—'}
                          </p>
                        </div>
                      </button>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-slate-700 leading-snug">
                            {[dealer.address?.city, dealer.address?.state].filter(Boolean).join(', ') || '—'}
                          </p>
                          {dealer.address?.pincode && (
                            <p className="text-xs text-slate-400 mt-0.5">{dealer.address.pincode}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-700 leading-snug">{dealer.email || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{dealer.phone || ''}</p>
                    </td>

                    {/* Credit Limit */}
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {fmt(dealer.creditLimit)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusChip status={dealer.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <RowActions
                        row={dealer}
                        onView={(d) => navigate(`/dealers/${d._id}`)}
                        onApprove={(d) => setApprovalModal(d)}
                        onReject={(d) => setRejectModal(d)}
                        onSuspend={(d) => dispatch(suspendDealer({ id: d._id, reason: 'Administrative action' }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* ── Approve modal ── */}
      <Modal
        isOpen={!!approvalModal}
        onClose={() => { setApprovalModal(null); reset(); }}
        title={`Approve ${approvalModal?.businessName}`}
      >
        <form onSubmit={handleSubmit(handleApprove)} className="space-y-4">
          <div>
            <label className="label">Credit Limit (₹)</label>
            <input type="number" className="input" defaultValue={100000} min={0}
              {...register('creditLimit', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Pricing Tier</label>
            <select className="input" {...register('pricingTier')}>
              <option value="standard">Standard</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => { setApprovalModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Approve Dealer</button>
          </div>
        </form>
      </Modal>

      {/* ── Reject modal ── */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => { setRejectModal(null); reset(); }}
        title={`Reject ${rejectModal?.businessName}`}
      >
        <form onSubmit={handleSubmit(handleReject)} className="space-y-4">
          <div>
            <label className="label">Rejection Reason</label>
            <textarea className="input" rows={3} {...register('reason', { required: true })} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => { setRejectModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-danger">Reject Dealer</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DealerListPage;
