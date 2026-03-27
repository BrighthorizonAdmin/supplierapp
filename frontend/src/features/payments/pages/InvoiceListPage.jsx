import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchInvoices, deleteInvoice, issueInvoice } from '../paymentSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import { format } from 'date-fns';
import { Plus, Search, Eye, Trash2, Send, FileText } from 'lucide-react';

const InvoiceListPage = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { invoices, invoicePagination, loading } = useSelector((s) => s.payment);

  const [page,        setPage]        = useState(1);
  const [status,      setStatus]      = useState('');
  const [search,      setSearch]      = useState('');
  const [invoiceType, setInvoiceType] = useState(''); // '' = all, 'b2b', 'retail'

  useEffect(() => {
    dispatch(fetchInvoices({ page, limit: 20, status, search, invoiceType }));
  }, [dispatch, page, status, search, invoiceType]);

  const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-700">{v}</span>,
    },
    {
      key: 'invoiceType',
      label: 'Type',
      render: (v) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold ${
            v === 'retail'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {v === 'retail' ? 'Retail' : 'B2B'}
        </span>
      ),
    },
    {
      key: 'partyName',
      label: 'Dealer',
      render: (v, row) => v || row.dealerId?.businessName || '—',
    },
    {
      key: 'notes',
      label: 'Customer',
      render: (v, row) => {
        if (row.invoiceType !== 'retail') return '—';
        // Notes format: "Retail sale to: Name | Phone"
        const match = (v || '').replace('Retail sale to: ', '');
        return <span className="text-xs text-slate-600">{match || '—'}</span>;
      },
    },
    {
      key: 'invoiceDate',
      label: 'Date',
      render: (v) => (v ? format(new Date(v), 'dd MMM yyyy') : '—'),
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      render: (v) => <span className="font-semibold">{fmt(v)}</span>,
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (v) => (
        <span className={v > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
          {fmt(v)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: '_id',
      label: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/invoices/${id}`)}
            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
            title="View"
          >
            <Eye size={15} />
          </button>
          {row.status === 'draft' && (
            <>
              <button
                onClick={() => navigate(`/invoices/${id}/edit`)}
                className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600"
                title="Edit"
              >
                <FileText size={15} />
              </button>
              <button
                onClick={() => dispatch(issueInvoice(id))}
                className="p-1.5 rounded hover:bg-green-50 text-green-600"
                title="Issue"
              >
                <Send size={15} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this draft invoice?')) dispatch(deleteInvoice(id));
                }}
                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Sales Invoices</h1>
        <button
          onClick={() => navigate('/invoices/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search invoice #..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Invoice Type filter */}
        <select
          className="input w-48"
          value={invoiceType}
          onChange={(e) => { setInvoiceType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="b2b">B2B (Supplier → Dealer)</option>
          <option value="retail">Retail (Dealer → Customer)</option>
        </select>

        {/* Status filter */}
        <select
          className="input w-40"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          {['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'].map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3">
        <button
          onClick={() => { setInvoiceType(''); setPage(1); }}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            invoiceType === ''
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
          }`}
        >
          All Invoices
        </button>
        <button
          onClick={() => { setInvoiceType('retail'); setPage(1); }}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            invoiceType === 'retail'
              ? 'bg-green-700 text-white border-green-700'
              : 'bg-white text-green-700 border-green-300 hover:border-green-500'
          }`}
        >
        Retail Sales
        </button>
        <button
          onClick={() => { setInvoiceType('b2b'); setPage(1); }}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            invoiceType === 'b2b'
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-white text-blue-700 border-blue-300 hover:border-blue-500'
          }`}
        >
        B2B Invoices
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <Table columns={columns} data={invoices} loading={loading} />
        <Pagination pagination={invoicePagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default InvoiceListPage;