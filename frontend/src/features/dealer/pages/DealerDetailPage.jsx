import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDealerById, fetchDealerStats, clearSelected,
  suspendDealer, updateDealer,
} from '../dealerSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import {
  MapPin, FileText, Eye, MessageSquare, Edit,
  AlertOctagon, Search, ChevronDown, X, Mail, Phone,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const TABS = ['Orders', 'Invoices', 'Activity Logs'];
const ORDER_FILTER_TABS = ['All Orders', 'Pending', 'Processing', 'Delivered'];

/* ── tiny reusable modal shell ── */
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
          <X size={16} />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

const DealerDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected: dealer, stats } = useSelector((s) => s.dealer);

  /* tab state */
  const [activeTab, setActiveTab] = useState('Orders');
  const [orderFilter, setOrderFilter] = useState('All Orders');
  const [orderSearch, setOrderSearch] = useState('');

  /* data */
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const fetchedTabs = useRef(new Set());

  /* modals */
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCredit, setEditCredit] = useState('');
  const [editPricingTier, setEditPricingTier] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [showFullscreen, setShowFullscreen] = useState(false);

  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgChannel, setMsgChannel] = useState('email'); // 'email' | 'sms'
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  /* ── initial fetch ── */
  useEffect(() => {
    dispatch(clearSelected());
    dispatch(fetchDealerById(id));
    dispatch(fetchDealerStats(id));
    fetchedTabs.current = new Set();
  }, [dispatch, id]);

  /* fetch docs on load (needed for KYC panel in left col) */
  useEffect(() => {
    if (!id) return;
    setDocsLoading(true);
    api.get(`/documents/dealer/${id}`)
      .then((res) => setDocuments(res.data.data || []))
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [id]);

  /* fetch tab data lazily */
  useEffect(() => {
    if (activeTab === 'Orders' && !fetchedTabs.current.has('Orders')) {
      fetchedTabs.current.add('Orders');
      setOrdersLoading(true);
      api.get('/orders', { params: { dealerId: id, limit: 50 } })
        .then((res) => setOrders(res.data.data || []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false));
    }
    if (activeTab === 'Invoices' && !fetchedTabs.current.has('Invoices')) {
      fetchedTabs.current.add('Invoices');
      setPaymentsLoading(true);
      api.get('/invoices', { params: { dealerId: id, limit: 50 } })
        .then((res) => setPayments(res.data.data || []))
        .catch(() => setPayments([]))
        .finally(() => setPaymentsLoading(false));
    }
  }, [activeTab, id]);

  /* ── open edit modal pre-filled ── */
  const openEditModal = () => {
    setEditCredit(dealer?.creditLimit ?? '');
    setEditPricingTier(dealer?.pricingTier ?? 'standard');
    setShowEditModal(true);
  };

  /* ── save credit limit / tier ── */
  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      await dispatch(updateDealer({
        id,
        creditLimit: Number(editCredit),
        pricingTier: editPricingTier,
        businessType: dealer.businessType,
      })).unwrap();
      // Re-fetch dealer so all displayed fields (credit limit, tier, stats) are fresh
      await dispatch(fetchDealerById(id));
      await dispatch(fetchDealerStats(id));
      setShowEditModal(false);
    } catch (err) {
      toast.error(err || 'Failed to update dealer');
    } finally {
      setEditSaving(false);
    }
  };

  /* ── suspend ── */
  const handleSuspend = async () => {
    if (!suspendReason.trim()) return;
    setSuspending(true);
    try {
      await dispatch(suspendDealer({ id, reason: suspendReason })).unwrap();
      setShowSuspendModal(false);
      setSuspendReason('');
    } catch (_) { }
    finally { setSuspending(false); }
  };

  /* ── send message (opens mailto / sms: link) ── */
  const handleSendMessage = () => {
    setMsgSending(true);
    if (msgChannel === 'email') {
      const mailto = `mailto:${dealer.email}?subject=${encodeURIComponent(msgSubject)}&body=${encodeURIComponent(msgBody)}`;
      window.open(mailto, '_blank');
    } else {
      const smsLink = `sms:${dealer.phone}?body=${encodeURIComponent(msgBody)}`;
      window.open(smsLink, '_blank');
    }
    setMsgSending(false);
    setShowMsgModal(false);
    setMsgSubject('');
    setMsgBody('');
  };

  /* ── order filtering ── */
  const filteredOrders = orders.filter((o) => {
    const matchSearch = !orderSearch ||
      (o.orderNumber || '').toLowerCase().includes(orderSearch.toLowerCase());
    const statusMap = {
      Pending: ['draft', 'pending'],
      Processing: ['order_confirmed', 'processing'],
      Delivered: ['delivered'],
    };
    const matchFilter =
      orderFilter === 'All Orders' ||
      (statusMap[orderFilter] || []).includes(o.status?.toLowerCase());
    return matchSearch && matchFilter;
  });

  /* ── derived stats ── */
  const totalRevenue = stats?.stats?.totalPayments || 0;
  const totalOrders = stats?.stats?.totalOrders || 0;
  const creditLimit = dealer?.creditLimit || 0;
  const creditUsed = dealer?.creditUsed || 0;
  const outstanding = creditUsed;
  const creditPct = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0;
  const pendingCount = orders.filter(o =>
    ['draft', 'pending', 'order_confirmed', 'processing'].includes(o.status)).length;

  /* docs panel — show 2 by default, all when expanded */
  const visibleDocs = showAllDocs ? documents : documents.slice(0, 2);
  const hasMoreDocs = documents.length > 2;

  if (!dealer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 h-[calc(100vh-80px)] overflow-hidden flex flex-col relative">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/dealers')} className="hover:text-primary-600 transition-colors">
          Dealer
        </button>
        <span>›</span>
        <span className="text-slate-800 font-medium">{dealer.businessName}</span>
      </div>

      {/* ── Profile Card ── */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {(dealer.businessName || dealer.ownerName || 'D')[0].toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{dealer.businessName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
              {(dealer.address?.city || dealer.address?.state) && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {[dealer.address?.city, dealer.address?.state].filter(Boolean).join(', ')}
                </span>
              )}
              <span className="font-mono text-xs">ID: {dealer.dealerCode}</span>
              <StatusBadge status={dealer.status} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge-blue capitalize">{dealer.pricingTier} Partner</span>
              {dealer.businessType && (
                <span className="badge-purple capitalize">{dealer.businessType}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowSuspendModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <AlertOctagon size={14} /> Suspend
            </button>
            <button
              onClick={() => setShowMsgModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <MessageSquare size={14} /> Message
            </button>
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Edit size={14} /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Row (dynamic) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Revenue (YTD)</p>
          <p className="text-xl font-bold text-primary-600">₹{totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-600 mt-1">↑ vs last year</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Orders</p>
          <p className="text-xl font-bold text-primary-600">{totalOrders}</p>
          <p className="text-xs text-slate-400 mt-1">{pendingCount} orders pending</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Credit Limit</p>
          <p className="text-xl font-bold text-primary-600">₹{creditLimit.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">{creditPct}% Used</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-primary-600">₹{outstanding.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">due in 14 days</p>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-4 min-h-0 h-full">

          {/* Contact Details — read-only, no Edit button */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Contact Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Email Address</p>
                <p className="text-slate-700 font-medium break-all">{dealer.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone Number</p>
                <p className="text-slate-700 font-medium">
                  {dealer.phone ? `+91 ${dealer.phone}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Registered Address</p>
                <p className="text-slate-700 font-medium">
                  {[dealer.address?.street, dealer.address?.city,
                  dealer.address?.state, dealer.address?.pincode]
                    .filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* KYC Documents */}
          <div className="card p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 text-sm">KYC Documents</h3>
              {hasMoreDocs ? (
                <button
                  onClick={() => setShowAllDocs((v) => !v)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {showAllDocs ? 'Show Less' : 'View All'}
                </button>
              ) : (
                <span className="text-xs text-slate-300 cursor-not-allowed select-none">View All</span>
              )}
            </div>

            {docsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {visibleDocs.map((doc) => (
                  <div
                    key={doc._id}
                    className="flex items-center gap-3 p-2.5 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                      <FileText size={15} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {doc.documentType || doc.name || 'Document'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {doc.updatedAt ? format(new Date(doc.updatedAt), 'dd MMM, yyyy') : ''}
                      </p>
                    </div>
                    <a
                      href={doc.fileUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-primary-600 text-slate-400 flex-shrink-0"
                      title="Preview document"
                    >
                      <Eye size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 card flex flex-col min-h-0">
          {/* Tab headers */}
          <div className="flex items-center border-b border-slate-200 px-4 pt-3 gap-1 sticky top-0 bg-white z-10">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                {tab === 'Orders' ? `Orders(${totalOrders})` : tab}
              </button>
            ))}
            <div className="ml-auto pb-1">
              <button
                onClick={() => setShowFullscreen(true)}
                className="px-3 py-1 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
              >
                See All
              </button>
            </div>
          </div>

          {/* ── Orders tab ── */}
          {activeTab === 'Orders' && (
            <div className="flex flex-col h-full min-h-0">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2 sticky top-[48px] bg-white z-10 p-4">                <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Orders..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
                <div className="flex gap-1 flex-wrap">
                  {ORDER_FILTER_TABS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setOrderFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${orderFilter === f
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-slate-200 text-slate-500 hover:border-primary-300'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                  <button className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-slate-200 text-slate-500 hover:border-primary-300 transition-colors">
                    Date Range <ChevronDown size={11} />
                  </button>
                </div>
              </div>

              {/* Table */}
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No orders found</div>
              ) : (
                <div className="overflow-auto flex-1 px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Order ID', 'Date', 'Amount', 'Payment Status', 'Fulfillment'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOrders.map((o) => (
                        <tr
                          key={o._id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => navigate(`/orders/${o._id}`)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800 text-xs">
                              Order #{o.orderNumber || o._id?.slice(-4)}
                            </p>
                            <p className="text-xs text-slate-400">{o.items?.length ?? 0} items</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-slate-800">
                            ₹{(o.netAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={o.paymentStatus || 'pending'} />
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Invoices tab ── */}
          {activeTab === 'Invoices' && (
            <div className="flex flex-col h-full min-h-0">
              {paymentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No invoices found for this dealer</div>
              ) : (
                <div className="overflow-auto flex-1 px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Invoice #', 'Date', 'Party', 'Amount', 'Balance', 'Status'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payments.map((inv) => (
                        <tr key={inv._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv._id}`)}>
                          <td className="px-3 py-3 text-xs font-mono font-semibold text-primary-600">
                            {inv.invoiceNumber || '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {inv.partyName || inv.dealerId?.businessName || '—'}
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-slate-800">
                            ₹{(inv.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            ₹{(inv.balance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={inv.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Activity Logs tab ── */}
          {activeTab === 'Activity Logs' && (
            <div className="p-8 text-center text-slate-400 text-sm">Activity logs coming soon</div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          FULLSCREEN: Table overlay
      ════════════════════════════════════════ */}
      {showFullscreen && (
        <div className="absolute inset-0 bg-white z-50 flex flex-col rounded-xl shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-slate-900">
                {activeTab === 'Orders' ? `Orders (${totalOrders})` : activeTab}
              </h2>
              <span className="text-sm text-slate-400">{dealer.businessName}</span>
            </div>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
            >
              <X size={18} />
            </button>
          </div>

          {/* Orders fullscreen */}
          {activeTab === 'Orders' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Orders..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {ORDER_FILTER_TABS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setOrderFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${orderFilter === f
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-slate-200 text-slate-500 hover:border-primary-300'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-auto flex-1 px-6 pb-6">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      {['Order ID', 'Date', 'Amount', 'Payment Status', 'Fulfillment'].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.map((o) => (
                      <tr key={o._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setShowFullscreen(false); navigate(`/orders/${o._id}`); }}>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800 text-xs">Order #{o.orderNumber || o._id?.slice(-4)}</p>
                          <p className="text-xs text-slate-400">{o.items?.length ?? 0} items</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd') : '—'}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-800">₹{(o.netAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3"><StatusBadge status={o.paymentStatus || 'pending'} /></td>
                        <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoices fullscreen */}
          {activeTab === 'Invoices' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="overflow-auto flex-1 px-6 pb-6">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      {['Invoice #', 'Date', 'Party', 'Amount', 'Balance', 'Status'].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((inv) => (
                      <tr key={inv._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setShowFullscreen(false); navigate(`/invoices/${inv._id}`); }}>
                        <td className="px-3 py-3 text-xs font-mono font-semibold text-primary-600">{inv.invoiceNumber || '—'}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{inv.invoiceDate ? format(new Date(inv.invoiceDate), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{inv.partyName || inv.dealerId?.businessName || '—'}</td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-800">₹{(inv.totalAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">₹{(inv.balance || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Activity Logs' && (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Activity logs coming soon
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          MODAL: Edit Profile (Credit Limit + Tier)
      ════════════════════════════════════════ */}
      {showEditModal && (
        <Modal title={`Edit ${dealer.businessName}`} onClose={() => setShowEditModal(false)}>
          <div className="space-y-4">
            {/* Credit Limit */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={editCredit}
                onChange={(e) => setEditCredit(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="e.g. 200000"
              />
            </div>

            {/* Pricing Tier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pricing Tier
              </label>
              <select
                value={editPricingTier}
                onChange={(e) => setEditPricingTier(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                {['standard', 'silver', 'gold', 'platinum'].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════
          MODAL: Message Dealer
      ════════════════════════════════════════ */}
      {showMsgModal && (
        <Modal title={`Message ${dealer.businessName}`} onClose={() => setShowMsgModal(false)}>
          {/* Channel toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMsgChannel('email')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${msgChannel === 'email'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Mail size={12} /> Email
            </button>
            <button
              onClick={() => setMsgChannel('sms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${msgChannel === 'sms'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Phone size={12} /> SMS
            </button>
          </div>

          <div className="space-y-3">
            {/* Recipient read-only */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                {msgChannel === 'email' ? 'To (Email)' : 'To (Phone)'}
              </label>
              <input
                readOnly
                value={msgChannel === 'email' ? dealer.email || '—' : dealer.phone || '—'}
                className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Subject — only for email */}
            {msgChannel === 'email' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="Enter subject…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            )}

            {/* Body */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Message</label>
              <textarea
                rows={4}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Type your message…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowMsgModal(false)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendMessage}
              disabled={msgSending || !msgBody.trim()}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {msgChannel === 'email' ? 'Open in Mail' : 'Open in SMS'}
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════
          MODAL: Suspend Dealer
      ════════════════════════════════════════ */}
      {showSuspendModal && (
        <Modal title="Suspend Dealer" onClose={() => setShowSuspendModal(false)}>
          <p className="text-sm text-slate-500 mb-3">
            Please provide a reason for suspending <strong>{dealer.businessName}</strong>.
          </p>
          <textarea
            rows={3}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
            placeholder="Enter reason…"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowSuspendModal(false)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspending}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {suspending ? 'Suspending…' : 'Suspend'}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default DealerDetailPage;