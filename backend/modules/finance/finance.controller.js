const financeService = require('./finance.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getRevenueSummary = asyncHandler(async (req, res) => {
  const data = await financeService.getRevenueSummary(req.query);
  return success(res, data, 'Revenue summary fetched');
});

const getOverallStats = asyncHandler(async (req, res) => {
  const stats = await financeService.getOverallStats();
  return success(res, stats, 'Finance stats fetched');
});

const getDealerLedger = asyncHandler(async (req, res) => {
  const { data, pagination } = await financeService.getDealerLedger(req.params.dealerId, req.query);
  return paginated(res, data, pagination, 'Dealer ledger fetched');
});

const getPaymentCollectionReport = asyncHandler(async (req, res) => {
  const data = await financeService.getPaymentCollectionReport(req.query);
  return success(res, data, 'Payment collection report fetched');
});

module.exports = { getRevenueSummary, getOverallStats, getDealerLedger, getPaymentCollectionReport };
