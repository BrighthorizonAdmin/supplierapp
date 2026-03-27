const express = require('express');
const { getNotifications, getUnreadCount, markRead, markAllRead } = require('./notification.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
