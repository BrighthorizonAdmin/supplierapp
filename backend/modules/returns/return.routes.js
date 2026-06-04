const express = require('express');
const { createReturn, getReturns, getReturnById, processReturn, updateReturnStatus } = require('./return.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { validate, required, isNonEmptyArray, oneOf, RETURN_STATUSES } = require('../../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('returns:read'), getReturns);
router.post('/', authorize('returns:write'), validate({ orderId: [required], items: [required, isNonEmptyArray] }), createReturn);
router.get('/:id', authorize('returns:read'), getReturnById);
router.patch('/:id/process', authorize('returns:write'), processReturn);
router.patch('/:id/status', authorize('returns:write'), validate({ status: [required, oneOf(RETURN_STATUSES)] }), updateReturnStatus);

module.exports = router;
