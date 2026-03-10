import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Mail, Shield, Hash, CheckCheck } from 'lucide-react';
import { logout } from '../../features/auth/authSlice';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../features/notifications/notificationSlice';
import toast from 'react-hot-toast';
import { useState, useRef, useEffect } from 'react';

const ROLE_LABELS = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  'inventory-manager': 'Inventory Manager',
  'onboarding-manager': 'Onboarding Manager',
  support: 'Support',
  'read-only': 'Read Only',
};

const TYPE_COLORS = {
  order: 'bg-blue-100 text-blue-700',
  payment: 'bg-green-100 text-green-700',
  dealer: 'bg-purple-100 text-purple-700',
  inventory: 'bg-orange-100 text-orange-700',
  return: 'bg-red-100 text-red-700',
  default: 'bg-slate-100 text-slate-600',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const Topbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { unreadCount, list: notifications, loading } = useSelector((s) => s.notification);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const handleLogout = () => {
    setDropdownOpen(false);
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleBellClick = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setDropdownOpen(false);
    if (next) {
      dispatch(fetchNotifications({ limit: 10, page: 1 }));
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Admin';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SU';

  const userId = user?._id ? user._id.slice(-6).toUpperCase() : '885857';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      <div />

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none font-semibold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dispatch(markAllNotificationsRead())}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Bell size={28} className="mb-2 opacity-30" />
                    <p className="text-sm font-medium">No notifications</p>
                    <p className="text-xs mt-0.5">You're all caught up!</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.default;
                    return (
                      <div
                        key={n._id}
                        onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
                        className={`flex gap-3 px-4 py-3 border-b border-slate-50 transition-colors ${
                          n.isRead ? 'bg-white' : 'bg-blue-50/50 cursor-pointer hover:bg-blue-50'
                        }`}
                      >
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase flex-shrink-0 h-fit ${colorClass}`}>
                          {n.type || 'info'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${n.isRead ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
                            {n.message}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                    className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supplier View button */}
        <button className="px-4 py-1.5 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
          Supplier View
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200" />

        {/* User info + avatar */}
        <div className="relative flex items-center gap-3" ref={dropdownRef}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.name || 'Supplier User'}
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              ID: #{userId} &bull; {roleLabel.toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => { setDropdownOpen((o) => !o); setNotifOpen(false); }}
            className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            {initials}
          </button>

          {/* Profile dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
              {/* Header */}
              <div className="bg-blue-600 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.name || 'Supplier User'}</p>
                  <p className="text-xs text-blue-100 truncate">{roleLabel}</p>
                </div>
              </div>

              {/* Details */}
              <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{user?.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Shield size={14} className="text-slate-400 flex-shrink-0" />
                  <span>{roleLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Hash size={14} className="text-slate-400 flex-shrink-0" />
                  <span>ID: #{userId}</span>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
