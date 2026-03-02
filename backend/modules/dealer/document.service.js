const Document = require('./model/Document.model');
const Dealer = require('./model/Dealer.model');
const { AppError } = require('../../middlewares/error.middleware');
const auditService = require('../audit/audit.service');
const fs = require('fs');
const path = require('path');

const uploadDocument = async ({ dealerId, documentType, file, userId }) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);

  const doc = await Document.create({
    dealerId,
    documentType,
    fileName: file.filename,
    originalName: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedBy: userId,
  });

  await auditService.log('dealer', dealerId, 'update', userId, { after: { documentUploaded: documentType } });
  return doc;
};

const getDealerDocuments = async (dealerId) => {
  const dealer = await Dealer.findById(dealerId);
  if (!dealer) throw new AppError('Dealer not found', 404);

  return Document.find({ dealerId })
    .populate('uploadedBy', 'name email')
    .populate('verifiedBy', 'name email')
    .lean();
};

const verifyDocument = async (documentId, userId) => {
  const doc = await Document.findByIdAndUpdate(
    documentId,
    { isVerified: true, verifiedBy: userId, verifiedAt: new Date() },
    { new: true }
  );
  if (!doc) throw new AppError('Document not found', 404);

  await auditService.log('dealer', doc.dealerId, 'update', userId, { after: { documentVerified: doc.documentType } });
  return doc;
};

const deleteDocument = async (documentId, userId) => {
  const doc = await Document.findById(documentId);
  if (!doc) throw new AppError('Document not found', 404);

  // Remove physical file
  try {
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
  } catch {
    // File may already be gone
  }

  await doc.deleteOne();
  await auditService.log('dealer', doc.dealerId, 'update', userId, { after: { documentDeleted: doc.documentType } });
};

module.exports = { uploadDocument, getDealerDocuments, verifyDocument, deleteDocument };
