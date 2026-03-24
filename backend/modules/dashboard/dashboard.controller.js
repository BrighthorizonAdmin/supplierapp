const dashboardService = require('./dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getKPIs = asyncHandler(async (req, res) => {
  const kpis = await dashboardService.getKPIs(req.user);
  return success(res, kpis, 'Dashboard KPIs fetched');
});

const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const activity = await dashboardService.getRecentActivity(limit, req.user);
  return success(res, activity, 'Recent activity fetched');
});

const getSalesChart = asyncHandler(async (req, res) => {
  const data = await dashboardService.getSalesChart(req.query.period);
  return success(res, data, 'Sales chart data fetched');
});

const getTopDealers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;
  const data = await dashboardService.getTopDealers(limit);
  return success(res, data, 'Top dealers fetched');
});

module.exports = { getKPIs, getRecentActivity, getSalesChart, getTopDealers };
