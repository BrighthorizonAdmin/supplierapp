const express = require('express');
const { getNotifications, getUnreadCount, markRead, markAllRead } = require('./notification.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('notifications:read'), getNotifications);
router.get('/unread-count', authorize('notifications:read'), getUnreadCount);
router.patch('/mark-all-read', authorize('notifications:read'), markAllRead);
router.patch('/:id/read', authorize('notifications:read'), markRead);

module.exports = router;
