const express = require('express');
const { uploadDocument, getDealerDocuments, verifyDocument, deleteDocument } = require('./document.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { uploadDocument: multerUpload } = require('../../config/multer');

const router = express.Router();

router.use(authenticate);

router.get('/dealer/:dealerId', authorize('documents:read'), getDealerDocuments);
router.post('/dealer/:dealerId', authorize('documents:write'), multerUpload.single('document'), uploadDocument);
router.patch('/:id/verify', authorize('documents:write'), verifyDocument);
router.delete('/:id', authorize('documents:write'), deleteDocument);

module.exports = router;
