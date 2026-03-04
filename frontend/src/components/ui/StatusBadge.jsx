const STATUS_MAP = {
  // Dealer
  active: 'badge-green',
  pending: 'badge-yellow',
  suspended: 'badge-red',
  rejected: 'badge-red',
  verified: 'badge-green',
  // Orders — solid Figma style
  draft: 'badge-solid-gray',
  confirmed: 'badge-solid-blue',
  processing: 'badge-solid-purple',
  shipped: 'badge-solid-blue',
  delivered: 'badge-solid-green',
  cancelled: 'badge-solid-red',
  // Payments
  confirmed: 'badge-solid-green',
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
