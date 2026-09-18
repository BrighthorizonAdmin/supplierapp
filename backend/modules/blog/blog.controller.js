const blogService = require('./blog.service');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = await blogService.getAll(req.query);
  return paginated(res, data, pagination);
});

const getById = asyncHandler(async (req, res) => {
  const blog = await blogService.getById(req.params.id);
  if (!blog) return res.status(404).json({ success: false, message: 'Blog post not found' });
  return success(res, blog, 'Blog post fetched');
});

const create = asyncHandler(async (req, res) => {
  if (req.file) {
    const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
    req.body.coverImage = `${baseUrl}/uploads/blogs/${req.file.filename}`;
  }
  if (req.body.tags && typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);
  const blog = await blogService.create(req.body, req.user?._id);
  return success(res, blog, 'Blog post created', 201);
});

const update = asyncHandler(async (req, res) => {
  if (req.file) {
    const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
    req.body.coverImage = `${baseUrl}/uploads/blogs/${req.file.filename}`;
  }
  if (req.body.tags && typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);
  const blog = await blogService.update(req.params.id, req.body);
  return success(res, blog, 'Blog post updated');
});

const remove = asyncHandler(async (req, res) => {
  await blogService.remove(req.params.id);
  return success(res, null, 'Blog post deleted');
});

module.exports = { getAll, getById, create, update, remove };
