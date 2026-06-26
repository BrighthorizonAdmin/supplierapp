const challanService = require('./deliveryChallan.service');
const asyncHandler   = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getChallans    = asyncHandler(async (req, res) => {
  const { data, pagination } = await challanService.getChallans(req.query);
  return paginated(res, data, pagination, 'Challans fetched');
});

const getChallanById = asyncHandler(async (req, res) => {
  const c = await challanService.getChallanById(req.params.id);
  return success(res, c, 'Challan fetched');
});

const createChallan  = asyncHandler(async (req, res) => {
  const c = await challanService.createChallan(req.body, req.user);
  return success(res, c, 'Delivery Challan created', 201);
});

const updateChallan  = asyncHandler(async (req, res) => {
  const c = await challanService.updateChallan(req.params.id, req.body);
  return success(res, c, 'Delivery Challan updated');
});

const deleteChallan  = asyncHandler(async (req, res) => {
  await challanService.deleteChallan(req.params.id);
  return success(res, null, 'Delivery Challan deleted');
});

module.exports = { getChallans, getChallanById, createChallan, updateChallan, deleteChallan };
