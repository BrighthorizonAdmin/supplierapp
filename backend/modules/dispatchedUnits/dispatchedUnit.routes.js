const express = require('express');
const router = express.Router();
const DispatchedUnit = require('./model/DispatchedUnit.model');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth.middleware');
const { success } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');
const { addMonths, isPast } = require('date-fns');

// GET /api/dispatched-units/lookup?serial=SN-XXX
router.get('/lookup', authenticate, asyncHandler(async (req, res) => {
  const serial = (req.query.serial || '').trim().toUpperCase();
  if (!serial) throw new AppError('Serial number is required', 400);

  const unit = await DispatchedUnit.findOne({ serialNumber: serial })
    .populate('productId', 'name category brand sku warrantyPeriod basePrice')
    .populate('dealerId', 'businessName dealerCode phone email address')
    .populate('invoiceId', 'invoiceNumber invoiceDate totalAmount')
    .populate('orderId', 'orderNumber')
    .lean();

  if (!unit) throw new AppError('No product found for this serial number', 404);

  const parseWarrantyMonths = (period = '') => {
    const m = (period || '').toLowerCase().trim().match(/^(\d+)\s*(month|year)/);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return m[2].startsWith('year') ? n * 12 : n;
  };
  const warrantyMonths = unit.warrantyMonths || parseWarrantyMonths(unit.productId?.warrantyPeriod);
  const dispatchedAt = unit.dispatchedAt;
  const warrantyExpiresAt = warrantyMonths > 0 ? addMonths(new Date(dispatchedAt), warrantyMonths) : null;
  const isWarrantyValid = warrantyExpiresAt ? !isPast(warrantyExpiresAt) : false;

  return success(res, {
    ...unit,
    warrantyMonths,
    warrantyExpiresAt,
    isWarrantyValid,
  }, 'Dispatched unit found');
}));

// GET /api/dispatched-units/for-order?orderId=xxx  (fetch serials already assigned to an order)
router.get('/for-order', authenticate, asyncHandler(async (req, res) => {
  const { orderId } = req.query;
  if (!orderId) throw new AppError('orderId is required', 400);
  const units = await DispatchedUnit.find({ orderId, status: 'dispatched' })
    .select('serialNumber productId')
    .sort({ createdAt: 1 })
    .lean();
  return success(res, units, 'Order serial numbers fetched');
}));

// GET /api/dispatched-units/in-stock?productId=xxx  (fetch in-stock serials for a product)
router.get('/in-stock', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.query;
  if (!productId) throw new AppError('productId is required', 400);
  const units = await DispatchedUnit.find({ productId, status: 'in_stock', isDeleted: { $ne: true } })
    .select('serialNumber dispatchedAt')
    .sort({ createdAt: 1 })
    .lean();
  return success(res, units, 'In-stock serial numbers fetched');
}));

router.get('/All-Serials', authenticate, asyncHandler(async (req, res) => {
  const { productId } = req.query;
  if (!productId) throw new AppError('productId is required', 400);
  const units = await DispatchedUnit.find({ productId,isDeleted: { $ne: true } })
    .select('serialNumber createdAt invoiceId invoiceNumber status')
    .populate('invoiceId', 'invoiceNumber')
    .sort({ createdAt: 1 })
    .lean();
  return success(res, units, 'Serial numbers fetched');
}));

// GET /api/dispatched-units?invoiceId=xxx  (list all units for an invoice)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.invoiceId) filter.invoiceId = req.query.invoiceId;
  if (req.query.dealerId)  filter.dealerId  = req.query.dealerId;
  const units = await DispatchedUnit.find(filter)
    .populate('productId', 'name category brand')
    .populate('dealerId', 'businessName dealerCode')
    .sort({ createdAt: -1 })
    .lean();
  return success(res, units, 'Dispatched units fetched');
}));

module.exports = router;
