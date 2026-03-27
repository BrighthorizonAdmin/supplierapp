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

export const usePermission = () => {
  const { permissions } = useSelector((s) => s.auth);

  const hasPermission = (required) => {
    if (!permissions || permissions.length === 0) return false;

    // super-admin
    if (permissions.includes('*')) return true;

    return permissions.includes(required);
  };

  return { hasPermission };
};
export default ProtectedRoute;
