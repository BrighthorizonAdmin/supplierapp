const marketingLeadService = require('./marketingLead.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createLead = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.createLead(
    { ...req.body, _creatorName: req.user.name },
    req.user.id
  );
  return success(res, lead, 'Marketing lead created successfully', 201);
});

const getLeads = asyncHandler(async (req, res) => {
  const { data, pagination } = await marketingLeadService.getLeads(req.query);
  return paginated(res, data, pagination, 'Marketing leads fetched');
});

const getLeadById = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.getLeadById(req.params.id);
  return success(res, lead, 'Marketing lead fetched');
});

const updateLead = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.updateLead(req.params.id, req.body, req.user.id);
  return success(res, lead, 'Marketing lead updated');
});

const logCall = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.logCall(req.params.id, req.body, req.user.id);
  return success(res, lead, 'Call logged successfully');
});

const requestDocuments = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.requestDocuments(req.params.id, req.user.id);
  return success(res, lead, 'Document request sent');
});

const advancePipeline = asyncHandler(async (req, res) => {
  const lead = await marketingLeadService.advancePipeline(req.params.id, req.user.id);
  return success(res, lead, 'Pipeline stage advanced');
});

const deleteLead = asyncHandler(async (req, res) => {
  const result = await marketingLeadService.deleteLead(req.params.id, req.user.id);
  return success(res, result, 'Marketing lead deleted');
});

const getLeadStats = asyncHandler(async (req, res) => {
  const stats = await marketingLeadService.getLeadStats();
  return success(res, stats, 'Marketing lead stats fetched');
});

module.exports = { createLead, getLeads, getLeadById, updateLead, logCall, requestDocuments, advancePipeline, deleteLead, getLeadStats };