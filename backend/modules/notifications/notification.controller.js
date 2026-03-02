const notificationService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getNotifications = asyncHandler(async (req, res) => {
  const { data, pagination } = await notificationService.getUserNotifications(req.user.id, req.query);
  return paginated(res, data, pagination, 'Notifications fetched');
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  return success(res, { count }, 'Unread count fetched');
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.params.id, req.user.id);
  return success(res, notification, 'Notification marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  return success(res, null, 'All notifications marked as read');
});

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
