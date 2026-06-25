import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createQuote, updateQuote, fetchQuoteById } from '../quoteSlice';
import { fetchDealers } from '../../dealer/dealerSlice';
import { fetchProducts } from '../../products/productSlice';
import { fetchSettings } from '../../notifications/settingsSlice';
import {
  ArrowLeft, Plus, Trash2, X, Calendar, Search, ChevronDown, QrCode,
} from 'lucide-react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────
const GST_RATES = [
  { label: 'No Tax',       value: 0    },
  { label: 'GST @ 0.1%',  value: 0.1  },
  { label: 'GST @ 0.25%', value: 0.25 },
  { label: 'GST @ 1.5%',  value: 1.5  },
  { label: 'GST @ 3%',    value: 3    },
  { label: 'GST @ 5%',    value: 5    },
  { label: 'GST @ 6%',    value: 6    },
  { label: 'GST @ 8.9%',  value: 8.9  },
  { label: 'GST @ 12%',   value: 12   },
  { label: 'GST @ 13.8%', value: 13.8 },
  { label: 'GST @ 18%',   value: 18   },
  { label: 'GST @ 28%',   value: 28   },
];

const CHARGE_TAXES = [
  { label: 'No Tax',    value: 0    },
  { label: 'GST 0.1%', value: 0.1  },
  { label: 'GST 0.25%',value: 0.25 },
  { label: 'GST 1.5%', value: 1.5  },
  { label: 'GST 3%',   value: 3    },
  { label: 'GST 5%',   value: 5    },
  { label: 'GST 6%',   value: 6    },
  { label: 'GST 8.9%', value: 8.9  },
  { label: 'GST 12%',  value: 12   },
  { label: 'GST 18%',  value: 18   },
  { label: 'GST 28%',  value: 28   },
];

const EMPTY_ITEM = {
  productId: '', productName: '', description: '', hsnCode: '',
  quantity: 1, unit: 'PCS', unitPrice: 0,
  discountPercent: 0, discountAmount: 0,
  taxRate: 18, taxAmount: 0, lineTotal: 0,
};

const EMPTY_CHARGE = { label: '', amount: 0, taxRate: 0, taxAmount: 0 };

const toNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };

