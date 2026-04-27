import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createProduct, updateProduct, fetchProductById,
  uploadProductImages, deleteProductImage, setPrimaryImage,
} from '../productSlice';
import { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';

// filePath on disk → browser-loadable URL
const toPreviewUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  const clean = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return '/' + clean;
};

// ─── Image Upload Component ───────────────────────────────────────────────────
const ImageUploader = ({ images, onChange, onDeleteExisting, onSetPrimaryExisting }) => {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const processFiles = useCallback(
    (files) => {
      const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!valid.length) return;
      const readers = valid.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({
                id:        `new-${Date.now()}-${Math.random()}`,
                file,
                fileName:  file.name,
                preview:   e.target.result,
                isPrimary: false,
                isNew:     true,
              });
            reader.readAsDataURL(file);
          })
      );
      Promise.all(readers).then((newImgs) => {
        const merged = [...images, ...newImgs];
        if (!merged.some((img) => img.isPrimary)) merged[0].isPrimary = true;
        onChange(merged);
      });
    },
    [images, onChange]
  );

  const handleFiles = (e) => processFiles(e.target.files);
  const handleDrop  = (e) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); };

  const handleSetPrimaryNew = (id) => {
    onChange(images.map((img) => ({ ...img, isPrimary: img.isNew && img.id === id })));
  };
  const handleRemoveNew = (id) => {
    const filtered = images.filter((img) => img.id !== id);
    if (filtered.length && !filtered.some((img) => img.isPrimary)) filtered[0].isPrimary = true;
    onChange(filtered);
  };
  const handleDeleteExisting = async (img) => {
    setDeleting(img.fileName);
    await onDeleteExisting(img.fileName);
    setDeleting(null);
  };
  const handleSetPrimaryExisting = async (img) => {
    await onSetPrimaryExisting(img.fileName);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
          ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <div className="flex flex-col items-center gap-1.5 text-gray-500">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm">
            <span className="font-medium text-primary-600">Click to upload</span>
            <span className="text-gray-500"> or drag &amp; drop</span>
          </p>
          <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 10MB</p>
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className={`relative group rounded-lg overflow-hidden border-2 transition-all
                ${img.isPrimary ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-gray-300'}
                ${deleting === img.fileName ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <img src={img.preview} alt={img.fileName} className="w-full h-20 object-cover bg-gray-100" />
              {img.isPrimary && (
                <span className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
              {deleting === img.fileName && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isPrimary && (
                  <button type="button" title="Set as primary"
                    onClick={() => img.isNew ? handleSetPrimaryNew(img.id) : handleSetPrimaryExisting(img)}
                    className="bg-white text-gray-800 rounded p-1.5 hover:bg-primary-50 hover:text-primary-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  </button>
                )}
                <button type="button" title="Remove"
                  onClick={() => img.isNew ? handleRemoveNew(img.id) : handleDeleteExisting(img)}
                  className="bg-white text-gray-800 rounded p-1.5 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <p className="text-xs text-gray-400">
          {images.length} image{images.length > 1 ? 's' : ''} · hover to set primary or remove
        </p>
      )}
    </div>
  );
};

// ─── Interface Option Row (inside a group) ────────────────────────────────────
const InterfaceOptionRow = ({ option, isDefault, onSetDefault, onRemove }) => (
  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm
    ${isDefault ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'}`}
  >
    <button type="button" title="Set as default" onClick={onSetDefault}
      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors
        ${isDefault ? 'border-primary-500 bg-primary-500' : 'border-gray-300 hover:border-primary-400'}`}
    />
    <span className="font-medium text-gray-800 flex-1">{option.label}</span>
    {option.additionalPrice > 0
      ? <span className="text-green-700 font-semibold text-xs">+₹{option.additionalPrice.toLocaleString('en-IN')}</span>
      : <span className="text-gray-400 text-xs">No extra cost</span>
    }
    {option.sku && <span className="text-xs text-gray-400">SKU: {option.sku}</span>}
    {isDefault && (
      <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-semibold">Default</span>
    )}
    <button type="button" onClick={onRemove}
      className="text-gray-400 hover:text-red-500 transition-colors ml-1" title="Remove">
      ✕
    </button>
  </div>
);

// ─── Single Interface Group Editor ────────────────────────────────────────────
const InterfaceGroupEditor = ({ group, onUpdate, onRemoveGroup }) => {
  const [newLabel,           setNewLabel]           = useState('');
  const [newAdditionalPrice, setNewAdditionalPrice] = useState('');
  const [newSku,             setNewSku]             = useState('');
  const [error,              setError]              = useState('');

  const addOption = () => {
    setError('');
    if (!newLabel.trim()) { setError('Option label is required.'); return; }
    const price = parseFloat(newAdditionalPrice);
    if (newAdditionalPrice === '' || isNaN(price) || price < 0) {
      setError('Enter a valid additional price (0 for no extra cost).'); return;
    }
    if (group.options.some(o => o.label.toLowerCase() === newLabel.trim().toLowerCase())) {
      setError('An option with this label already exists in this group.'); return;
    }
    const option = {
      label:           newLabel.trim(),
      additionalPrice: price,
      sku:             newSku.trim() || '',
      isDefault:       group.options.length === 0,
    };
    onUpdate({ ...group, options: [...group.options, option] });
    setNewLabel(''); setNewAdditionalPrice(''); setNewSku('');
  };

  const removeOption = (idx) => {
    const updated = group.options.filter((_, i) => i !== idx);
    if (group.options[idx].isDefault && updated.length > 0) updated[0] = { ...updated[0], isDefault: true };
    onUpdate({ ...group, options: updated });
  };

  const setDefault = (idx) => {
    onUpdate({ ...group, options: group.options.map((o, i) => ({ ...o, isDefault: i === idx })) });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
      {/* Group header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="label text-xs mb-1">
            Interface Group Name
            <span className="text-xs font-normal text-gray-400 ml-2">e.g. Magnetic Stripe Reader</span>
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Magnetic Stripe Reader"
            value={group.name}
            onChange={e => onUpdate({ ...group, name: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={onRemoveGroup}
          title="Remove this group"
          className="mt-5 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Add option row */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Option</p>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            className="input col-span-1"
            placeholder="Label *  e.g. With MSR"
            value={newLabel}
            onChange={e => { setNewLabel(e.target.value); setError(''); }}
          />
          <input
            type="number"
            className="input col-span-1"
            placeholder="Additional Price * (0 = free)"
            min="0"
            step="0.01"
            value={newAdditionalPrice}
            onChange={e => { setNewAdditionalPrice(e.target.value); setError(''); }}
          />
          <input
            type="text"
            className="input col-span-1"
            placeholder="SKU suffix (optional)"
            value={newSku}
            onChange={e => setNewSku(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button type="button" onClick={addOption} className="btn-primary text-sm py-1.5 px-4">
          + Add Option
        </button>
      </div>

      {/* Options list */}
      {group.options.length > 0 && (
        <div className="space-y-1.5">
          {group.options.map((opt, idx) => (
            <InterfaceOptionRow
              key={idx}
              option={opt}
              isDefault={opt.isDefault}
              onSetDefault={() => setDefault(idx)}
              onRemove={() => removeOption(idx)}
            />
          ))}
          <p className="text-xs text-gray-400">
            · "Additional Price" adds on top of the product base price. Use 0 for the standard option.
            <br />· The default option is pre-selected in the dealer app.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Multi-Interface Groups Manager ──────────────────────────────────────────
const InterfaceGroupsManager = ({ interfaceGroups, onInterfaceGroupsChange }) => {
  const addGroup = () => {
    onInterfaceGroupsChange([...interfaceGroups, { name: '', options: [] }]);
  };

  const updateGroup = (idx, updated) => {
    onInterfaceGroupsChange(interfaceGroups.map((g, i) => (i === idx ? updated : g)));
  };

  const removeGroup = (idx) => {
    onInterfaceGroupsChange(interfaceGroups.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {interfaceGroups.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-500 mb-1">No interface groups added yet.</p>
          <p className="text-xs text-gray-400">
            Add groups like "Magnetic Stripe Reader" or "Second Display", each with their own options.
          </p>
        </div>
      )}

      {interfaceGroups.map((group, idx) => (
        <InterfaceGroupEditor
          key={idx}
          group={group}
          onUpdate={(updated) => updateGroup(idx, updated)}
          onRemoveGroup={() => removeGroup(idx)}
        />
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed
          border-primary-300 text-primary-600 text-sm font-semibold hover:bg-primary-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Interface Group
      </button>

      {interfaceGroups.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">How pricing works with multiple interfaces:</p>
          <p>Final price = Base Price + additional price from each selected option</p>
          <p className="text-blue-500">
            Example: Base ₹40,000 + MSR ₹500 + 11.6" Screen ₹1,200 = <strong>₹41,700</strong>
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Form ────────────────────────────────────────────────────────────────
const ProductFormPage = () => {
  const { id } = useParams();
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { selected, loading } = useSelector((s) => s.product);

  const [productImages,   setProductImages]   = useState([]);
  const [interfaceGroups, setInterfaceGroups] = useState([]);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm();

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) dispatch(fetchProductById(id));
  }, [dispatch, id, isEdit]);

  useEffect(() => {
    if (isEdit && selected) {
      reset({
        ...selected,
        stockDate:      selected.openingStockDate
                          ? new Date(selected.openingStockDate).toISOString().split('T')[0]
                          : '',
        stockQty:       selected.openingStockQty        || 0,
        specWeight:     selected.specifications?.weight     || '',
        specDimensions: selected.specifications?.dimensions || '',
        specColor:      selected.specifications?.color      || '',
      });

      setProductImages(
        (selected.images || []).map((img, i) => ({
          id:        `existing-${i}-${img.fileName}`,
          fileName:  img.fileName,
          filePath:  img.filePath,
          preview:   toPreviewUrl(img.filePath),
          isPrimary: img.isPrimary,
          isNew:     false,
        }))
      );

      setInterfaceGroups(selected.interfaceGroups || []);
    }
  }, [selected, isEdit, reset]);

  // ── API handlers for existing images ──────────────────────────────────────
  const handleDeleteExisting = async (fileName) => {
    const res = await dispatch(deleteProductImage({ id, fileName }));
    if (!res.error) {
      setProductImages(
        (res.payload?.images || []).map((img, i) => ({
          id:        `existing-${i}-${img.fileName}`,
          fileName:  img.fileName,
          filePath:  img.filePath,
          preview:   toPreviewUrl(img.filePath),
          isPrimary: img.isPrimary,
          isNew:     false,
        }))
      );
      toast.success('Image deleted');
    }
  };

  const handleSetPrimaryExisting = async (fileName) => {
    const res = await dispatch(setPrimaryImage({ id, fileName }));
    if (!res.error) {
      setProductImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.fileName === fileName }))
      );
      toast.success('Primary image updated');
    }
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const onSubmit = async (data) => {
    const newFiles = productImages.filter((img) => img.isNew);
    if (isEdit && !isDirty && newFiles.length === 0) {
      toast('No changes to save.', { icon: 'ℹ️' });
      return;
    }

    const { stockDate, stockQty, specWeight, specDimensions, specColor, ...productData } = data;

    if (!isEdit) {
      productData.openingStockDate = stockDate || undefined;
      productData.openingStockQty  = Number(stockQty) || 0;
    }
    productData.specifications = {
      weight:     specWeight     || '',
      dimensions: specDimensions || '',
      color:      specColor      || '',
    };

    productData.interfaceGroups = interfaceGroups;

    const action = isEdit ? updateProduct({ id, ...productData }) : createProduct(productData);
    const res    = await dispatch(action);
    if (res.error) return;

    const productId = isEdit ? id : res.payload._id;

    if (newFiles.length > 0) {
      const uploadRes = await dispatch(uploadProductImages({
        id:    productId,
        files: newFiles.map((img) => img.file),
      }));
      if (uploadRes.error) return;
    }

    navigate('/products');
  };

  const F = ({ label, name, type = 'text', required = false, options, step }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500">*</span>}</label>
      {options ? (
        <select className="input" {...register(name, { required: required && 'Required' })}>
          {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      ) : (
        <input type={type} step={step} className="input"
          {...register(name, { required: required && 'Required', ...(type === 'number' ? { valueAsNumber: true } : {}) })}
        />
      )}
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Modal isOpen={true} onClose={() => navigate('/products')} title={isEdit ? 'Edit Product' : 'Add New Product'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Left ── */}
          <div className="flex flex-col gap-4">
            <F label="Product Name" name="name" required />
            <F label="Category"     name="category" required />
            <F label="MRP"          name="mrp"       type="number" step="0.01" />
            <F label="Tax"          name="taxRate"   type="number" />
            <F label="Base Price"   name="basePrice" type="number" step="0.01" required />
            <div className="flex-1 flex flex-col">
              <label className="label mb-1">
                Product Images
                <span className="text-xs font-normal text-gray-400 ml-2">(multiple · ⭐ = primary)</span>
              </label>
              <div className="flex-1">
                <ImageUploader
                  images={productImages}
                  onChange={setProductImages}
                  onDeleteExisting={handleDeleteExisting}
                  onSetPrimaryExisting={handleSetPrimaryExisting}
                />
              </div>
            </div>
          </div>

          {/* ── Right ── */}
          <div className="flex flex-col gap-4">
            <F label="SKU Code" name="sku" />
            <F label="MOQ"      name="moq" type="number" />
            <div>
              <label className="label">
                Opening Stock
                {isEdit && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input" {...register('stockDate')} />
                <input type="number" placeholder="Quantity" className="input" {...register('stockQty', { valueAsNumber: true })} />
              </div>
            </div>

            {isEdit && (() => {
              const cur  = selected?.currentStockQty  ?? 0;
              const open = selected?.openingStockQty ?? 0;
              const status = cur <= 0
                ? { label: 'Out of Stock',  cls: 'bg-red-100 text-red-700 border-red-200' }
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
                  <option value="units">Units</option>
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
                  <option value="green">Green</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                  <option value="yellow">Yellow</option>
                </select>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <label className="label">Description</label>
              <textarea className="input resize-none flex-1" placeholder="Enter product description..." {...register('description')} />
            </div>
          </div>

        </div>

        {/* ── Interface Groups Section (full width) ── */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Product Interfaces</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Optional — add multiple selectable interface groups (e.g. MSR, Second Display)
            </span>
          </div>
          <InterfaceGroupsManager
            interfaceGroups={interfaceGroups}
            onInterfaceGroupsChange={setInterfaceGroups}
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductFormPage;