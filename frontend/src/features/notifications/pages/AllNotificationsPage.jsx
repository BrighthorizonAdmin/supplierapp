import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../notificationSlice';

const TYPE_COLORS = {
  order: 'bg-blue-100 text-blue-700',
  payment: 'bg-green-100 text-green-700',
  dealer: 'bg-purple-100 text-purple-700',
  inventory: 'bg-orange-100 text-orange-700',
  return: 'bg-red-100 text-red-700',
  default: 'bg-slate-100 text-slate-600',
};

const TYPE_FILTERS = [
  // { label: 'All', value: '' },
  // { label: 'Unread', value: 'unread' },
  // { label: 'Order', value: 'order' },
  // { label: 'Payment', value: 'payment' },
  // { label: 'Dealer', value: 'dealer' },
  // { label: 'Inventory', value: 'inventory' },
  // { label: 'Return', value: 'return' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getNotificationRoute = (n) => {
  const entityType = n.relatedEntity?.entityType?.toLowerCase();
  const type = n.type?.toLowerCase();
  if (entityType === 'SupportTicket' ||  type === 'info') return '/support';
  if (entityType === 'dealer' || type === 'dealer') return '/onboarding';
  if(entityType === 'Order' || type === 'order') return '/orders';
  return null;
};

const LIMIT = 15;

const AllNotificationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: notifications, pagination, loading, unreadCount } = useSelector((s) => s.notification);

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState('');

  const loadNotifications = (p = 1, filter = activeFilter) => {
    const params = { page: p, limit: LIMIT };
    if (filter === 'unread') params.isRead = false;
    else if (filter) params.type = filter;
    dispatch(fetchNotifications(params));
  };

  useEffect(() => {
    loadNotifications(1, activeFilter);
  }, []);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setPage(1);
    loadNotifications(1, filter);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadNotifications(newPage, activeFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead()).then(() => {
      loadNotifications(page, activeFilter);
    });
  };

  const handleMarkRead = (id) => {
    dispatch(markNotificationRead(id));
  };

  const totalPages = pagination ? Math.ceil(pagination.total / LIMIT) : 1;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? (
              <span>
                You have{' '}
                <span className="font-semibold text-blue-600">{unreadCount} unread</span>{' '}
                notification{unreadCount !== 1 ? 's' : ''}
              </span>
            ) : (
              "You're all caught up!"
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-600">{unreadCount} unread</span>
            </div>
          )}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              <CheckCheck size={15} />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {/* <Filter size={14} className="text-slate-400 flex-shrink-0 mr-1" /> */}
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
            {f.value === 'unread' && unreadCount > 0 && (
              <span className={`ml-1 px-1 rounded-full text-[10px] font-bold ${activeFilter === 'unread' ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Bell size={40} className="mb-3 opacity-20" />
            <p className="text-base font-medium text-slate-500">No notifications found</p>
            <p className="text-sm mt-1">
              {activeFilter ? 'Try a different filter' : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.default;
              return (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.isRead) handleMarkRead(n._id);
                    const route = getNotificationRoute(n);
                    if (route) navigate(route);
                  }}
                  className={`flex gap-4 px-5 py-4 transition-colors cursor-pointer ${
                    n.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-blue-50/40 hover:bg-blue-50'
                  }`}
                >
                  {/* Type badge */}
                  <div className="flex-shrink-0 pt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${colorClass}`}>
                      {n.type || 'info'}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Unread dot */}
                  <div className="flex-shrink-0 pt-2">
                    {!n.isRead ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block" title="Unread" />
                    ) : (
                      <span className="w-2.5 h-2.5 block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination && pagination.total > LIMIT && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.total)} of{' '}
              <span className="font-semibold">{pagination.total}</span> notifications
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllNotificationsPage;
