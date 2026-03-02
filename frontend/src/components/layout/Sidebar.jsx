import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, Store,
  RotateCcw, DollarSign, CreditCard, FileText, Bell, ChevronLeft, ChevronRight, Building2,
} from 'lucide-react';
import { toggleSidebar } from '../../store/uiSlice';
import { usePermission } from '../../routes/ProtectedRoute';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard:read' },
  { to: '/dealers', icon: Users, label: 'Dealers', perm: 'dealer:read' },
  { to: '/inventory', icon: Boxes, label: 'Inventory', perm: 'inventory:read' },
  { to: '/products', icon: Package, label: 'Products', perm: 'products:read' },
  { to: '/orders', icon: ShoppingCart, label: 'B2B Orders', perm: 'orders:read' },
  { to: '/retail-orders', icon: Store, label: 'Retail Orders', perm: 'retailOrders:read' },
  { to: '/returns', icon: RotateCcw, label: 'Returns', perm: 'returns:read' },
  { to: '/payments', icon: CreditCard, label: 'Payments', perm: 'payments:read' },
  { to: '/invoices', icon: FileText, label: 'Invoices', perm: 'invoices:read' },
  { to: '/finance', icon: DollarSign, label: 'Finance', perm: 'finance:read' },
  { to: '/audit', icon: Building2, label: 'Audit Logs', perm: 'audit:read' },
  { to: '/notifications', icon: Bell, label: 'Notifications', perm: null },
];

const Sidebar = () => {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
  const unreadCount = useSelector((s) => s.notification.unreadCount);
  const { hasPermission } = usePermission();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-sidebar text-white z-30 flex flex-col transition-all duration-200 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-700">
        {sidebarOpen && (
          <span className="text-lg font-bold text-white truncate">Supplier App</span>
        )}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="ml-auto p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, perm }) => {
          if (perm && !hasPermission(null, perm)) return null;

          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon size={18} />
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
