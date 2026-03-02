const AuditLog = require('./model/AuditLog.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

const log = async (entity, entityId, action, performedBy, changes = {}, meta = {}) => {
  return AuditLog.create({
    entity,
    entityId,
    action,
    performedBy,
    changes,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: meta.metadata,
  });
};

const getLogs = async (filters = {}, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (filters.entity) match.entity = filters.entity;
  if (filters.entityId) match.entityId = filters.entityId;
  if (filters.action) match.action = filters.action;
  if (filters.performedBy) match.performedBy = filters.performedBy;
  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    AuditLog.find(match)
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

module.exports = { log, getLogs };
