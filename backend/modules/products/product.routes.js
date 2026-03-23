const express = require('express');
const {
  createProduct, getProducts, getProductById, updateProduct,
  deleteProduct, addProductImage, deleteProductImage, setPrimaryImage, getCategories,
} = require('./product.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { uploadProductImage } = require('../../config/multer');

const router = express.Router();

router.use(authenticate);

router.get('/categories',                   authorize('products:read'),  getCategories);
router.get('/',                             authorize('products:read'),  getProducts);
router.post('/',                            authorize('products:write'), createProduct);
router.get('/:id',                          authorize('products:read'),  getProductById);
router.put('/:id',                          authorize('products:write'), updateProduct);
router.delete('/:id',                       authorize('products:write'), deleteProduct);

// Image management
router.post('/:id/images',                          authorize('products:write'), uploadProductImage.single('image'), addProductImage);
router.delete('/:id/images/:fileName',              authorize('products:write'), deleteProductImage);
router.patch('/:id/images/:fileName/primary',       authorize('products:write'), setPrimaryImage);

module.exports = router;