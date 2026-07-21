const enquiryService = require('./websiteEnquiry.service');
const asyncHandler    = require('../../utils/asyncHandler');
const { success }     = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const { data, pagination, newCount } = await enquiryService.getAll(req.query);
  return res.json({
    success: true,
    data,
    pagination,
    meta: { newCount },
  });
});

const getById = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.getById(req.params.id);
  if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
  return success(res, enquiry, 'Enquiry fetched');
});

const updateStatus = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.updateStatus(req.params.id, req.body);
  return success(res, enquiry, 'Enquiry updated');
});

module.exports = { getAll, getById, updateStatus };
