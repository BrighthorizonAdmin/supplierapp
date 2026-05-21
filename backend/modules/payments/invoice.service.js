const Invoice = require('./model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const Product = require('../products/model/Product.model');
const DispatchedUnit = require('../dispatchedUnits/model/DispatchedUnit.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

// ── helpers ──────────────────────────────────────────────
const calcTotals = (lineItems = [], invoiceDiscount = 0, additionalCharges = 0, roundOff = false) => {
  const discount = Number(invoiceDiscount) || 0;
  const addl = Number(additionalCharges) || 0;
  let subtotal = 0, taxAmount = 0;

  const items = lineItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const base = qty * price;
    // Support both % and ₹ discount types from frontend
    const discType = item.discountType || '%';
    const discVal = Number(item.discountValue ?? item.discount) || 0;
    const discAmt = discType === '₹'
      ? Math.min(Math.max(discVal, 0), base)
      : base * (Math.min(Math.max(discVal, 0), 100) / 100);
    const taxable = Math.max(0, base - discAmt);
    const tax = taxable * ((Number(item.taxRate) || 0) / 100);
    const lineTotal = taxable + tax;
    subtotal += taxable;
    taxAmount += tax;
    return {
      ...item,
      discount: discType === '%' ? discVal : 0,   // keep legacy % field
      discountType: discType,
      discountValue: discVal,
      taxAmount: +tax.toFixed(2),
      lineTotal: +lineTotal.toFixed(2),
    };
  });

  const discountAmt = +discount.toFixed(2);
  let totalAmount = +(subtotal + taxAmount + addl - discountAmt).toFixed(2);
  let roundOffAmt = 0;
  if (roundOff) {
    roundOffAmt = +(Math.round(totalAmount) - totalAmount).toFixed(2);
    totalAmount = Math.round(totalAmount);
  }
  return { items, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), discountAmt, totalAmount, roundOffAmt };
};

// ── Serial uniqueness helper ──────────────────────────────────
// Validates:
//   1. No duplicates within the current batch (across all line items)
//   2. No serial already recorded in DispatchedUnit for a different invoice
const checkSerialUniqueness = async (allSerials, currentInvoiceId = null) => {
  if (!allSerials.length) return;

  // Within-batch duplicates
  const seen = new Set();
  const dupes = [];
  for (const sn of allSerials) {
    if (seen.has(sn)) dupes.push(sn);
    seen.add(sn);
  }
  if (dupes.length) {
    throw new AppError(
      `Duplicate serial number(s) in this invoice: ${dupes.join(', ')}`,
      400
    );
  }

  // Already used in DB — exclude current invoice so re-saves are allowed
  const filter = { serialNumber: { $in: allSerials } };
  if (currentInvoiceId) filter.invoiceId = { $ne: currentInvoiceId };
  const existing = await DispatchedUnit.find(filter).select('serialNumber invoiceNumber').lean();
  if (existing.length) {
    const details = existing
      .map(u => `${u.serialNumber} (Invoice: ${u.invoiceNumber || u.invoiceId})`)
      .join(', ');
    throw new AppError(
      `Serial number(s) already used in a previous invoice: ${details}`,
      400
    );
  }
};

