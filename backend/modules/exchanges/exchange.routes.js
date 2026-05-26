const express = require('express');
const { listExchanges, showExchange, patchExchangeStatus } = require('./exchange.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/',    authorize('returns:read'),  listExchanges);
router.get('/:id', authorize('returns:read'),  showExchange);
router.patch('/:id/status', authorize('returns:write'), patchExchangeStatus);

module.exports = router;
