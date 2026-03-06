const retailOrderService = require('./retailOrder.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getRetailAnalytics = asyncHandler(async (req, res) => {
  const data = await retailOrderService.getRetailAnalytics();
  return success(res, data, 'Retail analytics fetched');
});

const createRetailOrder = asyncHandler(async (req, res) => {
  const order = await retailOrderService.createRetailOrder(req.body, req.user.id);
  return success(res, order, 'Retail order created', 201);
});

const getRetailOrders = asyncHandler(async (req, res) => {
  const { data, pagination } = await retailOrderService.getRetailOrders(req.query);
  return paginated(res, data, pagination, 'Retail orders fetched');
});

const getRetailOrderById = asyncHandler(async (req, res) => {
  const order = await retailOrderService.getRetailOrderById(req.params.id);
  return success(res, order, 'Retail order fetched');
});

const updateRetailOrderStatus = asyncHandler(async (req, res) => {
  const order = await retailOrderService.updateRetailOrderStatus(req.params.id, req.body.status, req.user.id);
  return success(res, order, 'Retail order status updated');
});

module.exports = { createRetailOrder, getRetailOrders, getRetailOrderById, updateRetailOrderStatus, getRetailAnalytics };
