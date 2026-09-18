import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';
import {
  Search, Filter, X, Download, Bell, ChevronDown, ChevronRight,
  Paperclip, Trash2, Plus, CalendarClock, AlertTriangle,
  IndianRupee, Users, Layers3, Wallet, FileSpreadsheet, FileText,
  Clock, CheckCircle2, ReceiptText, ImagePlus, Send,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Pagination from '../../../components/ui/Pagination';
import KPICard from '../../../components/ui/KPICard';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  fetchLedger, fetchOrderLedger, clearDetail,
  addManualPayment, deleteManualPayment, patchLedgerEntry,
  uploadScreenshot, deleteScreenshot, notifyDealer, downloadLedger,
} from '../ledgerSlice';

const ASSET_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const d = (v) => (v ? format(new Date(v), 'dd MMM yyyy') : '—');

const MANUAL_METHODS = ['cash', 'upi', 'neft', 'rtgs', 'imps', 'bank-transfer', 'cheque', 'card', 'other'];

const STATUS_PILL = {
  pending: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  partial: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  cleared: 'bg-green-100 text-green-700 ring-1 ring-green-200',
};
const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[status] || 'bg-slate-100 text-slate-600'}`}>
    {status === 'cleared' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
    {status}
  </span>
);

const TL_META = {
  'split-paynow': { label: 'Split · pay now', dot: 'bg-violet-400' },
  gateway: { label: 'Online payment', dot: 'bg-emerald-400' },
  'invoice-allocation': { label: 'Invoice payment', dot: 'bg-emerald-400' },
  'invoice-recorded': { label: 'Recorded on invoice', dot: 'bg-emerald-400' },
  'order-marked-paid': { label: 'Marked paid', dot: 'bg-emerald-400' },
  manual: { label: 'Manual entry', dot: 'bg-amber-400' },
};

/* ───────────────────────── shared notify dropdown ───────────────────────── */
const NotifyMenu = ({ onPick, label = 'Notify', tone = 'outline', disabled, direction = 'down' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const base =
    tone === 'solid'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : 'border border-primary-200 text-primary-700 bg-white hover:bg-primary-50';
  const up = direction === 'up';
  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 ${base}`}>
        <Bell size={13} /> {label}
        <ChevronDown size={12} className={`transition-transform ${open !== up ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden text-xs ${up ? 'bottom-full mb-1.5' : 'mt-1.5'}`}>
          {[['both', 'App + Email', Send], ['app', 'In-app only', Bell], ['email', 'Email only', FileText]].map(([v, l, Ic]) => (
            <button key={v} type="button" onClick={() => { setOpen(false); onPick(v); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-slate-600">
              <Ic size={13} className="text-slate-400" /> {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const IconBtn = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} title={label}
    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:text-slate-800 transition-colors">
    <Icon size={13} /> {label}
  </button>
);

const SectionTitle = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2 text-slate-700">
      <Icon size={15} className="text-slate-400" />
      <h4 className="text-sm font-semibold">{children}</h4>
    </div>
    {action}
  </div>
);

/* ───────────────────────── manual-payment form ───────────────────────── */
const ManualPaymentForm = ({ orderId, onDone }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    amount: '', paidOn: new Date().toISOString().slice(0, 10),
    method: 'upi', reference: '', note: '',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const field = 'mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...form };
    if (file) payload.screenshot = file;
    const res = await dispatch(addManualPayment({ orderId, form: payload }));
    setBusy(false);
    if (!res.error) {
      setForm({ amount: '', paidOn: new Date().toISOString().slice(0, 10), method: 'upi', reference: '', note: '' });
      setFile(null);
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <label className="text-xs font-medium text-slate-500">Amount *
        <input type="number" step="0.01" min="0.01" required value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} placeholder="0.00" />
      </label>
      <label className="text-xs font-medium text-slate-500">Paid on *
        <input type="date" required value={form.paidOn}
          onChange={(e) => setForm({ ...form, paidOn: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-slate-500">Method
        <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field}>
          {MANUAL_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-500">Reference / UTR
        <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Note
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Payment proof (image / PDF)
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-primary-700 file:font-semibold hover:file:bg-primary-100" />
      </label>
      <div className="sm:col-span-2 flex justify-end">
        <button type="submit" disabled={busy}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
          <Plus size={14} /> {busy ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </form>
  );
};

/* ───────────────────────── detail modal ───────────────────────── */
const DetailModal = ({ orderId, onClose }) => {
  const dispatch = useDispatch();
  const { detail, detailLoading } = useSelector((s) => s.ledger);
  const [showForm, setShowForm] = useState(false);
  const [clearBy, setClearBy] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (orderId) dispatch(fetchOrderLedger(orderId));
    return () => dispatch(clearDetail());
  }, [orderId, dispatch]);

  useEffect(() => {
    if (detail) {
      setClearBy(detail.ledger?.expectedClearanceDate ? new Date(detail.ledger.expectedClearanceDate).toISOString().slice(0, 10) : '');
      setRemarks(detail.ledger?.remarks || '');
    }
  }, [detail]);

  const r = detail;
  const field = 'mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  const lastReminder = r?.ledger?.notifyLog?.length ? r.ledger.notifyLog[r.ledger.notifyLog.length - 1] : null;

  return (
    <Modal isOpen={!!orderId} onClose={onClose} size="xl"
      title={r ? `Ledger · ${r.orderNumber || r.dealerOrderNumber || ''}` : 'Ledger'}>
      {detailLoading || !r ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* headline band */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-red-50 to-white px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Outstanding</p>
                <p className="text-3xl font-bold text-red-600 tabular-nums">{inr(r.outstanding)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  of {inr(r.totalAmount)} · paid {inr(r.paidAmount)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={r.status} />
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.overdue ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-slate-100 text-slate-600'}`}>
                  <CalendarClock size={11} /> {r.overdue ? `Overdue ${r.overdueDays}d` : `Due ${d(r.dueDate)}`}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200 border-t border-slate-200 text-sm">
              {[
                ['Dealer', r.dealerName],
                ['Order date', d(r.orderDate)],
                ['Method', r.paymentMethodLabel],
                ['Source', r.source === 'dealer-app' ? 'Dealer app' : 'Supplier'],
              ].map(([k, v]) => (
                <div key={k} className="px-4 py-3">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className="text-slate-800 mt-0.5 font-medium">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {r.isSplit && (
            <p className="text-xs text-slate-600 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
              Split order — {inr(r.splitPayNowAmount)} paid at checkout, {inr(r.splitCreditAmount)} on credit.
            </p>
          )}

          {/* payment timeline */}
          <section>
            <SectionTitle icon={ReceiptText}>Payment timeline</SectionTitle>
            {r.timeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                No payments recorded yet.
              </div>
            ) : (
              <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                {r.timeline.map((t, i) => {
                  const m = TL_META[t.kind] || { label: t.kind, dot: 'bg-slate-300' };
                  return (
                    <li key={i} className="ml-4">
                      <span className={`absolute -left-[6px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${m.dot}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 tabular-nums">
                            {inr(t.amount)}
                            <span className="ml-2 text-xs font-normal text-slate-500">{t.methodLabel || t.method || '—'}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {d(t.date)} · {m.label}
                            {t.reference ? ` · ${t.reference}` : ''}
                            {t.note ? ` · ${t.note}` : ''}
                            {t.recordedByName ? ` · ${t.recordedByName}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.screenshotUrl && (
                            <a href={`${ASSET_BASE}${t.screenshotUrl}`} target="_blank" rel="noreferrer"
                              className="text-primary-600 hover:text-primary-700"><Paperclip size={13} /></a>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.source === 'ledger' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {t.source === 'ledger' ? 'manual' : 'system'}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* manual payment log */}
          <section>
            <SectionTitle icon={Wallet}
              action={
                <button onClick={() => setShowForm((v) => !v)}
                  className="text-xs font-semibold text-primary-700 border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-50">
                  {showForm ? 'Close' : '+ Add payment'}
                </button>
              }>
              Manual payment log <span className="font-normal text-slate-400">· book-keeping only</span>
            </SectionTitle>
            <p className="-mt-1 mb-2 text-xs text-slate-400">
              Online, invoice, split &amp; gateway payments appear in the timeline above automatically.
              Use this only for offline payments (cash, cheque, bank transfer) the system didn't capture — it stays out of the Payments module.
            </p>
            {showForm && <ManualPaymentForm orderId={r.orderId} onDone={() => setShowForm(false)} />}
            {(r.ledger?.manualPayments || []).length > 0 && (
              <ul className="mt-2 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {r.ledger.manualPayments.map((mp) => (
                  <li key={mp._id} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50">
                    <span className="text-slate-700 tabular-nums">
                      <span className="font-semibold">{inr(mp.amount)}</span>
                      <span className="text-slate-400"> · {mp.method} · {d(mp.paidOn)}{mp.reference ? ` · ${mp.reference}` : ''}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {mp.screenshotUrl && (
                        <a href={`${ASSET_BASE}${mp.screenshotUrl}`} target="_blank" rel="noreferrer" className="text-primary-600"><Paperclip size={13} /></a>
                      )}
                      <button onClick={() => dispatch(deleteManualPayment({ orderId: r.orderId, paymentId: mp._id }))}
                        className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* screenshots */}
          <section>
            <SectionTitle icon={ImagePlus}>Payment proof screenshots</SectionTitle>
            <div className="flex flex-wrap gap-3">
              {(r.ledger?.proofScreenshots || []).map((s) => (
                <div key={s._id} className="relative group">
                  <a href={`${ASSET_BASE}${s.url}`} target="_blank" rel="noreferrer">
                    <img src={`${ASSET_BASE}${s.url}`} alt={s.label || 'proof'}
                      className="h-24 w-24 object-cover rounded-xl border border-slate-200 group-hover:brightness-95 transition" />
                  </a>
                  <button onClick={() => dispatch(deleteScreenshot({ orderId: r.orderId, screenshotId: s._id }))}
                    className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="h-24 w-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50/40 cursor-pointer text-xs transition">
                <ImagePlus size={16} /> upload
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) dispatch(uploadScreenshot({ orderId: r.orderId, file: f }));
                    e.target.value = '';
                  }} />
              </label>
            </div>
          </section>

          {/* override + remarks */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><CalendarClock size={12} /> Remaining amount due by (override)</span>
                <input type="date" value={clearBy} onChange={(e) => setClearBy(e.target.value)} className={field} />
              </label>
              <label className="text-xs font-medium text-slate-500">Remarks
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} placeholder="Internal note…" />
              </label>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => dispatch(patchLedgerEntry({ orderId: r.orderId, body: { expectedClearanceDate: clearBy || null, remarks } }))}
                className="px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900">
                Save changes
              </button>
            </div>
          </section>

          {/* footer — pinned to the bottom of the scroll area */}
          <div className="sticky bottom-0 -mx-5 -mb-5 px-5 pt-4 pb-5 bg-white/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconBtn icon={FileText} label="CSV" onClick={() => downloadLedger({ scope: 'order', orderId: r.orderId, format: 'csv' })} />
              <IconBtn icon={FileSpreadsheet} label="Excel" onClick={() => downloadLedger({ scope: 'order', orderId: r.orderId, format: 'xlsx' })} />
            </div>
            <div className="flex items-center gap-3">
              {lastReminder && (
                <span className="text-xs text-slate-400">
                  Dealer last reminded {d(lastReminder.sentAt)} · {lastReminder.channel}
                  {lastReminder.ok ? '' : ' · failed'}
                </span>
              )}
              <NotifyMenu label="Remind dealer (all dues)" tone="solid" direction="up"
                onPick={(c) => dispatch(notifyDealer({ dealerId: r.dealerId, channel: c }))} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ───────────────────────── dealer group card ───────────────────────── */
const MetaChip = ({ children, tone = 'slate' }) => {
  const map = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[tone]}`}>{children}</span>;
};

const DealerGroup = ({ g, onOpen, defaultOpen, view = 'outstanding' }) => {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(defaultOpen);
  const initials = (g.dealerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 bg-slate-50/70 rounded-t-2xl ${open ? 'border-b border-slate-100' : 'rounded-b-2xl'}`}>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 text-left min-w-0">
          <span className="text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
          <span className="h-9 w-9 shrink-0 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 truncate">{g.dealerName}</span>
              {g.dealerCode && <span className="text-[11px] text-slate-400 font-medium">{g.dealerCode}</span>}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 mt-1">
              <MetaChip>{g.orderCount} order{g.orderCount > 1 ? 's' : ''}</MetaChip>
              {g.pendingCount > 0 && <MetaChip tone="amber">{g.pendingCount} pending</MetaChip>}
              {g.partialCount > 0 && <MetaChip tone="blue">{g.partialCount} partial</MetaChip>}
              {g.overdueCount > 0 && <MetaChip tone="red"><AlertTriangle size={9} className="inline -mt-0.5" /> {g.overdueCount} overdue</MetaChip>}
              {g.clearedCount > 0 && <MetaChip tone="green">{g.clearedCount} cleared</MetaChip>}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="text-right mr-1">
            {view === 'cleared' ? (
              <>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Collected</p>
                <p className="font-bold text-green-600 tabular-nums leading-tight">{inr(g.totalPaid)}</p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Outstanding</p>
                <p className="font-bold text-red-600 tabular-nums leading-tight">{inr(g.totalOutstanding)}</p>
              </>
            )}
          </div>
          {view === 'outstanding' && (
            <NotifyMenu label="Notify" onPick={(c) => dispatch(notifyDealer({ dealerId: g.dealerId, channel: c }))} />
          )}
          <IconBtn icon={FileSpreadsheet} label="Excel" onClick={() => downloadLedger({ scope: 'dealer', dealerId: g.dealerId, format: 'xlsx' })} />
          <IconBtn icon={FileText} label="CSV" onClick={() => downloadLedger({ scope: 'dealer', dealerId: g.dealerId, format: 'csv' })} />
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500">
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Order</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Method</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Total</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Paid</th>
                {view === 'cleared' ? (
                  <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Last Payment</th>
                ) : (
                  <>
                    <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Outstanding</th>
                    <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Clear by</th>
                  </>
                )}
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {g.orders.map((o) => (
                <tr key={o.orderId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {o.orderNumber || o.dealerOrderNumber || '—'}
                    {o.source === 'dealer-app' && <span className="ml-1.5 text-[10px] text-primary-500 font-sans">app</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{d(o.orderDate)}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{o.paymentMethodLabel}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums whitespace-nowrap">{inr(o.totalAmount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums whitespace-nowrap">{inr(o.paidAmount)}</td>
                  {view === 'cleared' ? (
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{d(o.lastPaymentDate)}</td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600 tabular-nums whitespace-nowrap">{inr(o.outstanding)}</td>
                      <td className={`px-4 py-2.5 whitespace-nowrap ${o.overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                        {d(o.dueDate)}{o.overdue ? ` · +${o.overdueDays}d` : ''}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => onOpen(o.orderId)}
                      className="text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── page ───────────────────────── */
const LedgerPage = () => {
  const dispatch = useDispatch();
  const { groups, summary, pagination, loading } = useSelector((s) => s.ledger);

  const [view, setView] = useState('outstanding'); // 'outstanding' | 'cleared'
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openOrder, setOpenOrder] = useState(null);
  const [notifyingAll, setNotifyingAll] = useState(false);

  // The "Cleared" tab is its own history view — it always asks the backend for
  // status=cleared (which pulls in settled orders the outstanding list hides)
  // regardless of the Pending/Partial filter, which only applies to Outstanding.
  const effectiveStatus = view === 'cleared' ? 'cleared' : status;

  const notifyAll = async (channel) => {
    setNotifyingAll(true);
    try {
      const { data } = await api.post('/ledger/notify/bulk', { channel });
      toast.success(`Notified ${data.data?.notified ?? 0} dealer(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk notify failed');
    } finally {
      setNotifyingAll(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [view]);

  useEffect(() => {
    dispatch(fetchLedger({ page, limit: 20, search, status: effectiveStatus, overdue, startDate, endDate }));
  }, [dispatch, page, search, effectiveStatus, overdue, startDate, endDate, openOrder]);

  const hasFilters = status || overdue || startDate || endDate;
  const exportParams = useMemo(
    () => ({ scope: 'all', status: effectiveStatus, overdue, startDate, endDate }),
    [effectiveStatus, overdue, startDate, endDate]
  );
  const s = summary || {};
  const field = 'text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  return (
    <div className="space-y-6 pb-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {view === 'cleared'
              ? 'History of dealer orders that have been fully paid off.'
              : 'Outstanding payments for pending & partially-paid dealer orders.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'outstanding' && (
            <NotifyMenu label={notifyingAll ? 'Notifying…' : 'Notify all'} disabled={notifyingAll} onPick={notifyAll} />
          )}
          <button onClick={() => downloadLedger({ ...exportParams, format: 'xlsx' })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Download size={14} /> Export all
          </button>
          <IconBtn icon={FileText} label="CSV" onClick={() => downloadLedger({ ...exportParams, format: 'csv' })} />
        </div>
      </div>

      {/* view tabs */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {[['outstanding', 'Outstanding'], ['cleared', 'Cleared']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-md font-semibold transition-colors ${view === v ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {view === 'cleared' ? (
          <>
            <KPICard title="Total Collected" value={inr(s.totalPaid || 0)} icon={IndianRupee} color="green"
              subtitle={`across ${s.orderCount || 0} cleared order${(s.orderCount || 0) === 1 ? '' : 's'}`} />
            <KPICard title="Dealers" value={s.dealerCount || 0} icon={Users} color="blue" />
            <KPICard title="Cleared Orders" value={s.clearedCount || 0} icon={Layers3} color="green" />
            <KPICard title="Order Value" value={inr(s.totalBilled || 0)} icon={IndianRupee} color="purple" />
          </>
        ) : (
          <>
            <KPICard title="Total Outstanding" value={inr(s.totalOutstanding || 0)} icon={IndianRupee} color="red"
              subtitle={`across ${s.orderCount || 0} order${(s.orderCount || 0) === 1 ? '' : 's'}`} />
            <KPICard title="Dealers with Dues" value={s.dealerCount || 0} icon={Users} color="blue" />
            <KPICard title="Pending / Partial" value={`${s.pendingCount || 0} / ${s.partialCount || 0}`} icon={Layers3} color="yellow" />
            <KPICard title="Overdue" value={s.overdueCount || 0} icon={AlertTriangle} color="orange"
              subtitle={(s.overdueOutstanding || 0) > 0 ? `${inr(s.overdueOutstanding)} past due` : 'nothing past due'} />
          </>
        )}
      </div>

      {/* list */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search dealer, order or invoice…"
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-72" />
          </div>
          <button onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${hasFilters || filtersOpen ? 'border-primary-200 text-primary-700 bg-primary-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Filter size={14} /> Filters{hasFilters ? ' · on' : ''}
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
            {view === 'outstanding' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={field}>
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className={field} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className={field} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
              <input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
              Overdue only
            </label>
            {hasFilters && (
              <button onClick={() => { setStatus(''); setOverdue(false); setStartDate(''); setEndDate(''); setPage(1); }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 pb-2">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <CheckCircle2 size={28} className="mx-auto text-green-400" />
            <p className="mt-2 text-sm text-slate-400">
              {view === 'cleared' ? 'No cleared orders in this range yet.' : 'No outstanding dues found.'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {groups.map((g, i) => (
              <DealerGroup key={g.dealerId} g={g} view={view} onOpen={setOpenOrder} defaultOpen={groups.length <= 3 || i === 0} />
            ))}
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {openOrder && <DetailModal orderId={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
};

export default LedgerPage;
