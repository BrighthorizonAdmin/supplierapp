const express = require('express');
const {
  register,
  login,
  getMe,
  getUsers,
  createUser,
  updateUser,
  changePassword,
  resetPassword,
} = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// Bootstrap: allow first-ever user to register without auth.
// After that, only super-admin (or admin:write) can register new users.
const User = require('./model/User.model');
const bootstrapOrAuth = async (req, res, next) => {
  const count = await User.countDocuments();
  if (count === 0) return next();
  return authenticate(req, res, () => authorize('admin:write')(req, res, next));
};

// Public
router.post('/register', bootstrapOrAuth, register);
router.post('/login', login);

// Authenticated
router.get('/me', authenticate, getMe);
router.patch('/me/password', authenticate, changePassword);

// Admin — user management
router.get('/users',               authenticate, authorize('admin:read'),  getUsers);
router.post('/users',              authenticate, authorize('admin:write'), createUser);
router.patch('/users/:id',         authenticate, authorize('admin:write'), updateUser);
router.patch('/users/:id/password',authenticate, authorize('admin:write'), resetPassword);

module.exports = router;
