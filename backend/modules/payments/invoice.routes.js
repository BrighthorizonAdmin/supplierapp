const express = require('express');
const ctrl    = require('./invoice.controller');
const { authenticate }  = require('../../middlewares/auth.middleware');
const { authorize }     = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

router.get   ('/',           authorize('invoices:read'),   ctrl.getInvoices);
router.get   ('/:id',        authorize('invoices:read'),   ctrl.getInvoiceById);
router.post  ('/',           authorize('invoices:write'),  ctrl.createInvoice);
router.put   ('/:id',        authorize('invoices:write'),  ctrl.updateInvoice);
router.patch ('/:id/issue',  authorize('invoices:write'),  ctrl.issueInvoice);
router.patch ('/:id/cancel', authorize('invoices:write'),  ctrl.cancelInvoice);
router.delete('/:id',        authorize('invoices:write'),  ctrl.deleteInvoice);

module.exports = router;