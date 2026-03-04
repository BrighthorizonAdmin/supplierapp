import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Mail, Shield, Hash } from 'lucide-react';
import { logout } from '../../features/auth/authSlice';
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

const Topbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notification.unreadCount);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    setDropdownOpen(false);
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
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
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

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
            onClick={() => setDropdownOpen((o) => !o)}
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
