const Notification = require('./model/Notification.model');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { emitToUser } = require('../../websocket/socket');
const { NEW_NOTIFICATION } = require('../../websocket/events');

const create = async ({ recipientId, title, message, type = 'info', relatedEntity = {}, createdBy }) => {
  const notification = await Notification.create({
    recipientId,
    title,
    message,
    type,
    relatedEntity,
    createdBy,
  });

  // Real-time push
  try {
    emitToUser(recipientId.toString(), NEW_NOTIFICATION, {
      id: notification._id,
      title,
      message,
      type,
    });
  } catch {
    // Socket may not be initialized in tests
  }

  return notification;
};

const markRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) {
    const { AppError } = require('../../middlewares/error.middleware');
    throw new AppError('Notification not found', 404);
  }
  return notification;
};

const markAllRead = async (userId) => {
  await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

const getUserNotifications = async (userId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = { recipientId: userId };
  if (query.unreadOnly === 'true') match.isRead = false;

  const [data, total] = await Promise.all([
    Notification.find(match)
      .sort({ isRead: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipientId: userId, isRead: false });
};

module.exports = { create, markRead, markAllRead, getUserNotifications, getUnreadCount };
