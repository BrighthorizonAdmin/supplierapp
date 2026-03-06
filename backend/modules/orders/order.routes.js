const express = require('express');
const {
  createOrder, getOrders, getOrderStats, getOrderById, confirmOrder, cancelOrder, updateOrderStatus,
} = require('./order.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/stats', authorize('orders:read'), getOrderStats);
router.get('/', authorize('orders:read'), getOrders);
router.post('/', authorize('orders:write'), createOrder);
router.get('/:id', authorize('orders:read'), getOrderById);
router.patch('/:id/confirm', authorize('orders:write'), confirmOrder);
router.patch('/:id/cancel', authorize('orders:write'), cancelOrder);
router.patch('/:id/status', authorize('orders:write'), updateOrderStatus);

module.exports = router;
