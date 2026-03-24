const express = require('express');
const { getKPIs, getRecentActivity, getSalesChart, getTopDealers } = require('./dashboard.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/kpis', authorize('dashboard:read'), getKPIs);
router.get('/activity', authorize('dashboard:read'), getRecentActivity);
router.get('/sales-chart', authorize('dashboard:read'), getSalesChart);
router.get('/top-dealers', authorize('dashboard:read'), getTopDealers);

module.exports = router;
