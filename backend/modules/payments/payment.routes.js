const express = require('express');
const { createPayment, getPayments, getPaymentById, confirmPayment } = require('./payment.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('payments:read'), getPayments);
router.post('/', authorize('payments:write'), createPayment);
router.get('/:id', authorize('payments:read'), getPaymentById);
router.patch('/:id/confirm', authorize('payments:write'), confirmPayment);

module.exports = router;
