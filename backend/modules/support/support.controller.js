const supportService = require('./support.service');
const asyncHandler   = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const { data, pagination, openCount, inProgressCount } = await supportService.getAll(req.query);
  return res.json({
    success: true,
    data,
    pagination,
    meta: { openCount, inProgressCount },
  });
});

const getById = asyncHandler(async (req, res) => {
  const ticket = await supportService.getById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  return success(res, ticket, 'Ticket fetched');
});

const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await supportService.updateStatus(req.params.id, req.body, req.user.id);
  return success(res, ticket, 'Ticket updated');
});

module.exports = { getAll, getById, updateStatus };