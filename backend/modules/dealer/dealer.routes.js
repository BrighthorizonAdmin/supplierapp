const express = require('express');
const {
  createDealer, getDealers, getDealerById, approveDealer,
  rejectDealer, suspendDealer, reactivateDealer, updateDealer, getDealerStats,
  requestUpdate, 
} = require('./dealer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.post('/webhook/application', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  console.log('[Webhook] received key:', apiKey);
  console.log('[Webhook] expected key:', process.env.DEALER_WEBHOOK_SECRET);
  if (apiKey !== process.env.DEALER_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const body = { ...req.body };

    // Sanitize phone — strip +91, spaces, dashes → keep last 10 digits
    if (body.phone) {
      const digits = body.phone.replace(/\D/g, '');
      body.phone = digits.length >= 10 ? digits.slice(-10) : digits;
    }

    // Sanitize email — lowercase trim
    if (body.email) body.email = body.email.toLowerCase().trim();

    // Normalise document field — D-BE sends either 'submittedDocuments' or 'documents'
    // Always store under 'submittedDocuments' to match the Dealer model field name
    if (!body.submittedDocuments && body.documents) {
      body.submittedDocuments = body.documents;
    }
    delete body.documents; // remove so it doesn't get spread as an unknown field

    console.log('[Webhook] creating dealer for applicationId:', body.applicationId, 'email:', body.email);
    const dealer = await require('./dealer.service').createFromWebhook(body);
    console.log('[Webhook] dealer saved:', dealer._id || dealer.applicationId);
    return res.status(201).json({ success: true, data: dealer });
  } catch (err) {
    console.error('[Webhook] createFromWebhook failed:', err.message);
    console.error('[Webhook] full error:', err.stack);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route  POST /api/dealers/webhook/application-updated
 * @desc   Called by Dealer-BE when a dealer resubmits after an UPDATE_REQUESTED.
 *         Resets the supplier-side dealer record back to 'pending' so it
 *         reappears in the Pending tab with a "Resubmitted" badge.
 * @access Webhook (x-api-key)
 */
router.post('/webhook/application-updated', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DEALER_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const {
      applicationId, businessName, ownerName, email,
      phone, gstNumber, address, documents,
    } = req.body;

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }

    const Dealer = require('./model/Dealer.model');
    const dealer = await Dealer.findOne({ applicationId });

    if (!dealer) {
      return res
        .status(404)
        .json({ success: false, message: 'Dealer record not found for this applicationId' });
    }

    // Update core fields from the resubmission payload
    if (businessName) dealer.businessName = businessName;
    if (ownerName)    dealer.ownerName    = ownerName;
    if (email)        dealer.email        = email.toLowerCase().trim();
    if (gstNumber)    dealer.gstNumber    = gstNumber;
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      dealer.phone = digits.length >= 10 ? digits.slice(-10) : digits;
    }
    if (address?.city) {
      dealer.address = {
        ...(dealer.address?.toObject ? dealer.address.toObject() : dealer.address || {}),
        city: address.city,
      };
    }

    // Store the updated documents so the supplier can review them inline
    if (documents && typeof documents === 'object') {
      dealer.submittedDocuments = {
        gst:  documents.gst  || dealer.submittedDocuments?.gst,
        pan:  documents.pan  || dealer.submittedDocuments?.pan,
        bank: documents.bank || dealer.submittedDocuments?.bank,
      };
    }

    // Reset to pending so the application reappears in the Pending tab
    dealer.status            = 'pending';
    dealer.kycStatus         = 'pending';
    dealer.lastResubmittedAt = new Date();

    await dealer.save();

    console.log(`[Webhook] application-updated: ${applicationId} reset to pending`);
    return res.status(200).json({ success: true, data: dealer });
  } catch (err) {
    console.error('[Webhook] application-updated failed:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authenticate);

router.get('/', authorize('dealer:read'), getDealers);
router.post('/', authorize('dealer:write'), createDealer);
router.get('/:id', authorize('dealer:read'), getDealerById);
router.put('/:id', authorize('dealer:write'), updateDealer);
router.get('/:id/stats', authorize('dealer:read'), getDealerStats);
router.patch('/:id/approve', authorize('dealer:write'), approveDealer);
router.patch('/:id/reject', authorize('dealer:write'), rejectDealer);
router.patch('/:id/suspend', authorize('dealer:write'), suspendDealer);
router.patch('/:id/reactivate', authorize('dealer:write'), reactivateDealer);
router.patch('/:id/request-update', authorize('dealer:write'), requestUpdate);

module.exports = router;