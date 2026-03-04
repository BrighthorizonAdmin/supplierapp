const inventoryService = require('./inventory.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getInventory = asyncHandler(async (req, res) => {
  const { data, pagination } = await inventoryService.getInventory(req.query);
  return paginated(res, data, pagination, 'Inventory fetched');
});

const getInventoryStats = asyncHandler(async (req, res) => {
  const stats = await inventoryService.getInventoryStats();
  return success(res, stats, 'Inventory stats fetched');
});

const getInventoryById = asyncHandler(async (req, res) => {
  const inv = await inventoryService.getInventoryById(req.params.id);
  return success(res, inv, 'Inventory record fetched');
});

const adjustStock = asyncHandler(async (req, res) => {
  const { productId, warehouseId, quantity, type } = req.body;
  const inv = await inventoryService.adjustStock(productId, warehouseId, quantity, type, req.user.id);
  return success(res, inv, `Stock ${type === 'add' ? 'added' : 'removed'} successfully`);
});

const upsertInventory = asyncHandler(async (req, res) => {
  const { productId, warehouseId, ...data } = req.body;
  const inv = await inventoryService.upsertInventory(productId, warehouseId, data, req.user.id);
  return success(res, inv, 'Inventory updated');
});

// Warehouse controllers
const createWarehouse = asyncHandler(async (req, res) => {
  const wh = await inventoryService.createWarehouse(req.body, req.user.id);
  return success(res, wh, 'Warehouse created', 201);
});

const getWarehouses = asyncHandler(async (req, res) => {
  const warehouses = await inventoryService.getWarehouses(req.query);
  return success(res, warehouses, 'Warehouses fetched');
});

const updateWarehouse = asyncHandler(async (req, res) => {
  const wh = await inventoryService.updateWarehouse(req.params.id, req.body, req.user.id);
  return success(res, wh, 'Warehouse updated');
});

module.exports = {
  getInventory, getInventoryStats, getInventoryById, adjustStock, upsertInventory,
  createWarehouse, getWarehouses, updateWarehouse,
};
