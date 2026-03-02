const paymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(req.body, req.user.id);
  return success(res, payment, 'Payment recorded', 201);
});

const getPayments = asyncHandler(async (req, res) => {
  const { data, pagination } = await paymentService.getPayments(req.query);
  return paginated(res, data, pagination, 'Payments fetched');
});

const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  return success(res, payment, 'Payment fetched');
});

const confirmPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.confirmPayment(req.params.id, req.user.id);
  return success(res, payment, 'Payment confirmed successfully');
});

module.exports = { createPayment, getPayments, getPaymentById, confirmPayment };
