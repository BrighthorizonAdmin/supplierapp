import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createDealer } from '../dealerSlice';
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
// Validation Helper Functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

const isValidGST = (gst) => {
 
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
};

const isValidPincode = (pincode) => {
  const pincodeRegex = /^[0-9]{6}$/;
  return pincodeRegex.test(pincode.replace(/\D/g, ''));
};

const validateForm = (form, docs) => {
  const errors = {};

  if (!form.businessName?.trim()) {
    errors.businessName = 'Business name is required';
  }

  if (!form.name?.trim()) {
    errors.name = 'Contact name is required';
  }

  if (!form.email?.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(form.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!form.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(form.phone)) {
    errors.phone = 'Please enter a valid 10-digit phone number';
  }

  if (form.creditLimit === '' || form.creditLimit === null || form.creditLimit === undefined) {
    errors.creditLimit = 'Credit limit is required';
  } else if (Number.isNaN(Number(form.creditLimit))) {
    errors.creditLimit = 'Credit limit must be a number';
  } else if(Number(form.creditLimit) > 2000) {
    errors.creditLimit = 'Credit limit cannot exceed ₹2,000';
  }
  else if (Number(form.creditLimit) < 0) {
    errors.creditLimit = 'Credit limit cannot be negative';
  }

  if (!form.paymentTerms?.trim()) {
    errors.paymentTerms = 'Payment terms is required';
  } else if (!PAYMENT_TERMS.includes(form.paymentTerms)) {
    errors.paymentTerms = 'Please select a valid payment term';
  }

  if (form.gstNumber && !isValidGST(form.gstNumber)) {
    errors.gstNumber = 'Please enter a valid GST number (15 characters)';
  }

  if (form.pincode && !isValidPincode(form.pincode)) {
    errors.pincode = 'Please enter a valid 6-digit pincode';
  }

  return errors;
};

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

const InputField = ({ label, id, type = 'text', placeholder, value, onChange, required, error }) => (
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
      className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 ${error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-slate-200 focus:ring-blue-500'
        }`}
    />
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
  </div>
);

function DocUploadRow({ title, icon, file, onUpload, onRemove }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) onUpload(selectedFile);
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      {/* Icon + title */}
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {file && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{file.name}</p>
        )}
      </div>

      {/* Action */}
      {file ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 text-xs font-medium text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="flex-shrink-0 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
          >
            Upload
          </button>
        </>
      )}
    </div>
  );
}

const AddNewDealerPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((s) => s.dealer);
  const [docs, setDocs] = useState({
    gst: null,
    pan: null,
    bank: null,
  });

  const [errors, setErrors] = useState({});

  const handleUpload = (key, file) => {
    setDocs((prev) => ({
      ...prev,
      [key]: file,
    }));
  };

  const handleRemove = (key) => {
    setDocs((prev) => ({
      ...prev,
      [key]: null,
    }));
  };
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    email: '',
    phone: '',
    gstNumber: '',
    creditLimit: '',
    pricingTier: '',
    paymentTerms: '',
    onboardedBy: '',
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

  const setField = (key) => (val) => {
    setForm((f) => ({ ...f, [key]: val }));
    // Clear error for this field when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: '',
      }));
    }
  };

  const handleSubmit = async () => {
    // Validate form
    const validationErrors = validateForm(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const formData = new FormData();
    formData.append('businessName', form.businessName);
    formData.append('ownerName', form.name);
    formData.append('email', form.email);
    formData.append('phone', form.phone);
    formData.append('gstNumber', form.gstNumber || '');
    formData.append('businessType', 'dealer');
    formData.append('street', form.street || '');
    formData.append('district', form.district || '');
    formData.append('state', form.state || '');
    formData.append('pincode', form.pincode || '');
    formData.append('country', form.country || 'India');
    formData.append('creditLimit', form.creditLimit || 0);
    formData.append('pricingTier', form.pricingTier || 'standard');
    formData.append('paymentTerms', form.paymentTerms || '');
    formData.append('onboardedBy', form.onboardedBy || '');

    if (docs.gst) formData.append('gst', docs.gst);
    if (docs.pan) formData.append('pan', docs.pan);
    if (docs.bank) formData.append('bank', docs.bank);

    const result = await dispatch(createDealer(formData));
    if (!result.error) {
      navigate('/dealers');
    }
  };



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Add New Dealer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Capture dealer details from external sources, log call information and push to onboarding page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dealers')}
            className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.businessName?.trim() || !form.name?.trim() || !form.phone?.trim() || form.creditLimit === '' || !form.paymentTerms?.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Create Dealer'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-8xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">

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
                error={errors.businessName}
              />
              <div className="grid grid-cols-2 gap-4">
                {/* <InputField
                  label="Primary Contact"
                  id="primaryContact"
                  placeholder="Enter Name"
                  value={form.primaryContact}
                  onChange={setField('primaryContact')}
                  required
                /> */}
                <InputField
                  label="Contact Name"
                  id="name"
                  placeholder="Enter Name"
                  value={form.name}
                  onChange={setField('name')}
                  required
                  error={errors.name}
                />
                <InputField
                  label="Email Address"
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={form.email}
                  onChange={setField('email')}
                  required
                  error={errors.email}
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
                  error={errors.phone}
                />
                <InputField
                  label="GST Number"
                  id="gstNumber"
                  placeholder="Enter GST number"
                  value={form.gstNumber}
                  onChange={setField('gstNumber')}
                  error={errors.gstNumber}
                />
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
                  placeholder="Enter 6-digit pincode"
                  value={form.pincode}
                  onChange={setField('pincode')}
                  error={errors.pincode}
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

{/* RIGHT: Documents + Onboarding */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Documents Required</h2>
            <p className="text-sm text-slate-500 mb-5">
              Please upload clear copies (PDF, JPG, PNG, HEIC). Max 5MB per file.
            </p>

            <DocUploadRow
              title="GST Certificate"
              icon="📄"
              file={docs.gst}
              onUpload={(file) => handleUpload('gst', file)}
              onRemove={() => handleRemove('gst')}
            />

            <DocUploadRow
              title="PAN Card Copy"
              icon="🪪"
              file={docs.pan}
              onUpload={(file) => handleUpload('pan', file)}
              onRemove={() => handleRemove('pan')}
            />

            <DocUploadRow
              title="Bank Statement"
              icon="🏦"
              file={docs.bank}
              onUpload={(file) => handleUpload('bank', file)}
              onRemove={() => handleRemove('bank')}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Onboarding Settings</h2>
            <div className="space-y-4">
              <InputField
                label="Credit Limit (INR)"
                id="creditLimit"
                min={0}
                max={2000}
                type="number"
                placeholder="Max ₹2,000"
                value={form.creditLimit}
                onChange={setField('creditLimit')}
                error={errors.creditLimit}
              />

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Pricing Tier</label>
                <SelectField
                  id="pricingTier"
                  value={form.pricingTier}
                  onChange={setField('pricingTier')}
                  options={PRICING_TIERS}
                  placeholder="Select pricing tier"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Net Payments</label>
                <SelectField
                  id="paymentTerms"
                  value={form.paymentTerms}
                  onChange={setField('paymentTerms')}
                  options={PAYMENT_TERMS.map((term) => ({ value: term, label: term }))}
                  placeholder="Select payment terms"
                />
                {errors.paymentTerms && <p className="text-xs text-red-500 mt-1.5">{errors.paymentTerms}</p>}
              </div>

              <InputField
                label="Onboarded By"
                id="onboardedBy"
                placeholder="Enter onboarded by"
                value={form.onboardedBy}
                onChange={setField('onboardedBy')}
                error={errors.onboardedBy}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNewDealerPage;