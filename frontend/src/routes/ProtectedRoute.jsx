import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Permission check (basic role check)
  if (permission && user?.role !== 'super-admin') {
    const { hasPermission } = usePermission();
    if (!hasPermission(user.role, permission)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export const usePermission = () => {
  const { user } = useSelector((s) => s.auth);

  const hasPermission = (role, required) => {
    const PERMISSIONS = {
      'super-admin': true,
      admin: ['dealer:read','dealer:write','inventory:read','inventory:write','products:read','products:write',
              'warehouse:read','warehouse:write','orders:read','orders:write','retailOrders:read','retailOrders:write',
              'returns:read','returns:write','payments:read','payments:write','invoices:read','invoices:write',
              'notifications:read','audit:read','dashboard:read','finance:read','documents:read','documents:write'],
      finance: ['finance:read','finance:write','payments:read','payments:write','invoices:read','invoices:write',
                'returns:read','dealer:read','orders:read','dashboard:read'],
      'inventory-manager': ['inventory:read','inventory:write','products:read','products:write','warehouse:read',
                            'warehouse:write','returns:read','returns:write','orders:read','dashboard:read'],
      'onboarding-manager': ['dealer:read','dealer:write','documents:read','documents:write','audit:read','dashboard:read'],
      support: ['dealer:read','orders:read','retailOrders:read','returns:read','notifications:read','dashboard:read'],
      'read-only': ['dealer:read','orders:read','inventory:read','products:read','finance:read','payments:read',
                    'invoices:read','returns:read','dashboard:read'],
    };

    const userRole = role || user?.role;
    if (userRole === 'super-admin') return true;
    const perms = PERMISSIONS[userRole] || [];
    const [resource] = required.split(':');
    return perms.includes(required) || perms.includes(`${resource}:*`);
  };

  return { hasPermission, role: user?.role };
};

export default ProtectedRoute;
