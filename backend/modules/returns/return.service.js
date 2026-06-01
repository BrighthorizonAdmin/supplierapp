const Return = require('./model/Return.model');
const Order = require('../orders/model/Order.model');
const OrderItem = require('../orders/model/OrderItem.model');
const Dealer = require('../dealer/model/Dealer.model');
const Payment = require('../payments/model/Payment.model');
const Transaction = require('../finance/model/Transaction.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const { withTransaction } = require('../../utils/transaction');
const inventoryService = require('../inventory/inventory.service');
const auditService = require('../audit/audit.service');
const { differenceInDays } = require('date-fns');
const { emitToAll } = require('../../websocket/socket');
const { RETURN_PROCESSED } = require('../../websocket/events');
const mongoose = require('mongoose');
const axios = require('axios');
const Invoice = require('../payments/model/Invoice.model');

const RETURN_WINDOW_DAYS = 30;

// ── Shared-DB direct access: DealerInventory ─────────────────────────────────
// Both apps share MongoDB, so we can write DealerInventory without HTTP.
const dealerInventorySchema = new mongoose.Schema({
  dealerId:      { type: mongoose.Schema.Types.ObjectId },
  productId:     { type: mongoose.Schema.Types.ObjectId },
  productName:   String,
  sku:           String,
  imageUrl:      String,
  purchasePrice: { type: Number, default: 0 },
  receivedQty:   { type: Number, default: 0 },
  currentQty:    { type: Number, default: 0 },
  soldQty:       { type: Number, default: 0 },
  threshold:     { type: Number, default: 2 },
}, { strict: false, timestamps: true });
const DealerInventory = mongoose.models.DealerInventory
  || mongoose.model('DealerInventory', dealerInventorySchema, 'dealerinventories');

// ── Shared-DB direct access: Product (supplier catalogue) ────────────────────
const Product = require('../products/model/Product.model');
const DispatchedUnit = require('../dispatchedUnits/model/DispatchedUnit.model');

// ─────────────────────────────────────────────────────────────────────────────
// notifyDealerReturn
// Fires a notification in the D-BE (dealer app) when a return request status
// changes so the dealer sees it in their notifications list.
// Uses D-BE's Notification model directly (shared MongoDB) — no HTTP needed.
// ─────────────────────────────────────────────────────────────────────────────
const dealerNotificationSchema = new mongoose.Schema({
  dealerId: { type: mongoose.Schema.Types.ObjectId },
  type:     { type: String },
  title:    { type: String },
  message:  { type: String },
  isRead:   { type: Boolean, default: false },
  data:     { type: Object },
  readAt:   { type: Date },
}, { strict: false, timestamps: true });

const DealerNotification = mongoose.models.Notification
  || mongoose.model('Notification', dealerNotificationSchema, 'notifications');

async function notifyDealerReturn(ret, newStatus) {
  try {
    const dealerId = ret.dealerId?._id || ret.dealerId;
    if (!dealerId) return;

    const returnIdentifier = ret.returnId || ret.rmaNumber || String(ret._id);
    const refundAmt = ret.totalRefundAmount || ret.refundAmount || 0;

    const messages = {
      APPROVED:         `Your return request ${returnIdentifier} has been approved. Please ship the item back.`,
      REJECTED:         `Your return request ${returnIdentifier} has been rejected by the supplier.`,
      REFUND_PROCESSED: `Refund of ₹${refundAmt.toLocaleString('en-IN')} for return ${returnIdentifier} has been processed.`,
      approved:         `Your return request ${returnIdentifier} has been approved. Please ship the item back.`,
      rejected:         `Your return request ${returnIdentifier} has been rejected by the supplier.`,
      refunded:         `Refund of ₹${refundAmt.toLocaleString('en-IN')} for return ${returnIdentifier} has been processed.`,
    };

    const titles = {
      APPROVED:         `Return Approved`,
      REJECTED:         `Return Rejected`,
      REFUND_PROCESSED: `Refund Processed`,
      approved:         `Return Approved`,
      rejected:         `Return Rejected`,
      refunded:         `Refund Processed`,
    };

    const msg   = messages[newStatus];
    const title = titles[newStatus];
    if (!msg) return; // don't notify for intermediate statuses

    await DealerNotification.create({
      dealerId,
      type:    'RETURN_UPDATE',
      title,
      message: msg,
      data:    { returnId: returnIdentifier, status: newStatus },
    });
    console.log(`[notifyDealerReturn] Notified dealer ${dealerId} — return ${returnIdentifier} → ${newStatus}`);
  } catch (err) {
    console.error('[notifyDealerReturn] Failed:', err.message);
  }
}

const createReturn = async (data, userId) => {
  const order = await Order.findById(data.orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === 'cancelled') throw new AppError('Cannot return items from a cancelled order', 400);

  // 30-day validation
  const daysSinceOrder = differenceInDays(new Date(), order.createdAt);
  if (daysSinceOrder > RETURN_WINDOW_DAYS) {
    throw new AppError(`Return window of ${RETURN_WINDOW_DAYS} days has expired`, 400);
  }

  // Validate return items are part of the order
  const orderItems = await OrderItem.find({ orderId: data.orderId }).lean();
  const orderItemMap = Object.fromEntries(orderItems.map((i) => [i._id.toString(), i]));

  for (const item of data.items) {
    if (item.orderItemId && !orderItemMap[item.orderItemId]) {
      throw new AppError(`Order item ${item.orderItemId} not found in this order`, 400);
    }
  }

  const ret = await Return.create({
    ...data,
    dealerId: order.dealerId,
  });

  await auditService.log('return', ret._id, 'create', userId, {
    after: { rmaNumber: ret.rmaNumber, orderId: data.orderId },
  });
  return ret;
};

// ─────────────────────────────────────────────────────────────────────────────
// applyRefundSideEffects
// Runs OUTSIDE of withTransaction so it is never rolled back and has no
// session interference.  Called after processReturn successfully commits.
//
// Actions:
//  1. Update D-BE order status → 'refunded'  (shared MongoDB, no HTTP needed)
//  2. Deduct returned items from DealerInventory
//  3. Restore supplier Product catalogue stock
// ─────────────────────────────────────────────────────────────────────────────
async function applyRefundSideEffects(ret, refundAmount) {
  try {
    // ── 1. Resolve the D-BE order _id ──────────────────────────────────────
    let dbeOrderId = null;
    const isDbeReturn = !!ret.returnId && !ret.rmaNumber;

    if (isDbeReturn) {
      // ret.orderId is already the D-BE order's _id (same shared MongoDB)
      dbeOrderId = ret.orderId;
    } else {
      // S-BE return created via dealer-return webhook — need to follow dbeOrderId
      const sbeOrder = await Order.findById(ret.orderId).lean();
      if (sbeOrder && sbeOrder.dbeOrderId) {
        dbeOrderId = sbeOrder.dbeOrderId;
      }
    }

    if (!dbeOrderId) {
      console.warn('[applyRefundSideEffects] Could not resolve D-BE order ID — skipping side effects');
      return;
    }

    // ── 2. Update D-BE order status to 'refunded' ──────────────────────────
    // Use $set with runValidators:false to bypass the enum check on old schema versions
    const orderUpdateResult = await Order.findByIdAndUpdate(
      dbeOrderId,
      {
        $set:  { status: 'refunded' },
        $push: {
          timeline: {
            status:      'refunded',
            timestamp:   new Date(),
            description: `Refund of ₹${refundAmount} has been processed`,
          },
        },
      },
      { runValidators: false, new: true }
    );
    if (orderUpdateResult) {
      console.log(`[applyRefundSideEffects] Order ${dbeOrderId} → refunded ✓`);
    } else {
      console.warn(`[applyRefundSideEffects] Order ${dbeOrderId} not found in DB`);
    }

    // ── 3. Deduct returned items from DealerInventory ──────────────────────
    // Only deduct items that are actually being returned (not the full order)
    const returnItems = ret.items || [];
    const dealerId    = ret.dealerId;

    for (const item of returnItems) {
      const pid = item.productId;
      const qty = Number(item.quantity) || 0;
      if (!pid || !qty || !dealerId) continue;

      await DealerInventory.findOneAndUpdate(
        { dealerId, productId: pid },
        { $inc: { currentQty: -qty } },
        { runValidators: false }
      );
      // Clamp currentQty to ≥ 0
      await DealerInventory.updateOne(
        { dealerId, productId: pid, currentQty: { $lt: 0 } },
        { $set: { currentQty: 0 } }
      );
      // NOTE: receivedQty is NOT decremented — it represents the historical
      // total ever received and must stay positive so the low-stock query
      // (filter: receivedQty > 0) continues to include this product after a
      // return, correctly showing it as out-of-stock instead of hiding it.
      console.log(`[applyRefundSideEffects] DealerInventory −${qty} for product ${pid} ✓`);
    }

    // ── 4. Restore supplier Product catalogue stock ─────────────────────────
    for (const item of returnItems) {
      const pid = item.productId;
      const qty = Number(item.quantity) || 0;
      if (!pid || !qty) continue;

      await Product.findByIdAndUpdate(
        pid,
        { $inc: { currentStockQty: qty } },
        { runValidators: false }
      );
      console.log(`[applyRefundSideEffects] Product ${pid} stock +${qty} ✓`);
    }

    // ── 5. Restore DispatchedUnit serial numbers back to in_stock ───────────
    let sbeOrderIdForUnits = null;
    if (isDbeReturn) {
      const sbeOrder = await Order.findOne({ dbeOrderId: ret.orderId }).select('_id').lean();
      if (sbeOrder) sbeOrderIdForUnits = sbeOrder._id;
    } else {
      sbeOrderIdForUnits = ret.orderId;
    }

    for (const item of returnItems) {
      const pid = item.productId;
      const qty = Number(item.quantity) || 0;
      if (!pid || !qty) continue;

      const unitQuery = {
        productId: pid,
        dealerId,
        status: { $in: ['dispatched', 'delivered'] },
      };
      if (sbeOrderIdForUnits) unitQuery.orderId = sbeOrderIdForUnits;

      const units = await DispatchedUnit.find(unitQuery)
        .sort({ dispatchedAt: -1 })
        .limit(qty)
        .select('_id serialNumber');

      if (units.length) {
        const ids = units.map(u => u._id);
        await DispatchedUnit.updateMany({ _id: { $in: ids } }, { $set: { status: 'in_stock' } });
        console.log(`[applyRefundSideEffects] Restored serial(s) for product ${pid} → in_stock: ${units.map(u => u.serialNumber).join(', ')} ✓`);
      }
    }

    // ── 6. Update S-BE Sales Invoice lineItems for returned items ───────────
    try {
      let sbeOrderId = null;
      if (!isDbeReturn) {
        sbeOrderId = ret.orderId;
      } else {
        const sbeOrd = await Order.findOne({ dbeOrderId: String(ret.orderId) }).lean();
        sbeOrderId = sbeOrd?._id || null;
      }
      if (sbeOrderId) {
        const invoice = await Invoice.findOne({ orderId: sbeOrderId }).lean();
        if (invoice && invoice.lineItems?.length > 0) {
          let modified = false;
          const updatedLineItems = invoice.lineItems.map(li => {
            const pid = li.productId?.toString();
            const retItem = returnItems.find(r => r.productId?.toString() === pid);
            if (!retItem) return li;
            const retQty = Number(retItem.quantity) || 0;
            const origQty = li.quantity || 0;
            const newQty = Math.max(0, origQty - retQty);
            modified = true;
            if (newQty <= 0) return null;
            const ratio = newQty / origQty;
            return { ...li, quantity: newQty, lineTotal: parseFloat(((li.lineTotal || 0) * ratio).toFixed(2)), taxAmount: parseFloat(((li.taxAmount || 0) * ratio).toFixed(2)) };
          }).filter(Boolean);
          if (modified) {
            const newSubtotal = updatedLineItems.reduce((s, li) => s + (li.lineTotal || 0), 0);
            const newTaxAmt   = updatedLineItems.reduce((s, li) => s + (li.taxAmount || 0), 0);
            const newTotal    = newSubtotal + newTaxAmt + (invoice.additionalCharges || 0) + (invoice.roundOffAmt || 0);
            const newBalance  = Math.max(0, newTotal - (invoice.amountPaid || 0));
            const newStatus   = (updatedLineItems.length === 0 || newTotal <= 0) ? 'cancelled' : invoice.status;
            await Invoice.findByIdAndUpdate(invoice._id, { $set: { lineItems: updatedLineItems, subtotal: parseFloat(newSubtotal.toFixed(2)), taxAmount: parseFloat(newTaxAmt.toFixed(2)), totalAmount: parseFloat(newTotal.toFixed(2)), balance: parseFloat(newBalance.toFixed(2)), status: newStatus } }, { runValidators: false });
            console.log(`[applyRefundSideEffects] S-BE Invoice updated for order ${sbeOrderId} ✓`);
          }
        }
      }
    } catch (invErr) {
      console.error('[applyRefundSideEffects] Invoice update failed:', invErr.message);
    }

    // ── 7. Store return info on D-BE order for dealer invoice display ───────
    if (dbeOrderId && returnItems.length > 0) {
      try {
        await Order.findByIdAndUpdate(
          dbeOrderId,
          { $set: {
            returnedItems: returnItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity) || 0, name: i.name || i.productName || '' })),
            returnRefundAmount: refundAmount,
          }},
          { runValidators: false, strict: false }
        );
        console.log(`[applyRefundSideEffects] D-BE order returnedItems set ✓`);
      } catch (riErr) {
        console.error('[applyRefundSideEffects] returnedItems update failed:', riErr.message);
      }
    }

    // ── 8. Reduce D-BE Invoice amount by the refund so Pay Now shows correct balance ──
    // .lean() returns the raw MongoDB document so 'amount' (a D-BE-only field absent from
    // the S-BE Invoice schema) is readable. strict:false on the update prevents Mongoose
    // from stripping 'amount' out of $set before it reaches MongoDB.
    if (dbeOrderId && refundAmount > 0) {
      try {
        const dbeInvoice = await Invoice.findOne(
          { orderId: dbeOrderId, status: { $in: ['UNPAID', 'OVERDUE'] } }
        ).lean();
        if (dbeInvoice && dbeInvoice.amount > 0) {
          const newAmount = Math.max(0, parseFloat((dbeInvoice.amount - refundAmount).toFixed(2)));
          const ratio = dbeInvoice.amount > 0 ? newAmount / dbeInvoice.amount : 0;
          const newSubtotal = parseFloat(((dbeInvoice.subtotal || dbeInvoice.amount) * ratio).toFixed(2));
          const newTax = parseFloat(((dbeInvoice.taxAmount || 0) * ratio).toFixed(2));
          await Invoice.findByIdAndUpdate(
            dbeInvoice._id,
            { $set: { amount: newAmount, subtotal: newSubtotal, taxAmount: newTax } },
            { runValidators: false, strict: false }
          );
          console.log(`[applyRefundSideEffects] D-BE Invoice amount updated: ${dbeInvoice.amount} → ${newAmount} ✓`);
        }
      } catch (invErr) {
        console.error('[applyRefundSideEffects] D-BE Invoice update failed:', invErr.message);
      }
    }

  } catch (err) {
    // Never fail the caller — this is a best-effort side-effect
    console.error('[applyRefundSideEffects] Error:', err.message);
  }
}

