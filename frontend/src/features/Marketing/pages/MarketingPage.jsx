import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, Search, Phone, MapPin } from 'lucide-react';
import { fetchLeads, fetchLeadStats } from '../marketingSlice';

const KYC_STYLES = {
  'pending-kyc':   'bg-yellow-50 text-yellow-700 border-yellow-200',
  'kyc-submitted': 'bg-blue-50 text-blue-700 border-blue-200',
  'kyc-verified':  'bg-green-50 text-green-700 border-green-200',
  'kyc-rejected':  'bg-red-50 text-red-700 border-red-200',
};
const KYC_LABELS = {
  'pending-kyc':   'Pending KYC',
  'kyc-submitted': 'KYC Submitted',
  'kyc-verified':  'KYC Verified',
  'kyc-rejected':  'KYC Rejected',
};

const PIPELINE_LABELS = {
  'lead-creation':        'Lead Creation',
  'document-collection':  'Document Collection',
  'admin-review':         'Admin Review',
  'approval':             'Approval',
};

const getInitials = (name) =>
  name ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '??';

const timeAgo = (date) => {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return ''; }
};

const MarketingPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading, pagination, stats } = useSelector((s) => s.marketing);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  useEffect(() => {
    dispatch(fetchLeadStats());
    dispatch(fetchLeads({ limit: 50 }));
  }, [dispatch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(fetchLeads({ search: search || undefined, pipelineStage: stageFilter || undefined, limit: 50 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, stageFilter, dispatch]);

  const STAT_CARDS = [
    { label: 'Total Leads', value: stats?.total ?? 0, color: 'text-blue-600' },
    { label: 'Active', value: stats?.active ?? 0, color: 'text-green-600' },
    { label: 'Converted', value: stats?.converted ?? 0, color: 'text-purple-600' },
    { label: 'Pending Docs', value: stats?.documentCollection ?? 0, color: 'text-amber-600' },
  ];

  return (
    <div className="-m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-blue-700">Marketing Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Capture and track dealer leads from external sources through the onboarding pipeline.
          </p>
        </div>
        <button
          onClick={() => navigate('/marketing-leads/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Add New Lead
        </button>
      </div>

      {/* Stat cards */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Stages</option>
          <option value="lead-creation">Lead Creation</option>
          <option value="document-collection">Document Collection</option>
          <option value="admin-review">Admin Review</option>
          <option value="approval">Approval</option>
        </select>
        {pagination?.total > 0 && (
          <span className="ml-auto text-xs text-slate-400">{pagination.total} leads</span>
        )}
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {loading && list.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading leads...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm mb-3">No leads found</p>
            <button
              onClick={() => navigate('/marketing-leads/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Add First Lead
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">KYC Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Calls</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {list.map((lead) => {
                  const location = [lead.address?.district, lead.address?.state].filter(Boolean).join(', ');
                  return (
                    <tr
                      key={lead._id}
                      onClick={() => navigate(`/marketing-leads/${lead._id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {getInitials(lead.businessName)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight">{lead.businessName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{lead.leadCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700 font-medium">{lead.primaryContact}</p>
                        {lead.phone && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Phone size={10} />
                            {lead.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {location ? (
                          <span className="flex items-center gap-1 text-slate-600 text-xs">
                            <MapPin size={11} className="text-slate-400" />
                            {location}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          {PIPELINE_LABELS[lead.pipelineStage] || lead.pipelineStage}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${KYC_STYLES[lead.kycStatus] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                          {KYC_LABELS[lead.kycStatus] || lead.kycStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium text-center">
                        {lead.callLogs?.length ?? 0}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {lead.createdAt ? timeAgo(lead.createdAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketingPage;