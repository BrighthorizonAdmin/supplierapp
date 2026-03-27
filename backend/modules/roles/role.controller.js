const roleService = require('./role.service');
const { ALL_PERMISSIONS } = require('../../utils/permissions');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const listRoles = asyncHandler(async (req, res) => {
  const roles = await roleService.getRoles(req.query);
  return success(res, roles, 'Roles fetched');
});

const getRole = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(req.params.id);
  return success(res, role, 'Role fetched');
});

const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body);
  return success(res, role, 'Role created', 201);
});

const updateRole = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.body);
  return success(res, role, 'Role updated');
});

const deleteRole = asyncHandler(async (req, res) => {
  await roleService.deleteRole(req.params.id);
  return success(res, null, 'Role deleted');
});

// Returns the full permission registry so the frontend can build the UI
const listPermissions = asyncHandler(async (req, res) => {
  return success(res, ALL_PERMISSIONS, 'Available permissions fetched');
});

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole, listPermissions };
