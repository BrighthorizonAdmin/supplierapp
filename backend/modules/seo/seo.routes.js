const express = require('express');
const {
  listSeoPages,
  getSeoPage,
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
  getPublicSeoPage,
} = require('./seo.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = express.Router();

router.get('/public', getPublicSeoPage);

router.use(authenticate);
router.get('/', authorize('seo:read'), listSeoPages);
router.get('/:id', authorize('seo:read'), getSeoPage);
router.post('/', authorize('seo:write'), createSeoPage);
router.put('/:id', authorize('seo:write'), updateSeoPage);
router.delete('/:id', authorize('seo:write'), deleteSeoPage);

module.exports = router;
