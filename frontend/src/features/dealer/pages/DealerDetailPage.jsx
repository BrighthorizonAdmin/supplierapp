import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDealerById, fetchDealerStats, clearSelected } from '../dealerSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { ArrowLeft, Building2, MapPin, CreditCard, Phone, Mail, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../../../services/api';

const TABS = ['Overview', 'Documents', 'Orders', 'Payments'];

const DealerDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected: dealer, stats } = useSelector((s) => s.dealer);
  const [activeTab, setActiveTab] = useState('Overview');
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  // Track which tabs have already been fetched to avoid refetching on switch-back
  const fetchedTabs = useRef(new Set());

  useEffect(() => {
    dispatch(clearSelected());
    dispatch(fetchDealerById(id));
    dispatch(fetchDealerStats(id));
    fetchedTabs.current = new Set(); // reset cache when dealer id changes
  }, [dispatch, id]);

  useEffect(() => {
    if (activeTab === 'Documents' && !fetchedTabs.current.has('Documents')) {
      fetchedTabs.current.add('Documents');
      setDocsLoading(true);
      api.get(`/documents/dealer/${id}`)
        .then((res) => setDocuments(res.data.data || []))
        .catch(() => setDocuments([]))
        .finally(() => setDocsLoading(false));
    }
    if (activeTab === 'Orders' && !fetchedTabs.current.has('Orders')) {
      fetchedTabs.current.add('Orders');
      setOrdersLoading(true);
      api.get('/orders', { params: { dealerId: id, limit: 10 } })
        .then((res) => setOrders(res.data.data || []))
        .catch(() => setOrders([]))
        .finally(() => setOrdersLoading(false));
    }
    if (activeTab === 'Payments' && !fetchedTabs.current.has('Payments')) {
      fetchedTabs.current.add('Payments');
      setPaymentsLoading(true);
      api.get('/payments', { params: { dealerId: id, limit: 10 } })
        .then((res) => setPayments(res.data.data || []))
        .catch(() => setPayments([]))
        .finally(() => setPaymentsLoading(false));
    }
  }, [activeTab, id]);

  if (!dealer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/dealers')} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{dealer.businessName}</h1>
            <StatusBadge status={dealer.status} />
            <span className="badge-blue capitalize">{dealer.pricingTier}</span>
          </div>
          <p className="text-slate-500 text-sm">{dealer.dealerCode} · {dealer.businessType}</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: stats.stats?.totalOrders },
            { label: 'Total Payments', value: `₹${(stats.stats?.totalPayments || 0).toLocaleString('en-IN')}` },
            { label: 'Total Returns', value: stats.stats?.totalReturns },
            { label: 'Available Credit', value: `₹${(stats.stats?.availableCredit || 0).toLocaleString('en-IN')}` },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{s.value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Building2 size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-500">Owner</p>
                  <p className="font-medium">{dealer.ownerName || dealer.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium">{dealer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium">{dealer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">
                    {[dealer.address?.street, dealer.address?.city, dealer.address?.state, dealer.address?.pincode]
                      .filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Business Details</h3>
            <div className="space-y-3 text-sm">
              {[
                ['GST Number', dealer.gstNumber],
                ['PAN Number', dealer.panNumber],
                ['KYC Status', dealer.kycStatus],
                ['Credit Limit', `₹${(dealer.creditLimit || 0).toLocaleString('en-IN')}`],
                ['Credit Used', `₹${(dealer.creditUsed || 0).toLocaleString('en-IN')}`],
                ['Onboarded By', dealer.onboardedBy?.name],
                ['Approved By', dealer.approvedBy?.name],
                ['Approved At', dealer.approvedAt ? format(new Date(dealer.approvedAt), 'dd MMM yyyy') : '—'],
                // ['Registered', format(new Date(dealer.createdAt), 'dd MMM yyyy')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-900">{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Documents' && (
        <div className="card">
          {docsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No documents uploaded</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5">
              {documents.map((doc) => (
                <a
                  key={doc._id}
                  href={doc.fileUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{doc.documentType || doc.name || 'Document'}</p>
                    <p className="text-xs text-slate-400 capitalize">{doc.verificationStatus || 'pending'}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Orders' && (
        <div className="card overflow-hidden">
          {ordersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No orders found for this dealer</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Order #', 'Date', 'Items', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/orders/${o._id}`)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-600">{o.orderNumber || o._id?.slice(-6)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.items?.length ?? 0} items</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">₹{(o.netAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="card overflow-hidden">
          {paymentsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No payments found for this dealer</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Payment #', 'Date', 'Method', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{p.paymentNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.createdAt ? format(new Date(p.createdAt), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{p.method || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">₹{(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default DealerDetailPage;
