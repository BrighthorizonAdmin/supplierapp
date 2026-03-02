const jwt = require('jsonwebtoken');
const User = require('./model/User.model');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const auditService = require('../audit/audit.service');

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const register = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError('Email is already registered', 409);

  const user = await User.create(data);
  await auditService.log('user', user._id, 'create', user._id, { after: { name: user.name, role: user.role } });

  const token = signToken(user);
  return { user, token };
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

  const token = signToken(user);
  return { user, token };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('User not found', 404);
  return user;
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

const updateUser = async (userId, updates, performedBy) => {
  const allowedFields = ['name', 'role', 'isActive'];
  const filtered = {};
  allowedFields.forEach((f) => { if (updates[f] !== undefined) filtered[f] = updates[f]; });

  const user = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);

  await auditService.log('user', userId, 'update', performedBy, { after: filtered });
  return user;
};

module.exports = { register, login, getMe, getUsers, updateUser, signToken };
