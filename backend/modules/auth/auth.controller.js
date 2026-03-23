const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const register = asyncHandler(async (req, res) => {
  const { user, token, permissions } = await authService.register(req.body);
  return success(res, { user, token, permissions }, 'User registered successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  const { user, token, permissions } = await authService.login(email, password, meta);
  return success(res, { user, token, permissions }, 'Login successful');
});

const getMe = asyncHandler(async (req, res) => {
  const data = await authService.getMe(req.user.id);
  return success(res, data, 'User profile fetched');
});

const getUsers = asyncHandler(async (req, res) => {
  const { data, pagination } = await authService.getUsers(req.query);
  return paginated(res, data, pagination, 'Users fetched');
});

const createUser = asyncHandler(async (req, res) => {
  const user = await authService.createUser(req.body, req.user.id);
  return success(res, user, 'User created successfully', 201);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await authService.updateUser(req.params.id, req.body, req.user.id);
  return success(res, user, 'User updated');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  return success(res, result, result.message);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const result = await authService.resetPassword(req.params.id, newPassword, req.user.id);
  return success(res, result, result.message);
});

module.exports = { register, login, getMe, getUsers, createUser, updateUser, changePassword, resetPassword };
