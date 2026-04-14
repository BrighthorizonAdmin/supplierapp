const SupportTicket      = require('./model/SupportTicket.model');
const notificationService = require('../notifications/notification.service');
const { getPagination, buildMeta } = require('../../utils/pagination');
const axios  = require('axios');

const DEALER_API_URL        = process.env.DEALER_API_URL        || 'http://localhost:5000';
const DEALER_WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET || '';

// Notify dealer backend when supplier updates a ticket
async function notifyDealerBackend(dbeId, type, status, adminNotes, resolvedAt) {
  try {
    await axios.post(
      `${DEALER_API_URL}/api/support/webhook/status-update`,
      { type, dbeId, status, adminNotes, resolvedAt },
      {
        headers: { 'x-webhook-secret': DEALER_WEBHOOK_SECRET, 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
  } catch (err) {
    console.error('[Support] Dealer webhook status-update failed:', err.message);
  }
}

const getAll = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.type)   filter.type   = query.type;
  if (query.search) {
    filter.$or = [
      { ticketNumber: { $regex: query.search, $options: 'i' } },
      { dealerName:   { $regex: query.search, $options: 'i' } },
      { message:      { $regex: query.search, $options: 'i' } },
      { description:  { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupportTicket.countDocuments(filter),
  ]);

  // KPI counts
  const [openCount, inProgressCount] = await Promise.all([
    SupportTicket.countDocuments({ status: 'OPEN' }),
    SupportTicket.countDocuments({ status: 'IN_PROGRESS' }),
  ]);

  return { data, pagination: buildMeta(total, page, limit), openCount, inProgressCount };
};

const getById = async (id) => {
  return SupportTicket.findById(id).populate('assignedTo', 'name email').lean();
};

const updateStatus = async (id, { status, adminNotes, priority, assignedTo }, updatedByUserId) => {
  const ticket = await SupportTicket.findById(id);
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

  const prevStatus = ticket.status;
  if (status)     ticket.status     = status;
  if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
  if (priority)   ticket.priority   = priority;
  if (assignedTo) ticket.assignedTo = assignedTo;
  if (status === 'RESOLVED' || status === 'CLOSED') ticket.resolvedAt = new Date();
  await ticket.save();

  // Push status update back to dealer backend (non-blocking)
  if (ticket.dbeTicketId && status && status !== prevStatus) {
    const dbeType = ticket.type === 'SERVICE_REQUEST' ? 'SERVICE_REQUEST' : 'SUPPORT_TICKET';
    notifyDealerBackend(ticket.dbeTicketId, dbeType, status, adminNotes, ticket.resolvedAt);
  }

  // Notify all supplier users with support permission via socket
  try {
    const { emitToRole } = require('../../websocket/socket');
    emitToRole('admin', 'support:ticket_updated', {
      ticketId: ticket._id, ticketNumber: ticket.ticketNumber, status,
    });
  } catch { /* socket may not be available in tests */ }

  return ticket;
};

// Create ticket from dealer webhook
const createFromWebhook = async (data, type) => {
  // Idempotent based on dbeTicketId / dbeRequestId
  const dbeId = data.dbeTicketId || data.dbeRequestId;
  const existing = await SupportTicket.findOne({ dbeTicketId: dbeId });
  if (existing) return existing;

  // Try to match dealer in S-Be
  let dealerObjectId = null;
  try {
    const Dealer = require('../dealer/model/Dealer.model');
    const dealer = await Dealer.findOne({
      $or: [
        { phone: data.dealerPhone?.replace(/\D/g, '').slice(-10) },
        { email: data.dealerEmail?.toLowerCase() },
      ],
    }).lean();
    if (dealer) dealerObjectId = dealer._id;
  } catch { /* ignore */ }

  const ticketData = {
    dbeTicketId:  dbeId,
    ticketNumber: data.ticketNumber,
    type,
    dealerId:    dealerObjectId,
    dealerName:  data.dealerName,
    dealerPhone: data.dealerPhone,
    dealerEmail: data.dealerEmail,
    status: 'OPEN',
  };

  if (type === 'GENERAL') {
    Object.assign(ticketData, { topic: data.topic, name: data.name, phone: data.phone, message: data.message });
  } else {
    Object.assign(ticketData, {
      productId: data.productId, productName: data.productName,
      productSku: data.productSku, issueType: data.issueType,
      description: data.description, contactPhone: data.contactPhone,
    });
  }

  const ticket = await SupportTicket.create(ticketData);

  // Notify all admin/support users
  try {
    const User = require('../auth/model/User.model');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title:       `New ${type === 'GENERAL' ? 'Support Ticket' : 'Service Request'}: ${data.ticketNumber}`,
        message:     `From ${data.dealerName}${type === 'GENERAL' ? ` — ${data.topic}` : ` — ${data.issueType}`}`,
        type:        'info',
        relatedEntity: { entityType: 'SupportTicket', entityId: ticket._id },
      });
    }
  } catch (err) { console.error('[Support] Notify admins failed:', err.message); }

  return ticket;
};

module.exports = { getAll, getById, updateStatus, createFromWebhook };