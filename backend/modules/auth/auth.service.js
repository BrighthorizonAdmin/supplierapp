const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./model/User.model');
const Role = require('../roles/role.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const auditService = require('../audit/audit.service');

/**
 * Fetch merged permissions for one role (string) or multiple roles (array).
 * Super-admin always gets ['*'] regardless of DB state.
 */
const getPermissionsForRole = async (roleInput) => {
  const roles = Array.isArray(roleInput) ? roleInput : [roleInput];

  if (roles.includes('super-admin')) return ['*'];

  const roleDocs = await Role.find({ name: { $in: roles }, isActive: true }).lean();

  // Merge and deduplicate permissions across all matched roles
  const merged = [...new Set(roleDocs.flatMap((r) => r.permissions))];
  return merged;
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

  const isFirstLogin = user.isFirstLogin;

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  await auditService.log('user', user._id, 'login', user._id, {}, meta);

  const permissions = await getPermissionsForRole(user.role);
  const token = signToken(user, permissions);

  // Low-stock check on every login — non-blocking
  let lowStockCount = 0;
  let outOfStockCount = 0;
  try {
    const Product = require('../products/model/Product.model');
    [lowStockCount, outOfStockCount] = await Promise.all([
      Product.countDocuments({
        isActive: true,
        currentStockQty: { $gt: 0 },
        $expr: { $lt: ['$currentStockQty', { $multiply: ['$openingStockQty', 0.2] }] },
      }),
      Product.countDocuments({ isActive: true, currentStockQty: { $lte: 0 } }),
    ]);

    const total = lowStockCount + outOfStockCount;
    if (total > 0) {
      const notificationService = require('../notifications/notification.service');
      const Notification = require('../notifications/model/Notification.model');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Create at most one low-stock alert per user per day
      const alreadyAlerted = await Notification.exists({
        recipientId: user._id,
        type: 'warning',
        isRead: false,
        createdAt: { $gte: todayStart },
        title: 'Low Stock Alert',
      });

      if (!alreadyAlerted) {
        const parts = [];
        if (lowStockCount > 0) parts.push(`${lowStockCount} low-stock`);
        if (outOfStockCount > 0) parts.push(`${outOfStockCount} out-of-stock`);
        await notificationService.create({
          recipientId: user._id,
          title: 'Low Stock Alert',
          message: `${parts.join(' and ')} product${total !== 1 ? 's' : ''} need attention. Review your inventory.`,
          type: 'warning',
          relatedEntity: { entityType: 'Inventory', entityId: user._id },
        });
      }
    }
  } catch (err) {
    console.error('[Auth] Low-stock check failed:', err.message);
  }

  return { user, token, permissions, isFirstLogin, lowStockCount, outOfStockCount };
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

  // ensure roles is array
  const roles = Array.isArray(data.role) && data.role.length > 0
    ? data.role.map(r => r.toLowerCase())
    : ['read-only'];

  // validate roles
  const roleDocs = await Role.find({ name: { $in: roles } });

  if (roleDocs.length !== roles.length) {
    throw new AppError(`One or more roles do not exist`, 400);
  }

  const user = await User.create({ ...data, role: roles,isFirstLogin: true, });
  await auditService.log('user', user._id, 'create', performedBy, {
    after: { name: user.name, email: user.email, role: user.role,isFirstLogin:user.isFirstLogin, },
  });

  return user;
};

const updateUser = async (userId, updates, performedBy) => {
  if (updates.role) {
    const roles = Array.isArray(updates.role)
      ? updates.role.map((r) => r.toLowerCase())
      : [updates.role.toLowerCase()];

    const roleDocs = await Role.find({ name: { $in: roles } });
    if (roleDocs.length !== roles.length)
      throw new AppError('One or more roles do not exist', 400);

    updates.role = roles;
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
  user.isFirstLogin = false;
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

/**
 * Forgot password — generate a reset token and email it to the user.
 * Always responds the same way (even if email not found) to prevent user enumeration.
 */
/**
 * Forgot password — generate a reset token and return it directly.
 * No email is sent; the caller receives the token to proceed immediately.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError('No account found with that email address', 404);
  if (!user.isActive) throw new AppError('This account has been deactivated. Contact admin.', 403);

  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

  user.resetToken = hashedToken;
  user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save({ validateBeforeSave: false });

  return { token: plainToken };
};

/**
 * Reset password using the token from the email link.
 */
const resetPasswordByToken = async (plainToken, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

  const user = await User.findOne({
    resetToken: hashedToken,
    resetTokenExpiry: { $gt: new Date() },
  }).select('+password');

  if (!user) throw new AppError('Reset link is invalid or has expired', 400);

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.isFirstLogin = false;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  await auditService.log('user', user._id, 'password_reset', user._id, {});
  return { message: 'Password reset successfully. Please log in.' };
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
  forgotPassword,
  resetPasswordByToken,
  signToken,
};
