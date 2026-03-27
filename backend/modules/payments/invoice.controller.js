const invoiceService = require('./invoice.service');
const asyncHandler   = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getInvoices     = asyncHandler(async (req, res) => {
  const { data, pagination } = await invoiceService.getInvoices(req.query);
  return paginated(res, data, pagination, 'Invoices fetched');
});
const getInvoiceById  = asyncHandler(async (req, res) => {
  const inv = await invoiceService.getInvoiceById(req.params.id);
  return success(res, inv, 'Invoice fetched');
});
const createInvoice   = asyncHandler(async (req, res) => {
  const inv = await invoiceService.createInvoice(req.body, req.user);
  return success(res, inv, 'Invoice created', 201);
});
const updateInvoice   = asyncHandler(async (req, res) => {
  const inv = await invoiceService.updateInvoice(req.params.id, req.body);
  return success(res, inv, 'Invoice updated');
});
const issueInvoice    = asyncHandler(async (req, res) => {
  const inv = await invoiceService.issueInvoice(req.params.id);
  return success(res, inv, 'Invoice issued');
});
const cancelInvoice   = asyncHandler(async (req, res) => {
  const inv = await invoiceService.cancelInvoice(req.params.id);
  return success(res, inv, 'Invoice cancelled');
});
const deleteInvoice   = asyncHandler(async (req, res) => {
  await invoiceService.deleteInvoice(req.params.id);
  return success(res, null, 'Invoice deleted');
});

module.exports = { getInvoices, getInvoiceById, createInvoice, updateInvoice, issueInvoice, cancelInvoice, deleteInvoice };