// ── CRUD ─────────────────────────────────────────────────
const getInvoices = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.status) match.status = query.status;
  if (query.invoiceType) match.invoiceType = query.invoiceType;
  if (query.search) match.invoiceNumber = { $regex: query.search, $options: 'i' };
  if (query.overdue === 'true') {
    match.status = { $in: ['issued', 'partial'] };
    match.dueDate = { $lt: new Date() };
  }
  match.invoiceType = match.invoiceType || { $in: ['b2b', 'retail'] };
  // Exclude D-BE-created invoices (dealer app creates invoices for net-30 orders in the same
  // collection but without lineItems / totalAmount). Only show supplier-app invoices.
  match.lineItems = { $exists: true };
  const [data, total] = await Promise.all([
    Invoice.find(match)
      .populate('dealerId', 'businessName dealerCode')
      .populate('orderId', 'orderNumber')
      .sort({ invoiceDate: -1 })
      .skip(skip).limit(limit).lean(),
    Invoice.countDocuments(match),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const getInvoiceById = async (id) => {
  const inv = await Invoice.findById(id)
    .populate('dealerId', 'businessName dealerCode email address phone gstin')
    .populate('orderId', 'orderNumber confirmedAt')
    .lean();
  if (!inv) throw new AppError('Invoice not found', 404);
  return inv;
};

const createInvoice = async (body, user) => {
  const {
    lineItems = [], invoiceDiscount = 0,
    additionalCharges = 0, additionalLabel,
    roundOff = false,
    dealerId,
    bankDetails, paymentMode, paymentReceivedIn,
    shippingAddress,
    invoicePrefix, invoiceSequence,
    ...rest
  } = body;

  // Validate serial numbers: count match + uniqueness
  const allSerials = [];
  for (const item of lineItems) {
    if (!item.serialNumbers || item.serialNumbers.length === 0) continue;
    const qty = Number(item.quantity) || 0;
    const cleaned = item.serialNumbers.map(s => s.trim().toUpperCase()).filter(Boolean);
    if (cleaned.length !== qty) {
      throw new AppError(
        `"${item.productName || 'Item'}" requires ${qty} serial number(s), but ${cleaned.length} provided`,
        400
      );
    }
    item.serialNumbers = cleaned;
    allSerials.push(...cleaned);
  }
  await checkSerialUniqueness(allSerials);

  const { items, subtotal, taxAmount, discountAmt, totalAmount, roundOffAmt } =
    calcTotals(lineItems, Number(invoiceDiscount) || 0, Number(additionalCharges) || 0, roundOff);

  // Snapshot dealer info
  let partyName = rest.partyName, partyAddress = rest.partyAddress,
    partyGST = rest.partyGST, partyPhone = rest.partyPhone;
  if (dealerId && !partyName) {
    const dealer = await Dealer.findById(dealerId).lean();
    if (dealer) {
      partyName = dealer.businessName;
      partyPhone = dealer.phone;
      partyGST = dealer.gstin;
      partyAddress = [dealer.address?.street, dealer.address?.city, dealer.address?.state, dealer.address?.pincode]
        .filter(Boolean).join(', ');
    }
  }

  const invoice = await Invoice.create({
    ...rest,
    dealerId,
    lineItems: items,
    subtotal, taxAmount, discountAmt, totalAmount, roundOffAmt,
    partyName, partyAddress, partyGST, partyPhone,
    additionalCharges: Number(additionalCharges) || 0,
    additionalLabel: additionalLabel || 'Additional Charges',
    roundOff,
    bankDetails: bankDetails || undefined,
    paymentMode: paymentMode || 'Cash',
    paymentReceivedIn: paymentReceivedIn || undefined,
    shippingAddress: shippingAddress || undefined,
    invoicePrefix: invoicePrefix || undefined,
    invoiceSequence: invoiceSequence || undefined,
  });

  if (dealerId && bankDetails && Object.keys(bankDetails).length > 0) {
    await Dealer.findByIdAndUpdate(dealerId, { bankDetails });
  }

  // Create one DispatchedUnit record per serial number entered
  const dispatchedUnits = [];
  for (const item of lineItems) {
    if (!item.serialNumbers || item.serialNumbers.length === 0) continue;
    const product = item.productId
      ? await Product.findById(item.productId).select('warrantyMonths').lean()
      : null;
    const warrantyMonths = product?.warrantyMonths || 0;
    for (const serial of item.serialNumbers) {
      const sn = serial.trim().toUpperCase();
      if (!sn) continue;
      dispatchedUnits.push({
        serialNumber:   sn,
        productId:      item.productId || undefined,
        productName:    item.productName || '',
        warrantyMonths,
        invoiceId:      invoice._id,
        invoiceNumber:  invoice.invoiceNumber,
        orderId:        rest.orderId || undefined,
        dealerId:       dealerId || undefined,
        dispatchedAt:   invoice.invoiceDate || new Date(),
      });
    }
  }
  if (dispatchedUnits.length > 0) {
    await DispatchedUnit.insertMany(dispatchedUnits, { ordered: false });
  }

  return invoice;
};

const updateInvoice = async (id, body) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'cancelled') throw new AppError('Cannot edit a cancelled invoice', 400);

  const {
    lineItems, invoiceDiscount,
    additionalCharges, additionalLabel,
    roundOff,
    bankDetails, paymentMode, paymentReceivedIn,
    shippingAddress,
    invoicePrefix, invoiceSequence,
    ...rest
  } = body;

  if (lineItems) {
    const addl = Number(additionalCharges ?? invoice.additionalCharges) || 0;
    const ro = roundOff !== undefined ? roundOff : invoice.roundOff;
    const { items, subtotal, taxAmount, discountAmt, totalAmount, roundOffAmt } =
      calcTotals(lineItems, Number(invoiceDiscount ?? invoice.discountAmt) || 0, addl, ro);
    invoice.lineItems = items;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.discountAmt = discountAmt;
    invoice.totalAmount = totalAmount;
    invoice.roundOffAmt = roundOffAmt;
    invoice.additionalCharges = addl;
    if (additionalLabel !== undefined) invoice.additionalLabel = additionalLabel;
    invoice.roundOff = ro;
  }

  // Persist new fields
  if (bankDetails !== undefined) invoice.bankDetails = bankDetails;
  if (paymentMode !== undefined) invoice.paymentMode = paymentMode;
  if (paymentReceivedIn !== undefined) invoice.paymentReceivedIn = paymentReceivedIn;
  if (shippingAddress !== undefined) invoice.shippingAddress = shippingAddress;
  if (invoicePrefix !== undefined) invoice.invoicePrefix = invoicePrefix;
  if (invoiceSequence !== undefined) invoice.invoiceSequence = invoiceSequence;

  Object.assign(invoice, rest);
  await invoice.save();
  return invoice;
};

