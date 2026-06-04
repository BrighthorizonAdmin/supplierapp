const express = require('express');
const {
  createOrder, getOrders, getOrderStats, getOrderById, confirmOrder, cancelOrder, updateOrderStatus, saveOrderSerials,
} = require('./order.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { validate, required, isNonEmptyArray, oneOf, ORDER_STATUSES } = require('../../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/stats', authorize('orders:read'), getOrderStats);
router.get('/', authorize('orders:read'), getOrders);
router.post('/', authorize('orders:write'), validate({ dealerId: [required], items: [required, isNonEmptyArray] }), createOrder);
router.get('/:id', authorize('orders:read'), getOrderById);
router.patch('/:id/confirm', authorize('orders:write'), confirmOrder);
router.patch('/:id/cancel', authorize('orders:write'), cancelOrder);
router.patch('/:id/status', authorize('orders:write'), validate({ status: [required, oneOf(ORDER_STATUSES)] }), updateOrderStatus);
router.patch('/:id/serials', authorize('orders:write'), saveOrderSerials);

module.exports = router;
