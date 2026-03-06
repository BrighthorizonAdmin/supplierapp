import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, fetchProductById } from '../productSlice';
import { useEffect } from 'react';

const ProductFormPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected, loading } = useSelector((s) => s.product);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) dispatch(fetchProductById(id));
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && selected) reset(selected);
  }, [selected, isEdit, reset]);

  const onSubmit = (data) => {
    const action = isEdit ? updateProduct({ id, ...data }) : createProduct(data);
    dispatch(action).then((res) => { if (!res.error) navigate('/products'); });
  };

  const F = ({ label, name, type = 'text', required = false, options, step }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500">*</span>}</label>
      {options ? (
        <select className="input" {...register(name, { required: required && `Required` })}>
          {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : (
        <input type={type} step={step} className="input" {...register(name, { required: required && `Required`, ...(type === 'number' ? { valueAsNumber: true } : {}) })} />
      )}
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Product Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Product Name" name="name" required />
            <F label="Category" name="category" required />
            <F label="Sub-Category" name="subCategory" />
            <F label="Brand" name="brand" />
            <F label="SKU" name="sku" />
            <F label="Unit" name="unit" options={[
              { value: 'piece', label: 'Piece' }, { value: 'kg', label: 'KG' },
              { value: 'litre', label: 'Litre' }, { value: 'box', label: 'Box' },
              { value: 'dozen', label: 'Dozen' }, { value: 'metre', label: 'Metre' },
            ]} />
          </div>
          <div className="mt-4">
            <label className="label">Description</label>
            <textarea className="input" rows={3} {...register('description')} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Pricing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <F label="Base Price (₹)" name="basePrice" type="number" step="0.01" required />
            <F label="MRP (₹)" name="mrp" type="number" step="0.01" />
            <F label="GST Rate (%)" name="taxRate" type="number" />
            <F label="HSN Code" name="hsn" />
          </div>
          <div className="mt-4">
            <p className="label mb-3">Tier Pricing (₹)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['standard', 'silver', 'gold', 'platinum'].map((tier) => (
                <div key={tier}>
                  <label className="label capitalize">{tier}</label>
                  <input type="number" step="0.01" className="input" {...register(`pricingTiers.${tier}`, { valueAsNumber: true })} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Availability</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" {...register('isActive')} />
            <span className="text-sm text-slate-700">Product is active (visible in marketplace)</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductFormPage;
