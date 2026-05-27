const Exchange = require('./exchange.model');
const Order = require('../orders/model/Order.model');
const Dealer = require('../dealer/model/Dealer.model');
const Invoice = require('../payments/model/Invoice.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const mongoose = require('mongoose');

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

async function notifyDealerExchange(exc, newStatus) {
  try {
    const dealerId = exc.dealerId?._id || exc.dealerId;
    if (!dealerId) return;
    const exchangeIdentifier = exc.exchangeId || String(exc._id);
    const messages = {
      APPROVED:             `Your exchange request ${exchangeIdentifier} has been approved. Please ship the item back.`,
      REJECTED:             `Your exchange request ${exchangeIdentifier} has been rejected by the supplier.`,
      REPLACEMENT_SHIPPED:  `Your replacement item for exchange ${exchangeIdentifier} has been shipped.`,
      COMPLETED:            `Exchange ${exchangeIdentifier} has been completed. Enjoy your replacement!`,
    };
    const titles = {
      APPROVED:            'Exchange Approved',
      REJECTED:            'Exchange Rejected',
      REPLACEMENT_SHIPPED: 'Replacement Shipped',
      COMPLETED:           'Exchange Completed',
    };
    const msg   = messages[newStatus];
    const title = titles[newStatus];
    if (!msg) return;
    await DealerNotification.create({
      dealerId,
      type:    'EXCHANGE_UPDATE',
      title,
      message: msg,
      data:    { exchangeId: exchangeIdentifier, status: newStatus },
    });
  } catch (err) {
    console.error('[notifyDealerExchange] Failed:', err.message);
  }
}

const getExchanges = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (query.status) {
    const statusExpansion = {
      submitted: ['REQUEST_SUBMITTED', 'UNDER_REVIEW'],
      approved:  ['APPROVED', 'SHIPPED_BACK', 'RECEIVED', 'REPLACEMENT_SHIPPED'],
      completed: ['COMPLETED'],
      rejected:  ['REJECTED', 'CANCELLED'],
    };
    match.status = { $in: statusExpansion[query.status] || [query.status] };
  }

  const [data, total] = await Promise.all([
    Exchange.find(match)
      .populate('dealerId', 'name businessName email phone')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Exchange.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getExchangeById = async (id) => {
  const exc = await Exchange.findById(id)
    .populate('dealerId', 'name businessName email phone')
    .populate('orderId', 'orderNumber netAmount')
    .lean();
  if (!exc) throw new AppError('Exchange not found', 404);
  return exc;
};

const updateExchangeStatus = async (id, status, supplierNotes, userId) => {
  const exc = await Exchange.findById(id);
  if (!exc) throw new AppError('Exchange not found', 404);

  const dbeStatusMap = {
    approved:   'APPROVED',
    rejected:   'REJECTED',
    shipped:    'REPLACEMENT_SHIPPED',
    completed:  'COMPLETED',
    cancelled:  'CANCELLED',
  };
  const newStatus = dbeStatusMap[status] || status;

  const timelineDescriptions = {
    APPROVED:            'Exchange request approved by supplier',
    REJECTED:            'Exchange request rejected by supplier',
    REPLACEMENT_SHIPPED: 'Replacement item has been shipped',
    COMPLETED:           'Exchange completed',
    CANCELLED:           'Exchange request cancelled',
    UNDER_REVIEW:        'Exchange request is under review',
  };

  const updated = await Exchange.findByIdAndUpdate(
    id,
    {
      $set: {
        status: newStatus,
        ...(supplierNotes ? { supplierNotes } : {}),
        ...(newStatus === 'APPROVED' ? { supplierApprovedAt: new Date() } : {}),
        ...(newStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
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

  // Update linked order status based on exchange outcome
  if (exc.orderId) {
    if (['REJECTED', 'CANCELLED'].includes(newStatus)) {
      await Order.findByIdAndUpdate(exc.orderId, { status: 'delivered' }, { runValidators: false });
    } else if (newStatus === 'COMPLETED') {
      await Order.findByIdAndUpdate(exc.orderId, { status: 'exchange_completed' }, { runValidators: false });

      // Update S-BE Sales Invoice lineItems with replacement product details
      try {
        const sbeOrd = await Order.findOne({ dbeOrderId: String(exc.orderId) }).lean();
        if (sbeOrd) {
          const invoice = await Invoice.findOne({ orderId: sbeOrd._id }).lean();
          if (invoice && invoice.lineItems?.length > 0) {
            let modified = false;
            const updatedLineItems = invoice.lineItems.map(li => {
              const excItem = (exc.items || []).find(i => i.productId?.toString() === li.productId?.toString());
              if (!excItem || (!excItem.replacementProductId && !excItem.replacementName)) return li;
              modified = true;
              return { ...li, productId: excItem.replacementProductId || li.productId, productName: excItem.replacementName || li.productName, productCode: excItem.replacementSku || li.productCode };
            });
            if (modified) {
              await Invoice.findByIdAndUpdate(invoice._id, { $set: { lineItems: updatedLineItems } }, { runValidators: false });
              console.log(`[updateExchangeStatus] S-BE Invoice lineItems updated for exchange ${id} ✓`);
            }
          }
        }
      } catch (invErr) {
        console.error('[updateExchangeStatus] Invoice update failed:', invErr.message);
      }

      // Store exchangedItems on D-BE order for dealer invoice display
      try {
        await Order.findByIdAndUpdate(
          exc.orderId,
          { $set: { exchangedItems: (exc.items || []).map(i => ({ productId: i.productId, replacementProductId: i.replacementProductId, replacementName: i.replacementName || i.name, replacementSku: i.replacementSku || i.sku, quantity: i.quantity })) }},
          { runValidators: false, strict: false }
        );
        console.log(`[updateExchangeStatus] D-BE order exchangedItems set ✓`);
      } catch (eiErr) {
        console.error('[updateExchangeStatus] exchangedItems update failed:', eiErr.message);
      }
    }
  }

  const updatedDoc = updated.toObject ? updated.toObject() : updated;
  await notifyDealerExchange(updatedDoc, newStatus);

  return updatedDoc;
};

module.exports = { getExchanges, getExchangeById, updateExchangeStatus };
