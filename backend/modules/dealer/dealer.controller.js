const dealerService = require('./dealer.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const createDealer = asyncHandler(async (req, res) => {
  const files = req.files || {};
  const submittedDocuments = {};

  if (files.gst?.[0]) {
    submittedDocuments.gst = {
      fileName: files.gst[0].originalname,
      fileUrl: `/uploads/documents/${files.gst[0].filename}`,
      uploadedAt: new Date(),
    };
  }
  if (files.pan?.[0]) {
    submittedDocuments.pan = {
      fileName: files.pan[0].originalname,
      fileUrl: `/uploads/documents/${files.pan[0].filename}`,
      uploadedAt: new Date(),
    };
  }
  if (files.bank?.[0]) {
    submittedDocuments.bank = {
      fileName: files.bank[0].originalname,
      fileUrl: `/uploads/documents/${files.bank[0].filename}`,
      uploadedAt: new Date(),
    };
  }

  const ownerName = req.body.ownerName || req.body.name || req.body.primaryContact || '';
  const address = {
    street: req.body.street || '',
    city: req.body.district || '',
    state: req.body.state || '',
    pincode: req.body.pincode || '',
    country: req.body.country || 'India',
  };

  const payload = {
    ...req.body,
    ownerName,
    businessName: req.body.businessName,
    email: req.body.email ? req.body.email.toLowerCase().trim() : undefined,
    phone: req.body.phone ? req.body.phone.replace(/\D/g, '').slice(-10) : undefined,
    businessType: 'dealer',
    address,
    submittedDocuments: Object.keys(submittedDocuments).length ? submittedDocuments : undefined,
    autoApprove: true,
  };

  const dealer = await dealerService.createDealer(payload, req.user.id);
  return success(res, dealer, 'Dealer created successfully', 201);
});

const getDealers = asyncHandler(async (req, res) => {
  const { data, pagination } = await dealerService.getDealers(req.query);
  return paginated(res, data, pagination, 'Dealers fetched');
});

const getDealerById = asyncHandler(async (req, res) => {
  const dealer = await dealerService.getDealerById(req.params.id);
  return success(res, dealer, 'Dealer fetched');
});

const approveDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.approveDealer(req.params.id, req.body, req.user.id);
  return success(res, dealer, 'Dealer approved successfully');
});

const rejectDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.rejectDealer(req.params.id, req.body.reason, req.user.id);
  return success(res, dealer, 'Dealer rejected');
});

const requestUpdate = asyncHandler(async (req, res) => {
  // Accept both old single-field format and new multi-field array format
  const { field, fields, updateFields, instructions } = req.body;
  const dealer = await dealerService.requestUpdate(
    req.params.id,
    { field, fields, updateFields, instructions },
    req.user.id
  );
  return success(res, dealer, 'Update requested from dealer');
});

const suspendDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.suspendDealer(req.params.id, req.body.reason, req.user.id);
  return success(res, dealer, 'Dealer suspended');
});

const reactivateDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.reactivateDealer(req.params.id, req.user.id);
  return success(res, dealer, 'Dealer reactivated');
});

const updateDealer = asyncHandler(async (req, res) => {
  const dealer = await dealerService.updateDealer(req.params.id, req.body, req.user.id);
  return success(res, dealer, 'Dealer updated');
});

const getDealerStats = asyncHandler(async (req, res) => {
  const stats = await dealerService.getDealerStats(req.params.id);
  return success(res, stats, 'Dealer stats fetched');
});

module.exports = {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
  requestUpdate,
};