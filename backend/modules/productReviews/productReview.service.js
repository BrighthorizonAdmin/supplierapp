const mongoose = require('mongoose');
const ProductReview = require('./model/ProductReview.model');
const { AppError } = require('../../middlewares/error.middleware');

const STATUSES = ['pending', 'approved', 'rejected'];
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const list = async ({ status = 'pending', search = '', rating, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (STATUSES.includes(status)) filter.status = status;
  if (Number(rating) >= 1 && Number(rating) <= 5) filter.rating = Number(rating);
  if (String(search).trim()) {
    const re = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ productName: re }, { name: re }, { email: re }, { phone: re }, { comment: re }, { title: re }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [data, total, counts] = await Promise.all([
    ProductReview.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * perPage).limit(perPage).lean(),
    ProductReview.countDocuments(filter),
    ProductReview.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const statusCounts = { pending: 0, approved: 0, rejected: 0 };
  counts.forEach((c) => { if (c._id in statusCounts) statusCounts[c._id] = c.count; });

  return {
    data,
    pagination: { page: pageNum, limit: perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    statusCounts,
  };
};

const setStatus = async (id, { status, reason }, user) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Review not found', 404);
  if (!STATUSES.includes(status)) throw new AppError('Status must be pending, approved or rejected', 400);
  const review = await ProductReview.findByIdAndUpdate(id, {
    status,
    moderatedAt: new Date(),
    moderatedBy: user?.name || user?.email || String(user?.id || ''),
    rejectionReason: status === 'rejected' ? String(reason || '').trim().slice(0, 300) : '',
  }, { returnDocument: 'after' }).lean();
  if (!review) throw new AppError('Review not found', 404);
  return review;
};

// Removes the review record. Its photos/videos are stored by the website API
// (dealerManagementBackend uploads/reviews) under unguessable names and are no
// longer linked from anywhere once the record is gone.
const remove = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Review not found', 404);
  const review = await ProductReview.findByIdAndDelete(id).lean();
  if (!review) throw new AppError('Review not found', 404);
  return review;
};

module.exports = { list, setStatus, remove };
