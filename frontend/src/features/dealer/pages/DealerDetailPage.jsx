import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDealerById, fetchDealerStats } from '../dealerSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { ArrowLeft, Building2, MapPin, CreditCard, Phone, Mail } from 'lucide-react';

const TABS = ['Overview', 'Documents', 'Orders', 'Payments'];

const DealerDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected: dealer, stats } = useSelector((s) => s.dealer);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    dispatch(fetchDealerById(id));
    dispatch(fetchDealerStats(id));
  }, [dispatch, id]);

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
                  <p className="font-medium">{dealer.ownerName}</p>
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
                ['Registered', format(new Date(dealer.createdAt), 'dd MMM yyyy')],
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
        <div className="card p-6 text-center text-slate-400">
          <p>Document management — link to /api/documents/dealer/{id}</p>
        </div>
      )}

      {activeTab === 'Orders' && (
        <div className="card p-6 text-center text-slate-400">
          <p>Dealer orders — use Orders page with dealer filter</p>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="card p-6 text-center text-slate-400">
          <p>Dealer payments — use Payments page with dealer filter</p>
        </div>
      )}
    </div>
  );
};

export default DealerDetailPage;
