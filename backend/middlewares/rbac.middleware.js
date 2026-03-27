const { error } = require('../utils/response');

/**
 * Checks whether a permissions array grants the required permission.
 * Supports exact match, resource-level wildcard (resource:*), and global wildcard (*).
 */
const hasPermission = (permissions, required) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes('*')) return true;

  const [resource] = required.split(':');
  return (
    permissions.includes(required) ||
    permissions.includes(`${resource}:*`)
  );
};

/**
 * authorize(...permissions)  [AND logic]
 *
 * All listed permissions must be present.
 * Permissions are read from req.user.permissions (embedded in JWT at login — no DB query).
 * Super-admin (role === 'super-admin') bypasses all checks.
 *
 * Usage:
 *   router.get('/',     authorize('orders:read'),  listOrders)
 *   router.post('/',    authorize('orders:write'), createOrder)
 */
const authorize = (...permissions) => {
  return (req, res, next) => {
    const { role, permissions: userPerms = [] } = req.user;

    if (role === 'super-admin') return next();

    const allowed = permissions.every((perm) => hasPermission(userPerms, perm));
    if (!allowed) {
      return error(res, 'Forbidden: You do not have permission to perform this action.', 403);
    }
    next();
  };
};

/**
 * authorizeAny(...permissions)  [OR logic]
 *
 * At least ONE of the listed permissions must be present.
 * Super-admin bypasses all checks.
 *
 * Use when a route is meaningful for multiple distinct roles that share no
 * common permission — e.g. a summary endpoint accessible to both
 * dashboard:read and audit:read users.
 *
 * Usage:
 *   router.get('/summary', authorizeAny('dashboard:read', 'audit:read'), handler)
 */
const authorizeAny = (...permissions) => {
  return (req, res, next) => {
    const { role, permissions: userPerms = [] } = req.user;

    if (role === 'super-admin') return next();

    const allowed = permissions.some((perm) => hasPermission(userPerms, perm));
    if (!allowed) {
      return error(res, 'Forbidden: You do not have permission to perform this action.', 403);
    }
    next();
  };
};

module.exports = { authorize, authorizeAny, hasPermission };
