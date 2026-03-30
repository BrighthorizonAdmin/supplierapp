const Role = require('./role.model');
const User = require('../auth/model/User.model');
const { AppError } = require('../../middlewares/error.middleware');
const { isValidPermission } = require('../../utils/permissions');

const getRoles = async (query = {}) => {
  const match = {};
  if (query.isActive !== undefined) match.isActive = query.isActive === 'true';
  const roles = await Role.find(match).sort({ isSystem: -1, name: 1 }).lean();

  // Attach user count to each role
  const counts = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {});

  return roles.map((r) => ({ ...r, userCount: countMap[r.name] || 0 }));
};

const getRoleById = async (id) => {
  const role = await Role.findById(id).lean();
  if (!role) throw new AppError('Role not found', 404);
  return role;
};

const getRoleByName = async (name) => {
  return Role.findOne({ name: name.toLowerCase().trim() }).lean();
};

const createRole = async (data) => {
  const { name, description = '', permissions = [] } = data;

  // Validate all provided permissions exist in the registry
  // Allow '*' only for super-admin (system role); block it for custom roles
  const invalid = permissions.filter((p) => p !== '*' && !isValidPermission(p));
  if (invalid.length) {
    throw new AppError(`Invalid permissions: ${invalid.join(', ')}`, 400);
  }

  const existing = await Role.findOne({ name: name.toLowerCase().trim() });
  if (existing) throw new AppError(`Role "${name}" already exists`, 409);

  return Role.create({ name, description, permissions });
};

const updateRole = async (id, data) => {
  const role = await Role.findById(id);
  if (!role) throw new AppError('Role not found', 404);

  if (data.permissions !== undefined) {
    const invalid = data.permissions.filter((p) => p !== '*' && !isValidPermission(p));
    if (invalid.length) {
      throw new AppError(`Invalid permissions: ${invalid.join(', ')}`, 400);
    }
    role.permissions = data.permissions;
  }

  if (data.description !== undefined) role.description = data.description;

  // System roles can have permissions updated but cannot be deactivated
  if (data.isActive !== undefined && !role.isSystem) {
    role.isActive = data.isActive;
  }

  return role.save();
};

const deleteRole = async (id) => {
  const role = await Role.findById(id);
  if (!role) throw new AppError('Role not found', 404);
  if (role.isSystem) throw new AppError('System roles cannot be deleted', 403);

  const userCount = await User.countDocuments({ role: role.name });
  if (userCount > 0) {
    throw new AppError(
      `Cannot delete role: ${userCount} user(s) are currently assigned to it`,
      409
    );
  }

  await role.deleteOne();
  return { deleted: true };
};

module.exports = { getRoles, getRoleById, getRoleByName, createRole, updateRole, deleteRole };
