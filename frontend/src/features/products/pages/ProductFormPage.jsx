import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, fetchProductById } from '../productSlice';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';

const ProductFormPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected, loading } = useSelector((s) => s.product);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm();

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) dispatch(fetchProductById(id));
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && selected) {
      reset({
        ...selected,
        // Map DB field names back to form field names
        stockDate:      selected.openingStockDate
                          ? new Date(selected.openingStockDate).toISOString().split('T')[0]
                          : '',
        stockQty:       selected.openingStockQty  || 0,
        specWeight:     selected.specifications?.weight     || '',
        specDimensions: selected.specifications?.dimensions || '',
        specColor:      selected.specifications?.color      || '',
      });
    }
  }, [selected, isEdit, reset]);

  const onSubmit = async (data) => {
    if (isEdit && !isDirty) {
      toast('No changes to save.', { icon: 'ℹ️' });
      return;
    }

    // Map form field names to Product schema field names
    const { stockDate, stockQty, specWeight, specDimensions, specColor, ...productData } = data;

    // openingStockQty / openingStockDate are set only at creation — they are immutable after that
    if (!isEdit) {
      productData.openingStockDate = stockDate || undefined;
      productData.openingStockQty  = Number(stockQty) || 0;
    }
    productData.specifications   = {
      weight:     specWeight     || '',
      dimensions: specDimensions || '',
      color:      specColor      || '',
    };

    const action = isEdit ? updateProduct({ id, ...productData }) : createProduct(productData);
    const res = await dispatch(action);

    if (!res.error) {
      navigate('/products');
    }
  };

  const F = ({ label, name, type = 'text', required = false, options, step }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500">*</span>}</label>
      {options ? (
        <select className="input" {...register(name, { required: required && 'Required' })}>
          {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          step={step}
          className="input"
          {...register(name, {
            required: required && 'Required',
            ...(type === 'number' ? { valueAsNumber: true } : {}),
          })}
        />
      )}
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={() => navigate('/products')}
      title={isEdit ? 'Edit Product' : 'Add New Product'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* left side */}
          <div className="space-y-4">
            <F label="Product Name" name="name" required />
            <F label="Category" name="category" required />
            <F label="MRP" name="mrp" type="number" step="0.01" />
            <F label="Tax" name="taxRate" type="number" />
            <F label="Base Price" name="basePrice" type="number" step="0.01" required />
            <div>
              <label className="label">Description</label>
              <textarea
                rows={4}
                className="input resize-none"
                placeholder="Enter product description..."
                {...register('description')}
              />
            </div>
          </div>

          {/* right side */}
          <div className="space-y-4">
            <F label="SKU Code" name="sku" />
            <F label="MOQ" name="moq" type="number" />
            <div>
              <label className="label">
                Opening Stock
                {isEdit && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className={`input ${isEdit ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  readOnly={isEdit}
                  {...register('stockDate')}
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  className={`input ${isEdit ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  readOnly={isEdit}
                  {...register('stockQty', { valueAsNumber: true })}
                />
              </div>
            </div>

            {isEdit && (() => {
              const cur  = selected?.currentStockQty  ?? 0;
              const open = selected?.openingStockQty ?? 0;
              const status = cur <= 0
                ? { label: 'No Stock',  cls: 'bg-red-100 text-red-700 border-red-200' }
                : open > 0 && cur < open * 0.2
                ? { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
                : { label: 'In Stock',  cls: 'bg-green-100 text-green-700 border-green-200' };
              return (
                <div>
                  <label className="label">Current Stock Quantity</label>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-blue-50">
                    <span className="text-2xl font-bold text-blue-700">{cur}</span>
                    <span className="text-sm text-gray-500">units on hand</span>
                    <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div>
              <p className="label">Specification</p>
              <div className="space-y-2">
                <select className="input" {...register('specWeight')}>
                  <option value="">Weight</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="g">Units</option>
                </select>
                <select className="input" {...register('specDimensions')}>
                  <option value="">Dimensions</option>
                  <option value="cm">cm</option>
                  <option value="inch">inch</option>
                </select>
                <select className="input" {...register('specColor')}>
                  <option value="">Color/Variant</option>
                  <option value="red">Red</option>
                  <option value="blue">Blue</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductFormPage;
