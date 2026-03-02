const express = require('express');
const {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
} = require('./dealer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

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

module.exports = router;
