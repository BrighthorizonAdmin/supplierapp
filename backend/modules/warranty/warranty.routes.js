const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const WarrantyRequest = require('./model/WarrantyRequest.model');
const asyncHandler   = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth.middleware');
const { success, paginated } = require('../../utils/response');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { AppError } = require('../../middlewares/error.middleware');
const { emitToAll } = require('../../websocket/socket');
const { WARRANTY_STATUS_UPDATED } = require('../../websocket/events');

async function pushStatusToDealer(dbeClaimId, status, supplierNotes) {
  const DEALER_API_URL = process.env.DEALER_API_URL;
  const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;
  if (!DEALER_API_URL || !WEBHOOK_SECRET || !dbeClaimId) return;
  await axios.patch(
    `${DEALER_API_URL}/api/warranty-claims/supplier-callback/${dbeClaimId}`,
    { status, supplierNotes: supplierNotes || '' },
    { headers: { 'x-webhook-secret': WEBHOOK_SECRET }, timeout: 5000 },
  );
}

// GET /api/warranty-requests
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const match = {};
  if (req.query.status)   match.status   = req.query.status;
  if (req.query.dealerId) match.dealerId = req.query.dealerId;
  if (req.query.search) {
    match.$or = [
      { claimNumber:   { $regex: req.query.search, $options: 'i' } },
      { customerName:  { $regex: req.query.search, $options: 'i' } },
      { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const [data, total] = await Promise.all([
    WarrantyRequest.find(match)
      .populate('dealerId', 'businessName dealerCode phone')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    WarrantyRequest.countDocuments(match),
  ]);
  return paginated(res, data, buildMeta(total, page, limit), 'Warranty requests fetched');
}));

// GET /api/warranty-requests/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const item = await WarrantyRequest.findById(req.params.id)
    .populate('dealerId', 'businessName dealerCode phone email')
    .populate('dbeInvoiceId')
    .lean();
  if (!item) throw new AppError('Warranty request not found', 404);
  return success(res, item, 'Warranty request fetched');
}));

// PATCH /api/warranty-requests/:id/status
router.patch('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const { status, supplierNotes } = req.body;
  const allowed = ['approved', 'rejected', 'repaired', 'replaced'];
  if (!allowed.includes(status)) {
    throw new AppError(`Status must be one of: ${allowed.join(', ')}`, 400);
  }

  const item = await WarrantyRequest.findById(req.params.id);
  if (!item) throw new AppError('Warranty request not found', 404);

  item.status = status;
  if (supplierNotes !== undefined) item.supplierNotes = supplierNotes;
  item.resolvedAt = new Date();
  await item.save();

  // Push status back to D-BE so dealer app reflects the update
  pushStatusToDealer(item.dbeClaimId, status, item.supplierNotes).catch((err) => {
    console.error('[WarrantyRoutes] D-BE status callback failed:', err.message);
  });

  // Emit real-time socket event so supplier dashboard reflects the change instantly
  try {
    emitToAll(WARRANTY_STATUS_UPDATED, {
      claimId: item._id,
      claimNumber: item.claimNumber,
      status,
    });
  } catch { /* non-blocking */ }

  return success(res, item, 'Warranty request status updated');
}));

module.exports = router;
