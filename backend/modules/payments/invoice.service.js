const Invoice = require('./model/Invoice.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

const getInvoices = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.status) match.status = query.status;
  if (query.orderId) match.orderId = query.orderId;
  if (query.overdue === 'true') {
    match.status = { $in: ['issued', 'partial'] };
    match.dueDate = { $lt: new Date() };
  }

  const [data, total] = await Promise.all([
    Invoice.find(match)
      .populate('dealerId', 'businessName dealerCode')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id)
    .populate('dealerId', 'businessName dealerCode email address')
    .populate('orderId', 'orderNumber confirmedAt')
    .lean();
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
};

module.exports = { getInvoices, getInvoiceById };
