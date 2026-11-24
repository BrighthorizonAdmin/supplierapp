const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sanitizeHtml = require('sanitize-html');
const Product = require('./model/Product.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { SERVER_URL, UPLOAD_PATH } = require('../../config/env');
const auditService = require('../audit/audit.service');
const notificationService = require('../notifications/notification.service');
const User = require('../auth/model/User.model');
const { emitToRole } = require('../../websocket/socket');
const { PRODUCT_CREATED, PRODUCT_UPDATED } = require('../../websocket/events');
const logger = require('../../utils/logger');

const productDescriptionOptions = {
  allowedTags: ['b', 'br', 'em', 'i', 'li', 'ol', 'p', 's', 'strong', 'u', 'ul'],
  allowedAttributes: {},
};

const sanitizeProductDescription = (description) => (
  typeof description === 'string'
    ? sanitizeHtml(
      description.replace(
        /&lt;(\/?)(p|ul|ol|li|strong|b|em|i|u|br)\b([\s\S]*?)&gt;/gi,
        '<$1$2$3>'
      ),
      productDescriptionOptions
    )
    : description
);

// Recompute image URLs from the stored path so legacy records use the current server URL.
const resolveImageUrl = (img) => {
  const clean = (img.filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const uploadsIndex = clean.toLowerCase().lastIndexOf('uploads/');
  const relativePath = img.fileName
    ? `uploads/products/${encodeURIComponent(img.fileName)}`
    : uploadsIndex >= 0
      ? clean.slice(uploadsIndex)
      : clean.replace(/^\/+/, '');
  if (!relativePath) return img;

  const urlPath = `/${relativePath}`;
  const baseUrl = SERVER_URL.replace(/\/+$/, '');
  return { ...img, filePath: relativePath, url: baseUrl ? `${baseUrl}${urlPath}` : urlPath };
};

const withResolvedImages = (product) => {
  if (!product) return product;
  return { ...product, images: (product.images || []).map(resolveImageUrl) };
};

const notifyDealersAboutProduct = async (product, action) => {
  try {
    const title = action === 'created' ? 'New product available' : 'Product updated';
    const message = action === 'created'
      ? `${product.name} is now available for dealers.`
      : `${product.name} has been updated.`;

    const event = action === 'created' ? PRODUCT_CREATED : PRODUCT_UPDATED;
    emitToRole('dealer', event, {
      productId: product._id,
      name: product.name,
      productCode: product.productCode,
      category: product.category,
      brand: product.brand,
      basePrice: product.basePrice,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
    });

    const dealerUsers = await User.find({ role: 'dealer', isActive: true }).select('_id').lean();
    await Promise.all(dealerUsers.map(({ _id }) => notificationService.create({
      recipientId: _id,
      title,
      message,
      type: 'info',
      relatedEntity: { entityType: 'Product', entityId: product._id },
      createdBy: product.createdBy || undefined,
    })));

    const dealerApiUrl = process.env.DEALER_API_URL;
    const dealerApiKey = process.env.DEALER_WEBHOOK_SECRET;
    if (dealerApiUrl && dealerApiKey) {
      await axios.post(
        `${dealerApiUrl}/api/notifications/supplier/product-update`,
        {
          productId: product._id,
          productName: product.name,
          action,
          category: product.category,
          brand: product.brand,
          basePrice: product.basePrice,
          isFeatured: product.isFeatured,
          sku: product.sku,
          warrantyPeriod: product.warrantyPeriod || '',
        },
        {
          headers: { 'Content-Type': 'application/json', 'x-api-key': dealerApiKey },
          timeout: 5000,
        }
      ).catch(err => logger.error('[ProductService] Failed to push product notification to dealer backend', err.message));
    }
  } catch (err) {
    logger.error('[ProductService] notifyDealersAboutProduct failed', err);
  }
};

// Case-insensitive, whitespace-trimmed match on product name — blocks adding
// the same product name twice.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const assertUniqueName = async (name, excludeId) => {
  if (typeof name !== 'string' || !name.trim()) return;
  const exists = await Product.exists({
    name: { $regex: `^\\s*${escapeRegex(name.trim())}\\s*$`, $options: 'i' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (exists) throw new AppError('A product with this name already exists', 409);
};

const createProduct = async (data, userId) => {
  await assertUniqueName(data.name);
  // Seed currentStockQty from openingStockQty so live stock starts at the opening value
  const payload = {
    ...data,
    description: sanitizeProductDescription(data.description),
    aboutProduct: sanitizeProductDescription(data.aboutProduct),
    createdBy: userId,
  };
  if (payload.currentStockQty === undefined) {
    payload.currentStockQty = payload.openingStockQty ?? 0;
  }
  const product = await Product.create(payload);
  await auditService.log('product', product._id, 'create', userId, { after: { name: product.name, productCode: product.productCode } });
  await notifyDealersAboutProduct(product, 'created');
  return product;
};

const getProducts = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.isActive !== undefined) match.isActive = query.isActive === 'true';
  if (query.isFeatured !== undefined) match.isFeatured = query.isFeatured === 'true';
  if (query.category) match.category = query.category;
  if (query.brand) match.brand = query.brand;
  if (query.search) match.$text = { $search: query.search };

  const sortOpts = query.search ? { score: { $meta: 'textScore' } } : { createdAt: -1 };

  const [data, total] = await Promise.all([
    Product.find(match, query.search ? { score: { $meta: 'textScore' } } : {})
      .populate('createdBy', 'name')
      .sort(sortOpts)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(match),
  ]);

  return { data: data.map(withResolvedImages), pagination: buildMeta(total, page, limit) };
};

const getFeaturedProducts = async () => {
  const products = await Product.find({ isActive: true, isFeatured: true })
    .select('name description aboutProduct category subCategory brand sku buvvasPrice mrp warrantyPeriod specifications images interfaceGroups tags isActive isFeatured')
    .sort({ updatedAt: -1 })
    .lean();

  return products.map(withResolvedImages);
};

const getProductById = async (id) => {
  const product = await Product.findById(id).lean();
  if (!product) throw new AppError('Product not found', 404);
  return withResolvedImages(product);
};

const updateProduct = async (id, updates, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const before = { name: product.name, basePrice: product.basePrice, isActive: product.isActive };

  // openingStockQty is immutable after creation — strip it from any update payload
  const { openingStockQty: _ignored, ...safeUpdates } = updates;
  if (safeUpdates.description !== undefined) {
    safeUpdates.description = sanitizeProductDescription(safeUpdates.description);
  }
  if (safeUpdates.aboutProduct !== undefined) {
    safeUpdates.aboutProduct = sanitizeProductDescription(safeUpdates.aboutProduct);
  }
  if (typeof safeUpdates.name === 'string'
      && safeUpdates.name.trim().toLowerCase() !== (product.name || '').trim().toLowerCase()) {
    await assertUniqueName(safeUpdates.name, product._id);
  }
  Object.assign(product, safeUpdates);
  await product.save();

  await auditService.log('product', id, 'update', userId, { before, after: safeUpdates });
  await notifyDealersAboutProduct(product, 'updated');
  return product;
};

const deleteProduct = async (id, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  product.isActive = false;
  await product.save();
  await auditService.log('product', id, 'update', userId, { after: { isActive: false } });
};

const addProductImage = async (id, file, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const isPrimary = product.images.length === 0;
  const normalizedPath = `uploads/products/${file.filename}`;
  const baseUrl = SERVER_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/${normalizedPath}`;
  product.images.push({ fileName: file.filename, filePath: normalizedPath, url, isPrimary });

  await product.save();
  return product;
};

// ── Delete a specific image by fileName ──────────────────────────────────────
const deleteProductImage = async (id, fileName, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const imgIndex = product.images.findIndex((img) => img.fileName === fileName);
  if (imgIndex === -1) throw new AppError('Image not found', 404);

  const [removed] = product.images.splice(imgIndex, 1);

  // Delete physical file from disk
  const storedFileName = removed.fileName
    || path.posix.basename((removed.filePath || '').replace(/\\/g, '/'));
  if (storedFileName) {
    const absPath = path.join(UPLOAD_PATH, 'products', storedFileName);
    fs.unlink(absPath, () => {}); // silent — file may already be gone
  }

  // If deleted image was primary, promote the next one
  if (removed.isPrimary && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }

  await product.save();
  await auditService.log('product', id, 'update', userId, { after: { deletedImage: fileName } });
  return product;
};

// ── Set a specific image as primary ─────────────────────────────────────────
const setPrimaryImage = async (id, fileName, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const target = product.images.find((img) => img.fileName === fileName);
  if (!target) throw new AppError('Image not found', 404);

  product.images.forEach((img) => { img.isPrimary = img.fileName === fileName; });

  await product.save();
  await auditService.log('product', id, 'update', userId, { after: { primaryImage: fileName } });
  return product;
};

const getCategories = async () => {
  const Category = require('../categories/model/Category.model');
  const [productCats, categoryCats] = await Promise.all([
    Product.distinct('category', { isActive: true }),
    Category.find({}, 'name').sort({ name: 1 }).lean(),
  ]);
  const nameSet = new Set([...productCats, ...categoryCats.map(c => c.name)]);
  return Array.from(nameSet).sort();
};

module.exports = {
  createProduct, getProducts, getFeaturedProducts, getProductById, updateProduct,
  deleteProduct, addProductImage, deleteProductImage, setPrimaryImage, getCategories,
};