const calcItem = (item) => {
  const qty     = toNum(item.quantity);
  const price   = toNum(item.unitPrice);
  const base    = qty * price;
  const disc    = toNum(item.discountAmount);
  const taxable = Math.max(0, base - disc);
  const tax     = +(taxable * (toNum(item.taxRate) / 100)).toFixed(2);
  return { ...item, taxAmount: tax, lineTotal: +(taxable + tax).toFixed(2) };
};

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function AddItemModal({ products, existingItems, onAdd, onClose }) {
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [selections, setSelections] = useState({});
  const [showScan,   setShowScan]   = useState(false);
  const [scanValue,  setScanValue]  = useState('');
  const [scanError,  setScanError]  = useState('');
  const [scanSuccess,setScanSuccess]= useState('');
  const searchRef  = useRef(null);
  const scanRef    = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') { if (showScan) { setShowScan(false); setScanValue(''); setScanError(''); } else onClose(); }
      if (e.key === 'F7') handleAdd();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selections, showScan]);

  useEffect(() => {
    if (showScan) { setScanValue(''); setScanError(''); setScanSuccess(''); scanRef.current?.focus(); }
    else searchRef.current?.focus();
  }, [showScan]);

  const handleScan = () => {
    const q = scanValue.trim().toLowerCase();
    if (!q) return;
    const found = (products || []).find(
      (p) => p.sku?.toLowerCase() === q ||
             p.productCode?.toLowerCase() === q ||
             p.hsnCode?.toLowerCase() === q ||
             p.name?.toLowerCase() === q
    );
    if (found) {
      const remaining = getRemainingStock(found);
      const curr      = selections[found._id] || 0;
      if (remaining <= 0) { setScanError('No stock remaining for this product.'); return; }
      if (curr >= remaining) { setScanError(`Max remaining stock reached (${remaining} units).`); return; }
      setSelections((prev) => ({ ...prev, [found._id]: (prev[found._id] || 0) + 1 }));
      setScanSuccess(`Added: ${found.name}`);
      setScanError('');
      setScanValue('');
      setTimeout(() => setScanSuccess(''), 2000);
    } else {
      setScanError('No product found for this barcode / SKU.');
      setScanSuccess('');
    }
  };

  const categories = useMemo(() => {
    const cats = [...new Set((products || []).map((p) => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (products || []).filter((p) => {
      const matchSearch = !q ||
        p.name?.toLowerCase().includes(q)         ||
        p.productCode?.toLowerCase().includes(q)  ||
        p.category?.toLowerCase().includes(q)     ||
        p.hsnCode?.toLowerCase().includes(q)       ||
        p.sku?.toLowerCase().includes(q);
      const matchCat = !category || p.category === category;
      return matchSearch && matchCat;
    });
  }, [products, search, category]);

  const selectedCount = Object.values(selections).filter((q) => q > 0).length;

  // Map of productId → quantity already in the bill (from previous modal sessions)
  const alreadyInBill = useMemo(() => {
    const map = {};
    (existingItems || []).forEach((it) => {
      if (it.productId) map[it.productId] = (map[it.productId] || 0) + toNum(it.quantity);
    });
    return map;
  }, [existingItems]);

  const getRemainingStock = (product) => {
    if (product?.currentStockQty == null) return Infinity;
    return Math.max(0, product.currentStockQty - (alreadyInBill[product._id] || 0));
  };

  const bump = (id, delta) => setSelections((prev) => {
    const product       = (products || []).find((p) => p._id === id);
    const remaining     = getRemainingStock(product);
    const next          = (prev[id] || 0) + delta;
    if (next <= 0) { const { [id]: _, ...rest } = prev; return rest; }
    if (next > remaining) return prev;
    return { ...prev, [id]: next };
  });

  const handleAdd = () => {
    const added = Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const p = (products || []).find((x) => x._id === productId);
        if (!p) return null;
        return calcItem({
          ...EMPTY_ITEM,
          productId:   p._id,
          productName: p.name,
          unitPrice:   p.basePrice  || 0,
          taxRate:     p.taxRate    ?? 18,
          unit:        (p.unit || 'PCS').toUpperCase().replace('PIECE', 'PCS'),
          hsnCode:     p.hsn       || '',
          quantity:    qty,
          discountPercent: 0,
          discountAmount:  0,
        });
      })
      .filter(Boolean);
    if (added.length) onAdd(added);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
           style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Add Items to Bill</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search + Category */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200">
          <div className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 transition-colors ${showScan ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 focus-within:border-blue-400'}`}>
            {showScan ? (
              <QrCode size={14} className="text-indigo-500 flex-shrink-0" />
            ) : (
              <Search size={14} className="text-gray-400 flex-shrink-0" />
            )}
            <input
              ref={showScan ? scanRef : searchRef}
              className="flex-1 text-sm outline-none placeholder-gray-400 bg-transparent"
              placeholder={showScan ? 'Scan or type barcode / SKU / product code…' : 'Search by Item / Serial no. / HSN code / SKU / Category'}
              value={showScan ? scanValue : search}
              onChange={(e) => {
                if (showScan) { setScanValue(e.target.value); setScanError(''); setScanSuccess(''); }
                else setSearch(e.target.value);
              }}
              onKeyDown={(e) => { if (showScan && e.key === 'Enter') handleScan(); }}
            />
            {showScan && scanSuccess && (
              <span className="text-xs text-green-600 font-semibold flex-shrink-0">{scanSuccess}</span>
            )}
            <button
              onClick={() => { setShowScan((v) => !v); setScanError(''); setScanSuccess(''); setScanValue(''); }}
              title={showScan ? 'Switch to search' : 'Scan barcode'}
              className={`flex-shrink-0 p-1 rounded transition-colors ${showScan ? 'text-indigo-500 bg-indigo-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <QrCode size={15} />
            </button>
          </div>
          {!showScan && (
            <div className="relative">
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-400 appearance-none pr-8 cursor-pointer bg-white"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
          {showScan && (
            <button
              onClick={handleScan}
              className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-lg hover:bg-indigo-600 transition-colors flex-shrink-0"
            >
              Add
            </button>
          )}
        </div>
        {/* Scan error */}
        {showScan && scanError && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-100">
            <p className="text-xs text-red-500">{scanError}</p>
          </div>
        )}

        {/* Product Table */}
        <div className="overflow-y-auto flex-1">
          {showScan && Object.keys(selections).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <QrCode size={48} className="mb-4 text-gray-300" />
              <p className="text-sm">Scan items to add them to your bill</p>
              <p className="text-xs mt-1 text-gray-300">Type a barcode, SKU, or product code above and press Enter</p>
            </div>
          ) : showScan ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Item Name</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-32">Item Code</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-28">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-28">Sales Price</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-36">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(selections).map(([pid, qty]) => {
                  const p = (products || []).find((x) => x._id === pid);
                  if (!p) return null;
                  const stock     = p.currentStockQty ?? null;
                  const remaining = getRemainingStock(p);
                  const atMax     = stock != null && qty >= remaining;
                  return (
                    <tr key={pid} className="bg-blue-50">
                      <td className="px-6 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">{p.productCode || '-'}</td>
                      <td className="px-4 py-3 text-center text-xs">
                        {stock != null ? <span className={remaining <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}>{remaining} PCS</span> : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">₹ {(p.basePrice || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => bump(p._id, -1)} className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-semibold">−</button>
                          <div className="text-center">
                            <span className="w-8 inline-block text-center font-bold text-gray-800">{qty}</span>
                            {atMax && <div className="text-xs text-orange-500 leading-none mt-0.5">Max</div>}
                          </div>
                          <button onClick={() => bump(p._id, 1)} disabled={atMax} className={`w-7 h-7 rounded border flex items-center justify-center font-semibold transition-colors ${atMax ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{'+'}</button>
                          <span className="text-xs text-gray-400">PCS</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Item Name</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-32">Item Code</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-28">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-28">Sales Price</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-36">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    No products found
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const qty       = selections[p._id] || 0;
                const stock     = p.currentStockQty ?? null;
                const remaining = getRemainingStock(p);
                const atMax     = stock != null && qty >= remaining;
                const outOfStock = stock != null && remaining <= 0;
                return (
                  <tr key={p._id}
                      className={`transition-colors ${qty > 0 ? 'bg-blue-50' : outOfStock ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {p.productCode || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {stock != null ? (
                        <span className={remaining <= 0 ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                          {remaining} PCS
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      ₹ {(p.basePrice || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {qty === 0 ? (
                        <button
                          onClick={() => !outOfStock && bump(p._id, 1)}
                          disabled={outOfStock}
                          className={`px-4 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${
                            outOfStock
                              ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'text-blue-600 border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {outOfStock ? 'Out of Stock' : '+ Add'}
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => bump(p._id, -1)}
                            className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors font-semibold"
                          >−</button>
                          <div className="text-center">
                            <span className="w-8 inline-block text-center font-bold text-gray-800">{qty}</span>
                            {atMax && (
                              <div className="text-xs text-orange-500 leading-none mt-0.5">Max</div>
                            )}
                          </div>
                          <button
                            onClick={() => bump(p._id, 1)}
                            disabled={atMax}
                            className={`w-7 h-7 rounded border flex items-center justify-center font-semibold transition-colors ${
                              atMax
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                            }`}
                          >{'+'}</button>
                          <span className="text-xs text-gray-400">PCS</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {showScan ? (
              <>
                <span className="font-semibold text-gray-500">Keyboard Shortcuts:</span>
                <span>Add Item <kbd className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-600">Enter</kbd></span>
                <span>Close <kbd className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-600">ESC</kbd></span>
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-500">Keyboard Shortcuts:</span>
                <span>Change Quantity <kbd className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-600">Enter</kbd></span>
                <span>Move between items <kbd className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-600">↑</kbd> <kbd className="border border-gray-300 rounded px-1.5 py-0.5 font-mono text-gray-600">↓</kbd></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{selectedCount} Item(s) Selected</span>
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel [ESC]
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedCount === 0}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors ${
                selectedCount > 0
                  ? 'bg-gray-800 text-white hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Add to Bill [F7]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export default function QuoteFormPage() {
  const { id }   = useParams();
  const isEdit   = Boolean(id);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { list: dealers  = [] } = useSelector((s) => s.dealer);
  const { list: products = [] } = useSelector((s) => s.product);
  const { selectedQuote, loading } = useSelector((s) => s.quotes);
  const settingsData = useSelector((s) => s.settings?.data || {});

  const today    = format(new Date(), 'yyyy-MM-dd');
  const expiry30 = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  // ── Core quote fields ────────────────────────────────────────────────────
  const [quoteNo,    setQuoteNo]    = useState('');
  const [quoteDate,  setQuoteDate]  = useState(today);
  const [expiryDate, setExpiryDate] = useState(expiry30);
  const [validForDays, setValidForDays] = useState(30);
  const [showValidFor,  setShowValidFor]  = useState(true);
  const [status,     setStatus]     = useState('draft');
  const [salesman,   setSalesman]   = useState('');

  // ── Party ────────────────────────────────────────────────────────────────
  const [dealer,          setDealer]         = useState(null);
  const [dealerSearch,    setDealerSearch]   = useState('');
  const [showPartyDrop,   setShowPartyDrop]  = useState(false);
  const partyRef       = useRef(null);
  const partySearchRef = useRef(null);

  // ── Line items ───────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);

  // ── Modals ───────────────────────────────────────────────────────────────
  const [showItemModal, setShowItemModal] = useState(false);

  // ── Additional charges ───────────────────────────────────────────────────
  const [additionalCharges, setAdditionalCharges] = useState([]);

  // ── Overall discount ─────────────────────────────────────────────────────
  const [showOverallDiscount, setShowOverallDiscount] = useState(false);
  const [overallAfterTax,     setOverallAfterTax]     = useState(true);
  const [overallDiscPct,      setOverallDiscPct]       = useState(0);
  const [overallDiscFlat,     setOverallDiscFlat]      = useState(0);

  // ── Round off ────────────────────────────────────────────────────────────
  const [autoRoundOff, setAutoRoundOff] = useState(false);

  // ── Notes / Terms / Bank ─────────────────────────────────────────────────
  const [notes,       setNotes]       = useState('');
  const [showNotes,   setShowNotes]   = useState(false);
  const [terms,       setTerms]       = useState('');
  const [showTerms,   setShowTerms]   = useState(true);
  const [bankName,    setBankName]    = useState('');
  const [bankIFSC,    setBankIFSC]    = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankBranch,  setBankBranch]  = useState('');

  const [errors, setErrors] = useState({});

  // ── Outside-click close party dropdown ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (partyRef.current && !partyRef.current.contains(e.target))
        setShowPartyDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch lists + settings ───────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDealers({ limit: 500 }));
    dispatch(fetchProducts({ limit: 1000 }));
    dispatch(fetchSettings());
    if (isEdit) dispatch(fetchQuoteById(id));
  }, [dispatch, id, isEdit]);

  // ── Pre-fill bank from settings ──────────────────────────────────────────
  useEffect(() => {
    if (!isEdit && settingsData) {
      setBankName(settingsData.bankName    || '');
      setBankIFSC(settingsData.bankIFSC    || '');
      setBankAccount(settingsData.bankAccount || '');
      setBankBranch(settingsData.bankBranch  || '');
    }
  }, [settingsData, isEdit]);

  // ── Sync expiryDate when validForDays or quoteDate changes ──────────────
  useEffect(() => {
    if (validForDays >= 0 && quoteDate) {
      try {
        setExpiryDate(format(addDays(parseISO(quoteDate), validForDays), 'yyyy-MM-dd'));
      } catch (_) {}
    }
  }, [validForDays, quoteDate]);

  // ── Pre-fill on edit ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !selectedQuote || selectedQuote._id !== id) return;
    const q = selectedQuote;
    setQuoteNo(q.quoteNumber || '');
    setQuoteDate(q.quoteDate?.split('T')[0] || today);
    setExpiryDate(q.expiryDate?.split('T')[0] || expiry30);
    setValidForDays(q.validForDays ?? 30);
    setStatus(q.status || 'draft');
    setSalesman(q.salesman || '');
    setNotes(q.notes || '');
    setShowNotes(Boolean(q.notes));
    setTerms(q.termsAndConditions || '');
    setShowTerms(true);
    setBankName(q.bankDetails?.name           || settingsData.bankName    || '');
    setBankIFSC(q.bankDetails?.ifscCode        || settingsData.bankIFSC    || '');
    setBankAccount(q.bankDetails?.accountNumber || settingsData.bankAccount || '');
    setBankBranch(q.bankDetails?.bankBranch     || settingsData.bankBranch  || '');

    const d = q.dealerId;
    if (d && typeof d === 'object') setDealer(d);
    else if (q.partyName) setDealer({ businessName: q.partyName, _id: q.dealerId });

    const pre = (q.lineItems || []).map((li) => calcItem({ ...EMPTY_ITEM, ...li }));
    setItems(pre);

    if (q.additionalCharges?.length) setAdditionalCharges(q.additionalCharges);

    if (q.overallDiscount) {
      setShowOverallDiscount(true);
      setOverallAfterTax(q.overallDiscount.afterTax ?? true);
      if (q.overallDiscount.discountType === 'percent') {
        setOverallDiscPct(q.overallDiscount.value || 0);
      } else {
        setOverallDiscFlat(q.overallDiscount.value || 0);
      }
    }
    setAutoRoundOff(q.autoRoundOff || false);
  }, [selectedQuote, isEdit, id]);

  // ── Handle manual expiry date change ─────────────────────────────────────
  const handleExpiryDateChange = (val) => {
    setExpiryDate(val);
    if (val && quoteDate) {
      try {
        const diff = differenceInDays(parseISO(val), parseISO(quoteDate));
        if (diff >= 0) setValidForDays(diff);
      } catch (_) {}
    }
  };

  // ── Filtered dealers ─────────────────────────────────────────────────────
  const filteredDealers = useMemo(() =>
    (dealers || [])
      .filter((d) => d?.businessName?.toLowerCase().includes((dealerSearch || '').toLowerCase()))
      .slice(0, 50),
    [dealers, dealerSearch]
  );

  // ── Select dealer ────────────────────────────────────────────────────────
  const selectDealer = useCallback((d) => {
    setDealer(d);
    setDealerSearch('');
    setShowPartyDrop(false);
    setErrors((e) => ({ ...e, dealer: '' }));
  }, []);

  // ── Item helpers ─────────────────────────────────────────────────────────
  const updateItem = useCallback((idx, field, val) => {
    setItems((prev) => {
      const n = [...prev];
      let it = { ...n[idx], [field]: val };
      // If qty or price changed and a % discount exists, recalculate flat discount
      if ((field === 'quantity' || field === 'unitPrice') && toNum(it.discountPercent) > 0) {
        const base = toNum(it.quantity) * toNum(it.unitPrice);
        it.discountAmount = +(base * toNum(it.discountPercent) / 100).toFixed(2);
      }
      n[idx] = calcItem(it);
      return n;
    });
  }, []);

  const updateItemDiscount = useCallback((idx, field, val) => {
    setItems((prev) => {
      const n = [...prev];
      const it  = { ...n[idx] };
      const base = toNum(it.quantity) * toNum(it.unitPrice);
      if (field === 'discountPercent') {
        it.discountPercent = toNum(val);
        it.discountAmount  = base > 0 ? +(base * toNum(val) / 100).toFixed(2) : 0;
      } else {
        it.discountAmount  = toNum(val);
        it.discountPercent = base > 0 ? +(toNum(val) / base * 100).toFixed(2) : 0;
      }
      n[idx] = calcItem(it);
      return n;
    });
  }, []);

  const removeRow = useCallback((idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addProductsToItems = useCallback((newItems) => {
    setItems((prev) => {
      const merged = [...prev];
      newItems.forEach((ni) => {
        const existing = merged.findIndex((x) => x.productId === ni.productId && ni.productId);
        if (existing >= 0) {
          merged[existing] = calcItem({ ...merged[existing], quantity: merged[existing].quantity + ni.quantity });
        } else {
          merged.push(ni);
        }
      });
      return merged;
    });
    setErrors((e) => ({ ...e, items: '' }));
  }, []);

  // ── Charge helpers ───────────────────────────────────────────────────────
  const updateCharge = useCallback((idx, field, val) => {
    setAdditionalCharges((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: field === 'label' ? val : toNum(val) };
      const amt  = toNum(n[idx].amount);
      const rate = toNum(n[idx].taxRate);
      n[idx].taxAmount = +(amt * rate / 100).toFixed(2);
      return n;
    });
  }, []);

  const removeCharge = useCallback((idx) => {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Summary ──────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let baseTotal = 0, totalDiscount = 0, taxTotal = 0;
    const taxBreakdown = {};

    items.forEach((it) => {
      const ci   = calcItem(it);
      const base = toNum(it.quantity) * toNum(it.unitPrice);
      const disc = toNum(ci.discountAmount);
      baseTotal     += base;
      totalDiscount += disc;
      taxTotal      += ci.taxAmount;
      const rate = toNum(it.taxRate);
      if (rate > 0) {
        if (!taxBreakdown[rate]) taxBreakdown[rate] = { sgst: 0, cgst: 0 };
        taxBreakdown[rate].sgst += ci.taxAmount / 2;
        taxBreakdown[rate].cgst += ci.taxAmount / 2;
      }
    });

    const taxableAmount = baseTotal - totalDiscount;

    let chargeBase = 0, chargeTax = 0;
    additionalCharges.forEach((c) => {
      const a = toNum(c.amount);
      const t = +(a * (toNum(c.taxRate) / 100)).toFixed(2);
      chargeBase += a;
      chargeTax  += t;
    });

    const preDiscountTotal = taxableAmount + taxTotal + chargeBase + chargeTax;

    let overallDiscAmt = 0;
    if (showOverallDiscount) {
      if (toNum(overallDiscPct) > 0) {
        const base = overallAfterTax ? preDiscountTotal : (taxableAmount + chargeBase);
        overallDiscAmt = +(base * toNum(overallDiscPct) / 100).toFixed(2);
      } else if (toNum(overallDiscFlat) > 0) {
        overallDiscAmt = toNum(overallDiscFlat);
      }
    }

    let total = +(preDiscountTotal - overallDiscAmt).toFixed(2);

    let roundOffAmt = 0;
    if (autoRoundOff) {
      const rounded = Math.round(total);
      roundOffAmt   = +(rounded - total).toFixed(2);
      total         = rounded;
    }

    return {
      baseTotal:     +baseTotal.toFixed(2),
      totalDiscount: +totalDiscount.toFixed(2),
      taxableAmount: +taxableAmount.toFixed(2),
      taxTotal:      +(taxTotal + chargeTax).toFixed(2),
      chargeBase,
      overallDiscAmt: +overallDiscAmt.toFixed(2),
      roundOffAmt:    +roundOffAmt.toFixed(2),
      total:          +total.toFixed(2),
      taxBreakdown,
    };
  }, [items, additionalCharges, showOverallDiscount, overallDiscPct, overallDiscFlat, overallAfterTax, autoRoundOff]);

  // ── Validate ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!dealer) e.dealer = 'Please select a party';
    if (items.length === 0 || items.every((i) => !i.productName?.trim())) e.items = 'Add at least one item';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Reset form ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setDealer(null); setDealerSearch(''); setItems([]);
    setNotes(''); setShowNotes(false);
    setTerms(''); setShowTerms(true);
    setAdditionalCharges([]); setShowOverallDiscount(false);
    setOverallDiscPct(0); setOverallDiscFlat(0); setOverallAfterTax(true);
    setAutoRoundOff(false); setSalesman(''); setStatus('draft');
    setQuoteNo(''); setQuoteDate(today); setExpiryDate(expiry30); setValidForDays(30);
    setBankName(settingsData.bankName    || '');
    setBankIFSC(settingsData.bankIFSC    || '');
    setBankAccount(settingsData.bankAccount || '');
    setBankBranch(settingsData.bankBranch  || '');
    setErrors({});
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (andNew = false) => {
    if (!validate()) return;

    const validItems = items.filter((i) => i.productName?.trim()).map(calcItem);

    const payload = {
      dealerId:   dealer?._id    || '',
      partyName:  dealer?.businessName || '',
      partyPhone: dealer?.phone  || '',
      partyGST:   dealer?.gstin  || '',
      partyAddress: dealer?.address
        ? [dealer.address.street, dealer.address.city, dealer.address.state, dealer.address.pincode].filter(Boolean).join(', ')
        : '',
      salesman,
      quoteDate,
      expiryDate:  expiryDate || undefined,
      validForDays,
      quoteNumber: quoteNo    || undefined,
      status,
      lineItems:   validItems,
      additionalCharges,
      overallDiscount: showOverallDiscount && (overallDiscPct > 0 || overallDiscFlat > 0) ? {
        discountType: overallDiscPct > 0 ? 'percent' : 'amount',
        value:        overallDiscPct > 0 ? overallDiscPct : overallDiscFlat,
        afterTax:     overallAfterTax,
        amount:       summary.overallDiscAmt,
      } : null,
      autoRoundOff,
      roundOffAmount: summary.roundOffAmt,
      totalAmount:    summary.total,
      notes:              showNotes ? notes : '',
      termsAndConditions: showTerms ? terms : '',
      bankDetails: {
        name:          bankName,
        ifscCode:      bankIFSC,
        accountNumber: bankAccount,
        bankBranch,
      },
    };

    const result = isEdit
      ? await dispatch(updateQuote({ id, body: payload }))
      : await dispatch(createQuote(payload));

    if (!result.error) {
      if (andNew) resetForm();
      else navigate('/quotes');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotes')}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Quotation' : 'Create Quotation'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave(true)} disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Save &amp; New
          </button>
          <button onClick={() => handleSave(false)} disabled={loading}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 disabled:opacity-50 shadow transition-colors">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Section 1: Bill To + Quote Meta ── */}
        <div className="bg-white border-b border-gray-200 flex">

          {/* Bill To */}
          <div className="flex-1 p-6 border-r border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Bill To</div>
            {errors.dealer && <p className="text-xs text-red-500 mb-2">{errors.dealer}</p>}

            {!dealer ? (
              <div className="relative" ref={partyRef}>
                {!showPartyDrop ? (
                  <div
                    onClick={() => { setShowPartyDrop(true); setTimeout(() => partySearchRef.current?.focus(), 60); }}
                    className="border-2 border-dashed border-blue-300 rounded-xl w-80 h-28 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-blue-500 font-semibold text-sm">+ Add Party</span>
                  </div>
                ) : (
                  <div className="absolute left-0 top-0 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-400 transition-colors">
                        <input
                          ref={partySearchRef}
                          className="flex-1 text-sm outline-none placeholder-gray-400"
                          placeholder="Search party by name or number"
                          value={dealerSearch}
                          onChange={(e) => setDealerSearch(e.target.value)}
                          autoFocus
                        />
                        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                    <div className="flex text-xs font-semibold text-gray-400 px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="flex-1">Party Name</span>
                      <span>Balance</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredDealers.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400">No parties found</div>
                      )}
                      {filteredDealers.map((d) => (
                        <button
                          key={d._id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectDealer(d)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 text-left transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-800">{d.businessName}</span>
                          <span className="text-sm text-gray-500">₹ 0</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100">
                      <button className="w-full text-blue-500 text-sm font-semibold py-3 hover:bg-blue-50 transition-colors">
                        + Create Party
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-base font-bold text-gray-900">{dealer.businessName}</p>
                {dealer.address?.city && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[dealer.address.street, dealer.address.city, dealer.address.state, dealer.address.pincode]
                      .filter(Boolean).join(', ')}
                  </p>
                )}
                {dealer.phone && <p className="text-sm text-gray-400 mt-0.5">{dealer.phone}</p>}
                <button
                  onClick={() => { setDealer(null); setDealerSearch(''); setShowPartyDrop(false); }}
                  className="mt-2 text-xs text-blue-500 font-semibold hover:underline"
                >
                  Change Party
                </button>
              </div>
            )}
          </div>

          {/* Quote Meta */}
          <div className="w-96 p-5 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Quotation No:</label>
                <input
                  className="w-full text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-gray-50"
                  value={quoteNo}
                  onChange={(e) => setQuoteNo(e.target.value)}
                  placeholder="Auto"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Quotation Date:</label>
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400 bg-white">
                  <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                  <input type="date"
                    className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                  />
                  <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Valid For — dashed box */}
            {showValidFor && (
              <div className="border border-dashed border-gray-300 rounded-lg p-3 mb-3 relative">
                <button
                  onClick={() => setShowValidFor(false)}
                  className="absolute -top-2.5 -right-2.5 bg-white border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm"
                >
                  <X size={11} />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1">Valid For:</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0"
                        className="w-16 text-sm text-gray-800 border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
                        value={validForDays}
                        onChange={(e) => setValidForDays(toNum(e.target.value))}
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1">Validity Date:</label>
                    <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-1 focus-within:border-blue-400">
                      <Calendar size={11} className="text-blue-500 flex-shrink-0" />
                      <input type="date"
                        className="flex-1 text-xs font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                        value={expiryDate}
                        onChange={(e) => handleExpiryDateChange(e.target.value)}
                      />
                      <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Salesman:</label>
              <input
                className="w-full text-sm text-gray-800 bg-gray-100 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 border border-transparent focus:border-blue-400 transition-all"
                value={salesman}
                onChange={(e) => setSalesman(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Items Table ── */}
        <div className="bg-white border-b border-gray-200">
          {errors.items && <p className="text-xs text-red-500 px-5 pt-3">{errors.items}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 920 }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-10">NO</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">ITEMS / SERVICES</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-24">HSN/ SAC</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-28">QTY</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 w-28">PRICE/ITEM (₹)</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-28">DISCOUNT</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-28">TAX</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 w-28">AMOUNT (₹)</th>
                  <th className="w-10 pr-2">
                    <button
                      onClick={() => setShowItemModal(true)}
                      title="Add Item"
                      className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors mx-auto"
                    >
                      <Plus size={14} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex items-center border-t border-dashed border-gray-200">
                        <button
                          onClick={() => setShowItemModal(true)}
                          className="flex-1 border-2 border-dashed border-blue-200 rounded-xl mx-5 my-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          <Plus size={15} /> Add Item
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {items.map((item, idx) => {
                  const ci = calcItem(item);
                  return (
                    <tr key={idx} className="hover:bg-gray-50/30 group align-top">
                      <td className="px-4 pt-4 pb-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800 text-sm">{item.productName}</div>
                        <input
                          className="w-full text-xs text-gray-400 outline-none bg-transparent mt-1.5 placeholder-gray-300"
                          placeholder="Enter Description (optional)"
                          value={item.description || ''}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          className="w-full text-xs text-center text-gray-600 outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 transition-colors"
                          value={item.hsnCode || ''}
                          onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" min="1"
                            className="w-12 text-sm text-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 text-gray-800 transition-colors"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          />
                          <span className="text-xs text-gray-400">PCS</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" min="0"
                          className="w-full text-sm text-right outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 text-gray-800 transition-colors"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-xs text-gray-400">%</span>
                          <input type="number" min="0" max="100"
                            className="w-14 text-xs text-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 text-gray-800 transition-colors"
                            value={item.discountPercent || 0}
                            onChange={(e) => updateItemDiscount(idx, 'discountPercent', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1 justify-center mt-1">
                          <span className="text-xs text-gray-400">₹</span>
                          <input type="number" min="0"
                            className="w-14 text-xs text-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 text-gray-800 transition-colors"
                            value={item.discountAmount || 0}
                            onChange={(e) => updateItemDiscount(idx, 'discountAmount', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="text-xs text-blue-600 font-semibold outline-none bg-transparent cursor-pointer block"
                          value={item.taxRate}
                          onChange={(e) => updateItem(idx, 'taxRate', Number(e.target.value))}
                        >
                          {GST_RATES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        {ci.taxAmount > 0 && (
                          <p className="text-xs text-gray-400 mt-1">(₹ {ci.taxAmount.toFixed(2)})</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-800">
                          ₹ {ci.lineTotal.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => removeRow(idx)}
                          className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Add Item row (when items exist) */}
                {items.length > 0 && (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <div className="flex items-center border-t border-dashed border-gray-200">
                        <button
                          onClick={() => setShowItemModal(true)}
                          className="flex-1 border-2 border-dashed border-blue-200 rounded-xl mx-5 my-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          <Plus size={15} /> Add Item
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Subtotal footer */}
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    SUBTOTAL
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">
                    ₹ {summary.totalDiscount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">
                    ₹ {summary.taxTotal.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-700">
                    ₹ {(summary.taxableAmount + summary.taxTotal).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Section 3: Footer ── */}
        <div className="bg-white flex flex-wrap">

          {/* Left: Notes + T&C + Bank Details */}
          <div className="flex-1 p-6 border-r border-gray-200" style={{ minWidth: 300, maxWidth: 780 }}>

            {/* Notes */}
            {!showNotes ? (
              <button onClick={() => setShowNotes(true)}
                className="flex items-center gap-1 text-sm font-semibold text-blue-500 hover:underline mb-4">
                <Plus size={14} /> Add Notes
              </button>
            ) : (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Notes</span>
                  <button onClick={() => { setShowNotes(false); setNotes(''); }}>
                    <X size={15} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <textarea rows={3} autoFocus
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-2.5 outline-none resize-none focus:border-blue-400 transition-colors"
                  placeholder="Notes for customer…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Terms & Conditions */}
            {showTerms ? (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Terms and Conditions</span>
                  <button onClick={() => setShowTerms(false)}>
                    <X size={16} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <textarea rows={3}
                    className="w-full bg-transparent text-sm text-gray-600 outline-none resize-none"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <button onClick={() => setShowTerms(true)}
                className="flex items-center gap-1 text-sm font-semibold text-blue-500 hover:underline mb-5">
                <Plus size={14} /> Add Terms &amp; Conditions
              </button>
            )}

            {/* Bank Details */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3">Bank Details</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Account Number</label>
                  <input
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-gray-50 transition-colors"
                    placeholder="—"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">IFSC Code</label>
                  <input
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-gray-50 transition-colors"
                    placeholder="—"
                    value={bankIFSC}
                    onChange={(e) => setBankIFSC(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Bank &amp; Branch Name</label>
                  <input
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-gray-50 transition-colors"
                    placeholder="—"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-0.5">Account Holder's Name</label>
                  <input
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-gray-50 transition-colors"
                    placeholder="—"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="flex-1 p-6" style={{ minWidth: 320 }}>

            {/* Additional Charges */}
            <div className="border-b border-gray-100 pb-2 mb-1">
              {additionalCharges.length === 0 ? (
                <button
                  onClick={() => setAdditionalCharges([{ ...EMPTY_CHARGE }])}
                  className="w-full flex items-center justify-between text-sm font-semibold text-blue-500 hover:underline py-1"
                >
                  <span>+ Add Additional Charges</span>
                  <span className="text-gray-500 text-sm font-normal">₹ 0</span>
                </button>
              ) : (
                <div>
                  {additionalCharges.map((c, i) => {
                    const chargeTax = +(toNum(c.amount) * (toNum(c.taxRate) / 100)).toFixed(2);
                    const inclTax   = +(toNum(c.amount) + chargeTax).toFixed(2);
                    return (
                    <div key={i} className="mb-3">
                      <div className="flex items-center gap-1.5">
                        {/* Label — 2 parts */}
                        <input
                          className="min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 placeholder-gray-400 transition-colors"
                          style={{ flex: '2 1 0%' }}
                          placeholder="Charge name"
                          value={c.label}
                          onChange={(e) => updateCharge(i, 'label', e.target.value)}
                        />
                        {/* Amount — 1 part */}
                        <div className="flex items-center border border-gray-200 rounded-lg px-1.5 py-1.5 focus-within:border-blue-400 transition-colors" style={{ flex: '1 1 0%', minWidth: 0 }}>
                          <span className="text-xs text-gray-400 mr-0.5 flex-shrink-0">₹</span>
                          <input type="number" min="0"
                            className="min-w-0 w-full text-xs outline-none bg-transparent text-gray-800"
                            placeholder="0"
                            value={c.amount || ''}
                            onChange={(e) => updateCharge(i, 'amount', e.target.value)}
                          />
                        </div>
                        {/* Tax — 1 part */}
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-1 py-1.5 outline-none bg-white cursor-pointer focus:border-blue-400 transition-colors"
                          style={{ flex: '1 1 0%', minWidth: 0 }}
                          value={c.taxRate}
                          onChange={(e) => updateCharge(i, 'taxRate', e.target.value)}
                        >
                          {CHARGE_TAXES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        {/* Remove */}
                        <button onClick={() => removeCharge(i)} className="flex-shrink-0 hover:bg-gray-100 rounded-full p-0.5 transition-colors">
                          <X size={14} className="text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                      {toNum(c.taxRate) > 0 && toNum(c.amount) > 0 && (
                        <div className="flex justify-between text-xs text-gray-500 mt-1.5 px-1">
                          <span>Amount incl. of tax</span>
                          <span className="font-semibold text-gray-700">₹ {inclTax}</span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                  <button
                    onClick={() => setAdditionalCharges((prev) => [...prev, { ...EMPTY_CHARGE }])}
                    className="text-blue-500 text-xs font-semibold hover:underline"
                  >
                    + Add Another Charge
                  </button>
                </div>
              )}
            </div>

            {/* Taxable Amount */}
            <div className="flex justify-between text-sm py-2 border-b border-gray-100">
              <span className="text-gray-600">Taxable Amount</span>
              <span className="text-gray-800">₹ {summary.taxableAmount.toFixed(2)}</span>
            </div>

            {/* Tax Breakdown */}
            {Object.entries(summary.taxBreakdown).map(([rate, val]) => (
              <React.Fragment key={rate}>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">SGST@{Number(rate) / 2}</span>
                  <span className="text-gray-700">₹ {val.sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">CGST@{Number(rate) / 2}</span>
                  <span className="text-gray-700">₹ {val.cgst.toFixed(2)}</span>
                </div>
              </React.Fragment>
            ))}

            {/* Overall Discount */}
            <div className="border-b border-gray-100">
              {!showOverallDiscount ? (
                <button
                  onClick={() => setShowOverallDiscount(true)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-blue-500 hover:underline py-2"
                >
                  <span>+ Add Discount</span>
                  <span className="text-gray-500 font-normal">- ₹ 0</span>
                </button>
              ) : (
                <div className="py-2">
                  {/* Single row: type selector + % / ₹ + X */}
                  <div className="flex items-center gap-2 mb-1">
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white cursor-pointer flex-shrink-0"
                      value={overallAfterTax ? 'after' : 'before'}
                      onChange={(e) => setOverallAfterTax(e.target.value === 'after')}
                    >
                      <option value="after">Discount After Tax</option>
                      <option value="before">Discount Before Tax</option>
                    </select>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 flex-1">
                      <span className="text-xs text-gray-400 flex-shrink-0">%</span>
                      <input type="number" min="0" max="100"
                        className="w-full text-xs text-center outline-none bg-transparent"
                        value={overallDiscPct || ''}
                        placeholder="0"
                        onChange={(e) => { setOverallDiscPct(toNum(e.target.value)); setOverallDiscFlat(0); }}
                      />
                    </div>
                    <span className="text-gray-400 text-sm font-light flex-shrink-0 w-4 text-center">/</span>
                    <div className={`flex items-center gap-1 border rounded-lg px-2 py-1.5 flex-1 ${overallDiscPct > 0 ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}`}>
                      <span className="text-xs text-gray-400 flex-shrink-0">₹</span>
                      <input type="number" min="0"
                        className="w-full text-xs text-center outline-none bg-transparent"
                        value={overallDiscPct > 0 ? summary.overallDiscAmt || '' : overallDiscFlat || ''}
                        placeholder="0"
                        readOnly={overallDiscPct > 0}
                        onChange={(e) => { if (overallDiscPct > 0) return; setOverallDiscFlat(toNum(e.target.value)); setOverallDiscPct(0); }}
                      />
                    </div>
                    <button onClick={() => { setShowOverallDiscount(false); setOverallDiscPct(0); setOverallDiscFlat(0); }}>
                      <X size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                  {summary.overallDiscAmt > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-red-500">- ₹ {summary.overallDiscAmt.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto Round Off */}
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRoundOff"
                  checked={autoRoundOff}
                  onChange={(e) => setAutoRoundOff(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 cursor-pointer accent-blue-500"
                />
                <label htmlFor="autoRoundOff" className="text-sm text-gray-700 cursor-pointer">
                  Auto Round Off
                </label>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <span className="text-xs border border-gray-200 rounded px-2 py-0.5 text-gray-500">
                  {summary.roundOffAmt >= 0 ? '+ Add' : '− Less'}
                </span>
                <span className="text-gray-400">₹</span>
                <span>{Math.abs(summary.roundOffAmt).toFixed(2)}</span>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex justify-between items-center py-3 mt-1">
              <span className="text-base font-bold text-gray-800">Total Amount</span>
              <span className="text-2xl font-black text-gray-900">
                ₹ {summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Authorized Signatory */}
            <div className="mt-3 text-right">
              <p className="text-xs text-gray-500">
                Authorized signatory for{' '}
                <strong className="text-gray-700">{settingsData?.companyName || 'Your Company'}</strong>
              </p>
              <div className="border border-gray-300 rounded-lg h-16 mt-2" />
            </div>
          </div>
        </div>

      </div>{/* end body */}

      {/* ── Modals ── */}
      {showItemModal && (
        <AddItemModal
          products={products}
          existingItems={items}
          onAdd={addProductsToItems}
          onClose={() => setShowItemModal(false)}
        />
      )}
    </div>
  );
}
