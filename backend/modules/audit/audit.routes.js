const express = require('express');
const { getLogs } = require('./audit.controller');
const {
  getKPIs,
  getSalesChart,
  getInventoryStats,
  getTopProducts,
  getDeliveredCount,
  getRetailAnalytics,
} = require('./audit.analytics.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// Audit logs
router.get('/', authorize('audit:read'), getLogs);

// Analytics dashboard — all routes require only audit:read.
// Data is aggregated server-side; no individual module permissions needed.
router.get('/analytics/kpis',             authorize('audit:read'), getKPIs);
router.get('/analytics/sales-chart',      authorize('audit:read'), getSalesChart);
router.get('/analytics/inventory-stats',  authorize('audit:read'), getInventoryStats);
router.get('/analytics/top-products',     authorize('audit:read'), getTopProducts);
router.get('/analytics/delivered-orders', authorize('audit:read'), getDeliveredCount);
router.get('/analytics/retail',           authorize('audit:read'), getRetailAnalytics);

module.exports = router;
