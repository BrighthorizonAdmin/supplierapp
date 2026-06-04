const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { error } = require('../utils/response');
const User = require('../modules/auth/model/User.model');
const Role = require('../modules/roles/role.model');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Access denied. No token provided.', 401);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token has expired. Please log in again.', 401);
    }
    return error(res, 'Invalid token.', 401);
  }

  // Re-fetch current role and active status from DB so a role change
  // or account deactivation takes effect immediately without waiting
  // for the JWT to expire.
  const dbUser = await User.findById(decoded.id).select('role isActive').lean();
  if (!dbUser || !dbUser.isActive) {
    return error(res, 'Access denied.', 401);
  }

  const roles = Array.isArray(dbUser.role) ? dbUser.role : [dbUser.role];
  let permissions;
  if (roles.includes('super-admin')) {
    permissions = ['*'];
  } else {
    const roleDocs = await Role.find({ name: { $in: roles }, isActive: true }).lean();
    permissions = [...new Set(roleDocs.flatMap((r) => r.permissions))];
  }

  req.user = {
    id: decoded.id,
    role: dbUser.role,
    name: decoded.name,
    email: decoded.email,
    permissions,
  };

  next();
};

module.exports = { authenticate };
