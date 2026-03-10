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
  const mongoose = require('mongoose');
  const { page, limit, skip } = getPagination(query);

  // ── Product-level filters ──────────────────────────────────────────────────
  const productMatch = {};
  if (query.search) {
    const re = new RegExp(query.search, 'i');
    productMatch.$or = [
      { name: re }, { productCode: re }, { sku: re }, { category: re }, { brand: re },
    ];
  }
  if (query.category) productMatch.category = query.category;
  if (query.productId) productMatch._id = new mongoose.Types.ObjectId(query.productId);

  // ── Aggregation pipeline (product-centric left join) ──────────────────────
  const pipeline = [
    { $match: productMatch },

    // Left-join all inventory records for this product
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'productId',
        as: 'invRecords',
      },
    },

    // Unwind: preserveNullAndEmptyArrays keeps products with no stock record
    { $unwind: { path: '$invRecords', preserveNullAndEmptyArrays: true } },

    // Warehouse filter — applied before joining warehouse details
    ...(query.warehouseId
      ? [{ $match: { 'invRecords.warehouseId': new mongoose.Types.ObjectId(query.warehouseId) } }]
      : []),

    // Left-join warehouse details
    {
      $lookup: {
        from: 'warehouses',
        localField: 'invRecords.warehouseId',
        foreignField: '_id',
        as: 'whArr',
      },
    },

    // Project into the shape the frontend already expects (mirrors .populate() output)
    {
      $project: {
        _id: { $ifNull: ['$invRecords._id', '$_id'] },
        productId: {
          _id: '$_id',
          name: '$name',
          productCode: '$productCode',
          category: '$category',
          unit: '$unit',
          basePrice: '$basePrice',
        },
        warehouseId: { $arrayElemAt: ['$whArr', 0] },
        quantityOnHand:    { $ifNull: ['$invRecords.quantityOnHand',    0] },
        quantityAllocated: { $ifNull: ['$invRecords.quantityAllocated', 0] },
        reorderLevel:      { $ifNull: ['$invRecords.reorderLevel',      10] },
        lastRestockedAt:   '$invRecords.lastRestockedAt',
        updatedAt:         { $ifNull: ['$invRecords.updatedAt', '$updatedAt'] },
      },
    },

    // Add virtual fields (mirrors Inventory model virtuals)
    {
      $addFields: {
        quantityAvailable: { $subtract: ['$quantityOnHand', '$quantityAllocated'] },
        isLowStock: {
          $and: [
            { $gt: ['$quantityOnHand', 0] },
            { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] },
          ],
        },
      },
    },

    // Stock status filter (runs after virtual fields are computed)
    ...(query.status === 'low-stock' || query.lowStock === 'true'
      ? [{ $match: { quantityOnHand: { $gt: 0 }, isLowStock: true } }]
      : query.status === 'out-of-stock'
      ? [{ $match: { quantityOnHand: 0 } }]
      : query.status === 'high-stock'
      ? [{ $match: { $expr: { $gt: ['$quantityAvailable', { $multiply: ['$reorderLevel', 2] }] } } }]
      : []),
  ];

  const [countResult, data] = await Promise.all([
    Product.aggregate([...pipeline, { $count: 'total' }]),
    Product.aggregate([...pipeline, { $sort: { updatedAt: -1 } }, { $skip: skip }, { $limit: limit }]),
  ]);

  const total = countResult[0]?.total || 0;
  return { data, pagination: buildMeta(total, page, limit) };
};

const getInventoryStats = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo  = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const lowStockExpr  = { $lte: [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] };
  const highStockExpr = { $gt:  [{ $subtract: ['$quantityOnHand', '$quantityAllocated'] }, '$reorderLevel'] };

  const [
    totalAgg, totalCatalogSKUs, stockedProductIds,
    lowStockCount, outOfStockRecords, inStockCount,
    fastMovingCount, slowMovingCount,
  ] = await Promise.all([
    Inventory.aggregate([{ $group: { _id: null, totalOnHand: { $sum: '$quantityOnHand' }, totalAllocated: { $sum: '$quantityAllocated' } } }]),
    // Total SKUs = all active products in catalog (not just those with inventory records)
    Product.countDocuments({ isActive: true }),
    // Products that have at least one inventory record
    Inventory.distinct('productId').then((ids) => ids.length),
    Inventory.countDocuments({ quantityOnHand: { $gt: 0 }, $expr: lowStockExpr }),
    Inventory.countDocuments({ quantityOnHand: 0 }),
    Inventory.countDocuments({ quantityOnHand: { $gt: 0 }, $expr: highStockExpr }),
    Inventory.countDocuments({ lastRestockedAt: { $gte: thirtyDaysAgo } }),
    Inventory.countDocuments({ $or: [{ lastRestockedAt: { $lt: ninetyDaysAgo } }, { lastRestockedAt: null }] }),
  ]);

  const totalOnHand    = totalAgg[0]?.totalOnHand    || 0;
  const totalAllocated = totalAgg[0]?.totalAllocated || 0;

  // Products with no inventory record are effectively out of stock
  const unstockedProducts = Math.max(0, totalCatalogSKUs - stockedProductIds);
  const outOfStockCount   = outOfStockRecords + unstockedProducts;

  return {
    totalOnHand,
    totalAllocated,
    totalSKUs:      totalCatalogSKUs,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    fastMovingCount,
    slowMovingCount,
    distribution: { inStock: inStockCount, lowStock: lowStockCount, outOfStock: outOfStockCount },
  };
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
  adjustStock, allocateStock, releaseAllocation, getInventory, getInventoryStats,
  getInventoryById, upsertInventory, getOrCreateInventory,
  createWarehouse, getWarehouses, updateWarehouse,
};
