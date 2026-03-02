const express = require('express');
const { getLogs } = require('./audit.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('audit:read'), getLogs);

module.exports = router;
