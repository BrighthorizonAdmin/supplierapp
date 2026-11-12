import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Search, X, Download, ChevronDown, ChevronRight, FileText, FileType, Mail,
  IndianRupee, Users, Wallet, CheckCircle2, Clock, Plus, Pencil, Undo2, Paperclip,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import KPICard from '../../../components/ui/KPICard';
import api from '../../../services/api';

// Buvvas website (b2c) customer ledger — the "Buvvas Customers" tab of the Ledger page.
// Backend: /api/customer-ledger (modules/customerLedger).

const ASSET_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const d = (v) => (v ? format(new Date(v), 'dd MMM yyyy') : '—');
const METHODS = ['cash', 'upi', 'neft', 'rtgs', 'imps', 'bank-transfer', 'cheque', 'card', 'other'];
const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', neft: 'NEFT', rtgs: 'RTGS', imps: 'IMPS', 'bank-transfer': 'Bank Transfer', cheque: 'Cheque', card: 'Card', other: 'Other' };
const field = 'text-sm font-normal text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

const STATUS = {
  cleared: ['Paid', 'bg-green-100 text-green-700 ring-1 ring-green-200'],
  partial: ['Part paid', 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'],
  pending: ['Due', 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'],
};
const StatusPill = ({ status }) => {
  const [label, cls] = STATUS[status] || [status, 'bg-slate-100 text-slate-600'];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status === 'cleared' ? <CheckCircle2 size={11} /> : <Clock size={11} />}{label}
    </span>
  );
};

const SmallBtn = ({ icon: Icon, label, onClick, disabled, tone = 'outline' }) => (
  <button onClick={onClick} disabled={disabled} title={label}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${tone === 'solid'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : 'text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-800'}`}>
    <Icon size={13} /> {label}
  </button>
);

const download = async (params) => {
  try {
    const res = await api.get('/customer-ledger/export', { params, responseType: 'blob' });
    const match = (res.headers['content-disposition'] || '').match(/filename="?([^"]+)"?/);
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : `customer-ledger.${params.format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    let msg = 'Download failed';
    try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch { /* not JSON */ }
    toast.error(msg);
  }
};

/* ───────────────────────── order: payments modal ───────────────────────── */
const emptyForm = () => ({ amount: '', method: 'cash', paidOn: format(new Date(), 'yyyy-MM-dd'), reference: '', note: '', file: null });

