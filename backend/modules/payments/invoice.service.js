const mongoose = require('mongoose');
const Invoice = require('./model/Invoice.model');
const Dealer = require('../dealer/model/Dealer.model');
const Product = require('../products/model/Product.model');
const DispatchedUnit = require('../dispatchedUnits/model/DispatchedUnit.model');
const Order = require('../orders/model/Order.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

// Converts "12 months" / "1 year" / "2 years" → number of months
const parseWarrantyMonths = (period = '') => {
  if (!period) return 0;
  const m = period.toLowerCase().trim().match(/^(\d+)\s*(month|year)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2].startsWith('year') ? n * 12 : n;
};

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

// The form always posts status 'issued' — derive the real payment status from
// the amounts (drafts and cancelled invoices keep their status).
const applyPaymentStatus = (invoice) => {
  if (['draft', 'cancelled'].includes(invoice.status)) return;
  const total = Number(invoice.totalAmount) || 0;
  invoice.amountPaid = Math.min(Math.max(Number(invoice.amountPaid) || 0, 0), total);
  if (total > 0 && invoice.amountPaid >= total - 0.01) invoice.status = 'paid';
  else if (invoice.amountPaid > 0) invoice.status = 'partial';
  else if (invoice.status !== 'overdue') invoice.status = 'issued';
};

// When an order's invoice is fully paid, reflect it on the order so the order
// page / ledger don't keep showing the payment as pending.
const syncOrderPaymentStatus = async (invoice) => {
  if (!invoice.orderId || invoice.status !== 'paid') return;
  await Order.updateOne(
    { _id: invoice.orderId, paymentStatus: { $nin: ['completed', 'paid'] } },
    { $set: { paymentStatus: 'completed' } }
  );
};

// Assigns serials to an invoice. Upsert, not insert: a serial already registered
// as in_stock has a record, and inserting a second one breaks the unique index.
const lockSerials = (units) => DispatchedUnit.bulkWrite(units.map((du) => ({
  updateOne: {
    filter: { serialNumber: du.serialNumber },
    update: { $set: { ...du, status: 'dispatched' } },
    upsert: true,
  },
})));

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
  // Also exclude in_stock records (pre-registered stock serials not yet dispatched)
  const filter = { serialNumber: { $in: allSerials }, status: { $ne: 'in_stock' } };
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
  if (query.search) {
    // Matches invoice #, customer (partyName / retail "notes" snapshot) or dealer business name
    const term = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = { $regex: term, $options: 'i' };
    const dealerIds = await Dealer.find({ businessName: re }).distinct('_id');
    match.$and = [{ $or: [
      { invoiceNumber: re }, { partyName: re }, { notes: re }, { dealerId: { $in: dealerIds } },
    ] }];
  }
  if (query.customerName) {
    // partyName covers B2B dealer / B2C customer; notes covers the retail
    // "Retail sale to: Name | Phone" snapshot format — search both.
    const re = { $regex: query.customerName, $options: 'i' };
    match.$or = [{ partyName: re }, { notes: re }];
  }
  if (query.dateFrom || query.dateTo) {
    match.invoiceDate = {};
    if (query.dateFrom) match.invoiceDate.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) match.invoiceDate.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  }
  if (query.overdue === 'true') {
    match.status = { $in: ['issued', 'partial'] };
    match.dueDate = { $lt: new Date() };
  }
  match.invoiceType = match.invoiceType || { $in: ['b2b', 'retail', 'b2c'] };
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
    // city/state/pinCode/gstNumber: dealer-app dealers keep their address as flat
    // top-level fields (shared `dealers` collection), not the nested address object
    .populate('dealerId', 'businessName dealerCode email address city state pinCode pincode phone gstin gstNumber')
    .populate('orderId', 'orderNumber confirmedAt deliveryAddress dbeOrderId')
    .lean();
  if (!inv) throw new AppError('Invoice not found', 404);

  // SHIP TO for invoices created before the order's delivery address was copied in:
  // take it from the order, or — for dealer-app orders whose supplier copy never
  // stored it — from the dealer-app order itself (same shared `orders` collection).
  if (!inv.shippingAddress?.street && !inv.shippingAddress?.city && inv.orderId && typeof inv.orderId === 'object') {
    let a = inv.orderId.deliveryAddress;
    if (!(a?.fullAddress || a?.city) && inv.orderId.dbeOrderId && mongoose.isValidObjectId(inv.orderId.dbeOrderId)) {
      const dbeOrder = await mongoose.connection.collection('orders').findOne(
        { _id: new mongoose.Types.ObjectId(String(inv.orderId.dbeOrderId)) },
        { projection: { deliveryAddress: 1 } }
      );
      a = dbeOrder?.deliveryAddress;
    }
    if (a?.fullAddress || a?.street || a?.city) {
      inv.shippingAddress = {
        label: a.label || '', street: a.fullAddress || a.street || '', city: a.city || '',
        state: a.state || '', pincode: a.postalCode || a.pincode || '',
      };
    }
  }

  // For invoices saved before warrantyPeriod field existed, derive it live from the product
  if (!inv.warrantyPeriod) {
    const productId = inv.lineItems?.find(li => li.productId)?.productId;
    if (productId) {
      const product = await Product.findById(productId).select('warrantyPeriod').lean();
      if (product?.warrantyPeriod) inv.warrantyPeriod = product.warrantyPeriod;
    }
  }

  // Backfill hsnCode for line items where it was not captured at invoice creation.
  // Falls back to the product's category HSN when the product's own hsnCode is empty.
  const missingHsn = (inv.lineItems || []).filter(li => !li.hsnCode && li.productId);
  if (missingHsn.length > 0) {
    const Category = require('../categories/model/Category.model');
    const productIds = [...new Set(missingHsn.map(li => li.productId.toString()))];
    const products = await Product.find({ _id: { $in: productIds } }).select('hsnCode category').lean();

    // For products still missing hsnCode, resolve via their category
    const noHsnProducts = products.filter(p => !p.hsnCode && p.category);
    if (noHsnProducts.length > 0) {
      const categoryNames = [...new Set(noHsnProducts.map(p => p.category))];
      const categories = await Category.find({ name: { $in: categoryNames } }).select('name hsnCode').lean();
      const catHsnMap = {};
      categories.forEach(c => { catHsnMap[c.name] = c.hsnCode || ''; });
      products.forEach(p => { if (!p.hsnCode && p.category) p.hsnCode = catHsnMap[p.category] || ''; });
    }

    const hsnMap = {};
    products.forEach(p => { hsnMap[p._id.toString()] = p.hsnCode || ''; });
    inv.lineItems = inv.lineItems.map(li => ({
      ...li,
      hsnCode: li.hsnCode || hsnMap[li.productId?.toString()] || '',
    }));
  }

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

  // One invoice per order — an order's invoice must be edited, not duplicated
  if (rest.orderId) {
    const order = await Order.findById(rest.orderId).select('invoiceId orderNumber').lean();
    if (!order) throw new AppError('Linked order not found', 404);
    const existing = await Invoice.findOne({
      $or: [{ _id: order.invoiceId }, { orderId: order._id }],
      status: { $ne: 'cancelled' },
    }).select('invoiceNumber').lean();
    if (existing) {
      throw new AppError(`Order ${order.orderNumber} already has invoice ${existing.invoiceNumber} — edit that invoice instead`, 409);
    }
  }

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

  // Auto-derive warrantyPeriod from the first product if not supplied
  if (!rest.warrantyPeriod) {
    const firstProductId = lineItems.find(li => li.productId)?.productId;
    if (firstProductId) {
      const prod = await Product.findById(firstProductId).select('warrantyPeriod').lean();
      if (prod?.warrantyPeriod) rest.warrantyPeriod = prod.warrantyPeriod;
    }
  }

  const invoice = new Invoice({
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
  applyPaymentStatus(invoice);
  await invoice.save();

  if (invoice.orderId) {
    await Order.updateOne({ _id: invoice.orderId }, { $set: { invoiceId: invoice._id } });
    await syncOrderPaymentStatus(invoice);
  }

  if (dealerId && bankDetails && Object.keys(bankDetails).length > 0) {
    await Dealer.findByIdAndUpdate(dealerId, { bankDetails });
  }

  // Create one DispatchedUnit record per serial number entered
  const dispatchedUnits = [];
  for (const item of lineItems) {
    if (!item.serialNumbers || item.serialNumbers.length === 0) continue;
    const product = item.productId
      ? await Product.findById(item.productId).select('warrantyPeriod').lean()
      : null;
    const warrantyMonths = parseWarrantyMonths(product?.warrantyPeriod);
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
    await lockSerials(dispatchedUnits);
  }

  return invoice;
};

const updateInvoice = async (id, body, user) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'cancelled') throw new AppError('Cannot edit a cancelled invoice', 400);

  // Generated invoices can only be edited by Super Admin; drafts stay open
  const isSuperAdmin = [].concat(user?.role || []).includes('super-admin');
  if (invoice.status !== 'draft' && !isSuperAdmin) {
    throw new AppError('Only Super Admin can edit a generated invoice', 403);
  }

  // Invoice date can only be changed by Super Admin (sending the same date is fine)
  if (body.invoiceDate !== undefined) {
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    if (!isSuperAdmin && day(body.invoiceDate) !== day(invoice.invoiceDate)) {
      throw new AppError('Only Super Admin can change the invoice date', 403);
    }
  }

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
    // Compute serial number diff so DispatchedUnit stays in sync with the invoice
    const oldSerials = [];
    for (const li of invoice.lineItems) {
      if (li.serialNumbers?.length) oldSerials.push(...li.serialNumbers.map(s => s.toUpperCase()));
    }
    const newSerials = [];
    for (const li of lineItems) {
      if (li.serialNumbers?.length)
        newSerials.push(...li.serialNumbers.map(s => s.trim().toUpperCase()).filter(Boolean));
    }
    const oldSet      = new Set(oldSerials);
    const newSet      = new Set(newSerials);
    const removed     = [...oldSet].filter(s => !newSet.has(s));
    const added       = [...newSet].filter(s => !oldSet.has(s));

    // Reject new serials already dispatched in OTHER invoices
    await checkSerialUniqueness(added, invoice._id);

    // Remove stale DispatchedUnit records
    if (removed.length > 0)
      await DispatchedUnit.deleteMany({ serialNumber: { $in: removed }, invoiceId: invoice._id });

    // Create DispatchedUnit records for newly added serials
    if (added.length > 0) {
      const units = [];
      for (const li of lineItems) {
        if (!li.serialNumbers?.length) continue;
        const cleaned = li.serialNumbers.map(s => s.trim().toUpperCase()).filter(Boolean);
        const newForItem = cleaned.filter(s => added.includes(s));
        if (!newForItem.length) continue;
        const product = li.productId
          ? await Product.findById(li.productId).select('warrantyPeriod').lean()
          : null;
        for (const sn of newForItem) {
          units.push({
            serialNumber:  sn,
            productId:     li.productId || undefined,
            productName:   li.productName || '',
            warrantyMonths: parseWarrantyMonths(product?.warrantyPeriod),
            invoiceId:     invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            dealerId:      invoice.dealerId || undefined,
            dispatchedAt:  invoice.invoiceDate || new Date(),
          });
        }
      }
      if (units.length > 0)
        await lockSerials(units);
    }

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
  applyPaymentStatus(invoice);
  await invoice.save();
  await syncOrderPaymentStatus(invoice);
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

  // Compute diff so DispatchedUnit stays in sync (same pattern as updateInvoice)
  const oldSerials = [];
  for (const li of invoice.lineItems) {
    if (li.serialNumbers?.length) oldSerials.push(...li.serialNumbers.map(s => s.toUpperCase()));
  }
  const newSet = new Set(allSerials); // already uppercased above
  const oldSet = new Set(oldSerials);
  const removed = [...oldSet].filter(s => !newSet.has(s));
  const added   = [...newSet].filter(s => !oldSet.has(s));

  // Write serials onto the invoice line items
  for (const entry of lineSerials) {
    invoice.lineItems[entry.index].serialNumbers = entry._resolved;
  }
  invoice.markModified('lineItems');
  await invoice.save();

  // Remove stale DispatchedUnit records for serials no longer in this invoice
  if (removed.length > 0)
    await DispatchedUnit.deleteMany({ serialNumber: { $in: removed }, invoiceId: invoice._id });

  // Create DispatchedUnit records only for newly added serials
  const dispatchedUnits = [];
  for (const entry of lineSerials) {
    const newForEntry = entry._resolved.filter(s => added.includes(s));
    if (!newForEntry.length) continue;
    const item = invoice.lineItems[entry.index];
    const product = item.productId
      ? await Product.findById(item.productId).select('warrantyPeriod').lean()
      : null;
    const warrantyMonths = parseWarrantyMonths(product?.warrantyPeriod);
    for (const sn of newForEntry) {
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
    const ops = dispatchedUnits.map((du) => ({
      updateOne: {
        filter: { serialNumber: du.serialNumber },
        update: { $set: { ...du, status: 'dispatched' } },
        upsert: true,
      },
    }));
    await DispatchedUnit.bulkWrite(ops);
  }

  return invoice;
};

