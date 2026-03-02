const express = require('express');
const { register, login, getMe, getUsers, updateUser } = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.post('/register', authenticate, authorize('*'), register); // super-admin only
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize('admin:read'), getUsers);
router.patch('/users/:id', authenticate, authorize('admin:write'), updateUser);

module.exports = router;
