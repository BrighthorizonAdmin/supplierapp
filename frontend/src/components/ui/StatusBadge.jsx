const STATUS_MAP = {
  // Dealer
  active: 'badge-green',
  pending: 'badge-yellow',
  suspended: 'badge-red',
  rejected: 'badge-red',
  verified: 'badge-green',
  // Orders
  draft: 'badge-gray',
  confirmed: 'badge-blue',
  processing: 'badge-blue',
  shipped: 'badge-purple',
  delivered: 'badge-green',
  cancelled: 'badge-red',
  // Payments
  paid: 'badge-green',
  partial: 'badge-yellow',
  issued: 'badge-blue',
  overdue: 'badge-red',
  failed: 'badge-red',
  // Returns
  requested: 'badge-yellow',
  approved: 'badge-blue',
  received: 'badge-blue',
  refunded: 'badge-green',
  // General
  true: 'badge-green',
  false: 'badge-red',
};

const StatusBadge = ({ status }) => {
  const cls = STATUS_MAP[status?.toLowerCase?.()] || 'badge-gray';
  return <span className={cls}>{status}</span>;
};

export default StatusBadge;
