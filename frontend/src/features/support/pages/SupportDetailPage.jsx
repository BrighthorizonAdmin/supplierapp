import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTicketById, updateTicketStatus } from '../supportSlice';
import { ArrowLeft, Wrench, Headphones, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['OPEN','IN_PROGRESS','AWAITING_DEALER','RESOLVED','CLOSED'];
const PRIORITY_OPTIONS = ['LOW','MEDIUM','HIGH','URGENT'];

const BADGE = {
  OPEN:'bg-yellow-100 text-yellow-800', IN_PROGRESS:'bg-blue-100 text-blue-800',
  AWAITING_DEALER:'bg-purple-100 text-purple-800', RESOLVED:'bg-green-100 text-green-800',
  CLOSED:'bg-gray-100 text-gray-600',
};

export default function SupportDetailPage() {
  const { id }   = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current: ticket, detailLoading } = useSelector(s => s.support);

  const [status,     setStatus]     = useState('');
  const [priority,   setPriority]   = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { dispatch(fetchTicketById(id)); }, [id, dispatch]);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status     || 'OPEN');
      setPriority(ticket.priority || 'MEDIUM');
      setAdminNotes(ticket.adminNotes || '');
    }
  }, [ticket]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateTicketStatus({ id, status, priority, adminNotes })).unwrap();
      toast.success('Ticket updated. Dealer will be notified.');
    } catch { toast.error('Failed to update ticket.'); }
    finally { setSaving(false); }
  };

  if (detailLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Loading…
    </div>
  );
  if (!ticket) return null;

  const isService = ticket.type === 'SERVICE_REQUEST';

  return (
    <div className="p-6 w-full px-6 space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/support')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Back to Tickets
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isService ? 'bg-blue-100' : 'bg-purple-100'}`}>
            {isService ? <Wrench size={18} className="text-blue-600" /> : <Headphones size={18} className="text-purple-600" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
            <p className="text-sm text-gray-500">{isService ? 'Service Request' : 'General Support'}</p>
          </div>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${BADGE[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
          {ticket.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — ticket details */}
        <div className="lg:col-span-2 space-y-4">

          {/* Dealer info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dealer</h3>
            <p className="font-semibold text-gray-900">
              {ticket.dealerName || (!isService && ticket.name) || '—'}
            </p>
            {ticket.dealerPhone && <p className="text-sm text-gray-500 mt-0.5">📞 {ticket.dealerPhone}</p>}
            {ticket.dealerEmail && <p className="text-sm text-gray-500">✉️ {ticket.dealerEmail}</p>}
            {/* For general tickets without dealerPhone, show the ticket's phone field */}
            {!ticket.dealerPhone && !isService && ticket.phone && (
              <p className="text-sm text-gray-500 mt-0.5">📞 {ticket.phone}</p>
            )}
            {ticket.contactPhone && ticket.contactPhone !== ticket.dealerPhone && (
              <p className="text-sm text-blue-600 mt-1">Contact: {ticket.contactPhone}</p>
            )}
          </div>

          {/* Ticket content */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {isService ? 'Service Details' : 'Message'}
            </h3>
            {isService ? (
              <div className="space-y-3">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-gray-400">Product</p>
                    <p className="font-semibold text-gray-800">{ticket.productName || '—'}</p>
                    {ticket.productSku && <p className="text-xs text-gray-500">SKU: {ticket.productSku}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Issue Type</p>
                    <p className="font-semibold text-gray-800">{ticket.issueType?.replace(/_/g, ' ') || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{ticket.description}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <div><p className="text-xs text-gray-400">Topic</p><p className="font-medium text-gray-800">{ticket.topic}</p></div>
                  <div><p className="text-xs text-gray-400">From</p><p className="font-medium text-gray-800">{ticket.name}</p></div>
                  {ticket.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium text-gray-800">{ticket.phone}</p></div>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Message</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{ticket.message}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Submitted: {new Date(ticket.createdAt).toLocaleString('en-IN')}
            </p>
          </div>

          {/* Existing admin notes */}
          {ticket.adminNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Previous Notes</h3>
              <p className="text-sm text-amber-900 leading-relaxed">{ticket.adminNotes}</p>
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Update Ticket</h3>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Notes / Response to Dealer
              </label>
              <textarea
                rows={5}
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Add internal notes or a message for the dealer…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">This note will be sent to the dealer as a notification.</p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : 'Save & Notify Dealer'}
            </button>
          </div>

          {/* Quick call */}
          {(ticket.dealerPhone || ticket.contactPhone) && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-2">Quick Call</p>
              <a href={`tel:${ticket.contactPhone || ticket.dealerPhone}`}
                className="text-green-700 font-bold text-lg hover:underline">
                📞 {ticket.contactPhone || ticket.dealerPhone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}