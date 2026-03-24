const express = require('express');
const { getSettings, updateSettings } = require('./settings.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('admin:read'), getSettings);
router.put('/', authorize('admin:write'), updateSettings);

module.exports = router;
