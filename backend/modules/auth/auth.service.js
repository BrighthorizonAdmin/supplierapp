const jwt = require('jsonwebtoken');
const User = require('./model/User.model');
const Role = require('../roles/role.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const auditService = require('../audit/audit.service');

/**
 * Fetch the permissions array for a given role name.
 * Super-admin always gets ['*'] regardless of DB state.
 */
const getPermissionsForRole = async (roleName) => {
  if (roleName === 'super-admin') return ['*'];
  const role = await Role.findOne({ name: roleName, isActive: true }).lean();
  return role ? role.permissions : [];
};

/**
 * Sign a JWT token embedding the user's permissions.
 * Permissions come from the role document in DB at login/register time.
 */
const signToken = (user, permissions = []) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      permissions,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const register = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError('Email is already registered', 409);

  // Validate that the role exists (skip check on very first user — bootstrap)
  if (data.role && data.role !== 'super-admin') {
    const roleDoc = await Role.findOne({ name: data.role.toLowerCase() });
    if (!roleDoc) throw new AppError(`Role "${data.role}" does not exist`, 400);
  }

  const user = await User.create(data);
  await auditService.log('user', user._id, 'create', user._id, { after: { name: user.name, role: user.role } });

  const permissions = await getPermissionsForRole(user.role);
  const token = signToken(user, permissions);
  return { user, token, permissions };
};

const login = async (email, password, meta = {}) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Your account has been deactivated. Contact admin.', 403);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  await auditService.log('user', user._id, 'login', user._id, {}, meta);

  const permissions = await getPermissionsForRole(user.role);
  const token = signToken(user, permissions);
  return { user, token, permissions };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('User not found', 404);

  const permissions = await getPermissionsForRole(user.role);
  return { ...user, permissions };
};

const getUsers = async (query = {}) => {
  const { getPagination, buildMeta } = require('../../utils/pagination');
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.role) match.role = query.role;
  if (query.isActive !== undefined) match.isActive = query.isActive === 'true';

  const [data, total] = await Promise.all([
    User.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(match),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const createUser = async (data, performedBy) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError('Email is already registered', 409);

  const roleName = (data.role || 'read-only').toLowerCase();
  const roleDoc = await Role.findOne({ name: roleName });
  if (!roleDoc) throw new AppError(`Role "${roleName}" does not exist`, 400);

  const user = await User.create({ ...data, role: roleName });
  await auditService.log('user', user._id, 'create', performedBy, {
    after: { name: user.name, email: user.email, role: user.role },
  });

  return user;
};

const updateUser = async (userId, updates, performedBy) => {
  // Validate role exists if being changed
  if (updates.role) {
    const roleName = updates.role.toLowerCase();
    const roleDoc = await Role.findOne({ name: roleName });
    if (!roleDoc) throw new AppError(`Role "${updates.role}" does not exist`, 400);
    updates.role = roleName;
  }

  const allowedFields = ['name', 'role', 'isActive'];
  const filtered = {};
  allowedFields.forEach((f) => { if (updates[f] !== undefined) filtered[f] = updates[f]; });

  const user = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);

  await auditService.log('user', userId, 'update', performedBy, { after: filtered });
  return user;
};

/**
 * Change own password — requires current password verification.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 401);

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  await auditService.log('user', userId, 'password_change', userId, {});
  return { message: 'Password changed successfully' };
};

/**
 * Admin resets another user's password — no current password required.
 */
const resetPassword = async (userId, newPassword, performedBy) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  await auditService.log('user', userId, 'password_reset', performedBy, {});
  return { message: 'Password reset successfully' };
};

module.exports = {
  register,
  login,
  getMe,
  getUsers,
  createUser,
  updateUser,
  changePassword,
  resetPassword,
  signToken,
};
