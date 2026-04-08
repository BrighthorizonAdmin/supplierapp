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
    { new: true, upsert: type === 'add', setDefaultsOnInsert: true, ...opts }
  );

  if (!inv) throw new AppError('Insufficient stock for this operation', 400);

  // Low stock check — percentage-based: alert when available drops to ≤20% of opening stock
  const product = await Product.findById(productId, 'openingStockQty').lean();
  const threshold = (product?.openingStockQty || 0) * 0.2;
  if (inv.quantityOnHand > 0 && inv.quantityAvailable <= threshold) {
    try {
      emitToRole('inventory-manager', LOW_STOCK_ALERT, {
        productId,
        warehouseId,
        quantityAvailable: inv.quantityAvailable,
        threshold,
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
  if (query.category)  productMatch.category = query.category;
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
        warehouseId:       { $arrayElemAt: ['$whArr', 0] },
        quantityOnHand:    { $ifNull: ['$invRecords.quantityOnHand',    '$openingStockQty'] },
        quantityAllocated: { $ifNull: ['$invRecords.quantityAllocated', 0] },
        reorderLevel:      { $ifNull: ['$invRecords.reorderLevel',      10] },
        lastRestockedAt:   '$invRecords.lastRestockedAt',
        updatedAt:         { $ifNull: ['$invRecords.updatedAt', '$updatedAt'] },
        openingStockQty:   '$openingStockQty',
        currentStockQty:   '$currentStockQty',
      },
    },

    // Compute isLowStock: quantityAvailable <= 20% of openingStockQty
    {
      $addFields: {
        isLowStock: {
          $and: [
            { $gt: ['$quantityOnHand', 0] },
            {
              $lte: [
                { $subtract: ['$quantityOnHand', '$quantityAllocated'] },
                { $multiply: ['$openingStockQty', 0.2] },
              ],
            },
          ],
        },
      },
    },

    // ── Full-column search (runs after all joins + virtual fields) ────────────
    ...(query.search ? (() => {
      const re  = new RegExp(query.search, 'i');
      const sl  = query.search.trim().toLowerCase();
      const num = parseFloat(query.search.trim());
      const isNumeric = !isNaN(num) && query.search.trim() !== '';

      const orClauses = [
        // Product / SKU column
        { 'productId.name':        re },
        { 'productId.productCode': re },
        { 'productId.category':    re },
        // Location column
        { 'warehouseId.name':             re },
        { 'warehouseId.code':             re },
        { 'warehouseId.address.city':     re },
        { 'warehouseId.address.state':    re },
      ];

      // Numeric columns (Available, Allocated, Total, Unit Price)
      if (isNumeric) {
        orClauses.push(
          { currentStockQty: num },
          { quantityAllocated: num },
          { quantityOnHand:    num },
          { 'productId.basePrice': num },
        );
      }

      // Stock Status column — match against the derived label strings
      if ('out of stock'.includes(sl))              orClauses.push({ quantityOnHand: { $lte: 0 } });
      if ('low stock'.includes(sl))                 orClauses.push({ isLowStock: true,  quantityOnHand: { $gt: 0 } });
      if ('in stock'.includes(sl) || 'in-stock'.includes(sl))
                                                    orClauses.push({ isLowStock: false, quantityOnHand: { $gt: 0 } });

      // Forecast & Demand column — match against the derived label strings
      if ('replenishment'.includes(sl))             orClauses.push({ quantityOnHand: { $lte: 0 } });
      if ('projected'.includes(sl) || 'spike'.includes(sl))
                                                    orClauses.push({ isLowStock: true,  quantityOnHand: { $gt: 0 } });
      if ('stable'.includes(sl) || 'demand'.includes(sl))
                                                    orClauses.push({ isLowStock: false, quantityOnHand: { $gt: 0 } });

      return [{ $match: { $or: orClauses } }];
    })() : []),

    // Stock status filter (runs after virtual fields are computed)
    ...(query.status === 'low-stock' || query.lowStock === 'true'
      ? [{ $match: { quantityOnHand: { $gt: 0 }, isLowStock: true } }]
      : query.status === 'out-of-stock'
      ? [{ $match: { quantityOnHand: { $not: { $gt: 0 } } } }]
      : query.status === 'high-stock'
      ? [{ $match: { isLowStock: false, quantityOnHand: { $gt: 0 } } }]
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

  // Distribution aggregate: same Product-centric left-join logic as the list endpoint
  // so pie chart matches what the table shows (uses openingStockQty as fallback)
  const distributionAgg = Product.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'productId',
        as: 'invRecords',
      },
    },
    { $unwind: { path: '$invRecords', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        _qoh:       { $ifNull: ['$invRecords.quantityOnHand',    { $ifNull: ['$openingStockQty', 0] }] },
        _qalloc:    { $ifNull: ['$invRecords.quantityAllocated', 0] },
        _threshold: { $multiply: [{ $ifNull: ['$openingStockQty', 0] }, 0.2] },
      },
    },
    {
      $addFields: {
        _qavail: { $subtract: ['$_qoh', '$_qalloc'] },
      },
    },
    {
      $group: {
        _id: null,
        inStock:    { $sum: { $cond: [{ $and: [{ $gt: ['$_qoh', 0] }, { $gt:  ['$_qavail', '$_threshold'] }] }, 1, 0] } },
        lowStock:   { $sum: { $cond: [{ $and: [{ $gt: ['$_qoh', 0] }, { $lte: ['$_qavail', '$_threshold'] }] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$_qoh', 0] }, 1, 0] } },
      },
    },
  ]);

  const [
    totalAgg, totalCatalogSKUs, distResult,
    fastMovingCount, slowMovingCount,
  ] = await Promise.all([
    Inventory.aggregate([{ $group: { _id: null, totalOnHand: { $sum: '$quantityOnHand' }, totalAllocated: { $sum: '$quantityAllocated' } } }]),
    Product.countDocuments({ isActive: true }),
    distributionAgg,
    Inventory.countDocuments({ lastRestockedAt: { $gte: thirtyDaysAgo } }),
    Inventory.countDocuments({ $or: [{ lastRestockedAt: { $lt: ninetyDaysAgo } }, { lastRestockedAt: null }] }),
  ]);

  const totalOnHand    = totalAgg[0]?.totalOnHand    || 0;
  const totalAllocated = totalAgg[0]?.totalAllocated || 0;
  const dist           = distResult[0] || { inStock: 0, lowStock: 0, outOfStock: 0 };

  return {
    totalOnHand,
    totalAllocated,
    totalSKUs:      totalCatalogSKUs,
    lowStockCount:  dist.lowStock,
    outOfStockCount: dist.outOfStock,
    inStockCount:   dist.inStock,
    fastMovingCount,
    slowMovingCount,
    distribution: { inStock: dist.inStock, lowStock: dist.lowStock, outOfStock: dist.outOfStock },
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
