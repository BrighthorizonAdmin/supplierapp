const express = require('express');
const {
  createLead, getLeads, getLeadById, updateLead,
  logCall, requestDocuments, advancePipeline, deleteLead, getLeadStats,
} = require('./marketingLead.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/stats',         authorize('marketing:read'),  getLeadStats);
router.get('/',              authorize('marketing:read'),  getLeads);
router.post('/',             authorize('marketing:write'), createLead);
router.get('/:id',           authorize('marketing:read'),  getLeadById);
router.put('/:id',           authorize('marketing:write'), updateLead);
router.delete('/:id',        authorize('marketing:write'), deleteLead);
router.post('/:id/log-call', authorize('marketing:write'), logCall);
router.patch('/:id/request-documents', authorize('marketing:write'), requestDocuments);
router.patch('/:id/advance-pipeline',  authorize('marketing:write'), advancePipeline);

module.exports = router;