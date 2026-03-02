import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { logout } from '../../features/auth/authSlice';
import toast from 'react-hot-toast';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/dealers': 'Dealer Management',
  '/inventory': 'Inventory',
  '/products': 'Product Catalog',
  '/orders': 'Orders',
  '/retail-orders': 'Retail Orders',
  '/returns': 'Returns',
  '/payments': 'Payments & Credits',
  '/invoices': 'Invoices',
  '/finance': 'Finances',
  '/audit': 'Analytics',
  '/notifications': 'Settings',
};

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
  const location = useLocation();
  const { user } = useSelector((s) => s.auth);
  const unreadCount = useSelector((s) => s.notification.unreadCount);

  const handleLogout = () => {
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Admin';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SU';

  const userId = user?._id ? user._id.slice(-6).toUpperCase() : '885857';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
      {/* Page title */}
      <h1 className="text-xl font-bold text-slate-800">{pageTitle}</h1>

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
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.name || 'Supplier User'}
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              ID: #{userId} &bull; {roleLabel.toUpperCase()}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
