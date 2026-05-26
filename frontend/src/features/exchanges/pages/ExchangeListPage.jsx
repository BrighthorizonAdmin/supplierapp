import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchExchanges, fetchExchangeById, updateExchangeStatus } from '../exchangeSlice';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved',  value: 'approved' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected',  value: 'rejected' },
];

const STATUS_LABEL = {
  REQUEST_SUBMITTED:   'Submitted',
  UNDER_REVIEW:        'Under Review',
  APPROVED:            'Approved',
  SHIPPED_BACK:        'Shipped Back',
  RECEIVED:            'Received',
  REPLACEMENT_SHIPPED: 'Replacement Shipped',
  COMPLETED:           'Completed',
  REJECTED:            'Rejected',
  CANCELLED:           'Cancelled',
};

const ExchangeListPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading } = useSelector((s) => s.exchange);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]           = useState('');
  const [detailsModal, setDetailsModal] = useState(null);
  const [detailData, setDetailData]   = useState(null);

  useEffect(() => {
    dispatch(fetchExchanges({ page, limit: 20, status: statusFilter }));
  }, [dispatch, page, statusFilter]);

  const handleViewDetails = (row) => {
    dispatch(fetchExchangeById(row._id)).then((res) => {
      if (!res.error) setDetailData(res.payload);
      setDetailsModal(row);
    });
  };

  const handleStatusUpdate = (id, status) => {
    dispatch(updateExchangeStatus({ id, status })).then((res) => {
      if (!res.error) dispatch(fetchExchanges({ page, limit: 20, status: statusFilter }));
    });
  };

  const filtered = list.filter((e) => {
    if (!search) return true;
    return (
      e.exchangeId?.toLowerCase().includes(search.toLowerCase()) ||
      e.dealerId?.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      e.dealerId?.name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const isPending = (status) => ['REQUEST_SUBMITTED', 'UNDER_REVIEW'].includes(status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exchanges</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review exchange requests and manage replacements.</p>
        </div>
      </div>

      <div className="card">
        {/* Filter tabs + Search */}
        <div className="flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Exchange ID, Dealer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Exchange ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Dealer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Items</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No exchange requests found</td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row._id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                        {row.exchangeId || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {row.dealerId?.businessName || row.dealerId?.name || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.createdAt ? format(new Date(row.createdAt), 'yyyy-MM-dd') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.items?.length ? `${row.items.length} Items` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isPending(row.status) ? (
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handleStatusUpdate(row._id, 'approved')}
                              className="text-xs text-blue-600 hover:underline font-medium text-left"
                            >
                              Approve Exchange
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(row._id, 'rejected')}
                              className="text-xs text-red-500 hover:underline font-medium text-left"
                            >
                              Reject Exchange
                            </button>
                          </div>
                        ) : (
                          <StatusBadge status={
                            row.status === 'COMPLETED' ? 'approved' :
                            row.status === 'REJECTED' || row.status === 'CANCELLED' ? 'rejected' :
                            row.status === 'APPROVED' ? 'approved' :
                            row.status?.toLowerCase()
                          } />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status === 'APPROVED' ? (
                          <button
                            onClick={() => handleStatusUpdate(row._id, 'shipped')}
                            className="text-xs text-blue-600 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            Mark Shipped
                          </button>
                        ) : (
                          <button
                            onClick={() => handleViewDetails(row)}
                            className="text-xs text-blue-600 font-medium border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!detailsModal}
        onClose={() => { setDetailsModal(null); setDetailData(null); }}
        title={`Exchange Details — ${detailsModal?.exchangeId}`}
      >
        {detailData && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Exchange ID</p>
                <p className="font-mono font-semibold text-slate-800">{detailData.exchangeId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Status</p>
                <p className="font-semibold text-slate-800">{STATUS_LABEL[detailData.status] || detailData.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Dealer</p>
                <p className="text-slate-800">{detailData.dealerId?.businessName || detailData.dealerId?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Order</p>
                <p className="text-slate-800">{detailData.orderId?.orderNumber || '—'}</p>
              </div>
              {detailData.comments && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-0.5">Comments</p>
                  <p className="text-slate-700">{detailData.comments}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
              <div className="space-y-2">
                {(detailData.items || []).map((item, i) => (
                  <div key={i} className="border border-slate-100 rounded p-3 bg-slate-50">
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku} · Qty: {item.quantity}</p>
                    <p className="text-xs text-slate-500">Reason: {(item.reason || '').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">
                      Type: {item.exchangeType === 'different' ? 'Different Product' : 'Same Product'}
                      {item.replacementName ? ` — ${item.replacementName}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {isPending(detailData.status) && (
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => { handleStatusUpdate(detailData._id, 'rejected'); setDetailsModal(null); setDetailData(null); }}
                  className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => { handleStatusUpdate(detailData._id, 'approved'); setDetailsModal(null); setDetailData(null); }}
                  className="btn-primary"
                >
                  Approve Exchange
                </button>
              </div>
            )}
            {detailData.status === 'APPROVED' && (
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => { handleStatusUpdate(detailData._id, 'shipped'); setDetailsModal(null); setDetailData(null); }}
                  className="btn-primary"
                >
                  Mark Replacement Shipped
                </button>
              </div>
            )}
            {detailData.status === 'REPLACEMENT_SHIPPED' && (
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => { handleStatusUpdate(detailData._id, 'completed'); setDetailsModal(null); setDetailData(null); }}
                  className="btn-primary"
                >
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExchangeListPage;
