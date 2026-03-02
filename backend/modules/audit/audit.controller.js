const auditService = require('./audit.service');
const asyncHandler = require('../../utils/asyncHandler');
const { paginated } = require('../../utils/response');

const getLogs = asyncHandler(async (req, res) => {
  const { entity, entityId, action, performedBy, startDate, endDate } = req.query;
  const { data, pagination } = await auditService.getLogs(
    { entity, entityId, action, performedBy, startDate, endDate },
    req.query
  );
  return paginated(res, data, pagination, 'Audit logs fetched');
});

module.exports = { getLogs };