// ── Higher-role edit / delete of generated invoices ─────────────────────────
// Separate from updateInvoice/deleteInvoice so existing flows are unchanged.
// Serial rules: a serial taken off the invoice goes back to in_stock (listed
// as available again); a newly assigned serial is locked (dispatched) to it.
// Product stock is restored only when the linked order actually deducted it.

const assertManageable = async (invoice) => {
  if (invoice.dbeInvoiceId) {
    throw new AppError('This invoice was created in the dealer app — delete it there', 400);
  }
  const Payment = require('./model/Payment.model');
  const paid = await Payment.exists({ 'allocations.invoiceId': invoice._id, status: 'confirmed' });
  const LedgerEntry = require('../ledger/model/LedgerEntry.model');
  const ledgerPaid = paid || (invoice.orderId && await LedgerEntry.exists({
    orderId: invoice.orderId,
    manualPayments: { $elemMatch: { appliedToInvoiceId: invoice._id, reversedAt: null } },
  }));
  const CustomerLedgerEntry = require('../customerLedger/model/CustomerLedgerEntry.model');
  const customerPaid = invoice.orderId && await CustomerLedgerEntry.exists({
    orderId: invoice.orderId,
    payments: { $elemMatch: { reversedAt: null } },
  });
  if (ledgerPaid || customerPaid) throw new AppError('A payment is recorded against this invoice — it cannot be changed', 400);
};

