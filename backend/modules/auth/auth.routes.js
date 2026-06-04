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
  forgotPassword,
  resetPasswordByToken,
} = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { validate, required, isEmail, minLen } = require('../../middlewares/validate.middleware');

const router = express.Router();

// Bootstrap: allow first-ever user to register without auth.
// After that, only super-admin (or admin:write) can register new users.
const User = require('./model/User.model');
const bootstrapOrAuth = async (req, res, next) => {
  const count = await User.countDocuments();
  if (count === 0) return next();
  return authenticate(req, res, () => authorize('admin:write')(req, res, next));
};

const userCreateRules = validate({ email: [required, isEmail], password: [required, minLen(8)], name: [required] });

// Public
router.post('/register', bootstrapOrAuth, userCreateRules, register);
router.post('/login', validate({ email: [required], password: [required] }), login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPasswordByToken);

// Authenticated
router.get('/me', authenticate, getMe);
router.patch('/me/password', authenticate, changePassword);

// Admin — user management
router.get('/users',               authenticate, authorize('admin:read'),  getUsers);
router.post('/users',              authenticate, authorize('admin:write'), userCreateRules, createUser);
router.patch('/users/:id',         authenticate, authorize('admin:write'), updateUser);
router.patch('/users/:id/password',authenticate, authorize('admin:write'), resetPassword);

module.exports = router;
