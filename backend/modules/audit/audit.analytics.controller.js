const analyticsService = require('./audit.analytics.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getKPIs = asyncHandler(async (req, res) => {
  const data = await analyticsService.getKPIs();
  return success(res, data, 'Analytics KPIs fetched');
});

const getSalesChart = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSalesChart(req.query.period);
  return success(res, data, 'Analytics sales chart fetched');
});

const getInventoryStats = asyncHandler(async (req, res) => {
  const data = await analyticsService.getInventoryStats();
  return success(res, data, 'Analytics inventory stats fetched');
});

const getTopProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 7;
  const data = await analyticsService.getTopProducts(limit);
  return success(res, data, 'Analytics top products fetched');
});

const getDeliveredCount = asyncHandler(async (req, res) => {
  const count = await analyticsService.getDeliveredCount();
  return success(res, { total: count }, 'Analytics delivered count fetched');
});

const getRetailAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRetailAnalytics();
  return success(res, data, 'Retail analytics fetched');
});

module.exports = { getKPIs, getSalesChart, getInventoryStats, getTopProducts, getDeliveredCount, getRetailAnalytics };