// Serials the dealer has already sold to a customer can't be taken back
const assertNotSoldByDealer = async (serials) => {
  if (!serials.length) return;
  const sale = await mongoose.connection.collection('retailinvoices').findOne(
    { 'items.serialNumbers': { $in: serials } }, { projection: { invoiceNumber: 1 } }
  );
  if (sale) throw new AppError(`Serial number(s) already sold by the dealer (${sale.invoiceNumber})`, 400);
  const sold = await Invoice.findOne({
    invoiceType: 'retail',
    dbeInvoiceId: { $exists: true, $ne: null },
    'lineItems.serialNumbers': { $in: serials },
  }).select('invoiceNumber lineItems.serialNumbers').lean();
  if (sold) {
    const set = new Set(serials);
    const hit = sold.lineItems.flatMap(li => li.serialNumbers || []).filter(s => set.has(s));
    throw new AppError(
      `Serial number(s) already sold by the dealer (${sold.invoiceNumber}): ${hit.join(', ')}`,
      400
    );
  }
};

const releaseSerials = async (invoice, serials) => {
  if (!serials.length) return;
  // Linked to this invoice, or assigned on its order before the invoice existed
  const owner = [{ invoiceId: invoice._id }];
  if (invoice.orderId) owner.push({ orderId: invoice.orderId, invoiceId: { $in: [null] } });
  await DispatchedUnit.updateMany(
    { serialNumber: { $in: serials }, $or: owner },
    {
      $set: { status: 'in_stock' },
      $unset: { invoiceId: '', invoiceNumber: '', orderId: '', dealerId: '', dispatchedAt: '' },
    }
  );
};

