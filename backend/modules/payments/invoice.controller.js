const invoiceService = require('./invoice.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getInvoices = asyncHandler(async (req, res) => {
  const { data, pagination } = await invoiceService.getInvoices(req.query);
  return paginated(res, data, pagination, 'Invoices fetched');
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  return success(res, invoice, 'Invoice fetched');
});

module.exports = { getInvoices, getInvoiceById };