const processReturn = async (returnId, { refundAmount, refundMethod }, userId) => {
  // Capture return details BEFORE the transaction so we can use them for side-effects after
  const retDoc = await Return.findById(returnId).lean();
  if (!retDoc) throw new AppError('Return not found', 404);

  const result = await withTransaction(async (session) => {
    const ret = await Return.findById(returnId).session(session);
    if (!ret) throw new AppError('Return not found', 404);

    const isDbeReturn = !!ret.returnId && !ret.rmaNumber;
    const normalizedStatus = isDbeReturn
      ? { REQUEST_SUBMITTED: 'requested', APPROVED: 'approved', REJECTED: 'rejected', REFUND_PROCESSED: 'refunded' }[ret.status] || ret.status
      : ret.status;

    if (normalizedStatus === 'refunded') throw new AppError('Return has already been processed', 400);
    if (normalizedStatus === 'rejected') throw new AppError('Rejected returns cannot be processed', 400);

    // Validate refund ≤ order total
    const order = await Order.findById(ret.orderId).session(session);
    if (!order) throw new AppError('Original order not found', 404);
    if (refundAmount > order.netAmount) {
      throw new AppError(`Refund amount (₹${refundAmount}) cannot exceed order total (₹${order.netAmount})`, 400);
    }

    // Restore inventory for sellable items (only S-BE returns have warehouseId)
    for (const item of ret.items) {
      if (item.condition === 'sellable' && item.productId && item.warehouseId) {
        await inventoryService.adjustStock(
          item.productId, item.warehouseId, item.quantity, 'add', userId, session
        );
        await inventoryService.releaseAllocation(item.productId, item.warehouseId, item.quantity, session);
      }
    }

    // Reduce dealer creditUsed when supplier processes the return.
    // For D-BE returns, creditUsed is NOT reduced at submission — it is reduced here
    // (at supplier approval) so outstanding only changes when the refund is confirmed.
    if (ret.dealerId && !isDbeReturn) {
      const dealer = await Dealer.findById(ret.dealerId).session(session).lean();
      if (dealer) {
        const newCreditUsed = Math.max(0, (dealer.creditUsed || 0) - refundAmount);
        await Dealer.findByIdAndUpdate(
          ret.dealerId,
          { $set: { creditUsed: newCreditUsed } },
          { session, runValidators: false }
        );
      }
    }

    // Transaction record
    const rmaRef = ret.rmaNumber || ret.returnId || returnId;
    await Transaction.create([{
      type: 'debit',
      dealerId: ret.dealerId,
      amount: refundAmount,
      ref: { refType: 'return', refId: ret._id },
      description: `Refund for ${isDbeReturn ? 'Return' : 'RMA'} ${rmaRef}`,
      createdBy: userId,
    }], { session });

    // Update return record — use findByIdAndUpdate to bypass enum validation for D-BE returns
    const refundedStatus  = isDbeReturn ? 'REFUND_PROCESSED' : 'refunded';
    const refundAmtField  = isDbeReturn ? 'totalRefundAmount' : 'refundAmount';
    await Return.findByIdAndUpdate(
      returnId,
      {
        $set: {
          status:             refundedStatus,
          [refundAmtField]:   refundAmount,
          refundAmount:       refundAmount,
          refundMethod,
          refundStatus:       'processed',
          processedBy:        userId,
          inventoryAdjusted:  true,
        },
        $push: {
          timeline: {
            status:      refundedStatus,
            timestamp:   new Date(),
            description: 'Refund has been processed',
          },
        },
      },
      { session, runValidators: false }
    );

    await auditService.log('return', returnId, 'refund', userId, {
      after: { status: refundedStatus, refundAmount },
    });

    emitToAll(RETURN_PROCESSED, { returnId, rmaNumber: rmaRef, refundAmount });

    const updated = await Return.findById(returnId).session(session).lean();
    // Notify the dealer that their refund has been processed
    await notifyDealerReturn(updated, refundedStatus);

    // If this is an S-BE copy of a D-BE return (via dealer-return webhook),
    // sync the refunded status back to the original D-BE return document.
    if (!isDbeReturn && updated.dbeReturnId) {
      await syncDbeReturnStatus(updated, 'REFUND_PROCESSED');
    }

    return normalizeReturn(updated);
  });

  // ── Run side-effects AFTER transaction commits ──────────────────────────────
  // Order status update + DealerInventory deduction + supplier stock restore
  // run completely outside the transaction so they are NEVER rolled back and
  // have no interference from the MongoDB session.
  setImmediate(() => applyRefundSideEffects(retDoc, refundAmount));

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// normalizeReturn
// D-BE (dealer app) returns and S-BE (supplier app) returns share the same
// MongoDB collection but have different field schemas.
//
// D-BE fields:  returnId, status (ALL_CAPS), totalRefundAmount, items[].name,
//               items[].reason, comments
// S-BE fields:  rmaNumber, status (lowercase), refundAmount, items[].productName,
//               items[].returnReason, reason
//
// This helper detects D-BE returns (have `returnId`, no `rmaNumber`) and
// maps them to the S-BE shape so the supplier UI renders them correctly.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeReturn(ret) {
  const isDbeReturn = !!ret.returnId && !ret.rmaNumber;

  // Resolve dealer display name — works for both D-BE and S-BE dealer records.
  // D-BE dealers store the business name in `businessName` (optional) and
  // always have `name` (personal/business name used at registration).
  // S-BE dealers always have `businessName`.
  const dealerObj = ret.dealerId;
  const dealerDisplayName = typeof dealerObj === 'object' && dealerObj !== null
    ? (dealerObj.businessName || dealerObj.name || '—')
    : null;

  if (!isDbeReturn) {
    // For S-BE returns just ensure dealer display is consistent
    if (dealerDisplayName && typeof ret.dealerId === 'object') {
      ret.dealerId._displayName = dealerDisplayName;
    }
    return ret;
  }

  // Map D-BE status values → S-BE status values
  const statusMap = {
    REQUEST_SUBMITTED: 'requested',
    UNDER_REVIEW:      'requested',
    APPROVED:          'approved',
    REJECTED:          'rejected',
    IN_TRANSIT:        'received',
    REFUND_PROCESSED:  'refunded',
    CANCELLED:         'rejected',
  };

  // Build a safe dealer object so S-FE can always find the name
  const normalizedDealer = dealerObj && typeof dealerObj === 'object'
    ? { ...dealerObj, businessName: dealerDisplayName }
    : dealerObj;

  return {
    ...ret,
    dealerId:     normalizedDealer,
    // Expose returnId as rmaNumber so the rest of the UI uses a consistent field
    rmaNumber:    ret.returnId,
    // Normalise status so supplier action buttons work correctly
    status:       statusMap[ret.status] || ret.status,
    _dbeStatus:   ret.status,   // keep raw D-BE status for reference/logging
    // Normalise refund amount field name
    refundAmount: ret.totalRefundAmount ?? ret.refundAmount ?? 0,
    // Top-level reason: use comments or first item's reason
    reason:       ret.comments || ret.items?.[0]?.reason || '',
    // Normalise item sub-fields
    items: (ret.items || []).map(item => ({
      ...item,
      productName:  item.name      || item.productName  || '—',
      returnReason: item.reason    || item.returnReason || '',
      condition:    item.condition || 'sellable',
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// syncDbeReturnStatus
// When the supplier approves / processes a return that was created by D-BE
// (via the dealer-return webhook), the D-BE Return document must also be
// updated so the dealer app shows the correct status and progress steps.
//
// The S-BE webhook-created return stores `dbeReturnId` (the D-BE returnId
// string like "RET-...").  We use that to find and update the original D-BE
// return document in the shared MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
async function syncDbeReturnStatus(sbeReturn, newDbeStatus) {
  try {
    const dbeReturnId = sbeReturn.dbeReturnId;
    if (!dbeReturnId) return; // not a webhook-created return, nothing to sync

    const timelineDescriptions = {
      APPROVED:         'Return request approved by supplier',
      REJECTED:         'Return request rejected by supplier',
      UNDER_REVIEW:     'Return is under review',
      REFUND_PROCESSED: 'Refund has been processed',
      CANCELLED:        'Return cancelled',
    };

    const updated = await Return.findOneAndUpdate(
      { returnId: dbeReturnId },
      {
        $set:  { status: newDbeStatus },
        $push: {
          timeline: {
            status:      newDbeStatus,
            timestamp:   new Date(),
            description: timelineDescriptions[newDbeStatus] || newDbeStatus,
          },
        },
      },
      { runValidators: false }
    );

    if (updated) {
      console.log(`[syncDbeReturnStatus] Synced D-BE return ${dbeReturnId} → ${newDbeStatus}`);
    } else {
      console.warn(`[syncDbeReturnStatus] D-BE return not found for dbeReturnId=${dbeReturnId}`);
    }
  } catch (err) {
    console.error('[syncDbeReturnStatus] Failed:', err.message);
  }
}

const updateReturnStatus = async (returnId, status, reason, userId) => {
  const ret = await Return.findById(returnId);
  if (!ret) throw new AppError('Return not found', 404);

  const isDbeReturn = !!ret.returnId && !ret.rmaNumber;
  const before = { status: ret.status };

  // Map S-BE status → D-BE ALL_CAPS status if this is a D-BE return
  const dbeStatusMap = {
    approved:  'APPROVED',
    rejected:  'REJECTED',
    received:  'UNDER_REVIEW',
    refunded:  'REFUND_PROCESSED',
    cancelled: 'CANCELLED',
  };
  const newStatus = isDbeReturn ? (dbeStatusMap[status] || status) : status;

  // Use findByIdAndUpdate with runValidators:false to bypass the enum mismatch
  // between D-BE status values (ALL_CAPS) and the S-BE Return model enum.
  // Also push a timeline entry so D-BE ReturnDetailsScreen progress steps advance.
  const timelineDescriptions = {
    APPROVED:         'Return request approved by supplier',
    REJECTED:         'Return request rejected by supplier',
    UNDER_REVIEW:     'Return is under review',
    REFUND_PROCESSED: 'Refund has been processed',
    CANCELLED:        'Return request cancelled by supplier',
    approved:         'Return request approved by supplier',
    rejected:         'Return request rejected by supplier',
    refunded:         'Refund has been processed',
    received:         'Item received by supplier',
    cancelled:        'Return request cancelled by supplier',
  };
  const updated = await Return.findByIdAndUpdate(
    returnId,
    {
      $set:  { status: newStatus, ...(reason ? { rejectionReason: reason } : {}) },
      $push: {
        timeline: {
          status:      newStatus,
          timestamp:   new Date(),
          description: timelineDescriptions[newStatus] || newStatus,
        },
      },
    },
    { new: true, runValidators: false }
  );

  await auditService.log('return', returnId, 'update', userId, {
    before,
    after: { status: newStatus, reason },
  });

  // When a return is rejected or cancelled, revert the S-BE order status back
  // to 'delivered' so the order no longer appears as returned.
  const isTerminal = ['rejected', 'REJECTED', 'cancelled', 'CANCELLED'].includes(newStatus);
  if (isTerminal && ret.orderId) {
    await Order.findByIdAndUpdate(ret.orderId, { status: 'delivered' });
  }

  // Notify the dealer of the status change
  const updatedRet = updated.toObject ? updated.toObject() : updated;
  await notifyDealerReturn(updatedRet, newStatus);

  // If this is an S-BE copy of a D-BE return (created via dealer-return webhook),
  // also update the original D-BE return so the dealer app shows the correct status.
  if (!isDbeReturn && updatedRet.dbeReturnId) {
    const dbeSyncStatus = { refunded: 'REFUND_PROCESSED', cancelled: 'CANCELLED', approved: 'APPROVED', rejected: 'REJECTED' }[status] || status.toUpperCase();
    await syncDbeReturnStatus(updatedRet, dbeSyncStatus);
  }

  return normalizeReturn(updatedRet);
};

const getReturns = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.dealerId) match.dealerId = query.dealerId;
  if (query.orderId)  match.orderId  = query.orderId;

  // Accept both S-BE lowercase status values AND D-BE ALL_CAPS status values
  // so filtering works regardless of which format the return was saved in.
  if (query.status) {
    const statusExpansion = {
      requested: ['requested', 'REQUEST_SUBMITTED', 'UNDER_REVIEW'],
      approved:  ['approved',  'APPROVED'],
      rejected:  ['rejected',  'REJECTED', 'CANCELLED'],
      refunded:  ['refunded',  'REFUND_PROCESSED'],
      received:  ['received',  'IN_TRANSIT'],
    };
    match.status = { $in: statusExpansion[query.status] || [query.status] };
  }

  const [data, total] = await Promise.all([
    Return.find(match)
      .populate('dealerId', 'name businessName email phone')
      .populate('orderId', 'orderNumber')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Return.countDocuments(match),
  ]);

  return { data: data.map(normalizeReturn), pagination: buildMeta(total, page, limit) };
};

const getReturnById = async (id) => {
  const ret = await Return.findById(id)
    .populate('dealerId', 'name businessName email phone')
    .populate('orderId', 'orderNumber netAmount dealerOrderNumber')
    .populate('processedBy', 'name email')
    .lean();
  if (!ret) throw new AppError('Return not found', 404);
  return normalizeReturn(ret);
};

module.exports = { createReturn, processReturn, updateReturnStatus, getReturns, getReturnById };