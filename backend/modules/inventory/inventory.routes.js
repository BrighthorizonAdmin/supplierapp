const express = require('express');
const { getInventory, getInventoryStats, getInventoryById, adjustStock, upsertInventory, editStockWithSerials, updateOpeningStock, getInventoryDetails } = require('./inventory.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/',       authorize('inventory:read'),  getInventory);
router.get('/stats',  authorize('inventory:read'),  getInventoryStats);  // must be before /:id
// combined details endpoint (inventory + in-stock serials)
router.get('/:id/details', authorize('inventory:read'), getInventoryDetails);
router.get('/:id',    authorize('inventory:read'),  getInventoryById);

router.post('/adjust',          authorize('inventory:write'), adjustStock);
router.post('/edit-stock',      authorize('inventory:write'), editStockWithSerials);
router.post('/opening-stock',   authorize('inventory:write'), updateOpeningStock);
router.put('/upsert',           authorize('inventory:write'), upsertInventory);


module.exports = router;
