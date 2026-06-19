const inventoryService = require('./inventory.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');
const DispatchedUnit = require('../dispatchedUnits/model/DispatchedUnit.model');

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

const editStockWithSerials = asyncHandler(async (req, res) => {
  const { productId, warehouseId, stockQuantity, serialNumbers, productName } = req.body;
  const inv = await inventoryService.editStockWithSerials(productId, warehouseId, stockQuantity, serialNumbers, productName, req.user.id);
  return success(res, inv, 'Stock updated successfully');
});

const updateOpeningStock = asyncHandler(async (req, res) => {
  const { productId, warehouseId, openingStockQty, reason } = req.body;
  if (!productId || openingStockQty == null) {
    throw new AppError('productId and openingStockQty are required', 400);
  }
  if (openingStockQty < 0) throw new AppError('Opening stock quantity cannot be negative', 400);
  const result = await inventoryService.updateOpeningStock(productId, warehouseId || null, Number(openingStockQty), reason, req.user.id);
  return success(res, result, 'Opening stock updated successfully');
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

const getInventoryDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError('Inventory ID is required', 400);
  
  console.log('Fetching inventory details for ID:', id);
  const inv = await inventoryService.getInventoryById(id);
  
  const prodId = (inv.productId && inv.productId._id) ? inv.productId._id : inv.productId;
  let serials = [];
  if (prodId) {
    const units = await DispatchedUnit.find({ productId: prodId, status: 'in_stock' })
      .select('serialNumber')
      .sort({ createdAt: 1 })
      .lean();
    serials = units.map((u) => u.serialNumber);
  }
  return success(res, { ...inv, serials }, 'Inventory details fetched');
});

module.exports = {
  getInventory, getInventoryStats, getInventoryById, getInventoryDetails, adjustStock, upsertInventory,
  createWarehouse, getWarehouses, updateWarehouse, editStockWithSerials, updateOpeningStock,
};
