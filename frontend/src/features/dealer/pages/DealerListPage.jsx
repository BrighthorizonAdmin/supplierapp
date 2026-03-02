import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { fetchDealers, approveDealer, rejectDealer, suspendDealer, setFilters } from '../dealerSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '../../../components/ui/StatusBadge';
import Modal from '../../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

const DealerListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, pagination, loading, filters } = useSelector((s) => s.dealer);
  const [page, setPage] = useState(1);
  const [approvalModal, setApprovalModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    dispatch(fetchDealers({ page, limit: 20, ...filters }));
  }, [dispatch, page, filters]);

  const handleApprove = (data) => {
    dispatch(approveDealer({ id: approvalModal._id, ...data })).then(() => {
      setApprovalModal(null);
      reset();
    });
  };

  const handleReject = (data) => {
    dispatch(rejectDealer({ id: rejectModal._id, reason: data.reason })).then(() => {
      setRejectModal(null);
      reset();
    });
  };

  const columns = [
    { key: 'dealerCode', label: 'Dealer Code' },
    { key: 'businessName', label: 'Business Name', render: (v, row) => (
      <button onClick={() => navigate(`/dealers/${row._id}`)} className="text-primary-600 hover:underline font-medium">
        {v}
      </button>
    )},
    { key: 'ownerName', label: 'Owner' },
    { key: 'phone', label: 'Phone' },
    { key: 'businessType', label: 'Type', render: (v) => <span className="capitalize">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'kycStatus', label: 'KYC', render: (v) => <StatusBadge status={v} /> },
    { key: 'creditLimit', label: 'Credit Limit', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'pricingTier', label: 'Tier', render: (v) => <span className="capitalize badge-blue">{v}</span> },
    { key: 'createdAt', label: 'Registered', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setApprovalModal(row); }}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Approve
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setRejectModal(row); }}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Reject
              </button>
            </>
          )}
          {row.status === 'active' && (
            <button
              onClick={() => dispatch(suspendDealer({ id: row._id, reason: 'Administrative action' }))}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              Suspend
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dealers</h1>
        <button onClick={() => navigate('/dealers/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Dealer
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealers..."
            className="input pl-9"
            value={filters.search}
            onChange={(e) => dispatch(setFilters({ search: e.target.value }))}
          />
        </div>
        <select
          className="input w-40"
          value={filters.status}
          onChange={(e) => dispatch(setFilters({ status: e.target.value }))}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="input w-44"
          value={filters.businessType}
          onChange={(e) => dispatch(setFilters({ businessType: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="retailer">Retailer</option>
          <option value="wholesaler">Wholesaler</option>
          <option value="distributor">Distributor</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Approve Modal */}
      <Modal isOpen={!!approvalModal} onClose={() => { setApprovalModal(null); reset(); }} title={`Approve ${approvalModal?.businessName}`}>
        <form onSubmit={handleSubmit(handleApprove)} className="space-y-4">
          <div>
            <label className="label">Credit Limit (₹)</label>
            <input type="number" className="input" defaultValue={100000} min={0} {...register('creditLimit', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Pricing Tier</label>
            <select className="input" {...register('pricingTier')}>
              <option value="standard">Standard</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setApprovalModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Approve Dealer</button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => { setRejectModal(null); reset(); }} title={`Reject ${rejectModal?.businessName}`}>
        <form onSubmit={handleSubmit(handleReject)} className="space-y-4">
          <div>
            <label className="label">Rejection Reason</label>
            <textarea className="input" rows={3} {...register('reason', { required: true })} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setRejectModal(null); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-danger">Reject Dealer</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DealerListPage;
