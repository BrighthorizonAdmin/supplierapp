const DeliveryChallan = require('./model/DeliveryChallan.model');
const Dealer          = require('../dealer/model/Dealer.model');
const { AppError }    = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

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
  return { items, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2) };
};

const getChallans = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.status)   match.status   = query.status;
  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.search)   match.$or = [
    { challanNumber: { $regex: query.search, $options: 'i' } },
    { partyName:     { $regex: query.search, $options: 'i' } },
  ];

  if (query.dateRange === '365d') {
    const from = new Date();
    from.setDate(from.getDate() - 365);
    match.challanDate = { $gte: from };
  } else if (query.dateRange === '30d') {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    match.challanDate = { $gte: from };
  } else if (query.dateRange === '7d') {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    match.challanDate = { $gte: from };
  } else if (query.from || query.to) {
    match.challanDate = {};
    if (query.from) match.challanDate.$gte = new Date(query.from);
    if (query.to)   match.challanDate.$lte = new Date(query.to);
  }

  const [data, total] = await Promise.all([
    DeliveryChallan.find(match)
      .populate('dealerId', 'businessName dealerCode')
      .sort({ challanDate: -1 })
      .skip(skip).limit(limit).lean(),
    DeliveryChallan.countDocuments(match),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const getChallanById = async (id) => {
  const challan = await DeliveryChallan.findById(id)
    .populate('dealerId', 'businessName dealerCode email address phone gstNumber panNumber')
    .lean();
  if (!challan) throw new AppError('Delivery Challan not found', 404);
  return challan;
};

const createChallan = async (body, user) => {
  const {
    lineItems = [],
    dealerId,
    totalAmount: clientTotal,
    additionalCharges,
    overallDiscount,
    autoRoundOff,
    roundOffAmount,
    ...rest
  } = body;

  const { items, subtotal, taxAmount } = calcTotals(lineItems);

  let { partyName, partyPhone, partyGST, partyAddress } = rest;
  if (dealerId && !partyName) {
    const dealer = await Dealer.findById(dealerId).lean();
    if (dealer) {
      partyName    = dealer.businessName;
      partyPhone   = dealer.phone;
      partyGST     = dealer.gstNumber;
      partyAddress = [dealer.address?.street, dealer.address?.city, dealer.address?.state, dealer.address?.pincode]
        .filter(Boolean).join(', ');
    }
  }

  const totalAmount = clientTotal != null
    ? +Number(clientTotal).toFixed(2)
    : +(subtotal + taxAmount).toFixed(2);

  return DeliveryChallan.create({
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
    partyName, partyPhone, partyGST, partyAddress,
    createdBy: user?._id,
  });
};

const updateChallan = async (id, body) => {
  const challan = await DeliveryChallan.findById(id);
  if (!challan) throw new AppError('Delivery Challan not found', 404);

  const {
    lineItems,
    totalAmount: clientTotal,
    additionalCharges,
    overallDiscount,
    autoRoundOff,
    roundOffAmount,
    ...rest
  } = body;

  if (lineItems) {
    const { items, subtotal, taxAmount } = calcTotals(lineItems);
    challan.lineItems   = items;
    challan.subtotal    = subtotal;
    challan.taxAmount   = taxAmount;
    challan.totalAmount = clientTotal != null
      ? +Number(clientTotal).toFixed(2)
      : +(subtotal + taxAmount).toFixed(2);
  } else if (clientTotal != null) {
    challan.totalAmount = +Number(clientTotal).toFixed(2);
  }

  if (additionalCharges !== undefined) challan.additionalCharges = additionalCharges;
  if (overallDiscount   !== undefined) challan.overallDiscount   = overallDiscount;
  if (autoRoundOff      !== undefined) challan.autoRoundOff      = autoRoundOff;
  if (roundOffAmount    !== undefined) challan.roundOffAmount     = roundOffAmount;

  Object.assign(challan, rest);
  await challan.save();
  return challan;
};

const deleteChallan = async (id) => {
  const challan = await DeliveryChallan.findById(id);
  if (!challan) throw new AppError('Delivery Challan not found', 404);
  await challan.deleteOne();
};

module.exports = { getChallans, getChallanById, createChallan, updateChallan, deleteChallan };
