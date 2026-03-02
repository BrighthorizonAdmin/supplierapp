const express = require('express');
const { getRevenueSummary, getOverallStats, getDealerLedger, getPaymentCollectionReport } = require('./finance.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/stats', authorize('finance:read'), getOverallStats);
router.get('/revenue', authorize('finance:read'), getRevenueSummary);
router.get('/payments/report', authorize('finance:read'), getPaymentCollectionReport);
router.get('/ledger/:dealerId', authorize('finance:read'), getDealerLedger);

module.exports = router;
