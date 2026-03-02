const Product = require('./model/Product.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');

const createProduct = async (data, userId) => {
  const product = await Product.create({ ...data, createdBy: userId });
  await auditService.log('product', product._id, 'create', userId, { after: { name: product.name, productCode: product.productCode } });
  return product;
};

const getProducts = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.isActive !== undefined) match.isActive = query.isActive === 'true';
  if (query.category) match.category = query.category;
  if (query.brand) match.brand = query.brand;
  if (query.search) {
    match.$text = { $search: query.search };
  }

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

  return { data, pagination: buildMeta(total, page, limit) };
};

const getProductById = async (id) => {
  const product = await Product.findById(id).lean();
  if (!product) throw new AppError('Product not found', 404);
  return product;
};

const updateProduct = async (id, updates, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  const before = { name: product.name, basePrice: product.basePrice, isActive: product.isActive };
  Object.assign(product, updates);
  await product.save();

  await auditService.log('product', id, 'update', userId, { before, after: updates });
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
  product.images.push({ fileName: file.filename, filePath: file.path, isPrimary });
  await product.save();
  return product;
};

const getCategories = async () => {
  return Product.distinct('category', { isActive: true });
};

module.exports = { createProduct, getProducts, getProductById, updateProduct, deleteProduct, addProductImage, getCategories };
