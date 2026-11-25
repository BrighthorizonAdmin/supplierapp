const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');
const { listReviews, updateReviewStatus, deleteReview } = require('./productReview.controller');

// Moderation of Buvvas website product reviews. Customers submit reviews through
// the storefront API (dealerManagementBackend /api/product-reviews).
const router = express.Router();

router.use(authenticate);
router.get('/', authorize('reviews:read'), listReviews);
router.patch('/:id/status', authorize('reviews:write'), updateReviewStatus);
router.delete('/:id', authorize('reviews:write'), deleteReview);

module.exports = router;
