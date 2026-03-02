const express = require('express');
const { register, login, getMe, getUsers, updateUser } = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// Open only when no users exist (bootstrap); requires super-admin auth after first user is created
const User = require('./model/User.model');
const bootstrapOrAuth = async (req, res, next) => {
  const count = await User.countDocuments();
  if (count === 0) return next(); // allow first registration without auth
  return authenticate(req, res, () => authorize('*')(req, res, next));
};
router.post('/register', bootstrapOrAuth, register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize('admin:read'), getUsers);
router.patch('/users/:id', authenticate, authorize('admin:write'), updateUser);

module.exports = router;
