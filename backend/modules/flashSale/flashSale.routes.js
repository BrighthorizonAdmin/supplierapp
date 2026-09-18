const express = require('express');
const {
  createFlashSale, getFlashSales, getFlashSaleById, updateFlashSale, deleteFlashSale, getActiveFlashSale,
} = require('./flashSale.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/active',   authorize('flashsale:read'),  getActiveFlashSale);
router.get('/',          authorize('flashsale:read'),  getFlashSales);
router.post('/',         authorize('flashsale:write'), createFlashSale);
router.get('/:id',       authorize('flashsale:read'),  getFlashSaleById);
router.put('/:id',       authorize('flashsale:write'), updateFlashSale);
router.delete('/:id',    authorize('flashsale:write'), deleteFlashSale);

module.exports = router;
