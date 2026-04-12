const express    = require('express');
const router     = express.Router();       // for /api/support
const whRouter   = express.Router();      // for /api/webhooks
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize }    = require('../../middlewares/rbac.middleware');
const supportService   = require('./support.service');
const { getAll, getById, updateStatus } = require('./support.controller');

const WEBHOOK_SECRET = process.env.DEALER_WEBHOOK_SECRET || '';

// ── Webhook receivers (registered at /api/webhooks/*) ────────────────────────
whRouter.post('/dealer-support-ticket', async (req, res) => {
  try {
    if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET)
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    const ticket = await supportService.createFromWebhook(req.body, 'GENERAL');
    return res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    console.error('[SupportWebhook] error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

whRouter.post('/dealer-service-request', async (req, res) => {
  try {
    if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET)
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    const ticket = await supportService.createFromWebhook(req.body, 'SERVICE_REQUEST');
    return res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    console.error('[SupportWebhook] error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ── Protected CRUD (registered at /api/support/*) ───────────────────────────
router.use(authenticate);
router.get('/',     authorize('support:read'),  getAll);
router.get('/:id',  authorize('support:read'),  getById);
router.patch('/:id/status', authorize('support:write'), updateStatus);

module.exports = { router, whRouter };