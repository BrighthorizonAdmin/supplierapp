import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart,
  RotateCcw, DollarSign, CreditCard, ChevronLeft, ChevronRight,
  UserPlus, TrendingUp, BarChart2, Settings, HelpCircle, LogOut, Building2, FileText,
} from 'lucide-react';
import { toggleSidebar } from '../../store/uiSlice';
import { usePermission } from '../../routes/ProtectedRoute';
import { logout } from '../../features/auth/authSlice';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard:read' },
  { to: '/marketing-leads', icon: Users, label: 'Marketing Leads', perm: 'marketing:read', end: false },
  { to: '/onboarding', icon: UserPlus, label: 'Onboarding', perm: 'dealer:read' },
  { to: '/dealers', icon: Users, label: 'Dealer Management', perm: 'dealer:read', end: false },
  { to: '/products', icon: Package, label: 'Product Catalog', perm: 'products:read' },
  { to: '/inventory', icon: Boxes, label: 'Inventory', perm: 'inventory:read' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders', perm: 'orders:read' },
  { to: '/finance', icon: TrendingUp, label: 'Finances', perm: 'finance:read' },
  { to: '/payments', icon: CreditCard, label: 'Payments & Credits', perm: 'payments:read' },
  { to: '/invoices', icon: FileText, label: 'Sales Invoices', perm: 'invoices:read' },
  { to: '/returns', icon: RotateCcw, label: 'Returns', perm: 'returns:read' },
  { to: '/audit', icon: BarChart2, label: 'Analytics', perm: 'audit:read' },
  { to: '/notifications', icon: Settings, label: 'Settings', perm: null },
{ to: '/rolemanagement', icon: ShieldCheck, label: 'Role Permissions', perm: 'users:manage' },
{ to: '/usermanagement', icon: Users, label: 'User Management', perm: 'users:manage' }
];

const Sidebar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
  const { user } = useSelector((s) => s.auth);
  const { hasPermission } = usePermission();
  const [showHelpCard, setShowHelpCard] = useState(true);

  const handleLogout = () => {
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'SU';

  return (
    <aside
      className={`fixed left-0 top-0 h-full  text-white z-30 flex flex-col transition-all duration-200 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
          <Building2 size={18} className="text-white" />
        </div>
        {sidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate leading-tight">Company Name</p>
            <p className="text-xs text-blue-600 truncate leading-tight">{`Supplier ${user.role} Portal`}</p>
          </div>
        )}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-blue-300 hover:text-white transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label, perm, end }) => {
         if (perm && !hasPermission(perm)) return null;
          return (
            <NavLink
              key={`${to}-${label}`}
              to={to}
              end={end !== false}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-blue-600  hover:bg-white/10'
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Need Help card */}
      {/* Need Help card */}
{sidebarOpen && showHelpCard && (
  <div className="mx-3 mb-3 p-3 bg-blue-600/90 rounded-2xl relative flex-shrink-0">
    
    {/* Close Button */}
    <button
      onClick={() => setShowHelpCard(false)}
      className="absolute top-2 right-2 text-blue-200 hover:text-white transition-colors"
    >
      <X size={14} />
    </button>

    <div className="flex items-center gap-2 mb-1">
      <HelpCircle size={15} className="text-blue-100 flex-shrink-0" />
      <span className="text-sm font-semibold text-white">Need Help?</span>
    </div>

    <p className="text-xs text-blue-200 mb-2 leading-relaxed">
      Contact our support team for assistance.
    </p>

    <button className="w-full text-xs bg-white text-blue-700 font-semibold py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
      Contact Support
    </button>
  </div>
)}

      {/* User profile */}
      <div
        className={`border-t border-white/10 px-3 py-3 flex items-center gap-3 flex-shrink-0 ${
          !sidebarOpen ? 'justify-center' : ''
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {initials}
        </div>
        {sidebarOpen && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user?.name || 'Supplier User'}
              </p>
              <p className="text-xs text-blue-300 truncate leading-tight capitalize">
                {user?.role || 'User'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/10 text-blue-300 hover:text-red-300 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
