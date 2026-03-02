const returnService = require('./return.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createReturn = asyncHandler(async (req, res) => {
  const ret = await returnService.createReturn(req.body, req.user.id);
  return success(res, ret, 'Return request created', 201);
});

const getReturns = asyncHandler(async (req, res) => {
  const { data, pagination } = await returnService.getReturns(req.query);
  return paginated(res, data, pagination, 'Returns fetched');
});

const getReturnById = asyncHandler(async (req, res) => {
  const ret = await returnService.getReturnById(req.params.id);
  return success(res, ret, 'Return fetched');
});

const processReturn = asyncHandler(async (req, res) => {
  const ret = await returnService.processReturn(req.params.id, req.body, req.user.id);
  return success(res, ret, 'Return processed and refund issued');
});

const updateReturnStatus = asyncHandler(async (req, res) => {
  const ret = await returnService.updateReturnStatus(
    req.params.id, req.body.status, req.body.reason, req.user.id
  );
  return success(res, ret, 'Return status updated');
});

module.exports = { createReturn, getReturns, getReturnById, processReturn, updateReturnStatus };
