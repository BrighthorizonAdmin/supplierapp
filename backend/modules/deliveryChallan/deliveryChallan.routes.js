const express = require('express');
const ctrl    = require('./deliveryChallan.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize }    = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

router.get   ('/',    authorize('invoices:read'),  ctrl.getChallans);
router.get   ('/:id', authorize('invoices:read'),  ctrl.getChallanById);
router.post  ('/',    authorize('invoices:write'), ctrl.createChallan);
router.put   ('/:id', authorize('invoices:write'), ctrl.updateChallan);
router.delete('/:id', authorize('invoices:write'), ctrl.deleteChallan);

module.exports = router;
