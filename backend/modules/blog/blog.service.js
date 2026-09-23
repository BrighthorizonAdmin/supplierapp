const Blog = require('./model/Blog.model');
const { getPagination, buildMeta } = require('../../utils/pagination');

const getAll = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.search) {
    filter.$or = ['title', 'excerpt', 'tags'].map((f) => ({
      [f]: { $regex: query.search, $options: 'i' },
    }));
  }

  const [data, total] = await Promise.all([
    Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);

  return { data, pagination: buildMeta(total, page, limit) };
};

const getById = async (id) => Blog.findById(id).lean();

const create = async (payload, userId) => {
  return Blog.create({ ...payload, createdBy: userId });
};

const update = async (id, payload) => {
  const blog = await Blog.findById(id);
  if (!blog) throw Object.assign(new Error('Blog post not found'), { statusCode: 404 });

  // Clearing slug lets the pre-validate hook regenerate it if the title changed.
  if (payload.title && payload.title !== blog.title && !payload.slug) {
    blog.slug = undefined;
  }

  Object.assign(blog, payload);
  await blog.save();
  return blog;
};

const remove = async (id) => {
  const blog = await Blog.findByIdAndDelete(id);
  if (!blog) throw Object.assign(new Error('Blog post not found'), { statusCode: 404 });
  return blog;
};

module.exports = { getAll, getById, create, update, remove };
