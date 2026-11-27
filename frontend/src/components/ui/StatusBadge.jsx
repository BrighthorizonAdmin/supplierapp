const STATUS_MAP = {
  // Dealer
  active: 'badge-green',
  pending: 'badge-yellow',
  suspended: 'badge-red',
  rejected: 'badge-red',
  verified: 'badge-green',
  // Orders — solid Figma style
  draft: 'badge-solid-gray',
  order_confirmed: 'badge-solid-blue',
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

const DOT = {
  'badge-green': 'bg-emerald-500', 'badge-solid-green': 'bg-emerald-500',
  'badge-red': 'bg-red-500', 'badge-solid-red': 'bg-red-500',
  'badge-yellow': 'bg-amber-500', 'badge-solid-amber': 'bg-amber-500',
  'badge-blue': 'bg-primary-500', 'badge-solid-blue': 'bg-primary-500',
  'badge-purple': 'bg-violet-500', 'badge-solid-purple': 'bg-violet-500',
};

const StatusBadge = ({ status }) => {
  const cls = STATUS_MAP[status?.toLowerCase?.()] || 'badge-gray';
  const label = String(status ?? '').replace(/_/g, ' ');
  return (
    <span className={`${cls} capitalize`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[cls] || 'bg-slate-400'}`} />
      {label}
    </span>
  );
};

export default StatusBadge;
