const Dealer = require('./model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');
const notificationService = require('../notifications/notification.service');
const { emitToRole, emitToAll } = require('../../websocket/socket');
const { DEALER_APPROVED, DEALER_REJECTED, DEALER_SUSPENDED } = require('../../websocket/events');
const axios = require('axios');

const DEALER_API_URL = process.env.DEALER_API_URL || 'http://localhost:5001';

const syncToDealerApp = async (applicationId, action, payload = {}) => {
  if (!applicationId) return;
  try {
    const body = { action, ...payload };
    console.log('[DealerSync] Sending to D-BE:', JSON.stringify(body));  // ADD THIS
    await axios.patch(
      `${DEALER_API_URL}/api/dealership/supplier/review/${applicationId}`,
      body,
      {
        headers: {
          'x-api-key': process.env.DEALER_WEBHOOK_SECRET,
        },
      }
    );
    console.log(`[DealerSync] Synced ${action} for ${applicationId}`);
  } catch (err) {
    console.error('[DealerSync] Failed:', err.response?.data || err.message);
  }
};

const createDealer = async (data, userId) => {
  const dealer = await Dealer.create({ ...data, onboardedBy: userId });
  await auditService.log('dealer', dealer._id, 'create', userId, { after: dealer.toObject() });
  return dealer;
};

const getDealers = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.status) match.status = query.status;
  if (query.kycStatus) match.kycStatus = query.kycStatus;
  if (query.businessType) match.businessType = query.businessType;
  if (query.pricingTier) match.pricingTier = query.pricingTier;
  if (query.search) {
    match.$or = [
      { businessName: { $regex: query.search, $options: 'i' } },
      { ownerName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
      { dealerCode: { $regex: query.search, $options: 'i' } },
      { gstNumber: { $regex: query.search, $options: 'i' } },
      { 'address.city': { $regex: query.search, $options: 'i' } },
      { 'address.state': { $regex: query.search, $options: 'i' } },
      { 'address.pincode': { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Dealer.find(match)
      .populate('onboardedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Dealer.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getDealerById = async (id) => {
  const dealer = await Dealer.findById(id)
    .populate('onboardedBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .lean({ virtuals: true });
  if (!dealer) throw new AppError('Dealer not found', 404);
  return dealer;
};

const approveDealer = async (dealerId, { creditLimit, pricingTier }, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (!['pending', 'updates-required'].includes(dealer.status)) throw new AppError(`Cannot approve dealer with status: ${dealer.status}`, 400);

  const before = { status: dealer.status, creditLimit: dealer.creditLimit, pricingTier: dealer.pricingTier };

  dealer.status = 'active';
  dealer.kycStatus = 'verified';
  dealer.creditLimit = creditLimit || 0;
  dealer.pricingTier = pricingTier || 'standard';
  dealer.approvedBy = userId;
  dealer.approvedAt = new Date();

  await dealer.save();

  await auditService.log('dealer', dealerId, 'approve', userId, {
    before,
    after: { status: dealer.status, creditLimit: dealer.creditLimit, pricingTier: dealer.pricingTier },
  });

  emitToRole('admin', DEALER_APPROVED, { dealerId, dealerCode: dealer.dealerCode, businessName: dealer.businessName });
  emitToAll(DEALER_APPROVED, { dealerId, businessName: dealer.businessName });

  await syncToDealerApp(dealer.applicationId, 'APPROVE');

  return dealer;
};

const rejectDealer = async (dealerId, reason, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (!['pending', 'updates-required'].includes(dealer.status)) throw new AppError(`Cannot reject dealer with status: ${dealer.status}`, 400);

  const before = { status: dealer.status };
  dealer.status = 'rejected';
  dealer.kycStatus = 'rejected';
  dealer.rejectionReason = reason;
  await dealer.save();

  await auditService.log('dealer', dealerId, 'reject', userId, { before, after: { status: 'rejected', reason } });
  emitToRole('onboarding-manager', DEALER_REJECTED, { dealerId, reason });

  await syncToDealerApp(dealer.applicationId, 'REJECT', { 
    supplierFeedback: reason,
    rejectionReasons: [reason],
  });

  return dealer;
};

const requestUpdate = async (dealerId, { field, instructions }, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (!['pending', 'updates-required'].includes(dealer.status)) throw new AppError('Can only request update on a pending or updates-required application', 400);

  const before = { status: dealer.status };
  dealer.status = 'updates-required';
  dealer.notes = `[Update Requested] ${field}: ${instructions}`;
  await dealer.save();

  await auditService.log('dealer', dealerId, 'request_update', userId, {
    before,
    after: { status: 'updates-required', field, instructions },
  });

  await syncToDealerApp(dealer.applicationId, 'REQUEST_UPDATE', {
    supplierFeedback: instructions,
    updateFields: [field],
  });

  return dealer;
};

const suspendDealer = async (dealerId, reason, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (dealer.status === 'suspended') throw new AppError('Dealer is already suspended', 400);

  const before = { status: dealer.status };
  dealer.status = 'suspended';
  dealer.suspensionReason = reason;
  await dealer.save();

  await auditService.log('dealer', dealerId, 'suspend', userId, { before, after: { status: 'suspended', reason } });
  emitToAll(DEALER_SUSPENDED, { dealerId, reason });
  return dealer;
};

const reactivateDealer = async (dealerId, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (dealer.status !== 'suspended') throw new AppError('Dealer is not suspended', 400);

  const before = { status: dealer.status };
  dealer.status = 'active';
  dealer.suspensionReason = undefined;
  await dealer.save();

  await auditService.log('dealer', dealerId, 'update', userId, { before, after: { status: 'active' } });
  return dealer;
};

const updateDealer = async (dealerId, updates, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);

  const before = dealer.toObject();
  Object.assign(dealer, updates);
  await dealer.save();

  await auditService.log('dealer', dealerId, 'update', userId, { before, after: dealer.toObject() });
  return dealer;
};

const getDealerStats = async (dealerId) => {
  const Order = require('../orders/model/Order.model');
  const Payment = require('../payments/model/Payment.model');
  const Return = require('../returns/model/Return.model');

  // fetch dealer first so we can reference its _id safely
  const dealer = await Dealer.findById(dealerId).lean({ virtuals: true });
  if (!dealer) throw new AppError('Dealer not found', 404);

  // other counts/aggregates can run in parallel now that we have dealer
  const [orderCount, paymentTotal, returnCount] = await Promise.all([
    Order.countDocuments({ dealerId, status: { $nin: ['draft', 'cancelled'] } }),
    Payment.aggregate([
      { $match: { dealerId: dealer._id, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Return.countDocuments({ dealerId }),
  ]);

  return {
    dealer,
    stats: {
      totalOrders: orderCount,
      totalPayments: paymentTotal[0]?.total || 0,
      totalReturns: returnCount,
      availableCredit: dealer.availableCredit,
    },
  };
};

module.exports = {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
  requestUpdate,
};
