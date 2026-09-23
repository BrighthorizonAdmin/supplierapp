const mongoose = require('mongoose');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const blogSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true, maxlength: 200 },
  slug:       { type: String, required: true, unique: true, trim: true, lowercase: true },
  excerpt:    { type: String, trim: true, maxlength: 400 },
  content:    { type: String, required: true }, // rich-text HTML from the admin editor
  coverImage: { type: String, trim: true }, // relative path, e.g. /uploads/blogs/xxx.jpg

  // Matches the site's solution verticals so posts can be surfaced on the
  // matching Retail / Restaurant / Pharmacy / Hospitality pages later.
  category: {
    type: String,
    enum: ['Retail', 'Restaurant', 'Pharmacy', 'Hospitality', 'Cafe', 'Supermarket', 'Warehouse', 'General'],
    default: 'General',
  },
  tags:   [{ type: String, trim: true }],
  author: { type: String, trim: true, default: 'BUVVAS Team' },

  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  publishedAt: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });

blogSchema.pre('validate', async function () {
  if (this.slug || !this.title) return;
  const base = slugify(this.title);
  let candidate = base;
  let n = 1;
  while (await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  this.slug = candidate;
});

blogSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

module.exports = mongoose.model('Blog', blogSchema);
