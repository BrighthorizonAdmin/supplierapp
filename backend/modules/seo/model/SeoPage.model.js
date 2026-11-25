const mongoose = require('mongoose');

const imageAltTextSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    altText: { type: String, trim: true, maxlength: 250, default: '' },
  },
  { _id: false }
);

const pageSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    eyebrow: { type: String, trim: true, maxlength: 120 },
    heading: { type: String, trim: true, maxlength: 160, default: '' },
    subheading: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    points: { type: String, trim: true, maxlength: 4000 },
  },
  { _id: false }
);

const homeHeroSlideSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    altText: { type: String, trim: true, maxlength: 250, default: '' },
    link: { type: String, trim: true, maxlength: 2048, default: '' },
  },
  { _id: false }
);

const homeStatSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const homeWhyChooseItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const homeContentSchema = new mongoose.Schema(
  {
    heroSlides: { type: [homeHeroSlideSchema], default: [] },
    stats: { type: [homeStatSchema], default: [] },
    featuredHardware: {
      eyebrow: { type: String, trim: true, maxlength: 100, default: '' },
      title: { type: String, trim: true, maxlength: 120, default: '' },
      description: { type: String, trim: true, maxlength: 500, default: '' },
    },
    whyChoose: {
      eyebrow: { type: String, trim: true, maxlength: 100, default: '' },
      title: { type: String, trim: true, maxlength: 120, default: '' },
      items: { type: [homeWhyChooseItemSchema], default: [] },
    },
  },
  { _id: false }
);

const seoPageSchema = new mongoose.Schema(
  {
    pageName: { type: String, required: true, trim: true, maxlength: 120 },
    pageType: {
      type: String,
      required: true,
      enum: ['home', 'about', 'products', 'product-detail', 'solutions', 'dealers', 'blog', 'blog-post', 'faq', 'custom'],
    },
    routePath: { type: String, required: true, trim: true, unique: true, maxlength: 500 },
    isTemplate: { type: Boolean, default: false },
    metaTitle: { type: String, trim: true, maxlength: 70, default: '' },
    metaDescription: { type: String, trim: true, maxlength: 320, default: '' },
    keywords: { type: [String], default: [] },
    canonicalUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    robots: {
      type: String,
      enum: ['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'],
      default: 'index,follow',
    },
    socialTitle: { type: String, trim: true, maxlength: 100, default: '' },
    socialDescription: { type: String, trim: true, maxlength: 320, default: '' },
    socialImageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    imageAltTexts: { type: [imageAltTextSchema], default: [] },
    pageHeading: { type: String, trim: true, maxlength: 160, default: '' },
    pageDescription: { type: String, trim: true, maxlength: 10000, default: '' },
    pageSections: { type: [pageSectionSchema], default: [] },
    homeContent: { type: homeContentSchema, default: undefined },
    contentHtml: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false }
);

seoPageSchema.index({ status: 1, routePath: 1 });
seoPageSchema.index({ status: 1, isTemplate: 1 });

module.exports = mongoose.model('SeoPage', seoPageSchema);
