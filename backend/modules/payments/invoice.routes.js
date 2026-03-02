const express = require('express');
const { getInvoices, getInvoiceById } = require('./invoice.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('invoices:read'), getInvoices);
router.get('/:id', authorize('invoices:read'), getInvoiceById);

module.exports = router;
