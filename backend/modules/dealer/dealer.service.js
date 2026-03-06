const Dealer = require('./model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');
const notificationService = require('../notifications/notification.service');
const { emitToRole, emitToAll } = require('../../websocket/socket');
const { DEALER_APPROVED, DEALER_REJECTED, DEALER_SUSPENDED } = require('../../websocket/events');

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
      { dealerCode: { $regex: query.search, $options: 'i' } },
      { gstNumber: { $regex: query.search, $options: 'i' } },
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
  if (dealer.status !== 'pending') throw new AppError(`Dealer is already ${dealer.status}`, 400);

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

  return dealer;
};

const rejectDealer = async (dealerId, reason, userId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);
  if (dealer.status !== 'pending') throw new AppError(`Dealer is already ${dealer.status}`, 400);

  const before = { status: dealer.status };
  dealer.status = 'rejected';
  dealer.kycStatus = 'rejected';
  dealer.rejectionReason = reason;
  await dealer.save();

  await auditService.log('dealer', dealerId, 'reject', userId, { before, after: { status: 'rejected', reason } });
  emitToRole('onboarding-manager', DEALER_REJECTED, { dealerId, reason });
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

  const [dealer, orderCount, paymentTotal, returnCount] = await Promise.all([
    Dealer.findById(dealerId).lean({ virtuals: true }),
    Order.countDocuments({ dealerId, status: { $nin: ['draft', 'cancelled'] } }),
    Payment.aggregate([
      { $match: { dealerId: dealer?._id, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Return.countDocuments({ dealerId }),
  ]);

  if (!dealer) throw new AppError('Dealer not found', 404);

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
};
