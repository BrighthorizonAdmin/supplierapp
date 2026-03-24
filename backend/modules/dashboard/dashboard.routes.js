const express = require('express');
const { getKPIs, getRecentActivity, getSalesChart, getTopDealers, getRecentOrders } = require('./dashboard.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// All routes require dashboard:read.
// These are feature-level aggregation endpoints — they do NOT expose raw module records.
// Callers never need orders:read, inventory:read, finance:read etc. to use this router.
router.get('/kpis',          authorize('dashboard:read'), getKPIs);
router.get('/activity',      authorize('dashboard:read'), getRecentActivity);
router.get('/sales-chart',   authorize('dashboard:read'), getSalesChart);
router.get('/top-dealers',   authorize('dashboard:read'), getTopDealers);
router.get('/recent-orders', authorize('dashboard:read'), getRecentOrders);

module.exports = router;
