const express = require('express');
const { createReturn, getReturns, getReturnById, processReturn, updateReturnStatus } = require('./return.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('returns:read'), getReturns);
router.post('/', authorize('returns:write'), createReturn);
router.get('/:id', authorize('returns:read'), getReturnById);
router.patch('/:id/process', authorize('returns:write'), processReturn);
router.patch('/:id/status', authorize('returns:write'), updateReturnStatus);

module.exports = router;
