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