// Returns true when the invoice's order already deducted product stock
const orderDeductedStock = async (invoice) => {
  if (!invoice.orderId) return false;
  const order = await Order.findById(invoice.orderId).select('stockDeductedAt orderType status').lean();
  // A cancelled order already put its stock back
  return Boolean(order?.stockDeductedAt) && order.status !== 'cancelled';
};

const qtyByProduct = (lineItems = []) => {
  const map = new Map();
  for (const li of lineItems) {
    if (!li.productId) continue;
    const pid = String(li.productId);
    map.set(pid, (map.get(pid) || 0) + (Number(li.quantity) || 0));
  }
  return map;
};

// delta > 0 → stock goes back up; delta < 0 → more stock taken
const adjustProductStock = async (deltaByProduct) => {
  for (const [pid, delta] of deltaByProduct) {
    if (!delta) continue;
    await Product.findByIdAndUpdate(
      pid,
      [{ $set: { currentStockQty: { $max: [0, { $add: ['$currentStockQty', delta] }] } } }],
      { updatePipeline: true }
    );
  }
};

// The ledger and dealer credit read the order's amount, so an edited invoice
// total has to move them too (and the dealer app's own copy of the order).
const syncOrderTotal = async (invoice, delta) => {
  if (!invoice.orderId || !delta) return;
  const order = await Order.collection.findOne({ _id: invoice.orderId });
  if (!orderIsOpen(order)) return;

  const isSplit = order.paymentMethod === 'split';
  const onCredit = order.dbeOrderId
    ? isSplit || /^net-\d+$/i.test(String(order.paymentMethod || ''))
    : Number(order.creditUsed) > 0;
  const moved = (field) => ({ $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, delta] }] });

  const set = { netAmount: moved('netAmount') };
  if (isSplit) set.splitCreditAmount = moved('splitCreditAmount');
  if (!order.dbeOrderId && onCredit) set.creditUsed = moved('creditUsed');

  const orderIds = [order._id];
  const dbeId = mongoose.isValidObjectId(order.dbeOrderId) ? new mongoose.Types.ObjectId(String(order.dbeOrderId)) : null;
  if (dbeId) orderIds.push(dbeId);
  await Order.collection.updateMany({ _id: { $in: orderIds } }, [{ $set: set }]);

  // Dealer-app net-terms invoice (uses `amount`, has no totalAmount)
  if (dbeId) {
    await Invoice.collection.updateMany(
      { orderId: dbeId, amount: { $type: 'number' }, totalAmount: { $exists: false }, status: { $nin: ['PAID', 'paid'] } },
      { $inc: { amount: delta } }
    );
  }
  if (onCredit && order.dealerId) {
    await Dealer.collection.updateOne({ _id: order.dealerId }, [{ $set: { creditUsed: moved('creditUsed') } }]);
  }
};

// ── Order side of an edited/deleted invoice ─────────────────────────────────
const toId = (v) => new mongoose.Types.ObjectId(String(v));
const dealerStock = () => mongoose.connection.collection('dealerinventories');

const orderIsOpen = (order) => Boolean(order) && !['cancelled', 'rejected'].includes(order.status);
// Website (b2c) orders have no dealer, so there is no dealer stock to move
const orderIsDelivered = (order) => orderIsOpen(order) && order.status === 'delivered' && Boolean(order.dealerId);

// The supplier's order plus the dealer app's own copy of it (same collection)
const orderCopies = (order) => {
  const ids = [order._id];
  if (mongoose.isValidObjectId(order.dbeOrderId)) ids.push(toId(order.dbeOrderId));
  return ids;
};

