const express = require('express');
const { getInventory, getInventoryStats, getInventoryById, adjustStock, upsertInventory, editStockWithSerials, updateOpeningStock, getInventoryDetails, softDeleteSerials, restoreSerials, getDeletedSerials } = require('./inventory.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { error } = require('../../utils/response');

const router = express.Router();

router.use(authenticate);

// Restrict route to super-admin role only
const superAdminOnly = (req, res, next) => {
  const role = req.user.role;
  const isSuperAdmin = Array.isArray(role)
    ? role.includes('super-admin')
    : role === 'super-admin';
  if (!isSuperAdmin)
    return error(res, 'Forbidden: Super Admin access required', 403);
  next();
};

router.get('/',       authorize('inventory:read'),  getInventory);
router.get('/stats',  authorize('inventory:read'),  getInventoryStats);  // must be before /:id
// combined details endpoint (inventory + in-stock serials)
router.get('/:id/details', authorize('inventory:read'), getInventoryDetails);
router.get('/:id',    authorize('inventory:read'),  getInventoryById);

router.post('/adjust',          authorize('inventory:write'), adjustStock);
router.post('/edit-stock',      authorize('inventory:write'), editStockWithSerials);
router.post('/opening-stock',   authorize('inventory:write'), updateOpeningStock);
router.put('/upsert',           authorize('inventory:write'), upsertInventory);

// Serial number soft-delete / restore — Super Admin only
router.get('/serials/deleted',        superAdminOnly, getDeletedSerials);
router.patch('/serials/soft-delete',  superAdminOnly, softDeleteSerials);
router.patch('/serials/restore',      superAdminOnly, restoreSerials);

module.exports = router;
