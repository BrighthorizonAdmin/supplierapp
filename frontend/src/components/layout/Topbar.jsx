import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Mail, Shield, CheckCheck, Search, KeyRound, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { logout } from '../../features/auth/authSlice';
import {
  fetchNotifications,
  markNotificationRead,
  fetchUnreadCount,
  markAllNotificationsRead,
} from '../../features/notifications/notificationSlice';
import { getBreadcrumbs } from './navConfig';
import { getInitials, getRoleLabel } from './userDisplay';
import CommandPalette from './CommandPalette';

const TYPE_COLORS = {
  order: 'badge-blue',
  payment: 'badge-green',
  dealer: 'badge-purple',
  inventory: 'badge-orange',
  warning: 'badge-yellow',
  return: 'badge-red',
  warranty: 'badge-blue',
  default: 'badge-gray',
};

const getNotificationRoute = (n) => {
  const entityType = n.relatedEntity?.entityType?.toLowerCase();
  const type = n.type?.toLowerCase();
  if (entityType === 'inventory' || type === 'warning') return '/inventory';
  if (entityType === 'supportticket' || entityType === 'support_ticket' || type === 'info' || type === 'support') return '/support';
  if (entityType === 'dealer' || type === 'dealer') return '/onboarding';
  if (entityType === 'order' || type === 'order') return '/orders';
  if (entityType === 'invoice' || type === 'payment') return '/invoices';
  if (entityType === 'warranty' || type === 'warranty') return '/warranty';
  if (type === 'return') return '/exchanges';
  return null;
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
  const { pathname } = useLocation();
  const { user } = useSelector((s) => s.auth);
  const { unreadCount, list: notifications, loading } = useSelector((s) => s.notification);

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const crumbs = getBreadcrumbs(pathname);
  const roleLabel = getRoleLabel(user?.role);
  const initials = getInitials(user?.name);

  const handleLogout = () => {
    setProfileOpen(false);
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleBellClick = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next) dispatch(fetchNotifications({ limit: 10, page: 1 }));
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const handleShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleShortcut);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  useEffect(() => {
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  return (
    <header className="flex h-[68px] flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-gradient-to-r from-white to-primary-50/40 px-6 backdrop-blur">
      {/* Breadcrumbs */}
      <nav className="flex min-w-0 items-center gap-1.5 text-[15px]" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight size={14} className="flex-shrink-0 text-slate-300" />}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="truncate text-slate-500 hover:text-slate-900">{crumb.label}</Link>
              ) : (
                <span className={`truncate ${last ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{crumb.label}</span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex flex-shrink-0 items-center gap-2.5">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-400 shadow-card transition hover:border-slate-300 md:flex"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search pages…</span>
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500">Ctrl K</kbd>
        </button>

        {/* Role */}
        <div className="hidden items-center gap-2 rounded-xl bg-slate-100 py-1 pl-3 pr-1 lg:flex">
          <span className="text-xs text-slate-500">Signed in as</span>
          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-primary-700 shadow-card">{roleLabel}</span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-card transition hover:text-slate-900"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && <span className="badge-red">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dispatch(markAllNotificationsRead())}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Bell size={28} className="mb-2 opacity-30" />
                    <p className="text-sm font-medium">No notifications</p>
                    <p className="mt-0.5 text-xs">You're all caught up.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => {
                        if (!n.isRead) dispatch(markNotificationRead(n._id));
                        const route = getNotificationRoute(n);
                        if (route) { setNotifOpen(false); navigate(route); }
                      }}
                      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 ${
                        n.isRead ? 'hover:bg-slate-50' : 'bg-primary-50/50 hover:bg-primary-50'
                      }`}
                    >
                      <span className={`${TYPE_COLORS[n.type] || TYPE_COLORS.default} h-fit flex-shrink-0 uppercase`}>{n.type || 'info'}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs leading-snug ${n.isRead ? 'text-slate-500' : 'font-medium text-slate-800'}`}>{n.message}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-2.5">
                <button
                  onClick={() => { setNotifOpen(false); navigate('/notifications/all'); }}
                  className="w-full text-center text-xs font-semibold text-primary-600 hover:text-primary-800"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-brand"
            title={user?.name || 'Account'}
          >
            {initials}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-primary-50 to-white px-4 py-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{user?.name || 'Supplier user'}</p>
                  <p className="truncate text-xs text-slate-500">{roleLabel}</p>
                </div>
              </div>
              <div className="space-y-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="flex-shrink-0 text-slate-400" />
                  <span className="truncate">{user?.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="flex-shrink-0 text-slate-400" />
                  <span>{roleLabel}</span>
                </div>
              </div>
              <button
                onClick={() => { setProfileOpen(false); navigate('/changePassword'); }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <KeyRound size={14} /> Change password
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </header>
  );
};

export default Topbar;
