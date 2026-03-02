const Inventory = require('./model/Inventory.model');
const Warehouse = require('./model/Warehouse.model');
const Product = require('../products/model/Product.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');
const { emitToRole } = require('../../websocket/socket');
const { LOW_STOCK_ALERT } = require('../../websocket/events');

const getOrCreateInventory = async (productId, warehouseId, session = null) => {
  const opts = session ? { session } : {};
  let inv = await Inventory.findOne({ productId, warehouseId }, null, opts);
  if (!inv) {
    const created = await Inventory.create([{ productId, warehouseId }], opts);
    inv = created[0];
  }
  return inv;
};

const adjustStock = async (productId, warehouseId, quantity, type = 'add', userId, session = null) => {
  const opts = session ? { session } : {};
  const delta = type === 'add' ? quantity : -quantity;

  const inv = await Inventory.findOneAndUpdate(
    {
      productId,
      warehouseId,
      ...(type === 'remove' ? { quantityOnHand: { $gte: quantity } } : {}),
    },
    {
      $inc: { quantityOnHand: delta },
      ...(type === 'add' ? { lastRestockedAt: new Date(), lastRestockedBy: userId } : {}),
    },
    { new: true, upsert: type === 'add', ...opts }
  );

  if (!inv) throw new AppError('Insufficient stock for this operation', 400);

  // Low stock check
  if (inv.quantityAvailable <= inv.reorderLevel) {
    try {
      emitToRole('inventory-manager', LOW_STOCK_ALERT, {
        productId,
        warehouseId,
        quantityAvailable: inv.quantityAvailable,
        reorderLevel: inv.reorderLevel,
      });
    } catch {}
  }

  await auditService.log('inventory', inv._id, 'update', userId, {
    after: { productId, warehouseId, delta, quantityOnHand: inv.quantityOnHand },
  });

  return inv;
};

const allocateStock = async (productId, warehouseId, quantity, session = null) => {
  const opts = session ? { session } : {};
  const inv = await Inventory.findOneAndUpdate(
    {
      productId,
      warehouseId,
      $expr: { $gte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, quantity] },
    },
    { $inc: { quantityAllocated: quantity } },
    { new: true, ...opts }
  );
  if (!inv) throw new AppError(`Insufficient available stock for product ${productId}`, 400);
  return inv;
};

const releaseAllocation = async (productId, warehouseId, quantity, session = null) => {
  const opts = session ? { session } : {};
  await Inventory.findOneAndUpdate(
    { productId, warehouseId, quantityAllocated: { $gte: quantity } },
    { $inc: { quantityAllocated: -quantity } },
    { ...opts }
  );
};

const getInventory = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.warehouseId) match.warehouseId = query.warehouseId;
  if (query.productId) match.productId = query.productId;
  if (query.lowStock === 'true') {
    match.$expr = { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] };
  }

  const [data, total] = await Promise.all([
    Inventory.find(match)
      .populate('productId', 'name productCode category unit')
      .populate('warehouseId', 'name code')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Inventory.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getInventoryById = async (id) => {
  const inv = await Inventory.findById(id)
    .populate('productId', 'name productCode unit basePrice')
    .populate('warehouseId', 'name code address')
    .lean({ virtuals: true });
  if (!inv) throw new AppError('Inventory record not found', 404);
  return inv;
};

const upsertInventory = async (productId, warehouseId, data, userId) => {
  const inv = await Inventory.findOneAndUpdate(
    { productId, warehouseId },
    { ...data },
    { new: true, upsert: true, runValidators: true }
  );
  await auditService.log('inventory', inv._id, 'update', userId, { after: data });
  return inv;
};

// Warehouse CRUD
const createWarehouse = async (data, userId) => {
  const warehouse = await Warehouse.create(data);
  await auditService.log('warehouse', warehouse._id, 'create', userId, { after: { name: warehouse.name } });
  return warehouse;
};

const getWarehouses = async (query = {}) => {
  const match = {};
  if (query.isActive !== undefined) match.isActive = query.isActive === 'true';
  return Warehouse.find(match).populate('manager', 'name email').lean();
};

const updateWarehouse = async (id, updates, userId) => {
  const wh = await Warehouse.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!wh) throw new AppError('Warehouse not found', 404);
  await auditService.log('warehouse', id, 'update', userId, { after: updates });
  return wh;
};

module.exports = {
  adjustStock, allocateStock, releaseAllocation, getInventory,
  getInventoryById, upsertInventory, getOrCreateInventory,
  createWarehouse, getWarehouses, updateWarehouse,
};
