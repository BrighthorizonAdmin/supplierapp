const Quote  = require('./model/Quote.model');
const Dealer = require('../dealer/model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { reserveSeq, freeSeq, formatCode, peekSeq } = require('../../utils/numberSequence');

// Preview only — does NOT reserve/advance the sequence, so opening the New
// Quote form (and navigating away without saving) never burns a number. The
// number is only actually assigned for real when the quote is created (see
// Quote.model.js pre-save hook).
const getNextQuoteNumber = async () => {
  const seq = await peekSeq('supplier-quote');
  return { quoteNumber: formatCode('QTN', seq) };
};

const calcTotals = (lineItems = []) => {
  let subtotal = 0, taxAmount = 0;
  const items = lineItems.map((item) => {
    const qty      = Number(item.quantity)  || 0;
    const price    = Number(item.unitPrice) || 0;
    const base     = qty * price;
    const discAmt  = Number(item.discountAmount) || 0;
    const taxable  = Math.max(0, base - discAmt);
    const tax      = taxable * ((Number(item.taxRate) || 0) / 100);
    const lineTotal = taxable + tax;
    subtotal  += base;
    taxAmount += tax;
    return {
      ...item,
      discountPercent: Number(item.discountPercent) || 0,
      discountAmount:  +discAmt.toFixed(2),
      taxAmount:       +tax.toFixed(2),
      lineTotal:       +lineTotal.toFixed(2),
    };
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
  const {
    lineItems = [],
    dealerId,
    totalAmount: clientTotal,
    additionalCharges,
    overallDiscount,
    autoRoundOff,
    roundOffAmount,
    validForDays,
    ...rest
  } = body;

  const { items, subtotal, taxAmount } = calcTotals(lineItems);

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

  // Trust the client's computed total (includes charges, discounts, round-off)
  const totalAmount = clientTotal != null ? +Number(clientTotal).toFixed(2) : +(subtotal + taxAmount).toFixed(2);

  return Quote.create({
    ...rest,
    dealerId,
    lineItems: items,
    subtotal,
    taxAmount,
    totalAmount,
    additionalCharges: additionalCharges || [],
    overallDiscount:   overallDiscount   || undefined,
    autoRoundOff:      autoRoundOff      || false,
    roundOffAmount:    roundOffAmount     || 0,
    validForDays:      validForDays       || 30,
    partyName, partyPhone, partyGST, partyAddress,
    createdBy: user?._id,
  });
};

const updateQuote = async (id, body) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new AppError('Quote not found', 404);

  const {
    lineItems,
    totalAmount: clientTotal,
    additionalCharges,
    overallDiscount,
    autoRoundOff,
    roundOffAmount,
    validForDays,
    ...rest
  } = body;

  if (lineItems) {
    const { items, subtotal, taxAmount } = calcTotals(lineItems);
    quote.lineItems  = items;
    quote.subtotal   = subtotal;
    quote.taxAmount  = taxAmount;
    quote.totalAmount = clientTotal != null
      ? +Number(clientTotal).toFixed(2)
      : +(subtotal + taxAmount).toFixed(2);
  } else if (clientTotal != null) {
    quote.totalAmount = +Number(clientTotal).toFixed(2);
  }

  if (additionalCharges !== undefined) quote.additionalCharges = additionalCharges;
  if (overallDiscount   !== undefined) quote.overallDiscount   = overallDiscount;
  if (autoRoundOff      !== undefined) quote.autoRoundOff      = autoRoundOff;
  if (roundOffAmount    !== undefined) quote.roundOffAmount     = roundOffAmount;
  if (validForDays      !== undefined) quote.validForDays       = validForDays;

  Object.assign(quote, rest);
  await quote.save();
  return quote;
};

const deleteQuote = async (id) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new AppError('Quote not found', 404);
  await quote.deleteOne();
  if (quote.quoteSeq != null) {
    freeSeq('supplier-quote', quote.quoteSeq).catch(err =>
      console.error('[Quote] failed to free quote number:', err.message)
    );
  }
};

module.exports = { getQuotes, getQuoteById, createQuote, updateQuote, deleteQuote, getNextQuoteNumber };
