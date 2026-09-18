const express = require('express');
const ctrl = require('./ledger.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { uploadLedgerProof } = require('./ledger.upload');

// NOTE: A dedicated permission (e.g. 'ledger:read' / 'ledger:write') is not wired
// yet by request. Every route currently requires only a valid login. To lock it
// down later, add the keys to utils/permissions.js and drop
// `authorize('ledger:read' | 'ledger:write')` into the chains below.
// const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

// Reads
router.get('/', ctrl.getLedger);
router.get('/summary', ctrl.getSummary);
router.get('/export', ctrl.exportLedger);
router.get('/order/:orderId', ctrl.getOrderLedger);

// Notify — one cumulative reminder per dealer (their total pending across all orders)
router.post('/notify', ctrl.notify);           // one dealer
router.post('/notify/bulk', ctrl.notifyBulk);  // every dealer with dues

// Ledger-entry mutations (isolated to the `ledgerentries` collection)
router.patch('/order/:orderId', ctrl.patchEntry);
router.post('/order/:orderId/payment', uploadLedgerProof.single('screenshot'), ctrl.addManualPayment);
router.delete('/order/:orderId/payment/:paymentId', ctrl.deleteManualPayment);
router.post('/order/:orderId/screenshot', uploadLedgerProof.single('screenshot'), ctrl.addScreenshot);
router.delete('/order/:orderId/screenshot/:screenshotId', ctrl.deleteScreenshot);

module.exports = router;