const OrderModal = ({ order: initial, onClose, onChanged }) => {
  const [order, setOrder] = useState(initial);
  const [form, setForm] = useState(null);       // null = closed; { ...fields, editId? }
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const fd = new FormData();
    ['amount', 'method', 'paidOn', 'reference', 'note'].forEach((k) => fd.append(k, form[k] ?? ''));
    if (form.file) fd.append('screenshot', form.file);
    setSaving(true);
    try {
      const url = `/customer-ledger/order/${order.orderId}/payment${form.editId ? `/${form.editId}` : ''}`;
      const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
      const { data } = form.editId ? await api.put(url, fd, cfg) : await api.post(url, fd, cfg);
      setOrder(data.data);
      setForm(null);
      toast.success(form.editId ? 'Payment updated' : 'Payment recorded');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the payment');
    } finally {
      setSaving(false);
    }
  };

  const undo = async (p) => {
    const reason = window.prompt(`Undo the ${inr(p.amount)} payment? Enter a reason (optional):`, '');
    if (reason === null) return;
    try {
      const { data } = await api.post(`/customer-ledger/order/${order.orderId}/payment/${p._id}/undo`, { reason });
      setOrder(data.data);
      toast.success('Payment undone');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not undo the payment');
    }
  };

  const startEdit = (p) => setForm({
    editId: p._id, amount: p.amount, method: p.method, paidOn: format(new Date(p.paidOn), 'yyyy-MM-dd'),
    reference: p.reference || '', note: p.note || '', file: null,
  });

  return (
    <Modal isOpen onClose={onClose} size="lg" title={`Order ${order.websiteOrderNumber || order.orderNumber}`}>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><p className="text-xs text-slate-400">Order total</p><p className="font-bold text-slate-800">{inr(order.totalAmount)}</p></div>
          <div><p className="text-xs text-slate-400">Paid</p><p className="font-bold text-green-600">{inr(order.paidAmount)}</p></div>
          <div><p className="text-xs text-slate-400">Balance due</p><p className="font-bold text-red-600">{inr(order.outstanding)}</p></div>
          <div><p className="text-xs text-slate-400">Status</p><StatusPill status={order.status} /></div>
        </div>
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>Supplier order {order.orderNumber}{order.invoiceNumber ? ` · Invoice ${order.invoiceNumber}` : ''} · {d(order.orderDate)}</p>
          <p>Payment method: <b>{order.paymentMethodLabel}</b></p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-slate-700">Payments</p>
            {!order.paidOnline && order.outstanding > 0 && !form && (
              <SmallBtn icon={Plus} label="Record payment" tone="solid"
                onClick={() => setForm({ ...emptyForm(), amount: order.outstanding })} />
            )}
          </div>
          {order.paidOnline && (
            <p className="text-xs text-slate-500 mb-2">Paid online through Razorpay — nothing to collect.</p>
          )}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {order.sources.map((s, i) => (
              <div key={`s${i}`} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-600">{s.label}{s.reference ? <span className="text-xs text-slate-400"> · {s.reference}</span> : ''}</span>
                <span className="font-semibold text-slate-800">{inr(s.amount)}</span>
              </div>
            ))}
            {order.payments.map((p) => (
              <div key={p._id} className={`px-3 py-2 ${p.reversedAt ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={p.reversedAt ? 'text-slate-400 line-through' : 'text-slate-700'}>
                    {METHOD_LABEL[p.method] || p.method} · {d(p.paidOn)}{p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${p.reversedAt ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{inr(p.amount)}</span>
                    {!p.reversedAt && (
                      <>
                        <button onClick={() => startEdit(p)} title="Edit" className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={13} /></button>
                        <button onClick={() => undo(p)} title="Undo" className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Undo2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recorded by {p.recordedByName || '—'} on {d(p.recordedAt)}
                  {p.editedAt ? ` · edited by ${p.editedByName || '—'} on ${d(p.editedAt)}` : ''}
                  {p.reversedAt ? ` · undone by ${p.reversedByName || '—'} on ${d(p.reversedAt)}${p.reversalReason ? ` (${p.reversalReason})` : ''}` : ''}
                </p>
                {p.note && <p className="text-xs text-slate-500 mt-0.5">{p.note}</p>}
                {p.screenshotUrl && (
                  <a href={`${ASSET_BASE}${p.screenshotUrl}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-0.5"><Paperclip size={11} /> Proof</a>
                )}
              </div>
            ))}
            {!order.sources.length && !order.payments.length && (
              <p className="px-3 py-3 text-xs text-slate-400">No payment recorded yet.</p>
            )}
          </div>
        </div>

        {form && (
          <div className="border border-primary-100 bg-primary-50/40 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-slate-700">{form.editId ? 'Edit payment' : 'Record payment received'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs text-slate-500">Amount (₹)
                <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} className={`${field} w-full mt-1`} />
              </label>
              <label className="text-xs text-slate-500">Method
                <select value={form.method} onChange={set('method')} className={`${field} w-full mt-1`}>
                  {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">Received on
                <input type="date" value={form.paidOn} onChange={set('paidOn')} className={`${field} w-full mt-1`} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">Reference (UTR / receipt no.)
                <input value={form.reference} onChange={set('reference')} className={`${field} w-full mt-1`} />
              </label>
              <label className="text-xs text-slate-500">Proof (optional)
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                  className="block w-full mt-1 text-xs" />
              </label>
            </div>
            <label className="text-xs text-slate-500 block">Note
              <input value={form.note} onChange={set('note')} className={`${field} w-full mt-1`} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ───────────────────────── one customer card ───────────────────────── */
const CustomerCard = ({ c, dates, defaultOpen, onOpenOrder, reloadKey }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [orders, setOrders] = useState(null);
  const [sending, setSending] = useState(false);
  const key = encodeURIComponent(c.customerKey);

  useEffect(() => {
    if (!open) return;
    api.get(`/customer-ledger/customer/${key}`, { params: dates })
      .then(({ data }) => setOrders(data.data.orders))
      .catch(() => setOrders([]));
  }, [open, key, dates, reloadKey]);

  const remind = async () => {
    setSending(true);
    try {
      const { data } = await api.post(`/customer-ledger/customer/${key}/remind`);
      toast.success(data.message || 'Reminder sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send the reminder');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left">
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          <div>
            <p className="font-semibold text-slate-800">{c.customerName}</p>
            <p className="text-xs text-slate-400">{[c.customerPhone, c.customerEmail].filter(Boolean).join(' · ') || '—'} · {c.orderCount} order{c.orderCount === 1 ? '' : 's'}</p>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right"><p className="text-xs text-slate-400">Billed</p><p className="font-bold text-slate-700">{inr(c.totalAmount)}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400">Paid</p><p className="font-bold text-green-600">{inr(c.totalPaid)}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400">Due</p><p className={`font-bold ${c.totalOutstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>{inr(c.totalOutstanding)}</p></div>
          <div className="flex items-center gap-1.5">
            <SmallBtn icon={FileType} label="Statement" onClick={() => download({ format: 'pdf', customerKey: c.customerKey, ...dates })} />
            <SmallBtn icon={FileText} label="CSV" onClick={() => download({ format: 'csv', customerKey: c.customerKey, ...dates })} />
            {c.totalOutstanding > 0 && (
              <SmallBtn icon={Mail} label={sending ? 'Sending…' : 'Email reminder'} onClick={remind}
                disabled={sending || !c.customerEmail} />
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          {!orders ? (
            <p className="px-4 py-4 text-sm text-slate-400">Loading…</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Order</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Payment</th>
                  <th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Due</th><th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800">{o.websiteOrderNumber || o.orderNumber}</p>
                      <p className="text-xs text-slate-400">{o.orderNumber}{o.invoiceNumber ? ` · ${o.invoiceNumber}` : ''}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{d(o.orderDate)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{o.paymentMethodLabel}</td>
                    <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                    <td className="px-4 py-2.5 text-right text-slate-700 whitespace-nowrap">{inr(o.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 whitespace-nowrap">{inr(o.paidAmount)}</td>
                    <td className={`px-4 py-2.5 text-right whitespace-nowrap ${o.outstanding > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{inr(o.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => onOpenOrder(o)} className="text-xs font-semibold text-primary-600 hover:underline whitespace-nowrap">
                        {!o.paidOnline && o.outstanding > 0 ? 'Record payment' : 'Payments'}
                      </button>
                    </td>
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

/* ───────────────────────── tab ───────────────────────── */
const CustomerLedger = () => {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');        // '' | 'due' | 'paid'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openOrder, setOpenOrder] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const dates = useMemo(() => ({ ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }), [startDate, endDate]);
  const datesKey = `${startDate}|${endDate}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customer-ledger', { params: { search, status, startDate, endDate } });
      setList(data.data || []);
      setSummary(data.summary || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the customer ledger');
    } finally {
      setLoading(false);
    }
  }, [search, status, startDate, endDate]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const exportParams = { search, status, ...dates };
  const hasFilters = status || startDate || endDate;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buvvas Customer Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Orders from the Buvvas website, per customer. Online (Razorpay) orders are paid; COD orders stay due until a payment is recorded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SmallBtn icon={Download} label="Export CSV" tone="solid" onClick={() => download({ format: 'csv', ...exportParams })} />
          <SmallBtn icon={FileType} label="PDF" onClick={() => download({ format: 'pdf', ...exportParams })} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Customers" value={summary.customers || 0} icon={Users} color="blue"
          subtitle={`${summary.customersWithDues || 0} with dues`} />
        <KPICard title="Total Billed" value={inr(summary.totalAmount)} icon={IndianRupee} color="purple" />
        <KPICard title="Collected" value={inr(summary.totalPaid)} icon={Wallet} color="green" />
        <KPICard title="Balance Due" value={inr(summary.totalOutstanding)} icon={IndianRupee} color="red" />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search customer, phone, email or order…"
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
                <option value="">All</option>
                <option value="due">Due</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              From <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              To <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={field} />
            </label>
            {hasFilters && (
              <button onClick={() => { setStatus(''); setStartDate(''); setEndDate(''); }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : list.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <CheckCircle2 size={28} className="mx-auto text-green-400" />
            <p className="mt-2 text-sm text-slate-400">No Buvvas website orders found.</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {list.map((c, i) => (
              <CustomerCard key={`${c.customerKey}|${datesKey}`} c={c} dates={dates} reloadKey={reloadKey}
                defaultOpen={list.length <= 3 || i === 0} onOpenOrder={setOpenOrder} />
            ))}
          </div>
        )}
      </div>

      {openOrder && (
        <OrderModal order={openOrder} onClose={() => setOpenOrder(null)} onChanged={() => setReloadKey((k) => k + 1)} />
      )}
    </div>
  );
};

export default CustomerLedger;