const qtyDelta = (oldItems, newItems) => {
  const oldQty = qtyByProduct(oldItems);
  const newQty = qtyByProduct(newItems);
  const delta = new Map();
  for (const pid of new Set([...oldQty.keys(), ...newQty.keys()])) {
    const d = (newQty.get(pid) || 0) - (oldQty.get(pid) || 0);
    if (d) delta.set(pid, d);
  }
  return delta;
};

// Website order paid online: the customer ledger treats it as paid in full,
// so its amount can't change without a refund or a new payment
const orderPaidOnline = async (order) => {
  if (order?.orderType !== 'b2c') return false;
  const copies = await Order.collection.find({ _id: { $in: orderCopies(order) } }).toArray();
  return copies.some((o) => ['completed', 'paid', 'success', 'captured'].includes(String(o.paymentStatus || '').toLowerCase())
    || Boolean(o.razorpayPaymentId));
};

// A return decides its own stock/refund movement — don't change the order under it
const assertNoOpenReturn = async (order) => {
  const ids = orderCopies(order);
  const open = await mongoose.connection.collection('returns').findOne({
    orderId: { $in: [...ids, ...ids.map(String)] },
    status: { $nin: ['rejected', 'REJECTED', 'CANCELLED'] },
  });
  if (open) throw new AppError('This order has a return in progress — finish that before changing the invoice', 400);
};

// Units the dealer has already sold can't be taken back from them
const assertDealerHasStock = async (order, delta) => {
  for (const [pid, d] of delta) {
    if (d >= 0) continue;
    const row = await dealerStock().findOne({ dealerId: order.dealerId, productId: toId(pid) });
    if ((Number(row?.currentQty) || 0) < -d) {
      throw new AppError(
        `The dealer has only ${Number(row?.currentQty) || 0} unit(s) of ${row?.productName || 'this product'} left, so ${-d} cannot be taken back`,
        400
      );
    }
  }
};

// Same fields the delivery step writes
const applyDealerStock = async (order, delta, lines = []) => {
  for (const [pid, d] of delta) {
    const productId = toId(pid);
    if (d > 0) {
      const line = lines.find((li) => String(li.productId) === pid);
      const product = await Product.findById(pid).select('name sku basePrice price images').lean();
      await dealerStock().updateOne(
        { dealerId: order.dealerId, productId },
        {
          $inc: { receivedQty: d, currentQty: d },
          $setOnInsert: {
            productName: line?.productName || product?.name || '',
            sku: product?.sku || '',
            imageUrl: product?.images?.find((i) => i.isPrimary)?.url || product?.images?.[0]?.url || '',
            purchasePrice: Number(line?.unitPrice) || product?.basePrice || product?.price || 0,
            soldQty: 0,
            threshold: Math.max(2, Math.ceil(d * 0.2)),
          },
        },
        { upsert: true }
      );
    } else {
      const less = (field) => ({ $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, d] }] });
      await dealerStock().updateOne(
        { dealerId: order.dealerId, productId },
        [{ $set: { currentQty: less('currentQty'), receivedQty: less('receivedQty') } }]
      );
    }
  }
};

// Warehouse allocation only exists on supplier-created orders (OrderItem rows)
const applyAllocation = async (order, delta) => {
  if (!orderIsOpen(order) || orderIsDelivered(order) || order.status === 'pending') return;
  const OrderItem = require('../orders/model/OrderItem.model');
  const rows = await OrderItem.find({ orderId: order._id }).lean();
  const fallback = rows.find((r) => r.warehouseId)?.warehouseId;
  if (!fallback) return;
  const inventoryService = require('../inventory/inventory.service');
  for (const [pid, d] of delta) {
    const warehouseId = rows.find((r) => String(r.productId) === pid)?.warehouseId || fallback;
    if (d > 0) await inventoryService.allocateStock(pid, warehouseId, d);
    else await inventoryService.releaseAllocation(pid, warehouseId, -d);
  }
};

