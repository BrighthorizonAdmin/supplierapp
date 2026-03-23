import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createLead } from '../marketingSlice';
import { ChevronDown } from 'lucide-react';

const LEAD_SOURCES = [
  { value: 'justdial', label: 'JustDial / External List' },
  { value: 'referral', label: 'Referral' },
  { value: 'trade-fair', label: 'Trade Fair' },
  { value: 'cold-call', label: 'Cold Call' },
  { value: 'online-enquiry', label: 'Online Enquiry' },
  { value: 'field-visit', label: 'Field Visit' },
  { value: 'other', label: 'Other' },
];

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
  { key: 'document-collection', label: 'Document Collection', desc: 'First approval and account activation.' },
  { key: 'admin-review', label: 'Under Review', desc: "The supplier's onboarding team is reviewing your profile and documents." },
  { key: 'approval', label: 'Approval', desc: 'Final approval and account activation.' },
];

const SelectField = ({ value, onChange, options, placeholder, id }) => (
  <div className="relative">
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
  </div>
);

const InputField = ({ label, id, type = 'text', placeholder, value, onChange, required }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-slate-500 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const AddMarketingLeadPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { submitting } = useSelector((s) => s.marketing);

  const [form, setForm] = useState({
    businessName: '',
    primaryContact: '',
    email: '',
    phone: '',
    leadSource: '',
    street: '',
    district: '',
    state: '',
    pincode: '',
    country: 'India',
    initialCallOutcome: '',
    initialCallNotes: '',
    nextFollowUpDate: '',
  });

  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.businessName.trim() || !form.primaryContact.trim() || !form.phone.trim()) {
      return;
    }
    const payload = {
      businessName: form.businessName,
      primaryContact: form.primaryContact,
      email: form.email,
      phone: form.phone,
      leadSource: form.leadSource || 'other',
      address: {
        street: form.street,
        district: form.district,
        state: form.state,
        pincode: form.pincode,
        country: form.country,
      },
      initialCallOutcome: form.initialCallOutcome || undefined,
      initialCallNotes: form.initialCallNotes,
      nextFollowUpDate: form.nextFollowUpDate || undefined,
    };

    const result = await dispatch(createLead(payload));
    if (!result.error) {
      navigate('/marketing-leads');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Add New Dealer Lead</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Capture dealer details from external sources, log call information and push to onboarding page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/marketing-leads')}
            className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.businessName.trim() || !form.primaryContact.trim() || !form.phone.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Lead & Continue'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">

        {/* LEFT: Business + Location */}
        <div className="col-span-2 space-y-6">

          {/* Business Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Business Information</h2>
            <div className="space-y-4">
              <InputField
                label="Business Name"
                id="businessName"
                placeholder="Enter Name"
                value={form.businessName}
                onChange={setField('businessName')}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Primary Contact"
                  id="primaryContact"
                  placeholder="Enter Name"
                  value={form.primaryContact}
                  onChange={setField('primaryContact')}
                  required
                />
                <InputField
                  label="Email Address"
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={form.email}
                  onChange={setField('email')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Phone Number"
                  id="phone"
                  type="tel"
                  placeholder="Enter Number"
                  value={form.phone}
                  onChange={setField('phone')}
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Lead Source</label>
                  <SelectField
                    id="leadSource"
                    value={form.leadSource}
                    onChange={setField('leadSource')}
                    options={LEAD_SOURCES}
                    placeholder="JustDial / External List"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Location Details</h2>
            <div className="space-y-4">
              <InputField
                label="Street Address"
                id="street"
                placeholder="Enter Name"
                value={form.street}
                onChange={setField('street')}
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="City / District"
                  id="district"
                  placeholder="Enter Name"
                  value={form.district}
                  onChange={setField('district')}
                />
                <InputField
                  label="State"
                  id="state"
                  placeholder="Enter email address"
                  value={form.state}
                  onChange={setField('state')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Pincode"
                  id="pincode"
                  placeholder="Enter Number"
                  value={form.pincode}
                  onChange={setField('pincode')}
                />
                <InputField
                  label="Country"
                  id="country"
                  placeholder="Enter GSTIN0"
                  value={form.country}
                  onChange={setField('country')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Initial Call Log + Pipeline */}
        <div className="space-y-6">

          {/* Initial Call Log */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Initial Call Log</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Call Outcome</label>
                <SelectField
                  value={form.initialCallOutcome}
                  onChange={setField('initialCallOutcome')}
                  options={CALL_OUTCOMES}
                  placeholder="Select outcome..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes / Remarks</label>
                <textarea
                  rows={4}
                  placeholder="Add notes from the call..."
                  value={form.initialCallNotes}
                  onChange={(e) => setField('initialCallNotes')(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Next Follow-up Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.nextFollowUpDate}
                    onChange={(e) => setField('nextFollowUpDate')(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Onboarding Pipeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5">Onboarding Pipeline</h2>
            <div className="space-y-4">
              {PIPELINE_STAGES.map((stage, idx) => (
                <div key={stage.key} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {idx === 0 ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${idx === 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{stage.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMarketingLeadPage;