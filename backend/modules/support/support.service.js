const SupportTicket  = require('./model/SupportTicket.model');
const ServiceRequest = require('./model/ServiceRequest.model');
const notificationService = require('../notifications/notification.service');
const { getPagination, buildMeta } = require('../../utils/pagination');
const axios = require('axios');

// NOTE: DEALER_API_URL and DEALER_WEBHOOK_SECRET are intentionally read from
// process.env inside the function — not captured as module-level constants —
// so they always reflect the actual loaded env values on the server.

async function notifyDealerBackend(dbeId, type, status, adminNotes, priority, resolvedAt) {
  const DEALER_API_URL = process.env.DEALER_API_URL;
  const DEALER_WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET || '';

  if (!DEALER_API_URL) {
    console.error('[Support] DEALER_API_URL is not set — cannot notify dealer backend');
    return;
  }

  try {
    await axios.post(
      `${DEALER_API_URL}/api/support/webhook/status-update`,
      { type, dbeId, status, adminNotes, priority, resolvedAt },
      {
        headers: { 'x-webhook-secret': DEALER_WEBHOOK_SECRET, 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
    console.log(`[Support] Dealer webhook status-update success for dbeId: ${dbeId}`);
  } catch (err) {
    console.error('[Support] Dealer webhook status-update failed:', err.message);
    console.error('[Support] URL attempted:', `${DEALER_API_URL}/api/support/webhook/status-update`);
    console.error('[Support] Response:', JSON.stringify(err.response?.data));
  }
}

// ── Resolve dealer ObjectId from phone/email ──────────────────────────────────
async function resolveDealerId(dealerPhone, dealerEmail) {
  try {
    const Dealer = require('../dealer/model/Dealer.model');
    const dealer = await Dealer.findOne({
      $or: [
        { phone: dealerPhone?.replace(/\D/g, '').slice(-10) },
        { email: dealerEmail?.toLowerCase() },
      ],
    }).lean();
    return dealer?._id || null;
  } catch { return null; }
}

// ── getAll ────────────────────────────────────────────────────────────────────
const getAll = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);

  const buildSearch = (fields) => {
    if (!query.search) return {};
    return {
      $or: fields.map(f => ({
        [f]: { $regex: query.search, $options: 'i' }
      }))
    };
  };

  const type = query.type || 'ALL';

  let serviceData = [];
  let generalData = [];

  // SERVICE REQUEST
  if (type === 'SERVICE_REQUEST' || type === 'ALL') {
    const serviceFilter = {
      dbeRequestId: { $exists: true },
      ...(query.status && { status: query.status }),
      ...buildSearch(['ticketNumber', 'dealerName', 'description'])
    };

    serviceData = await ServiceRequest.find(serviceFilter).lean();
  }

  // GENERAL SUPPORT
  if (type === 'GENERAL' || type === 'ALL') {
    const generalFilter = {
      type: 'GENERAL',
      ...(query.status && { status: query.status }),
      ...buildSearch(['ticketNumber', 'dealerName', 'message'])
    };

    generalData = await SupportTicket.find(generalFilter).lean();
  }

  // merge
  const merged = [
    ...serviceData.map(d => ({ ...d, type: 'SERVICE_REQUEST' })),
    ...generalData.map(d => ({ ...d, type: 'GENERAL' }))
  ];

  // sort
  const sorted = merged.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  // paginate
  const paginated = sorted.slice(skip, skip + limit);

  // counts
  const openCount = merged.filter(i => i.status === 'OPEN').length;
  const inProgressCount = merged.filter(i => i.status === 'IN_PROGRESS').length;

  return {
    data: paginated,
    pagination: buildMeta(merged.length, page, limit),
    openCount,
    inProgressCount
  };
};
// ── getById — checks both collections ────────────────────────────────────────
const getById = async (id) => {
  const ticket = await SupportTicket.findById(id).populate('assignedTo', 'name email').lean();
  if (ticket) return ticket;
  const sr = await ServiceRequest.findById(id).populate('assignedTo', 'name email').lean();
  return sr ? { ...sr, type: 'SERVICE_REQUEST' } : null;
};

// ── updateStatus — handles both collections ───────────────────────────────────
const updateStatus = async (id, { status, adminNotes, priority, assignedTo }, updatedByUserId) => {
  let doc = await SupportTicket.findById(id);
  let isServiceRequest = false;

  if (!doc) {
    doc = await ServiceRequest.findById(id);
    isServiceRequest = true;
  }
  if (!doc) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  if (status)              doc.status     = status;
  if (adminNotes !== undefined) doc.adminNotes = adminNotes;
  if (priority)            doc.priority   = priority;
  if (assignedTo)          doc.assignedTo = assignedTo;
  if (status === 'RESOLVED' || status === 'CLOSED') doc.resolvedAt = new Date();
  await doc.save();

  const dbeId = isServiceRequest ? doc.dbeRequestId : doc.dbeTicketId;
  if (dbeId) {
    notifyDealerBackend(
      dbeId,
      isServiceRequest ? 'SERVICE_REQUEST' : 'SUPPORT_TICKET',
      doc.status, adminNotes, priority, doc.resolvedAt
    );
  }

  try {
    const { emitToRole } = require('../../websocket/socket');
    emitToRole('admin', 'support:ticket_updated', {
      ticketId: doc._id, ticketNumber: doc.ticketNumber, status,
    });
  } catch { /* socket may not be available in tests */ }

  return { ...doc.toObject(), type: isServiceRequest ? 'SERVICE_REQUEST' : doc.type };
};

// ── createFromWebhook — GENERAL tickets only → SupportTicket ─────────────────
const createFromWebhook = async (data) => {
  const dbeId = data.dbeTicketId;
  const existing = await SupportTicket.findOne({ dbeTicketId: dbeId });
  if (existing) return existing;

  const dealerObjectId = await resolveDealerId(data.dealerPhone, data.dealerEmail);

  const ticket = await SupportTicket.create({
    dbeTicketId:  dbeId,
    ticketNumber: data.ticketNumber,
    type:         'GENERAL',
    dealerId:     dealerObjectId,
    dealerName:   data.dealerName,
    dealerPhone:  data.dealerPhone,
    dealerEmail:  data.dealerEmail,
    topic:        data.topic,
    name:         data.name,
    phone:        data.phone,
    message:      data.message,
    status:       'OPEN',
  });

  try {
    const User = require('../auth/model/User.model');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title:       `New Support Ticket: ${data.ticketNumber}`,
        message:     `From ${data.dealerName} — ${data.topic}`,
        type:        'info',
        relatedEntity: { entityType: 'SupportTicket', entityId: ticket._id },
      });
    }
  } catch (err) { console.error('[Support] Notify admins failed:', err.message); }

  return ticket;
};

