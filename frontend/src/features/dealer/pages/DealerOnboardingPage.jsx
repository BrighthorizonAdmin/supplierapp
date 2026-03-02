import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createDealer } from '../dealerSlice';

const DealerOnboardingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((s) => s.dealer);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (data) => {
    dispatch(createDealer(data)).then((res) => {
      if (!res.error) navigate('/dealers');
    });
  };

  const Field = ({ label, name, type = 'text', required = true, options, ...rest }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500">*</span>}</label>
      {options ? (
        <select className="input" {...register(name, { required: required && `${label} is required` })}>
          <option value="">Select {label}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} className="input" {...register(name, { required: required && `${label} is required` })} {...rest} />
      )}
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Dealer Onboarding</h1>
        <p className="text-slate-500 text-sm mt-1">Fill in the dealer information to start the onboarding process</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Business Info */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Business Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business Name" name="businessName" />
            <Field label="Owner Name" name="ownerName" />
            <Field label="Email" name="email" type="email" />
            <Field label="Phone" name="phone" />
            <Field label="Alternate Phone" name="alternatePhone" required={false} />
            <Field label="Business Type" name="businessType" options={[
              { value: 'retailer', label: 'Retailer' },
              { value: 'wholesaler', label: 'Wholesaler' },
              { value: 'distributor', label: 'Distributor' },
            ]} />
          </div>
        </div>

        {/* Tax Info */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Tax & Compliance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="GST Number" name="gstNumber" placeholder="22AAAAA0000A1Z5" />
            <Field label="PAN Number" name="panNumber" placeholder="AAAAA0000A" />
          </div>
        </div>

        {/* Address */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Business Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Street" name="address.street" />
            </div>
            <Field label="City" name="address.city" />
            <Field label="State" name="address.state" />
            <Field label="Pincode" name="address.pincode" />
            <Field label="Country" name="address.country" required={false} />
          </div>
        </div>

        {/* Bank Details */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Bank Details <span className="text-slate-400 font-normal text-sm">(Optional)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Account Number" name="bankDetails.accountNumber" required={false} />
            <Field label="IFSC Code" name="bankDetails.ifscCode" required={false} />
            <Field label="Bank Name" name="bankDetails.bankName" required={false} />
            <Field label="Branch Name" name="bankDetails.branchName" required={false} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/dealers')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting...' : 'Submit for Onboarding'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DealerOnboardingPage;
