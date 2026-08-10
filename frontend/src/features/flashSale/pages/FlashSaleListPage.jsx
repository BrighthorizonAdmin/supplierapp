import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchFlashSales, updateFlashSale, deleteFlashSale } from '../flashSaleSlice';
import { Plus, Zap, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const isLive = (fs) => {
  if (!fs.isEnabled) return false;
  const now = new Date();
  if (new Date(fs.startDate) > now) return false;
  return !fs.endDate || now <= new Date(fs.endDate); // no endDate = runs until manually disabled
};

const FlashSaleCard = ({ flashSale, onEdit, onToggle, onDelete }) => {
  const live = isLive(flashSale);
  return (
    <div className={`card p-4 flex items-start justify-between gap-4 ${!flashSale.isEnabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-none ${live ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
          <Zap size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">{flashSale.title}</h3>
            {live && <span className="badge-green text-[10px]">LIVE</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {flashSale.discountPercent}% off · {flashSale.scope === 'all' ? 'All products' : `${(flashSale.productIds || []).length} products, ${(flashSale.categories || []).length} categories`}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {fmtDate(flashSale.startDate)} – {flashSale.endDate ? fmtDate(flashSale.endDate) : 'until disabled'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-none">
        <button
          onClick={() => onToggle(flashSale)}
          title={flashSale.isEnabled ? 'Disable' : 'Enable'}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${flashSale.isEnabled ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
        >
          {flashSale.isEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
        </button>
        <button onClick={() => onEdit(flashSale._id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium">
          <Pencil size={11} /> Edit
        </button>
        <button onClick={() => onDelete(flashSale._id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};

const FlashSaleListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading } = useSelector((s) => s.flashSale);

  useEffect(() => { dispatch(fetchFlashSales()); }, [dispatch]);

  const handleToggle = (flashSale) => {
    dispatch(updateFlashSale({ id: flashSale._id, isEnabled: !flashSale.isEnabled }));
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this flash sale?')) dispatch(deleteFlashSale(id));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Flash Sale</h1>
        <button onClick={() => navigate('/flash-sales/new')} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={14} /> New Flash Sale
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Only one flash sale can be live at a time. When live, the discount auto-applies at checkout on the Buvvas website for a customer's first order.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="card flex items-center justify-center h-64 text-slate-400 text-sm">
          No flash sales yet
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((fs) => (
            <FlashSaleCard
              key={fs._id}
              flashSale={fs}
              onEdit={(id) => navigate(`/flash-sales/${id}/edit`)}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FlashSaleListPage;
