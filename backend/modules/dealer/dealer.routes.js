const express = require('express');
const {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
  requestUpdate, 
} = require('./dealer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.post('/webhook/application', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DEALER_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const dealer = await require('./dealer.service').createDealer(req.body, null);
    return res.status(201).json({ success: true, data: dealer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authenticate);

router.get('/', authorize('dealer:read'), getDealers);
router.post('/', authorize('dealer:write'), createDealer);
router.get('/:id', authorize('dealer:read'), getDealerById);
router.put('/:id', authorize('dealer:write'), updateDealer);
router.get('/:id/stats', authorize('dealer:read'), getDealerStats);
router.patch('/:id/approve', authorize('dealer:write'), approveDealer);
router.patch('/:id/reject', authorize('dealer:write'), rejectDealer);
router.patch('/:id/suspend', authorize('dealer:write'), suspendDealer);
router.patch('/:id/reactivate', authorize('dealer:write'), reactivateDealer);
router.patch('/:id/request-update', authorize('dealer:write'), requestUpdate);

module.exports = router;
