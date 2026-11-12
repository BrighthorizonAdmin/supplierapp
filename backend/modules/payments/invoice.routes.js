const express = require('express');
const ctrl    = require('./invoice.controller');

const { authenticate }  = require('../../middlewares/auth.middleware');
const { authorize }     = require('../../middlewares/rbac.middleware');
const { error }         = require('../../utils/response');

const router = express.Router();
router.use(authenticate);

const superAdminOnly = (req, res, next) => {
  if ([].concat(req.user?.role || []).includes('super-admin')) return next();
  return error(res, 'Only Super Admin can edit or delete a generated invoice', 403);
};

router.get   ('/',           authorize('invoices:read'),   ctrl.getInvoices);
router.get   ('/:id',        authorize('invoices:read'),   ctrl.getInvoiceById);
router.post  ('/',           authorize('invoices:write'),  ctrl.createInvoice);
router.put   ('/:id',        authorize('invoices:write'),  ctrl.updateInvoice);
router.patch ('/:id/issue',   authorize('invoices:write'),  ctrl.issueInvoice);
router.patch ('/:id/cancel',  authorize('invoices:write'),  ctrl.cancelInvoice);
router.patch ('/:id/serials', authorize('invoices:write'),  ctrl.saveSerialNumbers);
router.delete('/:id',         authorize('invoices:write'),  ctrl.deleteInvoice);

// Super Admin only — edit/delete already generated invoices
router.put   ('/:id/manage',  superAdminOnly, ctrl.manageEditInvoice);
router.delete('/:id/manage',  superAdminOnly, ctrl.manageDeleteInvoice);

module.exports = router;