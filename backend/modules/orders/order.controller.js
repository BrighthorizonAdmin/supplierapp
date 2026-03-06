const orderService = require('./order.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getOrderStats = asyncHandler(async (req, res) => {
  const stats = await orderService.getOrderStats();
  return success(res, stats, 'Order stats fetched');
});

const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user.id);
  return success(res, order, 'Order created', 201);
});

const getOrders = asyncHandler(async (req, res) => {
  const { data, pagination } = await orderService.getOrders(req.query);
  return paginated(res, data, pagination, 'Orders fetched');
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  return success(res, order, 'Order fetched');
});

const confirmOrder = asyncHandler(async (req, res) => {
  const order = await orderService.confirmOrder(req.params.id, req.user.id);
  return success(res, order, 'Order confirmed successfully');
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.params.id, req.body.reason, req.user.id);
  return success(res, order, 'Order cancelled');
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.user.id);
  return success(res, order, 'Order status updated');
});

module.exports = { createOrder, getOrders, getOrderStats, getOrderById, confirmOrder, cancelOrder, updateOrderStatus };