// Makes the order show what the invoice now says, on both copies
const applyOrderLines = async (order, items, subtotalDelta, taxDelta) => {
  const ids = orderCopies(order);
  const moved = (field, d) => ({ $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, d] }] });
  await Order.collection.updateMany({ _id: { $in: ids } }, [{ $set: {
    subtotal: moved('subtotal', subtotalDelta),
    taxAmount: moved('taxAmount', taxDelta),
  } }]);

  // Website items may have no product record — those are matched by name
  const isWebsite = order.orderType === 'b2c';
  const lines = items.filter((li) => li.productId || (isWebsite && li.productName));
  if (!lines.length) return;

  const productIds = lines.map((li) => li.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).select('sku').lean();
  const skuOf = (pid) => products.find((p) => String(p._id) === String(pid))?.sku || '';
  const taxableOf = (li) => Math.max(0, (Number(li.lineTotal) || 0) - (Number(li.taxAmount) || 0));

  // Embedded items: lineTotal is before tax, discount folded into the unit price
  const docs = await Order.collection.find({ _id: { $in: ids } }).toArray();
  for (const doc of docs) {
    if (!doc.items?.length) continue;
    const next = lines.map((li) => {
      const prev = doc.items.find((i) => (li.productId
        ? String(i.productId) === String(li.productId)
        : !i.productId && i.name === li.productName));
      const qty = Number(li.quantity) || 0;
      const taxable = taxableOf(li);
      const unit = qty ? +(taxable / qty).toFixed(2) : 0;
      return {
        moq: 1,
        ...prev,
        ...(li.productId ? { productId: toId(li.productId) } : {}),
        sku: prev?.sku || skuOf(li.productId),
        name: li.productName || prev?.name || '',
        unitPrice: unit,
        basePrice: unit,
        quantity: qty,
        lineTotal: +taxable.toFixed(2),
      };
    });
    await Order.collection.updateOne({ _id: doc._id }, { $set: { items: next } });
  }

  // Supplier-created orders keep their lines in OrderItem
  const OrderItem = require('../orders/model/OrderItem.model');
  const rows = await OrderItem.find({ orderId: order._id }).lean();
  if (!rows.length) return;
  const fallbackWarehouse = rows.find((r) => r.warehouseId)?.warehouseId;
  await OrderItem.deleteMany({ orderId: order._id, productId: { $nin: productIds } });
  for (const li of lines) {
    const prev = rows.find((r) => String(r.productId) === String(li.productId));
    await OrderItem.collection.updateOne(
      { orderId: order._id, productId: toId(li.productId) },
      {
        $set: {
          productName: li.productName || prev?.productName || '',
          productCode: prev?.productCode || skuOf(li.productId),
          warehouseId: prev?.warehouseId || fallbackWarehouse,
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          discount: Number(li.discount) || 0,
          taxRate: Number(li.taxRate) || 0,
          taxAmount: Number(li.taxAmount) || 0,
          lineTotal: Number(li.lineTotal) || 0,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
};

// Dealer invoice ("D-" copy, incl. converted quotes): the dealer's own invoice is
// the real one, so the edit runs there (stock, serials, warranty locks) and the
// normal sync brings this copy up to date.
const DEALER_PAY_MODES = { cash: 'cash', upi: 'upi', card: 'card', 'bank transfer': 'bank-transfer', neft: 'bank-transfer', rtgs: 'bank-transfer' };

const editDealerInvoice = async (invoice, body, user) => {
  const { lineItems } = body;
  if (!lineItems?.length) throw new AppError('Add at least one item', 400);
  if (Number(body.invoiceDiscount) > 0 || body.roundOff) {
    throw new AppError('Invoice discount and round off are not available on dealer invoices', 400);
  }
  const addl = Number(invoice.additionalCharges) || 0;
  if (body.additionalCharges !== undefined && Math.abs(Number(body.additionalCharges) - addl) > 0.01) {
    throw new AppError('Additional charges on a dealer invoice can only be changed in the dealer app', 400);
  }

  // The dealer invoice has no discount fields, so line discounts fold into the price
  const { items, totalAmount: formTotal } = calcTotals(lineItems, 0, addl, false);
  const dealerItems = items.map((li) => {
    const qty = Number(li.quantity) || 0;
    const taxable = Math.max(0, (Number(li.lineTotal) || 0) - (Number(li.taxAmount) || 0));
    return {
      productId: li.productId ? String(li.productId) : '',
      sku: li.productCode || '',
      name: li.productName || '',
      hsnCode: li.hsnCode || '',
      quantity: qty,
      unitPrice: qty ? +(taxable / qty).toFixed(2) : 0,
      taxRate: Number(li.taxRate) || 0,
      serialNumbers: li.serialNumbers || [],
    };
  });

  // "Paid in full" on the form leaves out GST on the charges, which the dealer invoice includes
  let receivedAmount;
  if (body.amountPaid !== undefined) {
    receivedAmount = Number(body.amountPaid) || 0;
    if (Math.abs(receivedAmount - formTotal) <= 0.01) {
      let net = 0, tax = 0;
      dealerItems.forEach((i) => { const base = i.unitPrice * i.quantity; net += base; tax += base * (i.taxRate / 100); });
      const chargeTax = (invoice.chargeLines || []).reduce((s, c) => s + (Number(c.taxAmount) || 0), 0);
      receivedAmount = +(+(net + addl).toFixed(2) + +(tax + chargeTax).toFixed(2)).toFixed(2);
    }
  }

  const DEALER_API_URL = process.env.DEALER_API_URL;
  const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET;
  if (!DEALER_API_URL || !WEBHOOK_SECRET) throw new AppError('Dealer app connection is not configured', 500);
  const axios = require('axios');
  try {
    await axios.post(`${DEALER_API_URL}/api/retail-sales/webhook/supplier-edit`, {
      dbeInvoiceId: invoice.dbeInvoiceId,
      items: dealerItems,
      receivedAmount,
      salesman: body.salesmanName,
      paymentMethod: DEALER_PAY_MODES[String(body.paymentMode || '').toLowerCase()],
    }, {
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      timeout: 15000,
    });
  } catch (err) {
    if (err.response?.data?.message) throw new AppError(err.response.data.message, err.response.status);
    throw new AppError('Could not reach the dealer app — the invoice was not changed', 502);
  }

  const updated = await Invoice.findById(invoice._id);
  // Same as the date cell on the invoice list: the date lives on this copy
  if (body.invoiceDate && new Date(body.invoiceDate).toISOString().slice(0, 10) !== updated.invoiceDate?.toISOString().slice(0, 10)) {
    updated.invoiceDate = new Date(body.invoiceDate);
    await updated.save();
  }

  const auditService = require('../audit/audit.service');
  await auditService.log('invoice', updated._id, 'update', user?._id || user?.id, {
    after: { invoiceNumber: updated.invoiceNumber, totalAmount: updated.totalAmount },
  });
  return updated;
};

const manageEditInvoice = async (id, body, user) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'cancelled') throw new AppError('Cannot edit a cancelled invoice', 400);
  if (invoice.dbeInvoiceId) return editDealerInvoice(invoice, body, user);
  await assertManageable(invoice);

  const {
    lineItems, invoiceDiscount,
    additionalCharges, additionalLabel,
    roundOff,
    bankDetails, paymentMode, paymentReceivedIn,
    shippingAddress,
    invoicePrefix, invoiceSequence,
    // never let an edit re-link the invoice or change its type
    orderId: _orderId, dbeInvoiceId: _dbeInvoiceId, invoiceType: _invoiceType,
    // a generated invoice never goes back to draft; status follows the amounts
    status: _status,
    ...rest
  } = body;

  if (lineItems) {
    if (!lineItems.length) throw new AppError('Add at least one item', 400);

    // Serial count must match quantity on every line that has serials
    const newSerials = [];
    for (const li of lineItems) {
      const cleaned = (li.serialNumbers || []).map(s => String(s).trim().toUpperCase()).filter(Boolean);
      if (cleaned.length && cleaned.length !== (Number(li.quantity) || 0)) {
        throw new AppError(
          `"${li.productName || 'Item'}" requires ${Number(li.quantity) || 0} serial number(s), but ${cleaned.length} provided`,
          400
        );
      }
      li.serialNumbers = cleaned;
      newSerials.push(...cleaned);
    }

    const oldSerials = invoice.lineItems.flatMap(li => (li.serialNumbers || []).map(s => s.toUpperCase()));
    const oldSet  = new Set(oldSerials);
    const newSet  = new Set(newSerials);
    const removed = [...oldSet].filter(s => !newSet.has(s));
    const added   = [...newSet].filter(s => !oldSet.has(s));

    await checkSerialUniqueness(newSerials, invoice._id);
    await assertNotSoldByDealer(removed);

    // A newly assigned serial that already exists must be in stock for that product
    if (added.length) {
      const existing = await DispatchedUnit.find({ serialNumber: { $in: added } })
        .select('serialNumber productId status isDeleted').lean();
      for (const u of existing) {
        if (u.isDeleted) throw new AppError(`Serial number ${u.serialNumber} was deleted from stock`, 400);
        const line = lineItems.find(li => li.serialNumbers.includes(u.serialNumber));
        if (u.productId && line?.productId && String(u.productId) !== String(line.productId)) {
          throw new AppError(`Serial number ${u.serialNumber} belongs to a different product`, 400);
        }
      }
    }

    const addl = Number(additionalCharges ?? invoice.additionalCharges) || 0;
    const ro = roundOff !== undefined ? roundOff : invoice.roundOff;
    const { items, subtotal, taxAmount, discountAmt, totalAmount, roundOffAmt } =
      calcTotals(lineItems, Number(invoiceDiscount ?? invoice.discountAmt) || 0, addl, ro);
    if (invoice.orderId && totalAmount < (Number(invoice.amountPaid) || 0) - 0.01) {
      throw new AppError(`New total ₹${totalAmount} is less than the ₹${invoice.amountPaid} already received on this order`, 400);
    }

    // Everything that can refuse the edit runs first, so a refusal changes nothing
    const order = invoice.orderId ? await Order.collection.findOne({ _id: invoice.orderId }) : null;
    const delivered = orderIsDelivered(order);
    const lineDelta = qtyDelta(invoice.lineItems, lineItems);
    if (order) await assertNoOpenReturn(order);
    if (Math.abs(totalAmount - (Number(invoice.totalAmount) || 0)) > 0.01 && await orderPaidOnline(order)) {
      throw new AppError('This website order was paid online — its total cannot be changed', 400);
    }
    if (delivered) await assertDealerHasStock(order, lineDelta);
    if (order) await applyAllocation(order, lineDelta);

    // Stock count: only when the linked order deducted stock in the first place
    if (await orderDeductedStock(invoice)) {
      const oldQty = qtyByProduct(invoice.lineItems);
      const newQty = qtyByProduct(lineItems);
      const delta = new Map();
      for (const pid of new Set([...oldQty.keys(), ...newQty.keys()])) {
        delta.set(pid, (oldQty.get(pid) || 0) - (newQty.get(pid) || 0));
      }
      await adjustProductStock(delta);
    }

    // Unassigned serials → available again
    await releaseSerials(invoice, removed);

    // Newly assigned serials → locked to this invoice (upsert, same as saveSerialNumbers)
    if (added.length) {
      const ops = [];
      for (const li of lineItems) {
        const newForItem = li.serialNumbers.filter(s => added.includes(s));
        if (!newForItem.length) continue;
        const product = li.productId
          ? await Product.findById(li.productId).select('warrantyPeriod').lean()
          : null;
        for (const sn of newForItem) {
          ops.push({
            updateOne: {
              filter: { serialNumber: sn },
              update: { $set: {
                serialNumber:   sn,
                productId:      li.productId || undefined,
                productName:    li.productName || '',
                warrantyMonths: parseWarrantyMonths(product?.warrantyPeriod),
                invoiceId:      invoice._id,
                invoiceNumber:  invoice.invoiceNumber,
                orderId:        invoice.orderId || undefined,
                dealerId:       invoice.dealerId || undefined,
                dispatchedAt:   invoice.invoiceDate || new Date(),
                // a delivered order's serials sit with the dealer, ready to sell
                status:         delivered ? 'delivered' : 'dispatched',
              } },
              upsert: true,
            },
          });
        }
      }
      if (ops.length) await DispatchedUnit.bulkWrite(ops);
    }

    await syncOrderTotal(invoice, +(totalAmount - (Number(invoice.totalAmount) || 0)).toFixed(2));
    if (orderIsOpen(order)) {
      await applyOrderLines(
        order, items,
        +(subtotal - (Number(invoice.subtotal) || 0)).toFixed(2),
        +(taxAmount - (Number(invoice.taxAmount) || 0)).toFixed(2)
      );
    }
    if (delivered) await applyDealerStock(order, lineDelta, items);

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

  if (bankDetails !== undefined) invoice.bankDetails = bankDetails;
  if (paymentMode !== undefined) invoice.paymentMode = paymentMode;
  if (paymentReceivedIn !== undefined) invoice.paymentReceivedIn = paymentReceivedIn;
  if (shippingAddress !== undefined) invoice.shippingAddress = shippingAddress;
  if (invoicePrefix !== undefined) invoice.invoicePrefix = invoicePrefix;
  if (invoiceSequence !== undefined) invoice.invoiceSequence = invoiceSequence;

  Object.assign(invoice, rest);
  applyPaymentStatus(invoice);
  await invoice.save();
  await syncOrderPaymentStatus(invoice);

  const auditService = require('../audit/audit.service');
  await auditService.log('invoice', invoice._id, 'update', user?._id || user?.id, {
    after: { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount },
  });
  return invoice;
};

const manageDeleteInvoice = async (id, user) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  // Temporary: what deleting an order invoice should do to the order isn't decided
  // yet (the order would stay billed). Remove this check once it is.
  if (invoice.orderId) throw new AppError("Delete isn't available for order invoices yet — edit the invoice instead", 400);
  await assertManageable(invoice);

  const serials = invoice.lineItems.flatMap(li => (li.serialNumbers || []).map(s => s.toUpperCase()));
  await assertNotSoldByDealer(serials);

  const order = invoice.orderId ? await Order.collection.findOne({ _id: invoice.orderId }) : null;
  if (order && orderIsOpen(order) && (Number(invoice.amountPaid) || 0) > 0) {
    throw new AppError('Money is already received on this order — this invoice cannot be deleted', 400);
  }
  if (order) await assertNoOpenReturn(order);
  if (await orderPaidOnline(order)) throw new AppError('This website order was paid online — this invoice cannot be deleted', 400);
  const delivered = orderIsDelivered(order);
  const dealerDelta = new Map([...qtyByProduct(invoice.lineItems)].map(([pid, q]) => [pid, -q]));
  if (delivered) await assertDealerHasStock(order, dealerDelta);

  // Stock goes back only if the linked order actually took it
  if (await orderDeductedStock(invoice)) {
    await adjustProductStock(qtyByProduct(invoice.lineItems));
  }
  await releaseSerials(invoice, serials);
  if (delivered) await applyDealerStock(order, dealerDelta);

  // Let the order get a fresh invoice
  if (invoice.orderId) {
    await Order.updateOne({ _id: invoice.orderId, invoiceId: invoice._id }, { $unset: { invoiceId: '' } });
  }

  await invoice.deleteOne();

  const auditService = require('../audit/audit.service');
  await auditService.log('invoice', invoice._id, 'delete', user?._id || user?.id, {
    before: { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount },
  });
};

module.exports = {
  getInvoices, getInvoiceById, createInvoice, updateInvoice, issueInvoice, cancelInvoice, deleteInvoice, saveSerialNumbers, applyPaymentStatus,
  manageEditInvoice, manageDeleteInvoice,
};