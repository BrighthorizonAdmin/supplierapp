const dealerService = require('./dealer.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.createDealer(req.body, req.user.id);
  return success(res, dealer, 'Dealer created successfully', 201);
});

const getDealers = asyncHandler(async (req, res) => {
  const { data, pagination } = await dealerService.getDealers(req.query);
  return paginated(res, data, pagination, 'Dealers fetched');
});

const getDealerById = asyncHandler(async (req, res) => {
  const dealer = await dealerService.getDealerById(req.params.id);
  return success(res, dealer, 'Dealer fetched');
});

const approveDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.approveDealer(req.params.id, req.body, req.user.id);
  return success(res, dealer, 'Dealer approved successfully');
});

const rejectDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.rejectDealer(req.params.id, req.body.reason, req.user.id);
  return success(res, dealer, 'Dealer rejected');
});

const requestUpdate = asyncHandler(async (req, res) => {
  // Accept both old single-field format and new multi-field array format
  const { field, fields, updateFields, instructions } = req.body;
  const dealer = await dealerService.requestUpdate(
    req.params.id,
    { field, fields, updateFields, instructions },
    req.user.id
  );
  return success(res, dealer, 'Update requested from dealer');
});

const suspendDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.suspendDealer(req.params.id, req.body.reason, req.user.id);
  return success(res, dealer, 'Dealer suspended');
});

const reactivateDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.reactivateDealer(req.params.id, req.user.id);
  return success(res, dealer, 'Dealer reactivated');
});

const updateDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.updateDealer(req.params.id, req.body, req.user.id);
  return success(res, dealer, 'Dealer updated');
});

const getDealerStats = asyncHandler(async (req, res) => {
  const stats = await dealerService.getDealerStats(req.params.id);
  return success(res, stats, 'Dealer stats fetched');
});

module.exports = {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
  requestUpdate,
};