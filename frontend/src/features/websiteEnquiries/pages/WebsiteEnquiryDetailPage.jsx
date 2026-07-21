import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEnquiryById, updateEnquiryStatus } from '../websiteEnquirySlice';
import { ArrowLeft, MessageSquare, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];

const BADGE = {
  NEW: 'bg-yellow-100 text-yellow-800',
  CONTACTED: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const SOURCE_LABEL = {
  support_page: 'Support Page',
  get_quote_page: 'Get a Quote',
  other: 'Other',
};

export default function WebsiteEnquiryDetailPage() {
  const { id }   = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current: enquiry, detailLoading } = useSelector(s => s.websiteEnquiries);

  const [status,     setStatus]     = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { dispatch(fetchEnquiryById(id)); }, [id, dispatch]);

  useEffect(() => {
    if (enquiry) {
      setStatus(enquiry.status || 'NEW');
      setAdminNotes(enquiry.adminNotes || '');
    }
  }, [enquiry]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateEnquiryStatus({ id, status, adminNotes })).unwrap();
      toast.success('Enquiry updated.');
    } catch { toast.error('Failed to update enquiry.'); }
    finally { setSaving(false); }
  };

  if (detailLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Loading…
    </div>
  );
  if (!enquiry) return null;

  return (
    <div className="p-6 w-full px-6 space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/website-enquiries')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Back to Enquiries
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100">
            <MessageSquare size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{enquiry.enquiryNumber}</h1>
            <p className="text-sm text-gray-500">{SOURCE_LABEL[enquiry.source] || enquiry.source}</p>
          </div>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${BADGE[enquiry.status] || 'bg-gray-100 text-gray-600'}`}>
          {enquiry.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — enquiry details */}
        <div className="lg:col-span-2 space-y-4">

          {/* Contact info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Submitted By</h3>
            <p className="font-semibold text-gray-900">{enquiry.name}</p>
            {enquiry.mobile && <p className="text-sm text-gray-500 mt-0.5">📞 {enquiry.mobile}</p>}
            {enquiry.email && <p className="text-sm text-gray-500">✉️ {enquiry.email}</p>}
            {enquiry.businessType && (
              <p className="text-sm text-blue-600 mt-1">Business Type: {enquiry.businessType}</p>
            )}
          </div>

          {/* Message */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Message</h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
              {enquiry.message || 'No message provided.'}
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Submitted: {new Date(enquiry.createdAt).toLocaleString('en-IN')}
            </p>
          </div>

          {/* Existing admin notes */}
          {enquiry.adminNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Previous Notes</h3>
              <p className="text-sm text-amber-900 leading-relaxed">{enquiry.adminNotes}</p>
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Update Enquiry</h3>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Internal Notes
              </label>
              <textarea
                rows={5}
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this enquiry…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Quick call */}
          {enquiry.mobile && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-2">Quick Call</p>
              <a href={`tel:${enquiry.mobile}`}
                className="text-green-700 font-bold text-lg hover:underline">
                📞 {enquiry.mobile}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
