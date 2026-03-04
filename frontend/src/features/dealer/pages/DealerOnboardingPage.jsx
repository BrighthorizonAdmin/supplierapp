import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { formatDistanceToNow, format } from 'date-fns';
import { MapPin, Calendar, Hash, FileText, CheckCircle } from 'lucide-react';
import { fetchDealers, approveDealer, rejectDealer } from '../dealerSlice';

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Review', value: 'in-review' },
  { label: 'Approved', value: 'active' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Updates Required', value: 'updates-required' },
];

const PRICING_TIERS = [
  { value: 'standard', label: 'Tier 3 (Standard)' },
  { value: 'silver', label: 'Tier 2 (Silver)' },
  { value: 'gold', label: 'Tier 1 (Gold)' },
  { value: 'platinum', label: 'Platinum (Premium)' },
];

const MOCK_DOCS = [
  { name: 'GST Certificate', ext: 'PDF', size: '2.4 MB' },
  { name: 'Shop Establishment', ext: 'JPG', size: '1.8 MB' },
  { name: 'PAN Card Copy', ext: 'PDF', size: '1.1 MB' },
];

const getInitials = (name) =>
  name ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '??';

const timeAgo = (date) => {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return ''; }
};

const STATUS_STYLES = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'in-review': 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABELS = {
  pending: 'Pending Review',
  'in-review': 'In Review',
  active: 'Approved',
  rejected: 'Rejected',
};

const StatusPill = ({ status }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

const DealerOnboardingPage = () => {
  const dispatch = useDispatch();
  const { list, loading, pagination } = useSelector((s) => s.dealer);
  const [activeTab, setActiveTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [inReview, setInReview] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { creditLimit: 50000, pricingTier: 'standard' },
  });

  useEffect(() => {
    dispatch(fetchDealers({ status: activeTab, limit: 50 }));
    setSelected(null);
    reset({ creditLimit: 50000, pricingTier: 'standard' });
  }, [dispatch, activeTab]);

  // Auto-select first item when list loads
  useEffect(() => {
    if (!selected && list.length > 0) {
      setSelected(list[0]);
      setInReview(false);
    }
  }, [list]);

  const handleApprove = (data) => {
    if (!selected) return;
    dispatch(approveDealer({ id: selected._id, creditLimit: Number(data.creditLimit), pricingTier: data.pricingTier }))
      .then((res) => {
        if (!res.error) {
          dispatch(fetchDealers({ status: activeTab, limit: 50 }));
          setSelected(null);
          reset({ creditLimit: 50000, pricingTier: 'standard' });
        }
      });
  };

  const handleReject = () => {
    if (!selected) return;
    dispatch(rejectDealer({ id: selected._id, reason: 'Application rejected by admin' }))
      .then(() => {
        dispatch(fetchDealers({ status: activeTab, limit: 50 }));
        setSelected(null);
      });
  };

  const appId = selected?._id ? `DLR-${selected._id.slice(-4).toUpperCase()}` : '—';
  const location = [selected?.address?.city, selected?.address?.state].filter(Boolean).join(', ') || '—';

  return (
    // Break out of MainLayout's p-6 padding to fill the full area
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-6 bg-white border-b border-slate-200 flex-shrink-0">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count = isActive && pagination?.total > 0 ? pagination.total : null;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {count && (
                <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Application list */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          {/* List header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <p className="text-sm font-semibold text-slate-800">Pending Applications</p>
            {pagination?.total > 0 && (
              <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-full font-semibold">
                {pagination.total} new
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading && (
              <p className="text-center text-slate-400 text-sm py-10">Loading...</p>
            )}
            {!loading && list.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-10">No applications</p>
            )}
            {list.map((dealer) => (
              <button
                key={dealer._id}
                onClick={() => { setSelected(dealer); setInReview(false); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-l-2 ${
                  selected?._id === dealer._id
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {getInitials(dealer.ownerName || dealer.businessName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="text-sm font-semibold text-slate-800 truncate">{dealer.ownerName || '—'}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(dealer.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mb-1.5">{dealer.businessName}</p>
                  <StatusPill status={dealer.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail panel */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <form onSubmit={handleSubmit(handleApprove)}>
              <div className="p-6 space-y-5">

                {/* Header row */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">{selected.businessName}</h2>
                  <div className="flex items-center gap-3">
                    <StatusPill status={selected.status} />
                    {/* In-Review toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-slate-500">In-Review</span>
                      <div
                        role="switch"
                        aria-checked={inReview}
                        onClick={() => setInReview((v) => !v)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${inReview ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${inReview ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-6 text-sm text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-slate-400" />
                    {location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    Applied {selected.createdAt ? format(new Date(selected.createdAt), 'MMM d, yyyy') : '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Hash size={14} className="text-slate-400" />
                    App ID: {appId}
                  </span>
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Primary Contact</p>
                      <p className="text-sm font-semibold text-slate-800">{selected.ownerName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Email Address</p>
                      <p className="text-sm font-semibold text-slate-800">{selected.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Phone Number</p>
                      <p className="text-sm font-semibold text-slate-800">{selected.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">GST Number</p>
                      <p className="text-sm font-semibold text-slate-800">{selected.gstNumber || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Documents</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {MOCK_DOCS.map((doc) => (
                      <button
                        key={doc.name}
                        type="button"
                        className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
                      >
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FileText size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">{doc.name}</p>
                          <p className="text-xs text-slate-400">{doc.ext} • {doc.size}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approval Actions */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Approval Actions</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Assign Credit Limits(₹)</label>
                      <input
                        type="number"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        {...register('creditLimit')}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Pricing Tier</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        {...register('pricingTier')}
                      >
                        {PRICING_TIERS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReject}
                      className="px-5 py-2 border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Reject Application
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Request Changes
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={15} />
                      Approve Dealer
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button type="button" className="text-xs text-blue-600 hover:underline">Role - based access</button>
              <span className="text-slate-300">·</span>
              <button type="button" className="text-xs text-blue-600 hover:underline">Supplier's View</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
            {loading ? 'Loading...' : 'Select an application to review'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerOnboardingPage;
