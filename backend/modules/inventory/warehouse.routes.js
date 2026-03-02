const express = require('express');
const { createWarehouse, getWarehouses, updateWarehouse } = require('./inventory.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('warehouse:read'), getWarehouses);
router.post('/', authorize('warehouse:write'), createWarehouse);
router.put('/:id', authorize('warehouse:write'), updateWarehouse);

module.exports = router;
