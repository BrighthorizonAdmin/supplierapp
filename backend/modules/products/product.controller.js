const productService = require('./product.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const buildImageUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  const base = (process.env.SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');
  return `${base}/${url}`;
};

const rewriteImages = (product) => {
  if (!product) return product;
  if (product.images) {
    product.images = product.images.map(img => ({ ...img, url: buildImageUrl(img.url) }));
  }
  return product;
};

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.user.id);
  return success(res, product, 'Product created', 201);
});

const getProducts = asyncHandler(async (req, res) => {
  const { data, pagination } = await productService.getProducts(req.query);
  return paginated(res, data.map(rewriteImages), pagination, 'Products fetched');
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  return success(res, rewriteImages(product), 'Product fetched');
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body, req.user.id);
  return success(res, product, 'Product updated');
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id, req.user.id);
  return success(res, null, 'Product deactivated');
});

const addProductImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image uploaded', 400);
  const product = await productService.addProductImage(req.params.id, req.file, req.user.id);
  return success(res, product, 'Image added');
});

const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await productService.deleteProductImage(req.params.id, req.params.fileName, req.user.id);
  return success(res, product, 'Image deleted');
});

const setPrimaryImage = asyncHandler(async (req, res) => {
  const product = await productService.setPrimaryImage(req.params.id, req.params.fileName, req.user.id);
  return success(res, product, 'Primary image updated');
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await productService.getCategories();
  return success(res, categories, 'Categories fetched');
});

module.exports = {
  createProduct, getProducts, getProductById, updateProduct,
  deleteProduct, addProductImage, deleteProductImage, setPrimaryImage, getCategories,
};