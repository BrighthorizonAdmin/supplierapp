const MarketingLead = require('./model/MarketingLead.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');
const auditService = require('../audit/audit.service');

const STAGE_ORDER = ['lead-creation', 'document-collection', 'admin-review', 'approval'];

const createLead = async (data, userId) => {
  const payload = { ...data, createdBy: userId };
  if (data.assignedTo === '') delete payload.assignedTo;

  const lead = await MarketingLead.create(payload);

  // Auto-add lead-creation activity log
  lead.callLogs.push({
    outcome: 'other',
    notes: `Lead added to the System by ${data._creatorName || 'Admin'}.`,
    loggedBy: userId,
    loggedAt: new Date(),
  });

  // If initial call log filled in, add it too
  if (data.initialCallOutcome) {
    lead.callLogs.push({
      outcome: data.initialCallOutcome,
      notes: data.initialCallNotes || '',
      followUpDate: data.nextFollowUpDate || null,
      loggedBy: userId,
      loggedAt: new Date(),
    });
  }

  await lead.save();
  await auditService.log('marketingLead', lead._id, 'create', userId, { after: lead.toObject() });
  return lead.populate([{ path: 'createdBy', select: 'name email' }, { path: 'assignedTo', select: 'name email' }]);
};

const getLeads = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.status) match.status = query.status;
  if (query.pipelineStage) match.pipelineStage = query.pipelineStage;
  if (query.kycStatus) match.kycStatus = query.kycStatus;
  if (query.createdBy) match.createdBy = query.createdBy;
  if (query.search) {
    match.$or = [
      { businessName: { $regex: query.search, $options: 'i' } },
      { primaryContact: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
      { leadCode: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    MarketingLead.find(match)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('callLogs.loggedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    MarketingLead.countDocuments(match),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getLeadById = async (id) => {
  const lead = await MarketingLead.findById(id)
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('callLogs.loggedBy', 'name email')
    .lean({ virtuals: true });
  if (!lead) throw new AppError('Marketing lead not found', 404);
  return lead;
};

const updateLead = async (id, updates, userId) => {
  const lead = await MarketingLead.findById(id);
  if (!lead) throw new AppError('Marketing lead not found', 404);

  const before = lead.toObject();
  const allowed = ['businessName', 'primaryContact', 'email', 'phone', 'leadSource', 'address', 'assignedTo', 'status', 'nextFollowUpDate', 'initialCallOutcome', 'initialCallNotes', 'kycStatus'];
  allowed.forEach((key) => { if (updates[key] !== undefined) lead[key] = updates[key]; });

  await lead.save();
  await auditService.log('marketingLead', id, 'update', userId, { before, after: lead.toObject() });
  return lead.populate([{ path: 'createdBy', select: 'name email' }, { path: 'assignedTo', select: 'name email' }]);
};

const logCall = async (id, callData, userId) => {
  const lead = await MarketingLead.findById(id);
  if (!lead) throw new AppError('Marketing lead not found', 404);

  lead.callLogs.push({
    outcome: callData.outcome,
    notes: callData.notes || '',
    followUpDate: callData.followUpDate || null,
    loggedBy: userId,
    loggedAt: new Date(),
  });

  // Update initial call fields if first real call
  if (callData.outcome !== 'other') {
    lead.initialCallOutcome = callData.outcome;
    lead.initialCallNotes = callData.notes || lead.initialCallNotes;
  }
  if (callData.followUpDate) lead.nextFollowUpDate = callData.followUpDate;

  if (callData.outcome === 'not-interested') {
    lead.status = 'not-interested';
  } else if (lead.status === 'not-interested' && callData.outcome !== 'not-interested') {
    lead.status = 'active';
  }

  await lead.save();
  await auditService.log('marketingLead', id, 'logCall', userId, { call: callData });
  return lead.populate([{ path: 'createdBy', select: 'name email' }, { path: 'callLogs.loggedBy', select: 'name' }]);
};

const requestDocuments = async (id, userId) => {
  const lead = await MarketingLead.findById(id);
  if (!lead) throw new AppError('Marketing lead not found', 404);

  lead.documentsRequested = true;
  lead.documentsRequestedAt = new Date();
  lead.pipelineStage = 'document-collection';
  lead.kycStatus = 'pending-kyc';

  lead.callLogs.push({
    outcome: 'form-sent',
    notes: 'Document collection link sent to dealer.',
    loggedBy: userId,
    loggedAt: new Date(),
  });

  await lead.save();
  await auditService.log('marketingLead', id, 'requestDocuments', userId, {});
  return lead;
};

const advancePipeline = async (id, userId) => {
  const lead = await MarketingLead.findById(id);
  if (!lead) throw new AppError('Marketing lead not found', 404);

  const currentIdx = STAGE_ORDER.indexOf(lead.pipelineStage);
  if (currentIdx === STAGE_ORDER.length - 1) throw new AppError('Lead is already at final stage', 400);

  lead.pipelineStage = STAGE_ORDER[currentIdx + 1];

  // Auto-update kycStatus when moving to admin-review
  if (lead.pipelineStage === 'admin-review') lead.kycStatus = 'kyc-submitted';
  if (lead.pipelineStage === 'approval') lead.kycStatus = 'kyc-verified';

  await lead.save();
  await auditService.log('marketingLead', id, 'advancePipeline', userId, { stage: lead.pipelineStage });
  return lead;
};

const deleteLead = async (id, userId) => {
  const lead = await MarketingLead.findByIdAndDelete(id);
  if (!lead) throw new AppError('Marketing lead not found', 404);
  await auditService.log('marketingLead', id, 'delete', userId, { before: lead.toObject() });
  return { deleted: true };
};

const getLeadStats = async () => {
  const [total, active, converted, documentCollection, adminReview] = await Promise.all([
    MarketingLead.countDocuments({}),
    MarketingLead.countDocuments({ status: 'active' }),
    MarketingLead.countDocuments({ status: 'converted' }),
    MarketingLead.countDocuments({ pipelineStage: 'document-collection' }),
    MarketingLead.countDocuments({ pipelineStage: 'admin-review' }),
  ]);
  return { total, active, converted, documentCollection, adminReview };
};

module.exports = { createLead, getLeads, getLeadById, updateLead, logCall, requestDocuments, advancePipeline, deleteLead, getLeadStats };