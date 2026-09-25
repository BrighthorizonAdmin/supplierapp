const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const svc = require('./audit.analytics.service');

router.use(authenticate);

const parseFilters = (q) => ({
  startDate:    q.startDate    || null,
  endDate:      q.endDate      || null,
  invoiceType:  q.invoiceType  || 'all',
  status:       q.status       || 'all',
  dealerId:     q.dealerId     || 'all',
  paymentMode:  q.paymentMode  || 'all',
  salesmanName: q.salesmanName || 'all',
  partyNames:   q.partyNames   || 'all',
  dealerIds:    q.dealerIds    || 'all',
});

router.get('/kpis', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getKPIs(parseFilters(req.query));
  return success(res, data);
}));

router.get('/invoice-type-split', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getInvoiceTypeSplit(parseFilters(req.query));
  return success(res, data);
}));

router.get('/payment-method-mix', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getPaymentMethodMix(parseFilters(req.query));
  return success(res, data);
}));

router.get('/weekly-revenue', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getWeeklyRevenue(parseFilters(req.query));
  return success(res, data);
}));

router.get('/heatmap', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getHeatmap(parseFilters(req.query));
  return success(res, data);
}));

router.get('/top-products', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getTopProducts(parseFilters(req.query));
  return success(res, data);
}));

router.get('/top-channels', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getTopChannels(parseFilters(req.query));
  return success(res, data);
}));

router.get('/invoices', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const data = await svc.getInvoiceList(parseFilters(req.query), { page: +page, limit: +limit });
  return success(res, data);
}));

router.get('/daily-stats', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getDailyStats(parseFilters(req.query));
  return success(res, data);
}));

router.get('/status-split', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getStatusSplit(parseFilters(req.query));
  return success(res, data);
}));

router.get('/top-salespeople', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getTopSalespeople(parseFilters(req.query));
  return success(res, data);
}));

router.get('/customer-revenue', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getCustomerRevenue(parseFilters(req.query));
  return success(res, data);
}));

router.get('/filter-options', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getFilterOptions();
  return success(res, data);
}));

router.get('/date-range', authorize('invoices:read'), asyncHandler(async (req, res) => {
  const data = await svc.getDateRange();
  return success(res, data);
}));

module.exports = router;
