const Payment = require('./model/Payment.model');
const Invoice = require('./model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const Transaction = require('../finance/model/Transaction.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { withTransaction } = require('../../utils/transaction');
const auditService = require('../audit/audit.service');
const { emitToAll } = require('../../websocket/socket');
const { PAYMENT_CONFIRMED } = require('../../websocket/events');

const createPayment = async (data, userId) => {
  const dealer = await Dealer.findById(data.dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);

  const payment = await Payment.create({ ...data, receivedBy: userId });
  await auditService.log('payment', payment._id, 'create', userId, {
    after: { paymentNumber: payment.paymentNumber, amount: payment.amount },
  });
  return payment;
};

const confirmPayment = async (paymentId, userId) => {
  return withTransaction(async (session) => {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status === 'confirmed') throw new AppError('Payment is already confirmed', 400);
    if (payment.status === 'failed') throw new AppError('Failed payments cannot be confirmed', 400);

    // Validate allocations sum ≤ payment amount
    const allocationTotal = payment.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (allocationTotal > payment.amount + 0.01) {
      throw new AppError(`Allocation total (₹${allocationTotal}) cannot exceed payment amount (₹${payment.amount})`, 400);
    }

    // Apply allocations to invoices
    for (const alloc of payment.allocations) {
      const invoice = await Invoice.findById(alloc.invoiceId).session(session);
      if (!invoice) throw new AppError(`Invoice ${alloc.invoiceId} not found`, 404);
      if (invoice.status === 'cancelled') throw new AppError(`Invoice ${invoice.invoiceNumber} is cancelled`, 400);

      invoice.amountPaid = Math.min(invoice.totalAmount, invoice.amountPaid + alloc.amount);
      invoice.balance = Math.max(0, invoice.totalAmount - invoice.amountPaid);
      invoice.status = invoice.balance === 0 ? 'paid' : 'partial';
      await invoice.save({ session });

      // Reduce dealer creditUsed when invoice is paid
      if (invoice.status === 'paid') {
        await Dealer.findByIdAndUpdate(
          payment.dealerId,
          { $inc: { creditUsed: -invoice.totalAmount } },
          { session }
        );
      }
    }

    payment.status = 'confirmed';
    payment.confirmedBy = userId;
    payment.confirmedAt = new Date();
    await payment.save({ session });

    // Transaction record
    await Transaction.create([{
      type: 'credit',
      dealerId: payment.dealerId,
      amount: payment.amount,
      ref: { refType: 'payment', refId: payment._id },
      description: `Payment ${payment.paymentNumber} confirmed via ${payment.method}`,
      createdBy: userId,
    }], { session });

    await auditService.log('payment', paymentId, 'confirm', userId, {
      before: { status: 'pending' },
      after: { status: 'confirmed' },
    });

    emitToAll(PAYMENT_CONFIRMED, { paymentId, paymentNumber: payment.paymentNumber, amount: payment.amount });
    return payment;
  });
};

const getPayments = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.status) match.status = query.status;
  if (query.method) match.method = query.method;
  if (query.startDate || query.endDate) {
    match.createdAt = {};
    if (query.startDate) match.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) match.createdAt.$lte = new Date(query.endDate);
  }

  const [data, total] = await Promise.all([
    Payment.find(match)
      .populate('dealerId', 'name')
      .populate('receivedBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getPaymentById = async (id) => {
  const payment = await Payment.findById(id)
    .populate('dealerId', 'businessName dealerCode email')
    .populate('receivedBy', 'name email')
    .populate('confirmedBy', 'name email')
    .lean();
  if (!payment) throw new AppError('Payment not found', 404);
  return payment;
};

module.exports = { createPayment, confirmPayment, getPayments, getPaymentById };
