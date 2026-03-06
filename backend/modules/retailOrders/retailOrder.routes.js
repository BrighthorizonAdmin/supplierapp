const express = require('express');
const {
  createRetailOrder, getRetailOrders, getRetailOrderById, updateRetailOrderStatus, getRetailAnalytics,
} = require('./retailOrder.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('retailOrders:read'), getRetailOrders);
router.post('/', authorize('retailOrders:write'), createRetailOrder);
router.get('/analytics', authorize('retailOrders:read'), getRetailAnalytics);
router.get('/:id', authorize('retailOrders:read'), getRetailOrderById);
router.patch('/:id/status', authorize('retailOrders:write'), updateRetailOrderStatus);

module.exports = router;
