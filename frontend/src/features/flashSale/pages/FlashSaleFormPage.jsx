import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchFlashSaleById, createFlashSale, updateFlashSale, clearSelectedFlashSale } from '../flashSaleSlice';
import { fetchProducts, fetchCategories } from '../../products/productSlice';
import { ArrowLeft } from 'lucide-react';

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time — toISOString()
// would shift to UTC and drift the displayed time from what was actually set.
const toDateTimeInput = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const FlashSaleFormPage = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected } = useSelector((s) => s.flashSale);
  const { list: products, categories } = useSelector((s) => s.product);

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { scope: 'all', isEnabled: false, productIds: [], categories: [] },
  });
  const scope = watch('scope');

  useEffect(() => {
    dispatch(fetchProducts({ limit: 200 }));
    dispatch(fetchCategories());
    if (isEdit) dispatch(fetchFlashSaleById(id));
    return () => dispatch(clearSelectedFlashSale());
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && selected) {
      reset({
        title: selected.title,
        discountPercent: selected.discountPercent,
        startDate: toDateTimeInput(selected.startDate),
        endDate: toDateTimeInput(selected.endDate),
        isEnabled: selected.isEnabled,
        scope: selected.scope || 'all',
        productIds: (selected.productIds || []).map((p) => (typeof p === 'string' ? p : p._id)),
        categories: selected.categories || [],
      });
    }
  }, [selected, isEdit, reset]);

  const onSubmit = async (data) => {
    // The datetime-local inputs give back a plain "no timezone" string
    // (e.g. "2026-08-10T16:05"), which a server running in a different
    // timezone than the browser would misinterpret as its own local time.
    // Converting to an ISO string here bakes in an explicit UTC offset, so
    // the moment means the same thing no matter where the backend runs.
    const toUtcIso = (localDateTimeStr) => localDateTimeStr ? new Date(localDateTimeStr).toISOString() : null;
    const payload = {
      title: data.title,
      discountPercent: Number(data.discountPercent),
      startDate: toUtcIso(data.startDate),
      endDate: toUtcIso(data.endDate),
      isEnabled: data.isEnabled,
      scope: data.scope,
      productIds: data.scope === 'selected' ? data.productIds : [],
      categories: data.scope === 'selected' ? data.categories : [],
    };
    const action = isEdit
      ? await dispatch(updateFlashSale({ id, ...payload }))
      : await dispatch(createFlashSale(payload));
    if (!action.error) navigate('/flash-sales');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <button onClick={() => navigate('/flash-sales')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} /> Back to Flash Sales
      </button>

      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Flash Sale' : 'New Flash Sale'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        <div>
          <label className="label">Title</label>
          <input {...register('title', { required: 'Required' })} className="input" placeholder="e.g. Diwali Flash Sale" />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Discount %</label>
          <input
            type="number" min={1} max={100}
            {...register('discountPercent', { required: 'Required', min: 1, max: 100 })}
            className="input" placeholder="10"
          />
          {errors.discountPercent && <p className="text-xs text-red-500 mt-1">Enter a value between 1 and 100</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date & Time</label>
            <input type="datetime-local" {...register('startDate', { required: 'Required' })} className="input" />
          </div>
          <div>
            <label className="label">End Date & Time (optional)</label>
            <input type="datetime-local" {...register('endDate')} className="input" />
            <p className="text-xs text-slate-400 mt-1">Leave blank to run until you disable it manually.</p>
          </div>
        </div>

        <div>
          <label className="label">Applies to</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="all" {...register('scope')} /> All products
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="selected" {...register('scope')} /> Specific products / categories
            </label>
          </div>
        </div>

        {scope === 'selected' && (
          <div className="space-y-4 border-l-2 border-slate-100 pl-4">
            <div>
              <label className="label">Categories</label>
              <select multiple {...register('categories')} className="input h-28">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Products</label>
              <select multiple {...register('productIds')} className="input h-32">
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isEnabled')} />
          Enable this flash sale (turns off any other live flash sale)
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary text-sm py-2 px-5">
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Flash Sale'}
          </button>
          <button type="button" onClick={() => navigate('/flash-sales')} className="text-sm py-2 px-5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FlashSaleFormPage;
