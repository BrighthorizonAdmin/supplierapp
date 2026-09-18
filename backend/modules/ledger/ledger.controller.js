const ledgerService = require('./ledger.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const getLedger = asyncHandler(async (req, res) => {
  const { data, summary, pagination } = await ledgerService.getLedger(req.query);
  return res.status(200).json({
    success: true,
    message: 'Ledger fetched',
    data,
    summary,
    pagination,
  });
});

const getSummary = asyncHandler(async (req, res) => {
  const summary = await ledgerService.getSummary(req.query);
  return success(res, summary, 'Ledger summary');
});

const getOrderLedger = asyncHandler(async (req, res) => {
  const row = await ledgerService.getOrderLedger(req.params.orderId);
  return success(res, row, 'Order ledger fetched');
});

const addManualPayment = asyncHandler(async (req, res) => {
  const row = await ledgerService.addManualPayment(req.params.orderId, req.body, req.file, req.user);
  return success(res, row, 'Manual payment recorded', 201);
});

const deleteManualPayment = asyncHandler(async (req, res) => {
  const row = await ledgerService.deleteManualPayment(req.params.orderId, req.params.paymentId);
  return success(res, row, 'Manual payment removed');
});

const patchEntry = asyncHandler(async (req, res) => {
  const row = await ledgerService.patchEntry(req.params.orderId, req.body, req.user);
  return success(res, row, 'Ledger entry updated');
});

const addScreenshot = asyncHandler(async (req, res) => {
  const row = await ledgerService.addScreenshot(req.params.orderId, req.body, req.file, req.user);
  return success(res, row, 'Screenshot added', 201);
});

const deleteScreenshot = asyncHandler(async (req, res) => {
  const row = await ledgerService.deleteScreenshot(req.params.orderId, req.params.screenshotId);
  return success(res, row, 'Screenshot removed');
});

const exportLedger = asyncHandler(async (req, res) => {
  const { filename, contentType, buffer } = await ledgerService.exportLedger(req.query);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

const notify = asyncHandler(async (req, res) => {
  const result = await ledgerService.notifyOneDealer({
    dealerId: req.body.dealerId,
    channel: req.body.channel,
    orderIds: req.body.orderIds,
    user: req.user,
  });
  return success(res, result, 'Dealer notified');
});

const notifyBulk = asyncHandler(async (req, res) => {
  const result = await ledgerService.notifyAllDealers({ channel: req.body.channel, user: req.user });
  return success(res, result, 'Dealers notified');
});

module.exports = {
  getLedger,
  getSummary,
  getOrderLedger,
  addManualPayment,
  deleteManualPayment,
  patchEntry,
  addScreenshot,
  deleteScreenshot,
  exportLedger,
  notify,
  notifyBulk,
};
