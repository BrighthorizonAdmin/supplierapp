const WebsiteEnquiry = require('./model/WebsiteEnquiry.model');
const notificationService = require('../notifications/notification.service');
const { getPagination, buildMeta } = require('../../utils/pagination');

// ── getAll ────────────────────────────────────────────────────────────────────
const getAll = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.search) {
    filter.$or = ['name', 'mobile', 'email', 'enquiryNumber', 'message'].map((f) => ({
      [f]: { $regex: query.search, $options: 'i' },
    }));
  }

  const [data, total, newCount] = await Promise.all([
    WebsiteEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WebsiteEnquiry.countDocuments(filter),
    WebsiteEnquiry.countDocuments({ status: 'NEW' }),
  ]);

  return { data, pagination: buildMeta(total, page, limit), newCount };
};

// ── getById ───────────────────────────────────────────────────────────────────
const getById = async (id) => {
  return WebsiteEnquiry.findById(id).populate('assignedTo', 'name email').lean();
};

// ── updateStatus ──────────────────────────────────────────────────────────────
const updateStatus = async (id, { status, adminNotes, assignedTo }) => {
  const doc = await WebsiteEnquiry.findById(id);
  if (!doc) throw Object.assign(new Error('Enquiry not found'), { statusCode: 404 });

  if (status) doc.status = status;
  if (adminNotes !== undefined) doc.adminNotes = adminNotes;
  if (assignedTo) doc.assignedTo = assignedTo;
  if (status === 'CONVERTED' || status === 'CLOSED') doc.resolvedAt = new Date();
  await doc.save();

  try {
    const { emitToRole } = require('../../websocket/socket');
    emitToRole('admin', 'enquiry:status_updated', {
      enquiryId: doc._id, enquiryNumber: doc.enquiryNumber, status: doc.status,
    });
  } catch { /* socket may not be available in tests */ }

  return doc.toObject();
};

// ── createFromWebhook ─────────────────────────────────────────────────────────
const createFromWebhook = async (data) => {
  const dbeId = data.dbeLeadId;
  const existing = await WebsiteEnquiry.findOne({ dbeLeadId: dbeId });
  if (existing) return existing;

  const enquiry = await WebsiteEnquiry.create({
    dbeLeadId:    dbeId,
    name:         data.name,
    mobile:       data.mobile,
    email:        data.email || '',
    businessType: data.businessType || '',
    message:      data.message || '',
    source:       data.source || 'other',
  });

  try {
    const User = require('../auth/model/User.model');
    const { emitToAll } = require('../../websocket/socket');
    const { ENQUIRY_NEW } = require('../../websocket/events');
    const admins = await User.find({ isActive: true }).lean();
    for (const admin of admins) {
      await notificationService.create({
        recipientId: admin._id,
        title:       `New Website Enquiry: ${enquiry.enquiryNumber}`,
        message:     `${data.name} submitted an enquiry from the Buvvas website`,
        type:        'info',
        relatedEntity: { entityType: 'WebsiteEnquiry', entityId: enquiry._id },
      });
    }
    emitToAll(ENQUIRY_NEW, {
      enquiryId: enquiry._id, enquiryNumber: enquiry.enquiryNumber, name: enquiry.name,
    });
  } catch (err) { console.error('[WebsiteEnquiry] Notify admins failed:', err.message); }

  return enquiry;
};

module.exports = { getAll, getById, updateStatus, createFromWebhook };