// ── createServiceRequestFromWebhook — SERVICE_REQUEST → ServiceRequest ────────
const createServiceRequestFromWebhook = async (data) => {
  const dbeId = data.dbeRequestId;
  const existing = await ServiceRequest.findOne({ dbeRequestId: dbeId });
  if (existing) return existing;

  const dealerObjectId = await resolveDealerId(data.dealerPhone, data.dealerEmail);

  const sr = await ServiceRequest.create({
    dbeRequestId: dbeId,
    ticketNumber: data.ticketNumber,
    dealerId:     dealerObjectId,
    type:         'SERVICE_REQUEST',
    dealerName:   data.dealerName,
    dealerPhone:  data.dealerPhone,
    dealerEmail:  data.dealerEmail,
    productId:    data.productId,
    productName:  data.productName,
    productSku:   data.productSku,
    issueType:    data.issueType,
    description:  data.description,
    contactPhone: data.contactPhone,
    status:       'OPEN',
  });

  try {
    const User = require('../auth/model/User.model');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title:       `New Service Request: ${data.ticketNumber}`,
        message:     `From ${data.dealerName} — ${data.issueType}`,
        type:        'info',
        relatedEntity: { entityType: 'ServiceRequest', entityId: sr._id },
      });
    }
  } catch (err) { console.error('[Support] Notify admins failed:', err.message); }

  return sr;
};

module.exports = { getAll, getById, updateStatus, createFromWebhook, createServiceRequestFromWebhook };
