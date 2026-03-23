const { error } = require('../utils/response');

const PERMISSIONS = {
  'super-admin': ['*'],
  admin: [
    'dealer:read', 'dealer:write', 'documents:read', 'documents:write',
    'inventory:read', 'inventory:write', 'products:read', 'products:write',
    'warehouse:read', 'warehouse:write', 'orders:read', 'orders:write',
    'retailOrders:read', 'retailOrders:write', 'returns:read', 'returns:write',
    'payments:read', 'payments:write', 'invoices:read', 'invoices:write',
    'notifications:read', 'notifications:write', 'audit:read', 'dashboard:read',
    'finance:read', 'marketing:read', 'marketing:write',
  ],
  finance: [
    'finance:read', 'finance:write', 'payments:read', 'payments:write',
    'invoices:read', 'invoices:write', 'returns:read', 'dealer:read',
    'orders:read', 'dashboard:read',
  ],
  'inventory-manager': [
    'inventory:read', 'inventory:write', 'products:read', 'products:write',
    'warehouse:read', 'warehouse:write', 'returns:read', 'returns:write',
    'orders:read', 'dashboard:read',
  ],
  'onboarding-manager': [
    'dealer:read', 'dealer:write', 'documents:read', 'documents:write',
    'audit:read', 'dashboard:read', 'marketing:read', 'marketing:write',
  ],
  marketing: [
    'marketing:read', 'marketing:write', 'dashboard:read',
  ],
  support: [
    'dealer:read', 'orders:read', 'retailOrders:read', 'returns:read',
    'notifications:read', 'dashboard:read',
  ],
  'read-only': [
    'dealer:read', 'orders:read', 'retailOrders:read', 'inventory:read',
    'products:read', 'finance:read', 'payments:read', 'invoices:read',
    'returns:read', 'dashboard:read',
  ],
};

/**
 * Checks if a role has a given permission.
 * Supports wildcard '*' and resource-level wildcards like 'dealer:*'.
 */
const hasPermission = (role, required) => {
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;

  const [resource, action] = required.split(':');
  return (
    perms.includes(required) ||
    perms.includes(`${resource}:*`) ||
    perms.includes('*')
  );
};

/**
 * Middleware factory: authorize('dealer:write')
 */
const authorize = (...permissions) => {
  return (req, res, next) => {
    const { role } = req.user;
    const allowed = permissions.every((perm) => hasPermission(role, perm));
    if (!allowed) {
      return error(res, 'Forbidden: You do not have permission to perform this action.', 403);
    }
    next();
  };
};

module.exports = { authorize, hasPermission, PERMISSIONS };
