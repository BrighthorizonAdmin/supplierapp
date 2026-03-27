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
 * Middleware factory: authorize('dealer:write')
 *
 * Permissions are read directly from req.user.permissions, which is embedded
 * in the JWT at login time. No DB query is needed on every request.
 *
 * Super-admin (role === 'super-admin') bypasses all permission checks.
 */
const authorize = (...permissions) => {
  return (req, res, next) => {
    const { role, permissions: userPerms = [] } = req.user;

    // Super-admin has unrestricted access
    if (role === 'super-admin') return next();

    const allowed = permissions.every((perm) => hasPermission(userPerms, perm));
    if (!allowed) {
      return error(res, 'Forbidden: You do not have permission to perform this action.', 403);
    }
    next();
  };
};

module.exports = { authorize, hasPermission };
