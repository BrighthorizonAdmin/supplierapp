const express   = require('express');
const router    = express.Router();  // for /api/website-enquiries
const whRouter  = express.Router();  // for /api/webhooks
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize }    = require('../../middlewares/rbac.middleware');
const enquiryService    = require('./websiteEnquiry.service');
const { getAll, getById, updateStatus } = require('./websiteEnquiry.controller');

const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET || '';

// ── Webhook receiver (registered at /api/webhooks/*) ─────────────────────────
// Called by D-BE whenever a visitor submits the "Send Us a Message" / "Get a
// Quote" form on the public Buvvas ecommerce site (Support and Get-Quote pages).
whRouter.post('/ecommerce-lead', async (req, res) => {
  try {
    if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET)
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    const enquiry = await enquiryService.createFromWebhook(req.body);
    return res.status(201).json({ success: true, data: enquiry });
  } catch (err) {
    console.error('[WebsiteEnquiryWebhook] error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ── Protected CRUD (registered at /api/website-enquiries/*) ─────────────────
router.use(authenticate);
router.get('/',     authorize('enquiries:read'),  getAll);
router.get('/:id',  authorize('enquiries:read'),  getById);
router.patch('/:id/status', authorize('enquiries:write'), updateStatus);

module.exports = { router, whRouter };
