import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAuditLogs, setFilters } from '../auditSlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import { format } from 'date-fns';

const AuditPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading, filters } = useSelector((s) => s.audit);
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchAuditLogs({ page, limit: 20, ...filters }));
  }, [dispatch, page, filters]);

  const ACTION_COLORS = {
    create: 'badge-green', approve: 'badge-green', confirm: 'badge-green',
    update: 'badge-blue', allocate: 'badge-blue',
    reject: 'badge-red', cancel: 'badge-red', suspend: 'badge-red', delete: 'badge-red',
    refund: 'badge-yellow', login: 'badge-gray', logout: 'badge-gray',
  };

  const columns = [
    { key: 'createdAt', label: 'Time', render: (v) => format(new Date(v), 'dd MMM yyyy, hh:mm a') },
    { key: 'performedBy', label: 'User', render: (v) => (
      <div>
        <p className="font-medium">{v?.name}</p>
        <p className="text-xs text-slate-400 capitalize">{v?.role}</p>
      </div>
    )},
    { key: 'action', label: 'Action', render: (v) => <span className={`${ACTION_COLORS[v] || 'badge-gray'} capitalize`}>{v}</span> },
    { key: 'entity', label: 'Entity', render: (v) => <span className="capitalize badge-gray">{v}</span> },
    { key: 'changes', label: 'Details', render: (v) => (
      <span className="text-xs text-slate-500 max-w-xs truncate block">
        {v?.after ? JSON.stringify(v.after).slice(0, 60) + '...' : '—'}
      </span>
    )},
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-40" value={filters.entity || ''} onChange={(e) => dispatch(setFilters({ entity: e.target.value }))}>
          <option value="">All Entities</option>
          {['dealer','order','payment','return','product','inventory','user','invoice'].map((e) => (
            <option key={e} value={e} className="capitalize">{e}</option>
          ))}
        </select>
        <select className="input w-40" value={filters.action || ''} onChange={(e) => dispatch(setFilters({ action: e.target.value }))}>
          <option value="">All Actions</option>
          {['create','update','delete','approve','reject','confirm','cancel','suspend','refund'].map((a) => (
            <option key={a} value={a} className="capitalize">{a}</option>
          ))}
        </select>
      </div>
      <div className="card">
        <Table columns={columns} data={list} loading={loading} emptyMessage="No audit logs found" />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default AuditPage;
