const service = require('./productReview.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/response');

const listReviews = asyncHandler(async (req, res) => {
  const { data, pagination, statusCounts } = await service.list(req.query);
  return res.status(200).json({ success: true, message: 'Success', data, pagination, statusCounts });
});

const updateReviewStatus = asyncHandler(async (req, res) => {
  const review = await service.setStatus(req.params.id, req.body || {}, req.user);
  return success(res, review, `Review ${review.status}`);
});

const deleteReview = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return success(res, null, 'Review deleted');
});

module.exports = { listReviews, updateReviewStatus, deleteReview };
