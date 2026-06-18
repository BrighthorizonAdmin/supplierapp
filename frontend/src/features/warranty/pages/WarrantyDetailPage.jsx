import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWarrantyById, updateWarrantyStatus } from '../warrantySlice';
import { format } from 'date-fns';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  repaired: 'bg-blue-100 text-blue-800 border-blue-200',
  replaced: 'bg-purple-100 text-purple-800 border-purple-200',
};

const ACTIONS = [
  { value: 'approved', label: 'Approve',  color: 'bg-green-600 hover:bg-green-700' },
  { value: 'repaired', label: 'Repaired', color: 'bg-blue-600 hover:bg-blue-700' },
  { value: 'replaced', label: 'Replaced', color: 'bg-purple-600 hover:bg-purple-700' },
  { value: 'rejected', label: 'Reject',   color: 'bg-red-600 hover:bg-red-700' },
];

export default function WarrantyDetailPage() {
  const { id }     = useParams();
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { selected: req, loading } = useSelector((s) => s.warranty);

  const [notes,      setNotes]      = useState('');
  const [actionBusy, setActionBusy] = useState('');

  useEffect(() => {
    dispatch(fetchWarrantyById(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (req?.supplierNotes) setNotes(req.supplierNotes);
  }, [req]);

  const handleAction = async (status) => {
    setActionBusy(status);
    await dispatch(updateWarrantyStatus({ id, status, supplierNotes: notes }));
    setActionBusy('');
  };

  if (loading || !req) return <div className="p-10 text-center text-slate-400">Loading warranty request…</div>;

  const isPending = req.status === 'pending';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/warranty')}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-5"
      >
        <ArrowLeft size={16} /> Back to Warranty Requests
      </button>

      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck size={22} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">{req.claimNumber}</h1>
            <p className="text-sm text-slate-500">Invoice: {req.invoiceNumber || '—'}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[req.status] || 'bg-slate-100 text-slate-600'}`}>
          {req.status?.charAt(0).toUpperCase() + req.status?.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Dealer */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Dealer</h3>
            <p className="font-semibold text-slate-800">{req.dealerId?.businessName || '—'}</p>
            <p className="text-sm text-slate-500 mt-0.5">{req.dealerId?.dealerCode || ''}</p>
            {req.dealerId?.phone && <p className="text-sm text-slate-500 mt-0.5">📞 {req.dealerId.phone}</p>}
            {req.dealerId?.email && <p className="text-sm text-slate-500 mt-0.5">✉️ {req.dealerId.email}</p>}
          </div>

          {/* Customer */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Customer</h3>
            <p className="font-semibold text-slate-800">{req.customerName || '—'}</p>
            {req.customerPhone && <p className="text-sm text-slate-500 mt-0.5">📞 {req.customerPhone}</p>}
          </div>

          {/* Invoice info */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Invoice Info</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice #</span>
                <span className="font-mono font-medium text-slate-800">{req.invoiceNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Date</span>
                <span className="text-slate-700">{req.invoiceDate ? format(new Date(req.invoiceDate), 'dd MMM yyyy') : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Warranty Expiry</span>
                <span className={`font-medium ${req.warrantyExpiryDate ? (new Date(req.warrantyExpiryDate) >= new Date() ? 'text-green-700' : 'text-red-600') : 'text-slate-700'}`}>
                  {req.warrantyExpiryDate ? format(new Date(req.warrantyExpiryDate), 'dd MMM yyyy') : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Warranty Period</span>
                <span className="font-semibold text-blue-700">{req.warrantyPeriod || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Claimed On</span>
                <span className="text-slate-700">{req.createdAt ? format(new Date(req.createdAt), 'dd MMM yyyy') : '—'}</span>
              </div>
              {req.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Resolved On</span>
                  <span className="text-slate-700">{format(new Date(req.resolvedAt), 'dd MMM yyyy')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Issue */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Issue Description</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{req.issueDescription || '—'}</p>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Claimed Items</h3>
            {req.items?.length > 0 ? (
              <div className="space-y-2">
                {req.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.name || '—'}</p>
                      <p className="text-xs mt-0.5"><span className="text-slate-500">SKU: </span><span className="text-slate-900 font-medium">{item.sku || '—'}</span></p>
                      {item.serialNumbers?.length > 0 && (
                        <p className="text-xs mt-0.5"><span className="text-slate-500">Serial No: </span><span className="font-semibold text-blue-700">{item.serialNumbers.join(', ')}</span></p>
                      )}
                      {item.reason && <p className="text-xs text-slate-900 mt-0.5 italic">"{item.reason}"</p>}
                    </div>
                    <span className="text-xs font-semibold text-slate-600 ml-3">Qty: {item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No items listed.</p>
            )}
          </div>

          {/* Supplier action */}
          {isPending ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Take Action</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for the dealer (optional)…"
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 resize-none mb-4"
              />
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => handleAction(value)}
                    disabled={!!actionBusy}
                    className={`${color} text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50`}
                  >
                    {actionBusy === value ? 'Processing…' : label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            req.supplierNotes && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Supplier Notes</h3>
                <p className="text-sm text-slate-700 leading-relaxed">{req.supplierNotes}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
