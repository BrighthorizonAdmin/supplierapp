import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { hasPermission } = usePermission();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

/**
 * usePermission — mirrors the backend hasPermission() logic exactly.
 *
 * Evaluation order (matches rbac.middleware.js):
 *  1. '*'           → super-admin, matches every permission
 *  2. 'resource:*'  → resource-level wildcard
 *  3. exact string  → exact permission key match
 */
export const usePermission = () => {
  const { permissions } = useSelector((s) => s.auth);

  const hasPermission = (required) => {
    if (!permissions || permissions.length === 0) return false;
    if (permissions.includes('*')) return true;

    const [resource] = required.split(':');
    return (
      permissions.includes(required) ||
      permissions.includes(`${resource}:*`)
    );
  };

  return { hasPermission };
};

export default ProtectedRoute;
