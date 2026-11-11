const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { uploadLedgerProof } = require('../ledger/ledger.upload');
const svc = require('./customerLedger.service');
const { toCsv, toPdf } = require('./customerLedger.export');

// Buvvas website (b2c) customer ledger. Same access as the dealer ledger
// (/api/ledger): any logged-in user.
const router = express.Router();
router.use(authenticate);

// List of customers with totals (+ summary). Query: startDate, endDate, status (due|paid), search
router.get('/', asyncHandler(async (req, res) => {
  const { data, summary } = await svc.getCustomers(req.query);
  return res.status(200).json({ success: true, message: 'Customer ledger fetched', data, summary });
}));

// Download: format csv|pdf, optional customerKey for one customer's statement
router.get('/export', asyncHandler(async (req, res) => {
  const { format = 'csv', customerKey, startDate, endDate, status, search } = req.query;
  let rows;
  let customer = null;
  if (customerKey) {
    customer = await svc.getCustomer(customerKey, { startDate, endDate });
    rows = customer.orders;
  } else {
    const groups = svc.filterGroups(svc.groupByCustomer(await svc.buildOrderRows({ startDate, endDate })), { status, search });
    rows = groups.flatMap((g) => g.orders);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const base = customer ? `customer-statement-${(customer.customerName || 'customer').replace(/[^a-z0-9]+/gi, '-')}` : 'buvvas-customer-ledger';
  if (format === 'pdf') {
    const buf = await toPdf(rows, { customer, fromDate: startDate, toDate: endDate });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-${stamp}.pdf"`);
    return res.send(buf);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}-${stamp}.csv"`);
  return res.send(toCsv(rows));
}));

// One customer with every order and payment
router.get('/customer/:customerKey', asyncHandler(async (req, res) => {
  const data = await svc.getCustomer(req.params.customerKey, req.query);
  return success(res, data, 'Customer fetched');
}));

// Email reminder of the customer's total dues
router.post('/customer/:customerKey/remind', asyncHandler(async (req, res) => {
  const data = await svc.remindCustomer(req.params.customerKey, req.user);
  return success(res, data, `Reminder emailed to ${data.emailTo}`);
}));

// COD collections on one order: record, edit, undo
router.post('/order/:orderId/payment', uploadLedgerProof.single('screenshot'), asyncHandler(async (req, res) => {
  const data = await svc.addPayment(req.params.orderId, req.body, req.file, req.user);
  return success(res, data, 'Payment recorded', 201);
}));

router.put('/order/:orderId/payment/:paymentId', uploadLedgerProof.single('screenshot'), asyncHandler(async (req, res) => {
  const data = await svc.editPayment(req.params.orderId, req.params.paymentId, req.body, req.file, req.user);
  return success(res, data, 'Payment updated');
}));

router.post('/order/:orderId/payment/:paymentId/undo', asyncHandler(async (req, res) => {
  const data = await svc.reversePayment(req.params.orderId, req.params.paymentId, req.body?.reason, req.user);
  return success(res, data, 'Payment undone');
}));

module.exports = router;
