const express = require('express');
const { getInventory, getInventoryById, adjustStock, upsertInventory } = require('./inventory.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('inventory:read'), getInventory);
router.get('/:id', authorize('inventory:read'), getInventoryById);
router.post('/adjust', authorize('inventory:write'), adjustStock);
router.put('/upsert', authorize('inventory:write'), upsertInventory);

module.exports = router;
