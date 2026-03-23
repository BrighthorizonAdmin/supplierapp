const express = require('express');
const {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
} = require('./role.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// Available permission registry — any authenticated user can fetch this
// (needed to build the role-creation UI)
router.get('/permissions', listPermissions);

router.get('/',      authorize('admin:read'),  listRoles);
router.post('/',     authorize('admin:write'), createRole);
router.get('/:id',   authorize('admin:read'),  getRole);
router.put('/:id',   authorize('admin:write'), updateRole);
router.delete('/:id',authorize('admin:write'), deleteRole);

module.exports = router;
