import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createInvoice, updateInvoice, fetchInvoiceById } from '../paymentSlice';
import { fetchDealers } from '../../dealer/dealerSlice';
import { fetchProducts } from '../../products/productSlice';
import {
  ArrowLeft, Settings, Plus, Trash2, X, Calendar, Search,
  Edit2, Barcode, ChevronDown, CheckCircle2, Circle,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const GST_RATES = [0, 5, 12, 18, 28];
const UNITS     = ['PCS','KG','LTR','BOX','DZN','MTR','PACK','SET','BAG','NOS'];
const PAY_MODES = ['Cash','UPI','Bank Transfer','Cheque','NEFT','RTGS'];
const CATEGORIES = ['All','Electronics','Food','Clothing','Furniture','Stationery','Other'];

const EMPTY_ITEM = {
  productId:'', productName:'', description:'', hsnCode:'',
  quantity:1, unit:'PCS', unitPrice:0,
  discountType:'%', discountValue:0,
  taxRate:0, taxAmount:0, lineTotal:0, _discAmt:0, _taxable:0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

const calcItem = (item) => {
  const qty     = toNum(item.quantity);
  const price   = toNum(item.unitPrice);
  const base    = qty * price;
  const discVal = toNum(item.discountValue);
  const discAmt = item.discountType === '%'
    ? base * (Math.min(Math.max(discVal, 0), 100) / 100)
    : Math.min(Math.max(discVal, 0), base);
  const taxable = Math.max(0, base - discAmt);
  const tax     = taxable * (toNum(item.taxRate) / 100);
  return { ...item, taxAmount:+tax.toFixed(2), lineTotal:+(taxable+tax).toFixed(2), _discAmt:+discAmt.toFixed(2), _taxable:+taxable.toFixed(2) };
};

const calcSummary = (items, addlCharges, invoiceDisc, amtReceived, roundOff) => {
  const totalDisc  = items.reduce((s,i) => s+(i._discAmt||0),  0);
  const taxableAmt = items.reduce((s,i) => s+(i._taxable||0),  0);
  const totalTax   = items.reduce((s,i) => s+(i.taxAmount||0), 0);
  const addlAmt    = toNum(addlCharges);
  const extraDisc  = toNum(invoiceDisc);
  let   total      = taxableAmt + totalTax + addlAmt - extraDisc;
  let   roundOffAmt = 0;
  if (roundOff) { roundOffAmt = +(Math.round(total)-total).toFixed(2); total = Math.round(total); }
  const balance = Math.max(0, total - toNum(amtReceived));
  const taxBreakdown = {};
  items.forEach((item) => {
    const rate = toNum(item.taxRate); if (!rate) return;
    if (!taxBreakdown[rate]) taxBreakdown[rate] = { sgst:0, cgst:0 };
    taxBreakdown[rate].sgst += (item.taxAmount||0)/2;
    taxBreakdown[rate].cgst += (item.taxAmount||0)/2;
  });
  return { totalDisc, taxableAmt, totalTax, addlAmt, extraDisc, roundOffAmt, total, balance, taxBreakdown };
};

// ── Reusable Modal wrapper ────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  const w = { sm:'max-w-md', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${w[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function InvoiceFormPage() {
  const { id }   = useParams();
  const isEdit   = Boolean(id);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { list: dealers  = [] } = useSelector((s) => s.dealer);
  const { list: products = [] } = useSelector((s) => s.product);
  const { selectedInvoice, loading } = useSelector((s) => s.payment);
  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Core form state ───────────────────────────────────────────────────────
  const [invoiceNo,   setInvoiceNo]   = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [paymentDays, setPaymentDays] = useState(30);
  const [dueDate,     setDueDate]     = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dealer,      setDealer]      = useState(null);
  const [shipAddress, setShipAddress] = useState(null); // selected shipping address
  const [items,       setItems]       = useState([{ ...EMPTY_ITEM }]);
  const [notes,       setNotes]       = useState('');
  const [showNotes,   setShowNotes]   = useState(false);
  const [terms,       setTerms]       = useState('1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to [ENTER_YOUR_CITY_NAME] jurisdiction only');
  const [showTerms,   setShowTerms]   = useState(true);
  const [addlCharges, setAddlCharges] = useState(0);
  const [showAddlChg, setShowAddlChg] = useState(false);
  const [addlLabel,   setAddlLabel]   = useState('Additional Charges');
  const [invoiceDisc, setInvoiceDisc] = useState(0);
  const [showDisc,    setShowDisc]    = useState(false);
  const [roundOff,    setRoundOff]    = useState(false);
  const [amtReceived, setAmtReceived] = useState(0);
  const [payMode,     setPayMode]     = useState('Cash');
  const [markPaid,    setMarkPaid]    = useState(false);
  const [bankAccount, setBankAccount] = useState(null);
  const [errors,      setErrors]      = useState({});

  // ── Modal visibility ──────────────────────────────────────────────────────
  const [showItemModal,    setShowItemModal]    = useState(false);
  const [showShipModal,    setShowShipModal]    = useState(false);
  const [showBankModal,    setShowBankModal]    = useState(false);
  const [showSettingsModal,setShowSettingsModal]= useState(false);
  const [showSignModal,    setShowSignModal]    = useState(false);

  // ── Settings state ────────────────────────────────────────────────────────
  const [settings, setSettings] = useState({
    invoicePrefix: false,
    showPurchasePrice: true,
    showItemImage: false,
    priceHistory: false,
    invoiceTheme: 'Luxury',
  });
  const [invoicePrefix,   setInvoicePrefix]   = useState('');
  const [invoiceSequence, setInvoiceSequence] = useState(1);

  // ── Create New Item modal state ───────────────────────────────────────────
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    itemType: 'Product', category: '', name: '', showOnline: false,
    salesPrice: '', priceWithTax: false, gstRate: 'None',
    measuringUnit: 'Pieces(PCS)', openingStock: '',
  });
  const [createItemTab, setCreateItemTab] = useState('basic');

  // ── Add Items modal state ─────────────────────────────────────────────────
  const [itemModalSearch,   setItemModalSearch]   = useState('');
  const [itemModalCategory, setItemModalCategory] = useState('All');
  const [selectedModalItems,setSelectedModalItems]= useState({}); // { productId: qty }

  // ── Shipping address modal ────────────────────────────────────────────────
  const [shipAddresses, setShipAddresses]   = useState([]); // built from dealer
  const [selectedShipId, setSelectedShipId] = useState(null);
  const [editingShipIdx, setEditingShipIdx] = useState(null);
  const [newShipAddress, setNewShipAddress] = useState({ label:'', street:'', city:'', state:'', pincode:'' });
  const [showAddShip,    setShowAddShip]    = useState(false);

  // ── Bank account modal state ──────────────────────────────────────────────
  const [bankForm, setBankForm] = useState({
    label:'', openingBalance:'', asOfDate: today, addBankDetails: true,
    accountNumber:'', reAccountNumber:'', ifscCode:'', branchName:'', holderName:'', upiId:'',
  });

  // ── Dealer search ─────────────────────────────────────────────────────────
  const [dealerSearch,   setDealerSearch]   = useState('');
  const [showDealerDrop, setShowDealerDrop] = useState(false);
  const dealerRef = useRef(null);

  // ── Product search per row ────────────────────────────────────────────────
  const [prodSearch,   setProdSearch]   = useState({});
  const [showProdDrop, setShowProdDrop] = useState({});
  const prodRefs = useRef({});

  // ── Outside click close ───────────────────────────────────────────────────
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

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDealers({ limit: 500 }));
    dispatch(fetchProducts({ limit: 1000 }));
    if (isEdit) dispatch(fetchInvoiceById(id));
  }, [dispatch, id, isEdit]);

  // ── Auto due date ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!invoiceDate) return;
    try { setDueDate(format(addDays(parseISO(invoiceDate), toNum(paymentDays)), 'yyyy-MM-dd')); } catch (_) {}
  }, [invoiceDate, paymentDays]);

  // ── Pre-fill from order (navigated via Order Detail → Invoice button) ──────
  useEffect(() => {
    const fromOrder = location.state?.fromOrder;
    if (!fromOrder || isEdit) return;
    // Dealer
    if (fromOrder.dealerId && typeof fromOrder.dealerId === 'object') {
      setDealer(fromOrder.dealerId);
      setDealerSearch(fromOrder.dealerId.businessName || fromOrder.dealerId.name || '');
    }
    // Line items
    if (fromOrder.items?.length > 0) {
      setItems(
        fromOrder.items.map((item) =>
          calcItem({
            ...EMPTY_ITEM,
            productId:   item.productId || '',
            productName: item.productName || item.name || '',
            hsnCode:     item.hsnCode || '',
            quantity:    item.quantity || 1,
            unit:        item.unit || 'PCS',
            unitPrice:   item.unitPrice || 0,
            taxRate:     item.taxRate || 0,
          })
        )
      );
    }
    // Notes
    setNotes(`Ref: Order ${fromOrder.orderNumber || fromOrder._id?.slice(-6).toUpperCase()}`);
    setShowNotes(true);
    // Shipping address from delivery address
    if (fromOrder.deliveryAddress) {
      const addr = {
        id: 'order',
        label: fromOrder.dealerId?.businessName || 'Delivery Address',
        street: fromOrder.deliveryAddress.fullAddress || fromOrder.deliveryAddress.street || '',
        city:   fromOrder.deliveryAddress.city || '',
        state:  fromOrder.deliveryAddress.state || '',
        pincode: fromOrder.deliveryAddress.postalCode || '',
      };
      setShipAddresses([addr]);
      setSelectedShipId('order');
      setShipAddress(addr);
    }
    // Payment terms
    if (fromOrder.paymentTerms) {
      const days = parseInt(fromOrder.paymentTerms.replace(/\D/g, ''), 10);
      if (!isNaN(days)) setPaymentDays(days);
    }
  }, [location.state, isEdit]);

  // ── Build ship addresses when dealer changes ──────────────────────────────
  useEffect(() => {
    if (!dealer) { setShipAddresses([]); setSelectedShipId(null); setShipAddress(null); return; }
    const addr = dealer.address;
    const list = addr
      ? [{ id: 'default', label: dealer.businessName, street: addr.street||'', city: addr.city||'', state: addr.state||'', pincode: addr.pincode||'' }]
      : [];
    setShipAddresses(list);
    if (list.length > 0) { setSelectedShipId('default'); setShipAddress(list[0]); }
  }, [dealer]);

  // ── Prefill edit ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !selectedInvoice || selectedInvoice._id !== id) return;
    const inv = selectedInvoice;
    setInvoiceNo(inv.invoiceNumber||''); setInvoiceDate(inv.invoiceDate?.split('T')[0]||today);
    setDueDate(inv.dueDate?.split('T')[0]||''); setNotes(inv.notes||''); setShowNotes(Boolean(inv.notes));
    setTerms(inv.termsAndConditions||''); setShowTerms(Boolean(inv.termsAndConditions));
    setInvoiceDisc(inv.discountAmt||0); setShowDisc(Boolean(inv.discountAmt));
    setAmtReceived(inv.amountPaid||0); setMarkPaid(inv.amountPaid>0 && inv.balance===0);
    // Additional charges
    if (inv.additionalCharges > 0) { setAddlCharges(inv.additionalCharges); setShowAddlChg(true); }
    if (inv.additionalLabel) setAddlLabel(inv.additionalLabel);
    // Round off
    setRoundOff(Boolean(inv.roundOff));
    // Payment mode & bank details
    if (inv.paymentMode) setPayMode(inv.paymentMode);
    if (inv.bankDetails?.accountNumber) setBankAccount(inv.bankDetails);
    // Invoice prefix/sequence
    if (inv.invoicePrefix) {
      setInvoicePrefix(inv.invoicePrefix);
      setSettings((p) => ({ ...p, invoicePrefix: true }));
    }
    if (inv.invoiceSequence) setInvoiceSequence(inv.invoiceSequence);
    // Dealer
    const d = inv.dealerId;
    if (d && typeof d==='object') { 
      setDealer(d); 
      setDealerSearch(d.businessName || '');
      if (d?.bankDetails) {
        setBankAccount(d.bankDetails);
      }
      setDealerSearch(d.businessName||''); }
    else setDealerSearch(inv.partyName||'');
    // Shipping address
    if (inv.shippingAddress?.city || inv.shippingAddress?.street) {
      setShipAddress(inv.shippingAddress);
      setShipAddresses([{ ...inv.shippingAddress, id: 'saved' }]);
      setSelectedShipId('saved');
    }
    // Line items
    const pre = inv.lineItems?.length ? inv.lineItems.map((li) => calcItem({...EMPTY_ITEM,...li})) : [{...EMPTY_ITEM}];
    setItems(pre);
    const ps = {}; pre.forEach((li,i) => { ps[i] = li.productName||''; }); setProdSearch(ps);
  }, [selectedInvoice, isEdit, id]);

  // ── Item helpers ──────────────────────────────────────────────────────────
  const updateItem    = (idx, field, val) => setItems((p) => { const n=[...p]; n[idx]=calcItem({...n[idx],[field]:val}); return n; });
  const setDiscType   = (idx, type) => setItems((p) => { const n=[...p]; n[idx]=calcItem({...n[idx],discountType:type,discountValue:0}); return n; });
  const setDiscVal    = (idx, val)  => setItems((p) => { const n=[...p]; n[idx]=calcItem({...n[idx],discountValue:val}); return n; });

  const pickProduct = (idx, p) => {
    setItems((prev) => { const n=[...prev]; n[idx]=calcItem({...n[idx],productId:p._id,productName:p.name,unitPrice:p.basePrice||0,taxRate:p.taxRate||0,unit:(p.unit||'PCS').toUpperCase(),hsnCode:p.hsnCode||'',discountValue:0}); return n; });
    setProdSearch((p2)=>({...p2,[idx]:p.name})); setShowProdDrop((p2)=>({...p2,[idx]:false}));
    setErrors((e)=>({...e,items:''}));
  };

  const addRow = () => { const idx=items.length; setItems((p)=>[...p,{...EMPTY_ITEM}]); setProdSearch((p)=>({...p,[idx]:''})); };
  const removeRow = (idx) => { setItems((p)=>p.filter((_,i)=>i!==idx)); setProdSearch((p)=>{const n={...p};delete n[idx];return n;}); setShowProdDrop((p)=>{const n={...p};delete n[idx];return n;}); };

  // ── Add Items Modal helpers ───────────────────────────────────────────────
  const filteredModalProducts = (products||[]).filter((p) => {
    const q = itemModalSearch.toLowerCase();
    const matchSearch = !q || p?.name?.toLowerCase().includes(q) || p?.productCode?.toLowerCase().includes(q) || p?.sku?.toLowerCase().includes(q);
    const matchCat = itemModalCategory === 'All' || p?.category === itemModalCategory;
    return matchSearch && matchCat;
  });

  const toggleModalItem = (productId) => {
    setSelectedModalItems((prev) => {
      const n = { ...prev };
      if (n[productId]) delete n[productId];
      else n[productId] = 1;
      return n;
    });
  };

  const addModalItemsToInvoice = () => {
    const toAdd = Object.entries(selectedModalItems);
    if (!toAdd.length) return;
    const newRows = toAdd.map(([productId, qty]) => {
      const p = (products||[]).find((x) => x._id === productId);
      if (!p) return null;
      return calcItem({ ...EMPTY_ITEM, productId:p._id, productName:p.name, unitPrice:p.basePrice||0, taxRate:p.taxRate||0, unit:(p.unit||'PCS').toUpperCase(), hsnCode:p.hsnCode||'', quantity:qty });
    }).filter(Boolean);

    // Replace empty first row if it's blank
    setItems((prev) => {
      const existing = prev.filter((i) => i.productName?.trim());
      const merged = [...existing, ...newRows];
      return merged.length ? merged : [{ ...EMPTY_ITEM }];
    });
    const ps = {};
    newRows.forEach((row, i) => { ps[items.filter(x=>x.productName?.trim()).length + i] = row.productName; });
    setProdSearch((p) => ({ ...p, ...ps }));
    setSelectedModalItems({});
    setItemModalSearch('');
    setShowItemModal(false);
    setErrors((e)=>({...e,items:''}));
  };

  // ── Shipping modal helpers ────────────────────────────────────────────────
  const addNewShippingAddress = () => {
    if (!newShipAddress.city && !newShipAddress.street) return;
    const newAddr = { ...newShipAddress, id: `addr_${Date.now()}` };
    setShipAddresses((p) => [...p, newAddr]);
    setSelectedShipId(newAddr.id);
    setShipAddress(newAddr);
    setNewShipAddress({ label:'', street:'', city:'', state:'', pincode:'' });
    setShowAddShip(false);
  };

  const confirmShipAddress = () => {
    const found = shipAddresses.find((a) => a.id === selectedShipId);
    if (found) setShipAddress(found);
    setShowShipModal(false);
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const calcedItems  = items.map(calcItem);
  const rawTotal     = calcSummary(calcedItems, addlCharges, invoiceDisc, 0, roundOff).total;
  const effectiveAmt = markPaid ? rawTotal : amtReceived;
  const summary      = calcSummary(calcedItems, addlCharges, invoiceDisc, effectiveAmt, roundOff);

  const handleMarkPaid = (checked) => { setMarkPaid(checked); setAmtReceived(checked ? rawTotal : 0); };

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!dealer && !dealerSearch.trim()) e.dealer = 'Please select or enter a party name';
    if (items.every((i) => !i.productName?.trim())) e.items = 'Add at least one item';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (asDraft, andNew) => {
    if (!validate()) return;
    const payload = {
      dealerId:     dealer?._id||'',
      partyName:    dealer?.businessName||dealerSearch.trim(),
      invoiceNumber: settings.invoicePrefix
        ? `${invoicePrefix||''}-${invoiceSequence||1}`
        : (invoiceNo || undefined),
      partyAddress: dealer ? [dealer.address?.street,dealer.address?.city,dealer.address?.state,dealer.address?.pincode].filter(Boolean).join(', ') : '',
      partyGST:     dealer?.gstin||'',
      partyPhone:   dealer?.phone||'',
      invoiceDate,
      dueDate,
      paymentTerms: `Net ${paymentDays}`,
      notes:        showNotes ? notes : '',
      termsAndConditions: showTerms ? terms : '',
      lineItems:    calcedItems,
      invoiceDiscount: showDisc ? toNum(invoiceDisc) : 0,
      amountPaid:   markPaid ? summary.total : toNum(amtReceived),
      status:       asDraft ? 'draft' : 'issued',
      // Additional charges
      additionalCharges: showAddlChg ? toNum(addlCharges) : 0,
      additionalLabel:   addlLabel,
      // Round off
      roundOff,
      // Payment
      paymentMode:       payMode,
      paymentReceivedIn: payMode !== 'Cash' && bankAccount?.accountNumber ? bankAccount.accountNumber : undefined,
      // Bank details
      bankDetails: bankAccount ? {
        label:          bankAccount.label,
        accountNumber:  bankAccount.accountNumber,
        ifscCode:       bankAccount.ifscCode,
        branchName:     bankAccount.branchName,
        holderName:     bankAccount.holderName,
        upiId:          bankAccount.upiId,
        openingBalance: toNum(bankAccount.openingBalance),
      } : undefined,
      // Shipping address
      shippingAddress: shipAddress ? {
        label:   shipAddress.label,
        street:  shipAddress.street,
        city:    shipAddress.city,
        state:   shipAddress.state,
        pincode: shipAddress.pincode,
      } : undefined,
      // Invoice prefix/sequence settings
      invoicePrefix:   settings.invoicePrefix ? invoicePrefix : undefined,
      invoiceSequence: settings.invoicePrefix ? toNum(invoiceSequence) : undefined,
    };
    const result = isEdit ? await dispatch(updateInvoice({id,body:payload})) : await dispatch(createInvoice(payload));
    if (!result.error) {
      if (andNew) {
        setDealer(null); setDealerSearch(''); setItems([{...EMPTY_ITEM}]); setProdSearch({});
        setNotes(''); setInvoiceDisc(0); setAmtReceived(0); setMarkPaid(false);
        setShowDisc(false); setShowNotes(false); setInvoiceNo(''); setInvoiceDate(today);
        setAddlCharges(0); setShowAddlChg(false); setBankAccount(null); setErrors({});
        setPayMode('Cash'); setRoundOff(false); setShipAddress(null);
      } else { navigate('/invoices'); }
    }
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredDealers = (dealers||[]).filter((d)=>d?.businessName?.toLowerCase().includes((dealerSearch||'').toLowerCase())).slice(0,8);
  const getFilteredProds = (idx) => { const q=((prodSearch[idx]??items[idx]?.productName)||'').toLowerCase(); if(!q)return[]; return(products||[]).filter((p)=>p?.name?.toLowerCase().includes(q)).slice(0,8); };

  const shipAddrDisplay = shipAddress
    ? [shipAddress.street, shipAddress.city, shipAddress.state, shipAddress.pincode].filter(Boolean).join(', ')
    : (dealer ? [dealer.address?.street, dealer.address?.city, dealer.address?.state].filter(Boolean).join(', ') : '');

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/invoices')} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"><ArrowLeft size={18}/></button>
          <h1 className="text-lg font-bold text-gray-800">{isEdit?'Edit Sales Invoice':'Create Sales Invoice'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowSettingsModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Settings size={15}/> Settings <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5"/>
          </button>
          <button onClick={()=>handleSave(true,true)} disabled={loading} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors">Save & New</button>
          <button onClick={()=>handleSave(false,false)} disabled={loading} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow transition-colors">{loading?'Saving…':'Save'}</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Centre ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Bill To / Ship To */}
          <div className="bg-white border-b border-gray-200">
            <div className="grid grid-cols-2 divide-x divide-gray-200">

              {/* Bill To */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bill To</span>
                  {dealer && (
                    <button onClick={()=>{setDealer(null);setDealerSearch('');setTimeout(()=>setShowDealerDrop(true),50);}}
                      className="px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-300 rounded-full hover:bg-blue-50">
                      Change Party
                    </button>
                  )}
                </div>
                {errors.dealer && <p className="text-xs text-red-500 mb-2">{errors.dealer}</p>}
                {dealer ? (
                  <div className="relative group">
                    <p className="font-bold text-gray-900 text-base leading-snug">{dealer.businessName}</p>
                    {dealer.ownerName && <p className="text-sm text-gray-500 mt-0.5">{dealer.ownerName}</p>}
                    {dealer.phone     && <p className="text-sm text-gray-500">{dealer.phone}</p>}
                    {dealer.address?.city && <p className="text-sm text-gray-500">{[dealer.address.street,dealer.address.city,dealer.address.state,dealer.address.pincode].filter(Boolean).join(', ')}</p>}
                    {dealer.gstin && <p className="text-xs text-gray-400 mt-1">GSTIN: {dealer.gstin}</p>}
                    <button onClick={()=>{setDealer(null);setDealerSearch('');}} className="absolute top-0 right-0 p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                  </div>
                ) : (
                  <div className="relative" ref={dealerRef}>
                    <input
                      className="w-full text-sm border-b-2 border-dashed border-gray-300 pb-1 outline-none focus:border-blue-500 bg-transparent placeholder-gray-400 font-medium transition-colors"
                      placeholder="Search or type party name..."
                      value={dealerSearch}
                      onChange={(e)=>{setDealerSearch(e.target.value);setShowDealerDrop(true);setErrors((er)=>({...er,dealer:''}));}}
                      onFocus={()=>setShowDealerDrop(true)}
                    />
                    {showDealerDrop && filteredDealers.length>0 && (
                      <div className="absolute z-50 left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                        {filteredDealers.map((d)=>(
                          <button key={d._id} onMouseDown={(e)=>e.preventDefault()}
                            onClick={()=>{setDealer(d);
                              setDealerSearch(d.businessName || '');
                              if (d?.bankDetails) {
                                setBankAccount(d.bankDetails);
                              }
                              setDealerSearch(d.businessName);setShowDealerDrop(false);setErrors((er)=>({...er,dealer:''}));}}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                            <p className="text-sm font-semibold text-gray-800">{d.businessName}</p>
                            <p className="text-xs text-gray-400">{d.dealerCode}{d.phone?` · ${d.phone}`:''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ship To */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ship To</span>
                  <button onClick={()=>setShowShipModal(true)} className="px-3 py-1 text-xs font-semibold text-blue-600 border border-blue-300 rounded-full hover:bg-blue-50">
                    Change Shipping Address
                  </button>
                </div>
                {dealer ? (
                  <div>
                    <p className="font-bold text-gray-900 text-base">{shipAddress?.label || dealer.businessName}</p>
                    {shipAddrDisplay && <p className="text-sm text-gray-500 mt-0.5">Address: {shipAddrDisplay}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Same as billing address</p>
                )}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border-b border-gray-200">
            {errors.items && <p className="text-xs text-red-500 px-4 pt-3">{errors.items}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-8">NO</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">ITEMS</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-20">HSN</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-32">QTY</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-28">PRICE/ITEM (₹)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-28">DISCOUNT</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-28">TAX</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-28">AMOUNT (₹)</th>
                    <th className="w-8"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const row = calcItem(item);
                    const searchVal = prodSearch[idx] ?? item.productName ?? '';
                    const filteredProd = getFilteredProds(idx);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/40 group align-top">
                        <td className="px-3 pt-4 pb-3 text-gray-400 text-xs">{idx+1}</td>
                        <td className="px-3 py-3">
                          <div className="relative" ref={(el)=>{if(el)prodRefs.current[idx]=el;}}>
                            <input
                              className="w-full font-medium text-gray-800 text-sm outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent pb-0.5 placeholder-gray-400 transition-colors"
                              placeholder="Type or select item"
                              value={searchVal}
                              onChange={(e)=>{const v=e.target.value;setProdSearch((p)=>({...p,[idx]:v}));updateItem(idx,'productName',v);setShowProdDrop((p)=>({...p,[idx]:true}));setErrors((er)=>({...er,items:''}));}}
                              onFocus={()=>setShowProdDrop((p)=>({...p,[idx]:true}))}
                            />
                            {showProdDrop[idx] && filteredProd.length>0 && (
                              <div className="absolute z-40 left-0 mt-0.5 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                                {filteredProd.map((p)=>(
                                  <button key={p._id} onMouseDown={(e)=>e.preventDefault()} onClick={()=>pickProduct(idx,p)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                    <p className="text-xs text-gray-400">₹{p.basePrice} · {p.unit}{p.productCode?` · ${p.productCode}`:''}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                            <input className="w-full text-xs text-gray-400 outline-none bg-transparent mt-1.5 placeholder-gray-300"
                              placeholder="Enter Description (optional)"
                              value={item.description||''} onChange={(e)=>updateItem(idx,'description',e.target.value)}/>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input className="w-full text-sm text-center outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-600 placeholder-gray-300"
                            placeholder="HSN" value={item.hsnCode||''} onChange={(e)=>updateItem(idx,'hsnCode',e.target.value)}/>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <input type="number" min="0"
                              className="w-14 text-sm text-center outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-800 transition-colors"
                              value={item.quantity} onChange={(e)=>updateItem(idx,'quantity',e.target.value)}/>
                            <select className="text-xs text-gray-500 outline-none bg-transparent border border-gray-200 rounded px-1 py-0.5 cursor-pointer"
                              value={item.unit} onChange={(e)=>updateItem(idx,'unit',e.target.value)}>
                              {UNITS.map((u)=><option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" min="0"
                            className="w-full text-sm text-right outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent text-gray-800"
                            value={item.unitPrice} onChange={(e)=>updateItem(idx,'unitPrice',e.target.value)}/>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            <div className={`flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${item.discountType==='%'?'bg-blue-50':''}`}>
                              <button className={`text-xs w-5 font-bold transition-colors ${item.discountType==='%'?'text-blue-600':'text-gray-400 hover:text-gray-600'}`} onClick={()=>setDiscType(idx,'%')}>%</button>
                              <input type="number" min="0" max="100"
                                className="w-14 text-sm text-right outline-none border-b border-transparent focus:border-blue-400 bg-transparent text-gray-700 disabled:opacity-40"
                                placeholder="0" value={item.discountType==='%'?item.discountValue:''} disabled={item.discountType!=='%'}
                                onFocus={()=>setDiscType(idx,'%')} onChange={(e)=>setDiscVal(idx,e.target.value)}/>
                            </div>
                            <div className={`flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${item.discountType==='₹'?'bg-blue-50':''}`}>
                              <button className={`text-xs w-5 font-bold transition-colors ${item.discountType==='₹'?'text-blue-600':'text-gray-400 hover:text-gray-600'}`} onClick={()=>setDiscType(idx,'₹')}>₹</button>
                              <input type="number" min="0"
                                className="w-14 text-sm text-right outline-none border-b border-transparent focus:border-blue-400 bg-transparent text-gray-700 disabled:opacity-40"
                                placeholder="0" value={item.discountType==='₹'?item.discountValue:''} disabled={item.discountType!=='₹'}
                                onFocus={()=>setDiscType(idx,'₹')} onChange={(e)=>setDiscVal(idx,e.target.value)}/>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select className="text-xs text-blue-600 font-semibold outline-none bg-transparent cursor-pointer block mb-1"
                            value={item.taxRate} onChange={(e)=>updateItem(idx,'taxRate',Number(e.target.value))}>
                            {GST_RATES.map((r)=><option key={r} value={r}>{r===0?'No Tax':`${r}%`}</option>)}
                          </select>
                          {row.taxAmount>0 && <p className="text-xs text-gray-400">(₹ {row.taxAmount.toFixed(2)})</p>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-800">₹ {row.lineTotal.toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-3">
                          {items.length>1 && (
                            <button onClick={()=>removeRow(idx)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Add Item + Scan — ABOVE subtotal ── */}
            <div className="border-t border-dashed border-gray-200 px-4 py-3 flex items-center justify-between">
              <button onClick={()=>setShowItemModal(true)}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 border-2 border-dashed border-blue-200 rounded-xl py-2.5 hover:bg-blue-50 transition-colors mr-4">
                <Plus size={16}/> Add Item
              </button>
              <button onClick={()=>setShowItemModal(true)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors bg-white">
                <Barcode size={16}/> Scan Barcode
              </button>
            </div>

            {/* Subtotal bar */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-500">
              <span className="text-gray-700">SUBTOTAL</span>
              <div className="flex items-center gap-8">
                <span>₹ {summary.totalDisc.toFixed(2)}</span>
                <span>₹ {summary.totalTax.toFixed(2)}</span>
                <span className="text-gray-800 text-sm font-bold">₹ {(summary.taxableAmt+summary.totalTax).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes + Terms + Add New Account */}
          <div className="bg-white border-b border-gray-200 px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                {!showNotes ? (
                  <button onClick={()=>setShowNotes(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                    <Plus size={14}/> Add Notes
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Notes</span>
                      <button onClick={()=>{setShowNotes(false);setNotes('');}} className="text-gray-300 hover:text-gray-500"><X size={14}/></button>
                    </div>
                    <textarea autoFocus rows={3}
                      className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-2.5 outline-none resize-none focus:border-blue-400 transition-colors"
                      placeholder="Notes for customer..." value={notes} onChange={(e)=>setNotes(e.target.value)}/>
                  </div>
                )}
              </div>
              <div>
                {!showTerms ? (
                  <button onClick={()=>setShowTerms(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                    <Plus size={14}/> Add Terms &amp; Conditions
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Terms and Conditions</span>
                      <button onClick={()=>setShowTerms(false)} className="text-gray-300 hover:text-gray-500"><X size={14}/></button>
                    </div>
                    <textarea rows={3}
                      className="w-full text-sm text-gray-500 border border-gray-200 rounded-lg p-2.5 outline-none resize-none focus:border-blue-400"
                      value={terms} onChange={(e)=>setTerms(e.target.value)}/>
                  </div>
                )}
              </div>
            </div>

            {/* Add Bank Account / Bank Details */}
            {!bankAccount ? (
              <button onClick={()=>setShowBankModal(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                <Plus size={14}/> Add Bank Account
              </button>
            ) : (
              <div className="mt-1">
                <p className="text-sm font-semibold text-gray-700 mb-2">Bank Details</p>
                <div className="space-y-1.5 text-sm">
                  {bankAccount.accountNumber && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-36 flex-shrink-0">Account Number:</span>
                      <span className="text-gray-700 font-medium">{bankAccount.accountNumber}</span>
                    </div>
                  )}
                  {bankAccount.ifscCode && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-36 flex-shrink-0">IFSC Code:</span>
                      <span className="text-gray-700 font-medium">{bankAccount.ifscCode}</span>
                    </div>
                  )}
                  {bankAccount.branchName && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-36 flex-shrink-0">Bank & Branch Name:</span>
                      <span className="text-gray-700 font-medium">{bankAccount.branchName}</span>
                    </div>
                  )}
                  {bankAccount.holderName && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-36 flex-shrink-0">Account Holder's Name:</span>
                      <span className="text-gray-700 font-medium">{bankAccount.holderName}</span>
                    </div>
                  )}
                  {bankAccount.upiId && (
                    <div className="flex gap-2 mt-1 pt-1 border-t border-gray-100">
                      <span className="text-gray-400 w-36 flex-shrink-0">UPI ID</span>
                      <span className="text-blue-600 font-medium">{bankAccount.upiId}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-3">
                  <button onClick={()=>setShowBankModal(true)} className="text-sm font-semibold text-blue-600 hover:underline">Change Bank Account</button>
                  <button onClick={()=>setBankAccount(null)} className="text-sm font-semibold text-red-500 hover:underline">Remove Bank Account</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-80 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto flex flex-col">

          {/* Invoice No + Date */}
          <div className="p-4 border-b border-gray-100">
            {settings.invoicePrefix ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Invoice Prefix</label>
                  <input className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    value={invoicePrefix} onChange={(e)=>setInvoicePrefix(e.target.value)} placeholder="ABC"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Invoice Number</label>
                  <input type="number" className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    value={invoiceSequence} onChange={(e)=>setInvoiceSequence(e.target.value)} placeholder="100"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Invoice Date</label>
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                    <Calendar size={13} className="text-blue-500 flex-shrink-0"/>
                    <input type="date" className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                      value={invoiceDate} onChange={(e)=>setInvoiceDate(e.target.value)}/>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Sales Invoice No.</label>
                  <input className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    value={invoiceNo} onChange={(e)=>setInvoiceNo(e.target.value)} placeholder="Auto"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Invoice Date</label>
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                    <Calendar size={13} className="text-blue-500 flex-shrink-0"/>
                    <input type="date" className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                      value={invoiceDate} onChange={(e)=>setInvoiceDate(e.target.value)}/>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Terms + Due Date */}
          <div className="p-4 border-b border-dashed border-gray-200 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Payment Terms</label>
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                <input type="number" min="0" className="w-10 text-sm font-semibold text-gray-800 outline-none bg-transparent"
                  value={paymentDays} onChange={(e)=>setPaymentDays(e.target.value)}/>
                <span className="text-xs text-gray-400">days</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Due Date</label>
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:border-blue-400">
                <Calendar size={13} className="text-blue-500 flex-shrink-0"/>
                <input type="date" className="flex-1 text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                  value={dueDate} onChange={(e)=>setDueDate(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 border-b border-gray-100 space-y-2.5">
            {/* Additional Charges */}
            {!showAddlChg ? (
              <button onClick={()=>setShowAddlChg(true)} className="flex items-center gap-1 text-sm text-blue-600 font-semibold hover:underline w-full">
                <Plus size={13}/> Add Additional Charges
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input className="flex-1 text-sm border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent text-gray-600 placeholder-gray-300"
                  placeholder="Label" value={addlLabel} onChange={(e)=>setAddlLabel(e.target.value)}/>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">₹</span>
                  <input type="number" min="0" className="w-16 text-sm text-right border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent text-gray-700"
                    value={addlCharges} onChange={(e)=>setAddlCharges(e.target.value)}/>
                </div>
                <button onClick={()=>{setShowAddlChg(false);setAddlCharges(0);}} className="text-gray-300 hover:text-red-400"><X size={13}/></button>
              </div>
            )}

            <div className="flex justify-between text-sm text-gray-600">
              <span className="font-medium">Taxable Amount</span>
              <span>₹ {summary.taxableAmt.toFixed(2)}</span>
            </div>

            {Object.entries(summary.taxBreakdown).map(([rate,val])=>(
              <div key={rate} className="space-y-1">
                <div className="flex justify-between text-sm text-gray-500"><span>SGST @ {rate/2}%</span><span>₹ {val.sgst.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>CGST @ {rate/2}%</span><span>₹ {val.cgst.toFixed(2)}</span></div>
              </div>
            ))}

            {!showDisc ? (
              <button onClick={()=>setShowDisc(true)} className="flex items-center gap-1 text-sm text-blue-600 font-semibold hover:underline w-full pt-1">
                <Plus size={13}/> Add Discount
              </button>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button onClick={()=>{setShowDisc(false);setInvoiceDisc(0);}} className="text-gray-300 hover:text-red-400"><X size={13}/></button>
                  <span className="text-sm text-gray-600 font-medium">Discount</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">- ₹</span>
                  <input type="number" min="0" autoFocus
                    className="w-20 text-sm text-right border-b border-gray-200 outline-none focus:border-blue-400 bg-transparent text-gray-700"
                    value={invoiceDisc} onChange={(e)=>setInvoiceDisc(e.target.value)}/>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={roundOff} onChange={(e)=>setRoundOff(e.target.checked)} className="rounded border-gray-300 text-blue-600 cursor-pointer"/>
                Auto Round Off
              </label>
              <span className="text-sm text-gray-500">
                {roundOff && summary.roundOffAmt!==0 ? `${summary.roundOffAmt>0?'+':''}₹ ${summary.roundOffAmt.toFixed(2)}` : '₹ 0'}
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="px-4 py-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <span className="text-base font-bold text-gray-800">Total Amount</span>
            <span className="text-xl font-black text-gray-900">₹ {summary.total.toFixed(2)}</span>
          </div>

          {/* Mark as fully paid */}
          <div className="px-4 pt-3 flex justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              Mark as fully paid
              <input type="checkbox" checked={markPaid} onChange={(e)=>handleMarkPaid(e.target.checked)} className="rounded border-gray-300 text-blue-600 cursor-pointer"/>
            </label>
          </div>

          {/* Amount Received */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-600 mb-2">Amount Received</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
                <span className="px-2.5 py-2 text-sm text-gray-500 bg-gray-50 border-r border-gray-200">₹</span>
                <input type="number" min="0"
                  className="flex-1 px-2 py-2 text-sm font-semibold text-gray-800 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  value={markPaid?summary.total.toFixed(2):amtReceived}
                  onChange={(e)=>{setAmtReceived(e.target.value);setMarkPaid(false);}} disabled={markPaid}/>
              </div>
              <select className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-600 outline-none bg-white cursor-pointer focus:border-blue-400"
                value={payMode} onChange={(e)=>setPayMode(e.target.value)}>
                {PAY_MODES.map((m)=><option key={m}>{m}</option>)}
              </select>
            </div>
            {/* Payment Received In — shown only when a non-Cash mode is selected and bank account exists */}
            {payMode !== 'Cash' && bankAccount?.accountNumber && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 font-medium">Payment Received In</span>
                  <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none bg-white cursor-pointer focus:border-blue-400 min-w-[180px]">
                    <option value={bankAccount.accountNumber}>{bankAccount.accountNumber}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Balance */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <span className="text-sm font-bold text-green-600">Balance Amount</span>
            <span className="text-base font-black text-green-600">₹ {summary.balance.toFixed(2)}</span>
          </div>

          {/* Signature */}
          <div className="p-4">
            <p className="text-xs text-gray-400 text-right mb-2">
              Authorized signatory for <span className="font-semibold text-gray-600">{dealer?.businessName||'Your Company'}</span>
            </p>
            <button onClick={()=>setShowSignModal(true)}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer">
              <span className="text-sm text-blue-600 font-semibold flex items-center gap-1"><Plus size={14}/> Add Signature</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 1 — Add Items to Bill
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showItemModal} onClose={()=>{setShowItemModal(false);setSelectedModalItems({});}} title="Add Items to Bill" size="xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input autoFocus
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
              placeholder="Search by Item / Serial no. / HSN code / SKU / Custom Field / Category"
              value={itemModalSearch} onChange={(e)=>setItemModalSearch(e.target.value)}/>
          </div>
          <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-blue-400"
            value={itemModalCategory} onChange={(e)=>setItemModalCategory(e.target.value)}>
            {CATEGORIES.map((c)=><option key={c}>{c}</option>)}
          </select>
          <button onClick={()=>setShowCreateItemModal(true)} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Create New Item</button>
        </div>

        {/* Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Item Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Item Code</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Sales Price</th>
                {settings.showPurchasePrice && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Purchase Price</th>}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredModalProducts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">
                  {itemModalSearch ? 'No items found' : 'Scan items to add them to your invoice'}
                </td></tr>
              ) : (
                filteredModalProducts.map((p) => {
                  const isSelected = Boolean(selectedModalItems[p._id]);
                  return (
                    <tr key={p._id} onClick={()=>toggleModalItem(p._id)}
                      className={`cursor-pointer transition-colors ${isSelected?'bg-blue-50':'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isSelected ? <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0"/> : <Circle size={16} className="text-gray-300 flex-shrink-0"/>}
                          <span className="font-medium text-gray-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.productCode||'—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">₹{p.basePrice}</td>
                      {settings.showPurchasePrice && <td className="px-4 py-3 text-right text-gray-500">₹{p.purchasePrice||'—'}</td>}
                      <td className="px-4 py-3 text-center" onClick={(e)=>e.stopPropagation()}>
                        {isSelected ? (
                          <input type="number" min="1"
                            className="w-16 text-sm text-center border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white"
                            value={selectedModalItems[p._id]||1}
                            onChange={(e)=>setSelectedModalItems((prev)=>({...prev,[p._id]:toNum(e.target.value)||1}))}/>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500 flex items-center gap-4">
            <span>Keyboard Shortcuts:</span>
            <span>Change Quantity <kbd className="px-2 py-0.5 border border-gray-200 rounded text-xs bg-gray-50">Enter</kbd></span>
            <span>Move between items <kbd className="px-2 py-0.5 border border-gray-200 rounded text-xs bg-gray-50">↑</kbd> <kbd className="px-2 py-0.5 border border-gray-200 rounded text-xs bg-gray-50">↓</kbd></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{Object.keys(selectedModalItems).length} Item(s) Selected</span>
            <button onClick={()=>{setShowItemModal(false);setSelectedModalItems({});}} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel [ESC]</button>
            <button onClick={addModalItemsToInvoice}
              disabled={Object.keys(selectedModalItems).length===0}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Add to Bill [F7]
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 2 — Change Shipping Address
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showShipModal} onClose={()=>setShowShipModal(false)} title="Change Shipping Address" size="md">
        {!dealer ? (
          <p className="text-sm text-gray-500 text-center py-6">Please select a party first to manage shipping addresses.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center border-b border-gray-100 pb-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase">Address</span>
              <span className="text-xs font-semibold text-gray-400 uppercase">Edit</span>
              <span className="text-xs font-semibold text-gray-400 uppercase">Select</span>
            </div>
            {shipAddresses.map((addr)=>(
              <div key={addr.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-start py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{addr.label || dealer.businessName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{[addr.street,addr.city,addr.state,addr.pincode].filter(Boolean).join(', ')}</p>
                </div>
                <button className="p-1.5 text-gray-400 hover:text-blue-500 mt-0.5"><Edit2 size={15}/></button>
                <button onClick={()=>setSelectedShipId(addr.id)} className="p-1.5 mt-0.5">
                  {selectedShipId===addr.id
                    ? <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-blue-600"/></div>
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300"/>}
                </button>
              </div>
            ))}

            {/* Add new address */}
            {!showAddShip ? (
              <button onClick={()=>setShowAddShip(true)} className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline mt-2">
                <Plus size={14}/> Add New Shipping Address
              </button>
            ) : (
              <div className="mt-3 space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">New Shipping Address</p>
                <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" placeholder="Label (e.g. Warehouse)" value={newShipAddress.label} onChange={(e)=>setNewShipAddress((p)=>({...p,label:e.target.value}))}/>
                <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" placeholder="Street" value={newShipAddress.street} onChange={(e)=>setNewShipAddress((p)=>({...p,street:e.target.value}))}/>
                <div className="grid grid-cols-2 gap-2">
                  <input className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" placeholder="City" value={newShipAddress.city} onChange={(e)=>setNewShipAddress((p)=>({...p,city:e.target.value}))}/>
                  <input className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" placeholder="State" value={newShipAddress.state} onChange={(e)=>setNewShipAddress((p)=>({...p,state:e.target.value}))}/>
                </div>
                <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" placeholder="Pincode" value={newShipAddress.pincode} onChange={(e)=>setNewShipAddress((p)=>({...p,pincode:e.target.value}))}/>
                <div className="flex gap-2 mt-2">
                  <button onClick={addNewShippingAddress} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Add</button>
                  <button onClick={()=>setShowAddShip(false)} className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
              <button onClick={()=>setShowShipModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={confirmShipAddress} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">Done</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 3 — Add Bank Account
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showBankModal} onClose={()=>setShowBankModal(false)} title="Add Bank Account" size="md">
        <div className="space-y-4">
        <label className="text-xs text-gray-500 font-semibold block mb-0"> Account Number <span className="text-red-500">*</span></label>
          <input className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 transition-colors"
            placeholder="ex: Personal Account" value={bankForm.label} onChange={(e)=>setBankForm((p)=>({...p,label:e.target.value}))}/>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">Opening Balance</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-400">
                <span className="px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border-r border-gray-200">₹</span>
                <input type="number" className="flex-1 px-3 py-2.5 text-sm outline-none"
                  placeholder="ex: ₹10,000" value={bankForm.openingBalance} onChange={(e)=>setBankForm((p)=>({...p,openingBalance:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1.5">As of Date</label>
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400">
                <Calendar size={14} className="text-blue-500 flex-shrink-0"/>
                <input type="date" className="flex-1 text-sm outline-none bg-transparent"
                  value={bankForm.asOfDate} onChange={(e)=>setBankForm((p)=>({...p,asOfDate:e.target.value}))}/>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-semibold text-gray-700">Add Bank Details</span>
            <Toggle checked={bankForm.addBankDetails} onChange={(v)=>setBankForm((p)=>({...p,addBankDetails:v}))}/>
          </div>

          {bankForm.addBankDetails && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">Bank Account Number <span className="text-red-500">*</span></label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: 123456789157950" value={bankForm.accountNumber} onChange={(e)=>setBankForm((p)=>({...p,accountNumber:e.target.value}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">Re-Enter Account Number <span className="text-red-500">*</span></label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: 123456789157950" value={bankForm.reAccountNumber} onChange={(e)=>setBankForm((p)=>({...p,reAccountNumber:e.target.value}))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">IFSC Code <span className="text-red-500">*</span></label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: HDFC000075" value={bankForm.ifscCode} onChange={(e)=>setBankForm((p)=>({...p,ifscCode:e.target.value.toUpperCase()}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">Bank &amp; Branch Name <span className="text-red-500">*</span></label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: HDFC, Old Madras" value={bankForm.branchName} onChange={(e)=>setBankForm((p)=>({...p,branchName:e.target.value}))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">Account Holders Name <span className="text-red-500">*</span></label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: Elisa wolf" value={bankForm.holderName} onChange={(e)=>setBankForm((p)=>({...p,holderName:e.target.value}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">UPI ID</label>
                  <input className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"
                    placeholder="ex: elisa@okhdfc" value={bankForm.upiId} onChange={(e)=>setBankForm((p)=>({...p,upiId:e.target.value}))}/>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={()=>setShowBankModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
            <button
              onClick={()=>{
                if (!bankForm.label && !bankForm.branchName) return;
                setBankAccount({...bankForm}); setShowBankModal(false);
              }}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">
              Save Account
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 4 — Quick Invoice Settings
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showSettingsModal} onClose={()=>setShowSettingsModal(false)} title="Quick Invoice Settings" size="md">
        <div className="space-y-3">
          {/* Invoice Prefix — expands when ON */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-start justify-between p-4">
              <div className="flex-1 pr-4">
                <span className="text-sm font-semibold text-gray-800">Invoice Prefix &amp; Sequence Number</span>
                <p className="text-xs text-gray-500 mt-0.5">Add your custom prefix &amp; sequence for Invoice Numbering</p>
              </div>
              <Toggle checked={settings.invoicePrefix} onChange={(v)=>setSettings((p)=>({...p,invoicePrefix:v}))}/>
            </div>
            {settings.invoicePrefix && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1.5">Prefix</label>
                    <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
                      placeholder="Prefix" value={invoicePrefix} onChange={(e)=>setInvoicePrefix(e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1.5">Sequence Number</label>
                    <input type="number" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
                      placeholder="1" value={invoiceSequence} onChange={(e)=>setInvoiceSequence(e.target.value)}/>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Invoice Number: {invoiceSequence}</p>
              </div>
            )}
          </div>

          {[
            { key:'showPurchasePrice',  label:'Show Purchase Price while adding Items', desc:'Add purchase price while adding items' },
            { key:'showItemImage',      label:'Show Item Image on Invoice',           desc:'This will apply to all vouchers except for Payment In and Payment Out' },
            { key:'priceHistory',       label:'Price History',                        desc:'Show last 5 sales / purchase prices of the item for the selected party in invoice', badge:'New' },
          ].map(({ key, label, desc, badge }) => (
            <div key={key} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                  {badge && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">{badge}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <Toggle checked={settings[key]} onChange={(v)=>setSettings((p)=>({...p,[key]:v}))}/>
            </div>
          ))}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <span className="text-sm font-semibold text-gray-800">Choose Invoice Theme</span>
            </div>
            <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400"
              value={settings.invoiceTheme} onChange={(e)=>setSettings((p)=>({...p,invoiceTheme:e.target.value}))}>
              {['Luxury','Classic','Modern','Minimal','Professional'].map((t)=><option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm font-bold text-gray-800 mb-0.5">Now <span className="text-blue-600">customise Invoice</span> with ease</p>
            <button className="mt-2 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
              Full Invoice Settings →
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={()=>setShowSettingsModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
            <button onClick={()=>setShowSettingsModal(false)} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">Save Settings</button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 5 — Add Signature
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showSignModal} onClose={()=>setShowSignModal(false)} title="Add Authorized Signature" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Upload or draw your signature for this invoice.</p>
          <div className="border-2 border-dashed border-gray-200 rounded-xl h-36 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/20 transition-colors cursor-pointer"
            onClick={()=>document.getElementById('sig-upload').click()}>
            <span className="text-3xl">✍️</span>
            <p className="text-sm font-semibold text-gray-600">Click to upload signature image</p>
            <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
            <input id="sig-upload" type="file" accept="image/*" className="hidden"/>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setShowSignModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
            <button onClick={()=>setShowSignModal(false)} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">Done</button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL 6 — Create New Item
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showCreateItemModal} onClose={()=>{setShowCreateItemModal(false);setNewItemForm({itemType:'Product',category:'',name:'',showOnline:false,salesPrice:'',priceWithTax:false,gstRate:'None',measuringUnit:'Pieces(PCS)',openingStock:''});setCreateItemTab('basic');}} title="Create New Item" size="lg">
        <div className="flex gap-0 min-h-[420px]">
          {/* Left sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-gray-100 pr-4 space-y-1">
            <button onClick={()=>setCreateItemTab('basic')}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${createItemTab==='basic'?'bg-blue-50 text-blue-700 border border-blue-200':'text-gray-600 hover:bg-gray-50'}`}>
              Basic Details *
            </button>
            <p className="text-xs text-gray-400 font-semibold px-3 pt-3 pb-1">Advance Details</p>
            {[['stock','Stock Details'],['pricing','Pricing Details'],['partywise','Party Wise Prices'],['custom','Custom Fields']].map(([tab,label])=>(
              <button key={tab} onClick={()=>setCreateItemTab(tab)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${createItemTab===tab?'bg-blue-50 text-blue-700 border border-blue-200':'text-gray-500 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="flex-1 pl-6">
            {createItemTab === 'basic' && (
              <div className="space-y-4">
                {/* Item Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Item Type <span className="text-red-500">*</span></label>
                    <div className="flex gap-3">
                      {['Product','Service'].map((type)=>(
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <div onClick={()=>setNewItemForm((p)=>({...p,itemType:type}))}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${newItemForm.itemType===type?'border-blue-600':'border-gray-300'}`}>
                            {newItemForm.itemType===type && <div className="w-2.5 h-2.5 rounded-full bg-blue-600"/>}
                          </div>
                          <span className="text-sm text-gray-700 font-medium">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Category</label>
                    <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-400 bg-white text-gray-600"
                      value={newItemForm.category} onChange={(e)=>setNewItemForm((p)=>({...p,category:e.target.value}))}>
                      <option value="">Search Categories</option>
                      {CATEGORIES.filter(c=>c!=='All').map((c)=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Item Name + Online Store */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Item Name <span className="text-red-500">*</span></label>
                    <input autoFocus className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-400"
                      placeholder="ex: Maggie 20gm" value={newItemForm.name} onChange={(e)=>setNewItemForm((p)=>({...p,name:e.target.value}))}/>
                  </div>
                  <div className="flex items-end justify-between pb-1">
                    <label className="text-sm text-gray-700 font-medium">Show Item in Online Store</label>
                    <Toggle checked={newItemForm.showOnline} onChange={(v)=>setNewItemForm((p)=>({...p,showOnline:v}))}/>
                  </div>
                </div>

                {/* Sales Price + GST */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Sales Price</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
                      <span className="px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border-r border-gray-200">₹</span>
                      <input type="number" className="flex-1 px-3 py-2.5 text-sm outline-none"
                        placeholder="ex: ₹200" value={newItemForm.salesPrice} onChange={(e)=>setNewItemForm((p)=>({...p,salesPrice:e.target.value}))}/>
                      <button onClick={()=>setNewItemForm((p)=>({...p,priceWithTax:!p.priceWithTax}))}
                        className={`px-3 py-2.5 text-xs font-semibold border-l border-gray-200 transition-colors ${newItemForm.priceWithTax?'bg-blue-50 text-blue-600':'text-gray-500 bg-white hover:bg-gray-50'}`}>
                        With Tax
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">GST Tax Rate(%)</label>
                    <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-400 bg-white text-gray-600"
                      value={newItemForm.gstRate} onChange={(e)=>setNewItemForm((p)=>({...p,gstRate:e.target.value}))}>
                      <option>None</option>
                      {GST_RATES.filter(r=>r>0).map((r)=><option key={r}>{r}%</option>)}
                    </select>
                  </div>
                </div>

                {/* Measuring Unit + Opening Stock */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Measuring Unit</label>
                    <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-400 bg-white text-gray-600"
                      value={newItemForm.measuringUnit} onChange={(e)=>setNewItemForm((p)=>({...p,measuringUnit:e.target.value}))}>
                      {['Pieces(PCS)','Kilograms(KG)','Litres(LTR)','Box(BOX)','Dozen(DZN)','Metres(MTR)'].map((u)=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Opening Stock</label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
                      <input type="number" className="flex-1 px-3 py-2.5 text-sm outline-none"
                        placeholder="ex: 150 PCS" value={newItemForm.openingStock} onChange={(e)=>setNewItemForm((p)=>({...p,openingStock:e.target.value}))}/>
                      <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 font-semibold">PCS</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {createItemTab !== 'basic' && (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-gray-400">Complete basic details first to unlock advanced options.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <button onClick={()=>setShowCreateItemModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
          <button
            onClick={()=>{
              if (!newItemForm.name.trim()) return;
              // Add the new item directly to the invoice as a row
              const newRow = calcItem({ ...EMPTY_ITEM, productName: newItemForm.name, unitPrice: toNum(newItemForm.salesPrice), taxRate: newItemForm.gstRate==='None'?0:toNum(newItemForm.gstRate) });
              setItems((prev) => {
                const existing = prev.filter((i) => i.productName?.trim());
                return [...existing, newRow].length ? [...existing, newRow] : [{ ...EMPTY_ITEM }];
              });
              setShowCreateItemModal(false);
              setShowItemModal(false);
              setNewItemForm({itemType:'Product',category:'',name:'',showOnline:false,salesPrice:'',priceWithTax:false,gstRate:'None',measuringUnit:'Pieces(PCS)',openingStock:''});
            }}
            disabled={!newItemForm.name.trim()}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Save
          </button>
        </div>
      </Modal>

    </div>
  );
}