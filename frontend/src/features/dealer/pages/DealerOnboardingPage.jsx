import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { formatDistanceToNow, format } from 'date-fns';
import { MapPin, Calendar, Hash, FileText, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { fetchDealers, approveDealer, rejectDealer } from '../dealerSlice';
import Modal from '../../../components/ui/Modal';

const STATUS_TABS = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Review', value: 'in-review' },
  { label: 'Approved', value: 'active' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Updates Required', value: 'updates-required' },
];

const PRICING_TIERS = [
  { value: 'standard', label: 'Standard Wholesale' },
  { value: 'silver', label: 'Silver Wholesale' },
  { value: 'gold', label: 'Gold Wholesale' },
  { value: 'platinum', label: 'Platinum Wholesale' },
];

const PAYMENT_TERMS = [
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
  'Net 90 Days',
  'Immediate Payment',
];

const UPDATE_FIELDS = [
  'GST Certificate',
  'PAN Card Copy',
  'Shop Establishment Certificate',
  'Bank Details',
  'Business Address',
  'Owner Identity Proof',
  'Other',
];

const REJECTION_REASONS = [
  'Incomplete Documentation',
  'Invalid GST Number',
  'Duplicate Application',
  'Failed Verification',
  'Business Address Mismatch',
  'Other',
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

const StatusBadgeOutline = ({ status }) => (
  <span className={`text-sm px-4 py-1.5 rounded-lg font-medium border ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

const SelectField = ({ value, onChange, placeholder, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

const DealerOnboardingPage = () => {
  const dispatch = useDispatch();
  const { list, loading, pagination } = useSelector((s) => s.dealer);

  const [activeTab, setActiveTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [inReview, setInReview] = useState(false);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  // Request update modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestField, setRequestField] = useState('');
  const [requestInstructions, setRequestInstructions] = useState('');

  // Approve modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveForm, setApproveForm] = useState({
    creditLimit: 2500000,
    paymentTerms: '',
    pricingTier: '',
    assignedManager: '',
  });

  useEffect(() => {
    dispatch(fetchDealers({ status: activeTab, limit: 50 }));
    setSelected(null);
  }, [dispatch, activeTab]);

  useEffect(() => {
    if (!selected && list.length > 0) {
      setSelected(list[0]);
      setInReview(false);
    }
  }, [list]);

  const resetAndClose = (setter) => {
    setter(false);
  };

  const handleConfirmApprove = () => {
    if (!selected) return;
    dispatch(approveDealer({
      id: selected._id,
      creditLimit: Number(approveForm.creditLimit),
      pricingTier: approveForm.pricingTier || 'standard',
      paymentTerms: approveForm.paymentTerms,
      assignedManager: approveForm.assignedManager,
    })).then((res) => {
      if (!res.error) {
        dispatch(fetchDealers({ status: activeTab, limit: 50 }));
        setSelected(null);
        setShowApproveModal(false);
        setApproveForm({ creditLimit: 2500000, paymentTerms: '', pricingTier: '', assignedManager: '' });
      }
    });
  };

  const handleConfirmReject = () => {
    if (!selected) return;
    const reason = rejectComment
      ? `${rejectReason}: ${rejectComment}`
      : rejectReason || 'Application rejected by admin';
    dispatch(rejectDealer({ id: selected._id, reason }))
      .then(() => {
        dispatch(fetchDealers({ status: activeTab, limit: 50 }));
        setSelected(null);
        setShowRejectModal(false);
        setRejectReason('');
        setRejectComment('');
      });
  };

  const handleSendRequest = () => {
    if (!selected || !requestField) return;
    // TODO: wire to API when backend endpoint is available
    setShowRequestModal(false);
    setRequestField('');
    setRequestInstructions('');
  };

  const appId = selected?._id ? `DLR-${selected._id.slice(-4).toUpperCase()}` : '—';
  const location = [selected?.address?.city, selected?.address?.state].filter(Boolean).join(', ') || '—';

  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* Page header: title + pill tabs */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Dealer Onboarding</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review pending applications and manage new dealer approvals.</p>
        </div>
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const count = isActive && pagination?.total > 0 ? pagination.total : null;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border border-blue-600 text-blue-600 bg-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {count && <span className="ml-0.5">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Application list */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <p className="text-sm font-semibold text-slate-800">Pending Applications</p>
            {pagination?.total > 0 && (
              <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-full font-semibold">
                {pagination.total} new
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading && <p className="text-center text-slate-400 text-sm py-10">Loading...</p>}
            {!loading && list.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-10">No applications</p>
            )}
            {list.map((dealer) => (
              <button
                key={dealer._id}
                onClick={() => { setSelected(dealer); setInReview(false); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-l-2 ${
                  selected?._id === dealer._id ? 'border-blue-600 bg-blue-50/50' : 'border-transparent'
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
            <div className="p-6 space-y-5">

              {/* Header row */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">{selected.businessName}</h2>
                <div className="flex items-center gap-3">
                  <StatusBadgeOutline status={selected.status} />
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
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="px-5 py-2 border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(true)}
                    className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApproveModal(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={15} />
                    Approve Dealer
                  </button>
                </div>
              </div>
            </div>

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

      {/* ── Reject Application Modal ── */}
      <Modal isOpen={showRejectModal} onClose={() => resetAndClose(setShowRejectModal)} title="Reject Application">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 mb-5">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">This Action cannot be undone</p>
            <p className="text-xs text-red-600 mt-0.5">
              The applicant will be notified immediately. They will need to re-apply if they wish to join the platform again.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">Reason for Rejection</label>
          <SelectField
            value={rejectReason}
            onChange={setRejectReason}
            placeholder="Select a reason..."
            options={REJECTION_REASONS}
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">Additional Comments (Optional)</label>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Add specific details..."
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectComment(''); }}
            className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmReject}
            className="px-5 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800 transition-colors"
          >
            Reject Application
          </button>
        </div>
      </Modal>

      {/* ── Request Application Update Modal ── */}
      <Modal isOpen={showRequestModal} onClose={() => resetAndClose(setShowRequestModal)} title="Request Application Update">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 mb-5">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Action Required by Applicant</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The Application will move to "Updates Required". The applicant will be notified to correct specific details.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">What need to be updated?</label>
          <SelectField
            value={requestField}
            onChange={setRequestField}
            placeholder="Select a Selection..."
            options={UPDATE_FIELDS}
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">Instructions for Applicant</label>
          <textarea
            value={requestInstructions}
            onChange={(e) => setRequestInstructions(e.target.value)}
            placeholder="E.g., Please upload a clear photo of your PAN card. The current one is blurry..."
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => { setShowRequestModal(false); setRequestField(''); setRequestInstructions(''); }}
            className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSendRequest}
            className="px-5 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800 transition-colors"
          >
            Send Request
          </button>
        </div>
      </Modal>

      {/* ── Approve Application Modal ── */}
      <Modal isOpen={showApproveModal} onClose={() => resetAndClose(setShowApproveModal)} title="Approve Application">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 mb-5">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700">Dealer Activation</p>
            <p className="text-xs text-green-700 mt-0.5">
              Approving this application will create an active dealer account. The user will receive login credentials via email.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Credit Limit (INR)</label>
            <input
              type="number"
              value={approveForm.creditLimit}
              onChange={(e) => setApproveForm((f) => ({ ...f, creditLimit: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Payment Terms</label>
            <SelectField
              value={approveForm.paymentTerms}
              onChange={(v) => setApproveForm((f) => ({ ...f, paymentTerms: v }))}
              placeholder="Net 45 Days"
              options={PAYMENT_TERMS}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">Pricing Tier</label>
          <SelectField
            value={approveForm.pricingTier}
            onChange={(v) => setApproveForm((f) => ({ ...f, pricingTier: v }))}
            placeholder="Standard Wholesale"
            options={PRICING_TIERS}
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-semibold text-slate-800 mb-2 block">Assigned Manager</label>
          <SelectField
            value={approveForm.assignedManager}
            onChange={(v) => setApproveForm((f) => ({ ...f, assignedManager: v }))}
            placeholder="Select a Selection..."
            options={[]}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setShowApproveModal(false)}
            className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmApprove}
            className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Confirm approval
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default DealerOnboardingPage;
