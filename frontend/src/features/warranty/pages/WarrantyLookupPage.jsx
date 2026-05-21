import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { lookupBySerial, clearLookupResult } from '../warrantySlice';
import { format, addMonths } from 'date-fns';
import { Search, ShieldCheck, ShieldOff, Package, User, FileText, Barcode } from 'lucide-react';

export default function WarrantyLookupPage() {
  const dispatch = useDispatch();
  const { lookupResult, lookupLoading, lookupError } = useSelector((s) => s.warranty);
  const [serial, setSerial] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (!serial.trim()) return;
    dispatch(lookupBySerial(serial.trim()));
  };

  const handleClear = () => {
    setSerial('');
    dispatch(clearLookupResult());
  };

  const unit = lookupResult;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Barcode size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-800">Warranty Lookup</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={serial}
            onChange={(e) => { setSerial(e.target.value); dispatch(clearLookupResult()); }}
            placeholder="Enter or scan serial number — e.g. SN-TV-00001"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!serial.trim() || lookupLoading}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {lookupLoading ? 'Searching…' : 'Search'}
        </button>
        {(unit || lookupError) && (
          <button type="button" onClick={handleClear} className="px-4 py-2.5 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
            Clear
          </button>
        )}
      </form>

      {/* Error */}
      {lookupError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          {lookupError}
        </div>
      )}

      {/* Result */}
      {unit && (
        <div className="space-y-4">
          {/* Warranty status banner */}
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
            unit.isWarrantyValid
              ? 'bg-green-50 border-green-200'
              : unit.warrantyMonths > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            {unit.isWarrantyValid
              ? <ShieldCheck size={22} className="text-green-600" />
              : <ShieldOff  size={22} className="text-red-500" />
            }
            <div>
              <p className={`font-bold text-base ${unit.isWarrantyValid ? 'text-green-700' : unit.warrantyMonths > 0 ? 'text-red-700' : 'text-slate-600'}`}>
                {unit.isWarrantyValid
                  ? 'Warranty Valid'
                  : unit.warrantyMonths > 0
                  ? 'Warranty Expired'
                  : 'No Warranty Registered'}
              </p>
              {unit.warrantyExpiresAt && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {unit.isWarrantyValid ? 'Expires' : 'Expired'}: {format(new Date(unit.warrantyExpiresAt), 'dd MMM yyyy')}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Product</h3>
              </div>
              <p className="font-semibold text-slate-800 text-base">{unit.productName || unit.productId?.name || '—'}</p>
              {unit.productId?.category && <p className="text-sm text-slate-500 mt-0.5">{unit.productId.category}</p>}
              {unit.productId?.brand   && <p className="text-sm text-slate-500">{unit.productId.brand}</p>}
              <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial No</span>
                  <span className="font-mono font-semibold text-blue-700">{unit.serialNumber}</span>
                </div>
                {unit.warrantyMonths > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Warranty</span>
                    <span className="font-semibold text-slate-700">{unit.warrantyMonths} months</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Dispatched On</span>
                  <span className="text-slate-700">{unit.dispatchedAt ? format(new Date(unit.dispatchedAt), 'dd MMM yyyy') : '—'}</span>
                </div>
                {unit.warrantyMonths > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Warranty Start</span>
                    <span className="text-slate-700">{format(new Date(unit.dispatchedAt), 'dd MMM yyyy')}</span>
                  </div>
                )}
                {unit.warrantyExpiresAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Warranty End</span>
                    <span className={`font-semibold ${unit.isWarrantyValid ? 'text-green-700' : 'text-red-600'}`}>
                      {format(new Date(unit.warrantyExpiresAt), 'dd MMM yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Dealer */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <User size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dealer</h3>
              </div>
              {unit.dealerId ? (
                <>
                  <p className="font-semibold text-slate-800 text-base">{unit.dealerId.businessName}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{unit.dealerId.dealerCode}</p>
                  {unit.dealerId.phone && <p className="text-sm text-slate-500 mt-1">{unit.dealerId.phone}</p>}
                  {unit.dealerId.email && <p className="text-sm text-slate-500">{unit.dealerId.email}</p>}
                  {unit.dealerId.address?.city && (
                    <p className="text-sm text-slate-500 mt-1">
                      {[unit.dealerId.address.street, unit.dealerId.address.city, unit.dealerId.address.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">No dealer information</p>
              )}
            </div>
          </div>

          {/* Invoice */}
          {unit.invoiceId && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Invoice</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Invoice #</p>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">{unit.invoiceId.invoiceNumber || unit.invoiceNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Invoice Date</p>
                  <p className="text-slate-700 mt-0.5">{unit.invoiceId.invoiceDate ? format(new Date(unit.invoiceId.invoiceDate), 'dd MMM yyyy') : '—'}</p>
                </div>
                {unit.orderId && (
                  <div>
                    <p className="text-slate-400 text-xs">Order #</p>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5">{unit.orderId.orderNumber || '—'}</p>
                  </div>
                )}
                {unit.invoiceId.totalAmount !== undefined && (
                  <div>
                    <p className="text-slate-400 text-xs">Invoice Amount</p>
                    <p className="font-semibold text-slate-800 mt-0.5">₹ {unit.invoiceId.totalAmount?.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
