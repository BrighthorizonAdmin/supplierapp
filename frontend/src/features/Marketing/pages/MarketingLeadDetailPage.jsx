import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';
import { MapPin, User, Phone, ChevronDown, X, CheckCircle } from 'lucide-react';
import {
  fetchLeadById, logCall, requestDocuments, updateLead, advancePipeline,
  clearCreatedSuccess,
} from '../marketingSlice';
import Modal from '../../../components/ui/Modal';

const CALL_OUTCOMES = [
  { value: 'interested', label: 'Interested – Requesting details' },
  { value: 'not-interested', label: 'Not Interested' },
  { value: 'callback', label: 'Call Back Requested' },
  { value: 'no-answer', label: 'No Answer' },
  { value: 'form-sent', label: 'Form / Catalogue Sent' },
  { value: 'other', label: 'Other' },
];

const PIPELINE_STAGES = [
  { key: 'lead-creation', label: 'Lead Creation', desc: 'Current Step.' },
  { key: 'document-collection', label: 'Document Collection', desc: 'Pending KYC Upload.' },
  { key: 'admin-review', label: 'Admin Review', desc: "The supplier's onboarding team / Admin is reviewing dealer's profile and documents." },
  { key: 'approval', label: 'Approval', desc: 'Final approval and account activation.' },
];

const STAGE_ORDER = ['lead-creation', 'document-collection', 'admin-review', 'approval'];

const KYC_BADGE_STYLES = {
  'pending-kyc': 'bg-yellow-50 border-yellow-300 text-yellow-700',
  'kyc-submitted': 'bg-blue-50 border-blue-300 text-blue-700',
  'kyc-verified': 'bg-green-50 border-green-300 text-green-700',
  'kyc-rejected': 'bg-red-50 border-red-300 text-red-700',
  'not-interested': 'bg-red-50 border-red-300 text-red-700',
};

const KYC_LABELS = {
  'pending-kyc': 'Pending KYC',
  'kyc-submitted': 'KYC Submitted',
  'kyc-verified': 'KYC Verified',
  'kyc-rejected': 'KYC Rejected',
  'not-interested': 'Not Interested',
};

const OUTCOME_LABEL = {
  interested: 'Interested – Requesting details',
  'not-interested': 'Not Interested',
  callback: 'Call Back Requested',
  'no-answer': 'No Answer',
  'form-sent': 'Form / Catalogue Sent',
  'requesting-details': 'Requesting Details',
  other: 'Other',
};

const OUTCOME_ICON = {
  interested: '📞',
  'not-interested': '📞',
  callback: '📞',
  'no-answer': '📞',
  'form-sent': '📄',
  'requesting-details': '📞',
  other: '📞',
};

const SelectField = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
  </div>
);

const MarketingLeadDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected, loading, createdLeadSuccess } = useSelector((s) => s.marketing);

  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [callSaving, setCallSaving] = useState(false);

  const [callForm, setCallForm] = useState({ outcome: '', notes: '', followUpDate: '' });
  const [editForm, setEditForm] = useState({ primaryContact: '', email: '', phone: '', leadSource: '', street: '' });

  const [panelOutcome, setPanelOutcome] = useState('');
  const [panelNotes, setPanelNotes] = useState('');
  const [panelFollowUp, setPanelFollowUp] = useState('');
  const [panelSaving, setPanelSaving] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchLeadById(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (createdLeadSuccess && selected && createdLeadSuccess._id === selected._id) {
      setShowSuccessBanner(true);
      dispatch(clearCreatedSuccess());
    }
  }, [createdLeadSuccess, selected, dispatch]);

  useEffect(() => {
    if (selected) {
      setPanelOutcome(selected.initialCallOutcome || '');
      setPanelNotes(selected.initialCallNotes || '');
      setPanelFollowUp(
        selected.nextFollowUpDate
          ? format(new Date(selected.nextFollowUpDate), 'yyyy-MM-dd')
          : ''
      );
      setEditForm({
        primaryContact: selected.primaryContact || '',
        email: selected.email || '',
        phone: selected.phone || '',
        leadSource: selected.leadSource || '',
        street: selected.address?.street || '',
      });
    }
  }, [selected]);

  const handleRequestDocuments = () => { dispatch(requestDocuments(id)); };

  const handlePanelSave = async () => {
    if (!panelOutcome) return;
    setPanelSaving(true);
    await dispatch(logCall({ id, outcome: panelOutcome, notes: panelNotes, followUpDate: panelFollowUp || undefined }));
    setPanelSaving(false);
  };

  const handleLogCallSubmit = async () => {
    if (!callForm.outcome) return;
    setCallSaving(true);
    await dispatch(logCall({ id, outcome: callForm.outcome, notes: callForm.notes, followUpDate: callForm.followUpDate || undefined }));
    setCallSaving(false);
    setShowLogCallModal(false);
    setCallForm({ outcome: '', notes: '', followUpDate: '' });
  };

  const handleEditSave = async () => {
    await dispatch(updateLead({
      id,
      primaryContact: editForm.primaryContact,
      email: editForm.email,
      phone: editForm.phone,
      leadSource: editForm.leadSource,
      address: { ...selected?.address, street: editForm.street },
    }));
    setShowEditModal(false);
  };

  const handleAdvance = () => dispatch(advancePipeline(id));

  if (loading && !selected) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading lead details...
      </div>
    );
  }

  if (!selected) return null;

  const location = [selected.address?.district, selected.address?.state].filter(Boolean).join(', ') || '—';
  const currentStageIdx = STAGE_ORDER.indexOf(selected.pipelineStage);
  const kycLabel = KYC_LABELS[selected.kycStatus] || selected.kycStatus;
  const kycStyle = KYC_BADGE_STYLES[selected.kycStatus] || 'bg-slate-50 border-slate-200 text-slate-600';
  const fullAddress = [
    selected.address?.street,
    selected.address?.district,
    selected.address?.state,
    selected.address?.country,
  ].filter(Boolean).join(', ');

  const isNotInterested = selected.status === 'not-interested' || panelOutcome === 'not-interested';

  return (
    <div className="min-h-screen bg-white">

      {/* Success banner */}
      {showSuccessBanner && (
        <div className="flex items-center gap-3 px-6 py-3 bg-green-50 border-b border-green-200 text-green-700 text-sm font-medium">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <span>
            Lead &ldquo;<strong>{selected.businessName}</strong>&rdquo; has been successfully created and added to the pipeline.
          </span>
          <button onClick={() => setShowSuccessBanner(false)} className="ml-auto text-green-500 hover:text-green-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sub-header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${kycStyle}`}>{kycLabel}</span>
              {isNotInterested && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded border bg-red-50 border-red-300 text-red-700">
                  Not Interested
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{selected.businessName}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                {selected.primaryContact}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                {location}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/marketing-leads')}
              className="text-xs px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
            >
              Back
            </button>
            {!isNotInterested && (
              <button
                onClick={handleRequestDocuments}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 2h7l3 3v9H3V2z" /><path d="M10 2v3h3" />
                </svg>
                Request Documents
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main two-column body */}
      <div className="px-6 py-5 grid grid-cols-3 gap-6">

        {/* LEFT col */}
        <div className="col-span-2 space-y-5">

          {/* Lead Details card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Lead Details</h2>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Primary Contact</p>
                <p className="text-sm font-semibold text-slate-800">{selected.primaryContact || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Email Address</p>
                <p className="text-sm font-semibold text-slate-800">{selected.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Phone Number</p>
                <p className="text-sm font-semibold text-slate-800">
                  {selected.phone ? `+${selected.phone.replace(/^\+/, '')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Lead Source</p>
                <p className="text-sm font-semibold text-slate-800 capitalize">
                  {selected.leadSource?.replace(/-/g, ' ') || '—'}
                </p>
              </div>
              {fullAddress && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Address</p>
                  <p className="text-sm font-semibold text-slate-800">{fullAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity & Call Logs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4">Activity & Call Logs</h2>
            {selected.callLogs && selected.callLogs.length > 0 ? (
              <div className="space-y-4">
                {[...selected.callLogs].reverse().map((log) => {
                  const isCallEntry = log.outcome !== 'other' || (log.notes && log.notes.includes('Call'));
                  const isLeadCreation = log.notes?.toLowerCase().includes('lead added') || log.notes?.toLowerCase().includes('lead created');
                  return (
                    <div key={log._id} className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {isLeadCreation ? (
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                            <User size={13} className="text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                            {OUTCOME_ICON[log.outcome] || '📞'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800">
                            {isLeadCreation
                              ? 'Lead Created'
                              : `Initial Contact Call – ${OUTCOME_LABEL[log.outcome] || log.outcome}`}
                          </p>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {log.loggedAt ? format(new Date(log.loggedAt), 'MMM d, h:mm a') : '—'}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{log.notes}</p>
                        )}
                        {log.followUpDate && (
                          <p className="text-xs text-blue-600 mt-0.5">
                            Follow-up scheduled for {format(new Date(log.followUpDate), 'MMM d, yyyy')}.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No activity yet</p>
            )}
          </div>
        </div>

        {/* RIGHT col */}
        <div className="space-y-5">

          {/* Initial Call Log panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Initial Call Log</h2>
              <button
                onClick={handlePanelSave}
                disabled={!panelOutcome || panelSaving}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium disabled:opacity-40 transition-colors"
              >
                {panelSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Call Outcome</label>
                <SelectField
                  value={panelOutcome}
                  onChange={setPanelOutcome}
                  options={CALL_OUTCOMES}
                  placeholder="Select outcome..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes / Remarks</label>
                <textarea
                  rows={4}
                  value={panelNotes}
                  onChange={(e) => setPanelNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Add call notes..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Next Follow-up Date</label>
                <input
                  type="date"
                  value={panelFollowUp}
                  onChange={(e) => setPanelFollowUp(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ✅ Onboarding Pipeline — disabled with overlay when not interested */}
          <div className={`bg-white border rounded-xl p-5 relative ${isNotInterested ? 'border-red-200' : 'border-slate-200'}`}>
            <h2 className="text-sm font-bold text-slate-800 mb-4">Onboarding Pipeline</h2>

            {/* Not Interested overlay */}
            {isNotInterested && (
              <div className="absolute inset-0 rounded-xl bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 gap-2">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                  <X size={18} className="text-red-500" />
                </div>
                <p className="text-sm font-semibold text-red-600">Pipeline Disabled</p>
                <p className="text-xs text-slate-500 text-center px-4">
                  Lead marked as Not Interested. Onboarding pipeline is inactive.
                </p>
              </div>
            )}

            {/* Stages — faded and non-interactive when not interested */}
            <div className={`space-y-4 ${isNotInterested ? 'opacity-30 pointer-events-none select-none' : ''}`}>
              {PIPELINE_STAGES.map((stage, idx) => {
                const isDone = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                const isPending = idx > currentStageIdx;
                const isBlocked = stage.key === 'document-collection' && isCurrent && selected.kycStatus === 'pending-kyc';

                return (
                  <div key={stage.key} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {isDone ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : isBlocked ? (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold leading-none">!</span>
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isPending ? 'text-slate-400' : 'text-slate-800'}`}>
                        {stage.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}

              {currentStageIdx < PIPELINE_STAGES.length - 1 && (
                <button
                  onClick={handleAdvance}
                  className="mt-4 w-full py-2 border border-blue-300 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Advance to next stage →
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Log Call Modal */}
      <Modal isOpen={showLogCallModal} onClose={() => setShowLogCallModal(false)} title="Log Call">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Call Outcome *</label>
            <SelectField
              value={callForm.outcome}
              onChange={(v) => setCallForm((f) => ({ ...f, outcome: v }))}
              options={CALL_OUTCOMES}
              placeholder="Select outcome..."
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Notes / Remarks</label>
            <textarea
              rows={4}
              value={callForm.notes}
              onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Add notes from this call..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Next Follow-up Date</label>
            <input
              type="date"
              value={callForm.followUpDate}
              onChange={(e) => setCallForm((f) => ({ ...f, followUpDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowLogCallModal(false)}
              className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogCallSubmit}
              disabled={!callForm.outcome || callSaving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {callSaving ? 'Logging...' : 'Log Call'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Lead Details">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Primary Contact</label>
            <input
              type="text"
              value={editForm.primaryContact}
              onChange={(e) => setEditForm((f) => ({ ...f, primaryContact: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-800 mb-2 block">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800 mb-2 block">Phone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800 mb-2 block">Street Address</label>
            <input
              type="text"
              value={editForm.street}
              onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setShowEditModal(false)} className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleEditSave} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Save Changes</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MarketingLeadDetailPage;