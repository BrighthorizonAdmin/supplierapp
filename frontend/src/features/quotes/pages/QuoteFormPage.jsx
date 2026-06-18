import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createQuote, updateQuote, fetchQuoteById } from '../quoteSlice';
import { fetchDealers } from '../../dealer/dealerSlice';
import { fetchProducts } from '../../products/productSlice';
import { fetchSettings } from '../../notifications/settingsSlice';
import { ArrowLeft, Plus, Trash2, X, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS     = ['PCS', 'KG', 'LTR', 'BOX', 'DZN', 'MTR', 'PACK', 'SET', 'BAG', 'NOS'];

const EMPTY_ITEM = {
  productId: '', productName: '', description: '', hsnCode: '',
  quantity: 1, unit: 'PCS', unitPrice: 0, taxRate: 0, taxAmount: 0, lineTotal: 0,
};

const toNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

const calcItem = (item) => {
  const qty     = toNum(item.quantity);
  const price   = toNum(item.unitPrice);
  const taxable = qty * price;
  const tax     = taxable * (toNum(item.taxRate) / 100);
  return { ...item, taxAmount: +tax.toFixed(2), lineTotal: +(taxable + tax).toFixed(2) };
};

const calcSummary = (items) => {
  const subtotal  = items.reduce((s, i) => s + toNum(i.quantity) * toNum(i.unitPrice), 0);
  const taxAmount = items.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const total     = subtotal + taxAmount;
  const taxBreakdown = {};
  items.forEach((item) => {
    const rate = toNum(item.taxRate);
    if (!rate) return;
    if (!taxBreakdown[rate]) taxBreakdown[rate] = { sgst: 0, cgst: 0 };
    taxBreakdown[rate].sgst += (item.taxAmount || 0) / 2;
    taxBreakdown[rate].cgst += (item.taxAmount || 0) / 2;
  });
  return { subtotal, taxAmount, total, taxBreakdown };
};

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

  // ── Form state ────────────────────────────────────────────────────
  const [quoteNo,       setQuoteNo]       = useState('');
  const [quoteDate,     setQuoteDate]     = useState(today);
  const [expiryDate,    setExpiryDate]    = useState(expiry30);
  const [status,        setStatus]        = useState('draft');
  const [dealer,        setDealer]        = useState(null);
  const [dealerSearch,  setDealerSearch]  = useState('');
  const [partyPhone,    setPartyPhone]    = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [shippingName,  setShippingName]  = useState('');
  const [salesman,      setSalesman]      = useState('');
  const [items,         setItems]         = useState([{ ...EMPTY_ITEM }]);
  const [notes,         setNotes]         = useState('');
  const [showNotes,     setShowNotes]     = useState(false);
  const [terms,         setTerms]         = useState('');
  const [showTerms,     setShowTerms]     = useState(false);
  const [bankName,      setBankName]      = useState('');
  const [bankIFSC,      setBankIFSC]      = useState('');
  const [bankAccount,   setBankAccount]   = useState('');
  const [bankBranch,    setBankBranch]    = useState('');
  const [errors,        setErrors]        = useState({});

  // ── Product / dealer dropdown refs ───────────────────────────────
  const [prodSearch,     setProdSearch]     = useState({});
  const [showProdDrop,   setShowProdDrop]   = useState({});
  const [showDealerDrop, setShowDealerDrop] = useState(false);
  const prodRefs  = useRef({});
  const dealerRef = useRef(null);

  // ── Outside-click close ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dealerRef.current && !dealerRef.current.contains(e.target)) setShowDealerDrop(false);
      Object.keys(prodRefs.current).forEach((i) => {
        if (prodRefs.current[i] && !prodRefs.current[i].contains(e.target))
          setShowProdDrop((p) => ({ ...p, [i]: false }));
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch lists + settings ────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDealers({ limit: 500 }));
    dispatch(fetchProducts({ limit: 1000 }));
    dispatch(fetchSettings());
    if (isEdit) dispatch(fetchQuoteById(id));
  }, [dispatch, id, isEdit]);

  // ── Pre-fill bank details from company settings (create mode) ────
  useEffect(() => {
    if (!isEdit && settingsData) {
      setBankName(settingsData.bankName    || '');
      setBankIFSC(settingsData.bankIFSC    || '');
      setBankAccount(settingsData.bankAccount || '');
      setBankBranch(settingsData.bankBranch  || '');
    }
  }, [settingsData, isEdit]);

  // ── Pre-fill on edit ──────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !selectedQuote || selectedQuote._id !== id) return;
    const q = selectedQuote;
    setQuoteNo(q.quoteNumber || '');
    setQuoteDate(q.quoteDate?.split('T')[0] || today);
    setExpiryDate(q.expiryDate?.split('T')[0] || '');
    setStatus(q.status || 'draft');
    setPlaceOfSupply(q.placeOfSupply || '');
    setShippingName(q.shippingName || '');
    setSalesman(q.salesman || '');
    setNotes(q.notes || '');
    setShowNotes(Boolean(q.notes));
    setTerms(q.termsAndConditions || '');
    setShowTerms(Boolean(q.termsAndConditions));
    setPartyPhone(q.partyPhone || '');
    setBankName(q.bankDetails?.name          || settingsData.bankName    || '');
    setBankIFSC(q.bankDetails?.ifscCode       || settingsData.bankIFSC    || '');
    setBankAccount(q.bankDetails?.accountNumber || settingsData.bankAccount || '');
    setBankBranch(q.bankDetails?.bankBranch    || settingsData.bankBranch  || '');
    const d = q.dealerId;
    if (d && typeof d === 'object') { setDealer(d); setDealerSearch(d.businessName || ''); }
    else if (q.partyName) setDealerSearch(q.partyName);
    const pre = q.lineItems?.length ? q.lineItems.map((li) => calcItem({ ...EMPTY_ITEM, ...li })) : [{ ...EMPTY_ITEM }];
    setItems(pre);
    const ps = {};
    pre.forEach((li, i) => { ps[i] = li.productName || ''; });
    setProdSearch(ps);
  }, [selectedQuote, isEdit, id]);

  // ── Auto ship name from dealer (create mode) ──────────────────────
  useEffect(() => {
    if (dealer && !isEdit) setShippingName(dealer.businessName || '');
  }, [dealer]);

  // ── Item helpers ──────────────────────────────────────────────────
  const updateItem = (idx, field, val) =>
    setItems((p) => { const n = [...p]; n[idx] = calcItem({ ...n[idx], [field]: val }); return n; });

  const pickProduct = (idx, p) => {
    setItems((prev) => {
      const n = [...prev];
      n[idx] = calcItem({ ...n[idx], productId: p._id, productName: p.name, unitPrice: p.basePrice || 0, taxRate: p.taxRate || 0, unit: (p.unit || 'PCS').toUpperCase(), hsnCode: p.hsnCode || '' });
      return n;
    });
    setProdSearch((p2) => ({ ...p2, [idx]: p.name }));
    setShowProdDrop((p2) => ({ ...p2, [idx]: false }));
    setErrors((e) => ({ ...e, items: '' }));
  };

  const addRow    = () => { const idx = items.length; setItems((p) => [...p, { ...EMPTY_ITEM }]); setProdSearch((p) => ({ ...p, [idx]: '' })); };
  const removeRow = (idx) => {
    setItems((p) => p.filter((_, i) => i !== idx));
    setProdSearch((p) => { const n = { ...p }; delete n[idx]; return n; });
    setShowProdDrop((p) => { const n = { ...p }; delete n[idx]; return n; });
  };

  // ── Filtered lists ────────────────────────────────────────────────
  const filteredDealers = (dealers || [])
    .filter((d) => d?.businessName?.toLowerCase().includes((dealerSearch || '').toLowerCase()))
    .slice(0, 8);

  const getFilteredProds = (idx) => {
    const q = ((prodSearch[idx] ?? items[idx]?.productName) || '').toLowerCase();
    if (!q) return [];
    return (products || []).filter((p) => p?.name?.toLowerCase().includes(q)).slice(0, 8);
  };

  // ── Summary ───────────────────────────────────────────────────────
  const calcedItems = items.map(calcItem);
  const summary     = calcSummary(calcedItems);

  // ── Validate ──────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!dealer && !dealerSearch.trim()) e.dealer = 'Please select or enter a party name';
    if (items.every((i) => !i.productName?.trim())) e.items = 'Add at least one item';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = async (andNew = false) => {
    if (!validate()) return;
    const payload = {
      dealerId:           dealer?._id || '',
      partyName:          dealer?.businessName || dealerSearch.trim(),
      partyPhone,
      partyGST:           dealer?.gstin || '',
      partyAddress:       dealer
        ? [dealer.address?.street, dealer.address?.city, dealer.address?.state, dealer.address?.pincode].filter(Boolean).join(', ')
        : '',
      placeOfSupply,
      shippingName:       shippingName || dealer?.businessName || dealerSearch.trim(),
      salesman,
      quoteDate,
      expiryDate:         expiryDate || undefined,
      quoteNumber:        quoteNo || undefined,
      status,
      lineItems:          calcedItems,
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
      if (andNew) {
        setDealer(null); setDealerSearch(''); setItems([{ ...EMPTY_ITEM }]); setProdSearch({});
        setNotes(''); setTerms(''); setPlaceOfSupply(''); setShippingName(''); setSalesman('');
        setShowNotes(false); setShowTerms(false); setQuoteNo('');
        setQuoteDate(today); setExpiryDate(expiry30); setStatus('draft'); setErrors({});
        setPartyPhone('');
        setBankName(settingsData.bankName    || '');
        setBankIFSC(settingsData.bankIFSC    || '');
        setBankAccount(settingsData.bankAccount || '');
        setBankBranch(settingsData.bankBranch  || '');
      } else {
        navigate('/quotes');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotes')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">{isEdit ? 'Edit Quote' : 'Create Quote'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave(true)} disabled={loading} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors">
            Save &amp; New
          </button>
          <button onClick={() => handleSave(false)} disabled={loading} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow transition-colors">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Centre panel ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Bill To / Ship To */}
          <div className="bg-white border-b border-gray-200">
            <div className="grid grid-cols-2 divide-x divide-gray-200">

              {/* Bill To */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bill To</span>
                  {dealer && (
                    <button
                      onClick={() => { setDealer(null); setDealerSearch(''); setPartyPhone(''); setTimeout(() => setShowDealerDrop(true), 50); }}
                      className="px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-300 rounded-full hover:bg-blue-50"
                    >
                      Change Party
                    </button>
                  )}
                </div>

                {errors.dealer && <p className="text-xs text-red-500 mb-2">{errors.dealer}</p>}

                {/* Dealer selector */}
                {dealer ? (
                  <div className="relative group">
                    <p className="font-bold text-gray-900 text-base">{dealer.businessName}</p>
                    {dealer.address?.city && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[dealer.address.street, dealer.address.city, dealer.address.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <button
                      onClick={() => { setDealer(null); setDealerSearch(''); setPartyPhone(''); }}
                      className="absolute top-0 right-0 p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={dealerRef}>
                    <input
                      className="w-full text-sm border-b-2 border-dashed border-gray-300 pb-1 outline-none focus:border-blue-500 bg-transparent placeholder-gray-400 font-medium transition-colors"
                      placeholder="Search or type party name..."
                      value={dealerSearch}
                      onChange={(e) => { setDealerSearch(e.target.value); setShowDealerDrop(true); setErrors((er) => ({ ...er, dealer: '' })); }}
                      onFocus={() => setShowDealerDrop(true)}
                    />
                    {showDealerDrop && filteredDealers.length > 0 && (
                      <div className="absolute z-50 left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                        {filteredDealers.map((d) => (
                          <button
                            key={d._id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setDealer(d);
                              setDealerSearch(d.businessName);
                              setPartyPhone(d.phone || '');
                              setShowDealerDrop(false);
                              setErrors((er) => ({ ...er, dealer: '' }));
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                          >
                            <p className="text-sm font-semibold text-gray-800">{d.businessName}</p>
                            <p className="text-xs text-gray-400">{d.dealerCode}{d.phone ? ` · ${d.phone}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile number — always editable */}
                <div className="mt-3">
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Mobile</label>
                  <input
                    className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                    placeholder="Mobile number"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                  />
                </div>

                {/* Place of Supply */}
                <div className="mt-3">
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Place of Supply</label>
                  <input
                    className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                    placeholder="e.g. Telangana"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                  />
                </div>
              </div>

              {/* Ship To */}
              <div className="p-5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-3">Ship To</span>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1">Name</label>
                    <input
                      className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 font-medium transition-colors"
                      placeholder="Ship to name"
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1">Salesman</label>
                    <input
                      className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                      placeholder="Salesman name"
                      value={salesman}
                      onChange={(e) => setSalesman(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border-b border-gray-200">
            {errors.items && <p className="text-xs text-red-500 px-4 pt-3">{errors.items}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-8">NO</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">ITEMS</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-24">HSN</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-28">QTY.</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-28">RATE (₹)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-24">TAX %</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-28">AMOUNT (₹)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const row      = calcItem(item);
                    const searchVal = prodSearch[idx] ?? item.productName ?? '';
                    const filtered  = getFilteredProds(idx);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/40 group align-top">
                        <td className="px-3 pt-4 pb-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="relative" ref={(el) => { if (el) prodRefs.current[idx] = el; }}>
                            <input
                              className="w-full font-medium text-gray-800 text-sm outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent pb-0.5 placeholder-gray-400 transition-colors"
                              placeholder="Type or select item"
                              value={searchVal}
                              onChange={(e) => { const v = e.target.value; setProdSearch((p) => ({ ...p, [idx]: v })); updateItem(idx, 'productName', v); setShowProdDrop((p) => ({ ...p, [idx]: true })); setErrors((er) => ({ ...er, items: '' })); }}
                              onFocus={() => setShowProdDrop((p) => ({ ...p, [idx]: true }))}
                            />
                            {showProdDrop[idx] && filtered.length > 0 && (
                              <div className="absolute z-40 left-0 mt-0.5 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                                {filtered.map((p) => (
                                  <button key={p._id} onMouseDown={(e) => e.preventDefault()} onClick={() => pickProduct(idx, p)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                    <p className="text-xs text-gray-400">₹{p.basePrice} · {p.unit}{p.productCode ? ` · ${p.productCode}` : ''}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                            <input
                              className="w-full text-xs text-gray-400 outline-none bg-transparent mt-1.5 placeholder-gray-300"
                              placeholder="Description (optional)"
                              value={item.description || ''}
                              onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="w-full text-sm text-center outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-600 placeholder-gray-300"
                            placeholder="HSN"
                            value={item.hsnCode || ''}
                            onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <input type="number" min="1"
                              className="w-14 text-sm text-center outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-800 transition-colors"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            />
                            <select
                              className="text-xs text-gray-500 outline-none bg-transparent border border-gray-200 rounded px-1 py-0.5 cursor-pointer"
                              value={item.unit}
                              onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                            >
                              {UNITS.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" min="0"
                            className="w-full text-sm text-right outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-800"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            className="text-xs text-blue-600 font-semibold outline-none bg-transparent cursor-pointer block mb-1"
                            value={item.taxRate}
                            onChange={(e) => updateItem(idx, 'taxRate', Number(e.target.value))}
                          >
                            {GST_RATES.map((r) => <option key={r} value={r}>{r === 0 ? 'No Tax' : `${r}%`}</option>)}
                          </select>
                          {row.taxAmount > 0 && <p className="text-xs text-gray-400">(₹ {row.taxAmount.toFixed(2)})</p>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-800">₹ {row.lineTotal.toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-3">
                          {items.length > 1 && (
                            <button onClick={() => removeRow(idx)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add item button */}
            <div className="border-t border-dashed border-gray-200 px-4 py-3">
              <button onClick={addRow}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 border-2 border-dashed border-blue-200 rounded-xl py-2.5 w-full hover:bg-blue-50 transition-colors">
                <Plus size={16} /> Add Item
              </button>
            </div>

            {/* Subtotal bar */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-500">
              <span className="text-gray-700">SUBTOTAL — {items.filter((i) => i.productName?.trim()).length} item(s)</span>
              <div className="flex items-center gap-8">
                <span>Tax: ₹ {summary.taxAmount.toFixed(2)}</span>
                <span className="text-gray-800 text-sm font-bold">₹ {summary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes + Terms */}
          <div className="bg-white border-b border-gray-200 px-5 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                {!showNotes ? (
                  <button onClick={() => setShowNotes(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                    <Plus size={14} /> Add Notes
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Notes</span>
                      <button onClick={() => { setShowNotes(false); setNotes(''); }} className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
                    </div>
                    <textarea autoFocus rows={3}
                      className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-2.5 outline-none resize-none focus:border-blue-400 transition-colors"
                      placeholder="Notes for customer..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div>
                {!showTerms ? (
                  <button onClick={() => setShowTerms(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                    <Plus size={14} /> Add Terms &amp; Conditions
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Terms and Conditions</span>
                      <button onClick={() => setShowTerms(false)} className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
                    </div>
                    <textarea rows={3}
                      className="w-full text-sm text-gray-500 border border-gray-200 rounded-lg p-2.5 outline-none resize-none focus:border-blue-400"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bg-white border-b border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Bank Details</span>
              <span className="text-xs text-gray-400">Appears on the quotation PDF</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1">Account Holder Name</label>
                <input
                  className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                  placeholder="Name on account"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1">IFSC Code</label>
                <input
                  className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                  placeholder="e.g. KKBK0007475"
                  value={bankIFSC}
                  onChange={(e) => setBankIFSC(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1">Account Number</label>
                <input
                  className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                  placeholder="Account number"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1">Bank &amp; Branch</label>
                <input
                  className="w-full text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent pb-0.5 placeholder-gray-300 transition-colors"
                  placeholder="e.g. Kotak Mahindra Bank, KPHB"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>{/* end centre panel */}

        {/* ── Right panel ── */}
        <div className="w-72 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto flex flex-col">

          {/* Quote No + Date + Expiry */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Quote No.</label>
              <input
                className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                value={quoteNo}
                onChange={(e) => setQuoteNo(e.target.value)}
                placeholder="Auto"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Quote Date</label>
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                <input type="date"
                  className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Expiry Date</label>
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                <Calendar size={13} className="text-orange-400 flex-shrink-0" />
                <input type="date"
                  className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="p-4 border-b border-gray-100">
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">Status</label>
            <select
              className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white cursor-pointer"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Summary */}
          <div className="p-4 border-b border-gray-100 space-y-2.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span className="font-medium">Taxable Amount</span>
              <span>₹ {summary.subtotal.toFixed(2)}</span>
            </div>
            {Object.entries(summary.taxBreakdown).map(([rate, val]) => (
              <div key={rate} className="space-y-1">
                <div className="flex justify-between text-sm text-gray-500"><span>SGST @ {rate / 2}%</span><span>₹ {val.sgst.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>CGST @ {rate / 2}%</span><span>₹ {val.cgst.toFixed(2)}</span></div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="px-4 py-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <span className="text-base font-bold text-gray-800">Total Amount</span>
            <span className="text-xl font-black text-gray-900">₹ {summary.total.toFixed(2)}</span>
          </div>

          {/* Signatory note */}
          <div className="p-4">
            <p className="text-xs text-gray-400 text-right leading-relaxed">
              Authorized signatory for<br />
              <span className="font-semibold text-gray-600">{dealer?.businessName || 'Your Company'}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
