const express = require('express');
const {
  createOrder, getOrders, getOrderStats, getOrderById, confirmOrder, cancelOrder, updateOrderStatus, saveOrderSerials, getOrderTracking,
} = require('./order.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

// Public route — API key auth only, used by dealer backend to fetch live NimbusPost tracking
router.get('/tracking/:awb', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.SUPPLIER_API_KEY) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const npService = require('../nimbuspost/nimbuspost.service');
    const liveTracking = await npService.trackShipment(req.params.awb);
    return res.json({ success: true, data: { liveTracking } });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

router.get('/stats', authorize('orders:read'), getOrderStats);
router.get('/', authorize('orders:read'), getOrders);
router.post('/', authorize('orders:write'), createOrder);
router.get('/:id/tracking', authorize('orders:read'), getOrderTracking);
router.get('/:id', authorize('orders:read'), getOrderById);
router.patch('/:id/confirm', authorize('orders:write'), confirmOrder);
router.patch('/:id/cancel', authorize('orders:write'), cancelOrder);
router.patch('/:id/status', authorize('orders:write'), updateOrderStatus);
router.patch('/:id/serials', authorize('orders:write'), saveOrderSerials);

module.exports = router;