const issueInvoice = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status !== 'draft') throw new AppError('Only draft invoices can be issued', 400);
  invoice.status = 'issued';
  invoice.issuedAt = new Date();
  await invoice.save();
  return invoice;
};

const cancelInvoice = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (['paid', 'cancelled'].includes(invoice.status)) throw new AppError('Cannot cancel this invoice', 400);
  invoice.status = 'cancelled';
  invoice.cancelledAt = new Date();
  await invoice.save();
  return invoice;
};

const deleteInvoice = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status !== 'draft') throw new AppError('Only draft invoices can be deleted', 400);
  await invoice.deleteOne();
};

// Save serial numbers for line items of an auto-generated invoice
// lineSerials = [{ index: 0, serialNumbers: ['SN-001', 'SN-002'] }, ...]
const saveSerialNumbers = async (id, lineSerials) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'cancelled') throw new AppError('Cannot update a cancelled invoice', 400);

  // Validate count per entry and collect all serials for uniqueness check
  const allSerials = [];
  for (const entry of lineSerials) {
    const item = invoice.lineItems[entry.index];
    if (!item) throw new AppError(`Line item at index ${entry.index} not found`, 400);
    const serials = (entry.serialNumbers || []).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (serials.length !== item.quantity) {
      throw new AppError(
        `"${item.productName}" requires ${item.quantity} serial(s), got ${serials.length}`,
        400
      );
    }
    entry._resolved = serials;
    allSerials.push(...serials);
  }
  // Uniqueness: within-batch + DB (exclude this invoice so re-saves are allowed)
  await checkSerialUniqueness(allSerials, invoice._id);

  // Write serials onto the invoice line items
  for (const entry of lineSerials) {
    invoice.lineItems[entry.index].serialNumbers = entry._resolved;
  }
  invoice.markModified('lineItems');
  await invoice.save();

  // Create DispatchedUnit records (skip any serial that already exists)
  const dispatchedUnits = [];
  for (const entry of lineSerials) {
    const item = invoice.lineItems[entry.index];
    const product = item.productId
      ? await Product.findById(item.productId).select('warrantyMonths').lean()
      : null;
    const warrantyMonths = product?.warrantyMonths || 0;
    for (const sn of entry._resolved) {
      dispatchedUnits.push({
        serialNumber:  sn,
        productId:     item.productId || undefined,
        productName:   item.productName || '',
        warrantyMonths,
        invoiceId:     invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        orderId:       invoice.orderId || undefined,
        dealerId:      invoice.dealerId || undefined,
        dispatchedAt:  invoice.invoiceDate || new Date(),
      });
    }
  }
  if (dispatchedUnits.length > 0) {
    // ordered:false — skip duplicates instead of aborting the whole batch
    await DispatchedUnit.insertMany(dispatchedUnits, { ordered: false }).catch(() => {});
  }

  return invoice;
};

module.exports = { getInvoices, getInvoiceById, createInvoice, updateInvoice, issueInvoice, cancelInvoice, deleteInvoice, saveSerialNumbers };