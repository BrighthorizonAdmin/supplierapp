const documentService = require('./document.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const doc = await documentService.uploadDocument({
    dealerId: req.params.dealerId || req.body.dealerId,
    documentType: req.body.documentType,
    file: req.file,
    userId: req.user.id,
  });
  return success(res, doc, 'Document uploaded successfully', 201);
});

const getDealerDocuments = asyncHandler(async (req, res) => {
  const docs = await documentService.getDealerDocuments(req.params.dealerId);
  return success(res, docs, 'Documents fetched');
});

const verifyDocument = asyncHandler(async (req, res) => {
  const doc = await documentService.verifyDocument(req.params.id, req.user.id);
  return success(res, doc, 'Document verified');
});

const deleteDocument = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.user.id);
  return success(res, null, 'Document deleted');
});

module.exports = { uploadDocument, getDealerDocuments, verifyDocument, deleteDocument };
