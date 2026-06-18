const Quote  = require('./model/Quote.model');
const Dealer = require('../dealer/model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

const calcTotals = (lineItems = []) => {
  let subtotal = 0, taxAmount = 0;
  const items = lineItems.map((item) => {
    const qty      = Number(item.quantity)  || 0;
    const price    = Number(item.unitPrice) || 0;
    const taxable  = qty * price;
    const tax      = taxable * ((Number(item.taxRate) || 0) / 100);
    const lineTotal = taxable + tax;
    subtotal   += taxable;
    taxAmount  += tax;
    return { ...item, taxAmount: +tax.toFixed(2), lineTotal: +lineTotal.toFixed(2) };
  });
  return {
    items,
    subtotal:    +subtotal.toFixed(2),
    taxAmount:   +taxAmount.toFixed(2),
    totalAmount: +(subtotal + taxAmount).toFixed(2),
  };
};

const getQuotes = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.status)   match.status   = query.status;
  if (query.source === 'dealer') {
    match.source = 'dealer';
  } else if (query.source === 'supplier') {
    // include existing quotes that predate the source field (no source = supplier-created)
    match.$and = [...(match.$and || []), { $or: [{ source: 'supplier' }, { source: { $exists: false } }] }];
  }
  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.search)   match.$or = [
    { quoteNumber: { $regex: query.search, $options: 'i' } },
    { partyName:   { $regex: query.search, $options: 'i' } },
  ];
  const [data, total] = await Promise.all([
    Quote.find(match)
      .populate('dealerId', 'businessName dealerCode')
      .sort({ quoteDate: -1 })
      .skip(skip).limit(limit).lean(),
    Quote.countDocuments(match),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const getQuoteById = async (id) => {
  const quote = await Quote.findById(id)
    .populate('dealerId', 'businessName dealerCode email address phone')
    .lean();
  if (!quote) throw new AppError('Quote not found', 404);
  return quote;
};

const createQuote = async (body, user) => {
  const { lineItems = [], dealerId, ...rest } = body;
  const { items, subtotal, taxAmount, totalAmount } = calcTotals(lineItems);

  let { partyName, partyPhone, partyGST, partyAddress } = rest;
  if (dealerId && !partyName) {
    const dealer = await Dealer.findById(dealerId).lean();
    if (dealer) {
      partyName    = dealer.businessName;
      partyPhone   = dealer.phone;
      partyGST     = dealer.gstin;
      partyAddress = [dealer.address?.street, dealer.address?.city, dealer.address?.state, dealer.address?.pincode]
        .filter(Boolean).join(', ');
    }
  }

  return Quote.create({
    ...rest,
    dealerId,
    lineItems: items,
    subtotal, taxAmount, totalAmount,
    partyName, partyPhone, partyGST, partyAddress,
    createdBy: user?._id,
  });
};

const updateQuote = async (id, body) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new AppError('Quote not found', 404);

  const { lineItems, ...rest } = body;
  if (lineItems) {
    const { items, subtotal, taxAmount, totalAmount } = calcTotals(lineItems);
    quote.lineItems   = items;
    quote.subtotal    = subtotal;
    quote.taxAmount   = taxAmount;
    quote.totalAmount = totalAmount;
  }
  Object.assign(quote, rest);
  await quote.save();
  return quote;
};

const deleteQuote = async (id) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new AppError('Quote not found', 404);
  await quote.deleteOne();
};

module.exports = { getQuotes, getQuoteById, createQuote, updateQuote, deleteQuote };
