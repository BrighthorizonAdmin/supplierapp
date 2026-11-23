const Quote  = require('./model/Quote.model');
const Dealer = require('../dealer/model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { reserveSeq, freeSeq, formatCode, peekSeq } = require('../../utils/numberSequence');
const axios = require('axios');
const User  = require('../auth/model/User.model');
const Role  = require('../roles/role.model');
const { assertItemDiscountsWithinLimits } = require('../../utils/discountLimit');

// Salesman dropdown: active users whose role lets them create/edit invoices
// (invoices:write, invoices:* or *). Super-admin always qualifies.
const getSalesmen = async () => {
  const roles = await Role.find({
    isActive: true,
    permissions: { $in: ['*', 'invoices:*', 'invoices:write'] },
  }).select('name').lean();
  const roleNames = [...new Set(['super-admin', ...roles.map((r) => r.name)])];
  const users = await User.find({ isActive: true, role: { $in: roleNames } })
    .select('name email role')
    .sort({ name: 1 })
    .lean();
  return users.map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role }));
};

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

// ── Quote expiry (supplier-created quotes only) ─────────────────────────────
// A quote is valid through its expiryDate (stored as that day at 00:00 UTC).
// Once the day has passed, Draft/Sent quotes become 'expired'. Accepted /
// Rejected quotes and dealer-app quotes are never touched.
const todayStart = () => {
  const t = new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
};
const isOverdue = (expiryDate) => Boolean(expiryDate) && new Date(expiryDate) < todayStart();
const SUPPLIER_SOURCE = { $or: [{ source: 'supplier' }, { source: { $exists: false } }] };

const expireOverdueQuotes = () =>
  Quote.updateMany(
    { ...SUPPLIER_SOURCE, status: { $in: ['draft', 'sent'] }, expiryDate: { $lt: todayStart() } },
    { $set: { status: 'expired' } }
  ).catch((err) => console.error('[Quote] auto-expire failed:', err.message));

const getQuotes = async (query = {}) => {
  await expireOverdueQuotes();
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
  await expireOverdueQuotes();
  const quote = await Quote.findById(id)
    // state/gstin/gstNumber: decide CGST + SGST vs IGST on the quote
    .populate('dealerId', 'businessName dealerCode email address phone state gstin gstNumber')
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

  await assertItemDiscountsWithinLimits(lineItems, user, dealerId);
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

// Sends a supplier-side edit of a dealer quote (source: 'dealer') back to the
// Dealer app so both copies match. Line discounts are folded into the unit
// price because the dealer quote has no discount fields.
const syncQuoteToDealer = async (quote) => {
  const DEALER_API_URL = process.env.DEALER_API_URL;
  const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;
  if (!DEALER_API_URL || !WEBHOOK_SECRET) throw new Error('DEALER_API_URL / DEALER_WEBHOOK_SECRET not configured');

  const Product = require('../products/model/Product.model');
  const ids = quote.lineItems.map((li) => li.productId).filter(Boolean);
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).select('sku').lean() : [];
  const skuById = Object.fromEntries(products.map((p) => [String(p._id), p.sku || '']));

  let itemsNet = 0, itemsTax = 0;
  const items = quote.lineItems.map((li) => {
    const qty     = Number(li.quantity) || 1;
    const taxable = Math.max(0, qty * (Number(li.unitPrice) || 0) - (Number(li.discountAmount) || 0));
    itemsNet += taxable;
    itemsTax += Number(li.taxAmount) || 0;
    return {
      productId: li.productId ? String(li.productId) : '',
      sku:       li.productId ? skuById[String(li.productId)] || '' : '',
      name:      li.productName,
      hsnCode:   li.hsnCode || '',
      quantity:  qty,
      unitPrice: +(taxable / qty).toFixed(2),
      taxRate:   Number(li.taxRate) || 0,
    };
  });
  const charges   = quote.additionalCharges || [];
  const chargeNet = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const chargeTax = charges.reduce((s, c) => s + (Number(c.taxAmount) || 0), 0);

  await axios.post(`${DEALER_API_URL}/api/dealer-quotes/webhook/supplier-update`, {
    dbeQuoteId:  quote.dbeQuoteId,
    status:      quote.status,
    items,
    additionalCharges: charges.map((c) => ({ label: c.label, amount: c.amount, taxRate: c.taxRate })),
    subtotal:    +(itemsNet + chargeNet).toFixed(2),
    taxAmount:   +(itemsTax + chargeTax).toFixed(2),
    totalAmount: quote.totalAmount,
    quoteDate:   quote.quoteDate,
    expiryDate:  quote.expiryDate || null,
    salesman:    quote.salesman || '',
    notes:       quote.notes || '',
  }, {
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
    timeout: 8000,
  });
};

const updateQuote = async (id, body, user) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new AppError('Quote not found', 404);

  const isDealerQuote = quote.source === 'dealer' && Boolean(quote.dbeQuoteId);
  if (isDealerQuote && quote.status === 'deletedByDealer') {
    throw new AppError('This quote was deleted by the dealer and can no longer be edited', 400);
  }

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

  // ── Expiry rules (supplier quotes only) ──
  //  • past validity date → Draft/Sent stay 'expired'; can't be marked Accepted
  //  • renew: an expired quote saved with a new, valid expiryDate goes back to Draft
  if (quote.source !== 'dealer') {
    const effectiveExpiry = rest.expiryDate !== undefined ? rest.expiryDate : quote.expiryDate;
    const overdue   = isOverdue(effectiveExpiry);
    const requested = rest.status !== undefined ? rest.status : quote.status;
    if (overdue) {
      if (requested === 'accepted' && quote.status !== 'accepted') {
        throw new AppError('This quote has expired. Edit it and set a new validity date to renew it first.', 400);
      }
      if (['draft', 'sent'].includes(requested)) rest.status = 'expired';
    } else if (quote.status === 'expired' && rest.expiryDate !== undefined
               && (rest.status === undefined || rest.status === 'expired')) {
      rest.status = 'draft'; // renewed
    }
  }

  if (lineItems) {
    await assertItemDiscountsWithinLimits(lineItems, user, rest.dealerId || quote.dealerId);
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

  // A dealer quote's customer, dealer link and number belong to the dealer — never changed from here
  if (isDealerQuote) {
    ['dealerId', 'dealerBusinessName', 'partyName', 'partyPhone', 'partyAddress', 'partyGST',
      'quoteNumber', 'source', 'dbeQuoteId', 'bankDetails'].forEach((k) => delete rest[k]);
  }
  Object.assign(quote, rest);
  await quote.save();

  if (isDealerQuote) {
    try {
      await syncQuoteToDealer(quote);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error(`[Quote] dealer sync failed for ${quote.quoteNumber}:`, msg);
      throw new AppError(`Saved here, but the Dealer app could not be updated: ${msg}`, 502);
    }
  }
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

module.exports = { getQuotes, getQuoteById, createQuote, updateQuote, deleteQuote, getNextQuoteNumber, getSalesmen };
