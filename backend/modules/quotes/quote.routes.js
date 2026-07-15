const express = require('express');
const ctrl    = require('./quote.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize }    = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

router.get   ('/',    authorize('invoices:read'),  ctrl.getQuotes);
router.get   ('/next-number', authorize('invoices:read'), ctrl.getNextQuoteNumber);
router.get   ('/:id', authorize('invoices:read'),  ctrl.getQuoteById);
router.post  ('/',    authorize('invoices:write'), ctrl.createQuote);
router.put   ('/:id', authorize('invoices:write'), ctrl.updateQuote);
router.delete('/:id', authorize('invoices:write'), ctrl.deleteQuote);

module.exports = router;
