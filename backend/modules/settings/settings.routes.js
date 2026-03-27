const express = require('express');
const { getSettings, updateSettings } = require('./settings.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
