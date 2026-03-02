import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../notificationSlice';
import { Bell, Check } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_COLORS = {
  info: 'bg-blue-50 border-blue-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  error: 'bg-red-50 border-red-200',
  order: 'bg-purple-50 border-purple-200',
  payment: 'bg-green-50 border-green-200',
  return: 'bg-orange-50 border-orange-200',
  dealer: 'bg-blue-50 border-blue-200',
};

const NotificationPage = () => {
  const dispatch = useDispatch();
  const { list, pagination, loading, unreadCount } = useSelector((s) => s.notification);

  useEffect(() => {
    dispatch(fetchNotifications({ limit: 50 }));
  }, [dispatch]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          {unreadCount > 0 && <span className="badge-blue">{unreadCount} unread</span>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => dispatch(markAllNotificationsRead())}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <div
              key={n._id}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${TYPE_COLORS[n.type] || 'bg-slate-50 border-slate-200'} ${!n.isRead ? 'opacity-100' : 'opacity-60'}`}
              onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm">{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-2">{format(new Date(n.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
                <span className={`badge-gray capitalize text-xs flex-shrink-0`}>{n.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationPage;
