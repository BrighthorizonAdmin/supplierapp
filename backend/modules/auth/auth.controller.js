const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  return success(res, { user, token }, 'User registered successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  const { user, token } = await authService.login(email, password, meta);
  return success(res, { user, token }, 'Login successful');
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return success(res, user, 'User profile fetched');
});

const getUsers = asyncHandler(async (req, res) => {
  const { data, pagination } = await authService.getUsers(req.query);
  return paginated(res, data, pagination, 'Users fetched');
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await authService.updateUser(req.params.id, req.body, req.user.id);
  return success(res, user, 'User updated');
});

module.exports = { register, login, getMe, getUsers, updateUser };
