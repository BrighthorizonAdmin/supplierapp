const sanitizeHtml = require('sanitize-html');
const SeoPage = require('./model/SeoPage.model');
const { AppError } = require('../../middlewares/error.middleware');
const { getPagination, buildMeta } = require('../../utils/pagination');

const MAX_PAGE_SECTIONS = 60;
const PAGE_TYPES = ['home', 'about', 'products', 'product-detail', 'solutions', 'dealers', 'blog', 'blog-post', 'faq', 'custom'];
const ROBOTS_OPTIONS = ['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'];
const SEO_FIELDS = [
  'pageName', 'pageType', 'routePath', 'metaTitle', 'metaDescription', 'keywords',
  'canonicalUrl', 'robots', 'socialTitle', 'socialDescription', 'socialImageUrl',
  'imageAltTexts', 'pageHeading', 'pageDescription', 'pageSections', 'homeContent', 'contentHtml', 'status',
];

const richContentOptions = {
  allowedTags: [
    'a', 'blockquote', 'br', 'em', 'h1', 'h2', 'h3', 'h4', 'hr', 'li', 'ol',
    'p', 's', 'span', 'strong', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedStyles: {
    '*': {
      'font-family': [/^[a-z0-9 ,'"-]+$/i],
      'font-size': [/^(?:\d+(?:\.\d+)?(?:px|em|rem|%)|small|large|x-large|xx-large)$/i],
      'text-align': [/^(?:left|right|center|justify)$/i],
      color: [/^#[0-9a-f]{3,8}$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    ...Object.fromEntries(['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote'].map((tag) => [tag, (tagName, attributes) => {
      const align = (attributes.class || '').match(/ql-align-(center|right|justify)/);
      const style = [attributes.style, align ? `text-align: ${align[1]}` : ''].filter(Boolean).join('; ');
      return { tagName, attribs: style ? { style } : {} };
    }])),
    span: (tagName, attributes) => {
      const classes = (attributes.class || '').split(/\s+/);
      const styles = [];
      if (classes.includes('ql-font-serif')) styles.push('font-family: serif');
      if (classes.includes('ql-font-monospace')) styles.push('font-family: monospace');
      if (classes.includes('ql-size-small')) styles.push('font-size: 0.75em');
      if (classes.includes('ql-size-large')) styles.push('font-size: 1.5em');
      if (classes.includes('ql-size-huge')) styles.push('font-size: 2.5em');

      const existingStyle = attributes.style || '';
      return {
        tagName,
        attribs: {
          ...attributes,
          style: [existingStyle, ...styles].filter(Boolean).join('; '),
        },
      };
    },
  },
};

const sanitizeRichContent = (content) => sanitizeHtml(String(content || ''), richContentOptions);

const normalizeRoutePath = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('A page route is required', 400);
  }

  const routePath = value.trim().toLowerCase();
  if (
    routePath.length > 500
    || !routePath.startsWith('/')
    || routePath.startsWith('//')
    || routePath.includes('//')
    || /[?#\\\s]/.test(routePath)
    || routePath.split('/').some((segment) => segment === '.' || segment === '..')
    || !/^\/[a-z0-9._:/-]*$/.test(routePath)
  ) {
    throw new AppError('Enter a valid website path, such as /about or /products/:slug', 400);
  }

  return routePath.length > 1 ? routePath.replace(/\/+$/, '') : routePath;
};

const requireWebUrl = (value, label, allowRelative = false) => {
  if (!value) return '';
  if (allowRelative && value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
  } catch {
    throw new AppError(`${label} must be an HTTP or HTTPS URL`, 400);
  }
  return value;
};

const normalizeOptionalText = (value, label, maxLength) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} must be text`, 400);
  const text = value.trim();
  if (text.length > maxLength) throw new AppError(`${label} must be ${maxLength} characters or fewer`, 400);
  return text;
};

const MAX_DESCRIPTION_LENGTH = 10000;
const looksLikeHtml = (value) => /<\/?[a-z][^>]*>/i.test(value);

/** Descriptions may be plain text or formatted HTML from the SEO Manager's rich text editor. */
const normalizeDescription = (value, label) => {
  const text = normalizeOptionalText(value, label, MAX_DESCRIPTION_LENGTH);
  if (!text || !looksLikeHtml(text)) return text;
  const html = sanitizeRichContent(text).trim();
  // An editor left empty produces markup such as <p><br></p>; store it as blank.
  return html.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() ? html : '';
};

const normalizeHomeContent = (content) => {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new AppError('Homepage content must be an object', 400);
  }

  const normalizeObject = (value, label) => {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError(`${label} must be an object`, 400);
    }
    return value;
  };
  const normalizeList = (value, label, maxItems, mapper, hasContent) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new AppError(`${label} must be a list`, 400);
    if (value.length > maxItems) throw new AppError(`${label} cannot contain more than ${maxItems} items`, 400);
    return value.filter((item) => item && hasContent(item)).map(mapper);
  };

  const heroSlides = normalizeList(
    content.heroSlides,
    'Hero slides',
    12,
    (slide) => {
      const imageUrlText = normalizeOptionalText(slide.imageUrl === undefined ? '' : slide.imageUrl, 'Hero image URL', 2048);
      const imageUrl = requireWebUrl(imageUrlText, 'Hero image URL', true);
      if (!imageUrl) throw new AppError('Each hero slide needs an image URL or path', 400);
      return {
        imageUrl,
        altText: normalizeOptionalText(slide.altText === undefined ? '' : slide.altText, 'Hero image alt text', 250),
        link: requireWebUrl(
          normalizeOptionalText(slide.link === undefined ? '' : slide.link, 'Hero slide link', 2048),
          'Hero slide link',
          true
        ),
      };
    },
    (slide) => Boolean(String(slide.imageUrl || slide.altText || slide.link || '').trim())
  );
  const stats = normalizeList(
    content.stats,
    'Homepage stats',
    6,
    (stat) => {
      const value = normalizeOptionalText(stat.value === undefined ? '' : stat.value, 'Stat value', 80);
      const label = normalizeOptionalText(stat.label === undefined ? '' : stat.label, 'Stat label', 120);
      if (!value || !label) throw new AppError('Each homepage stat needs a value and label', 400);
      return { value, label };
    },
    (stat) => Boolean(String(stat.value || stat.label || '').trim())
  );
  const whyChoose = normalizeObject(content.whyChoose, 'Why Choose Buvvas content');
  const whyItems = normalizeList(
    whyChoose.items,
    'Why Choose Buvvas items',
    12,
    (item) => {
      const title = normalizeOptionalText(item.title === undefined ? '' : item.title, 'Why Choose title', 120);
      const description = normalizeOptionalText(item.description === undefined ? '' : item.description, 'Why Choose description', 500);
      if (!title || !description) throw new AppError('Each Why Choose Buvvas item needs a title and description', 400);
      return { title, description };
    },
    (item) => Boolean(String(item.title || item.description || '').trim())
  );
  const featuredHardware = normalizeObject(content.featuredHardware, 'Featured Hardware content');

  return {
    heroSlides,
    stats,
    featuredHardware: {
      eyebrow: normalizeOptionalText(featuredHardware.eyebrow === undefined ? '' : featuredHardware.eyebrow, 'Featured Hardware eyebrow', 100),
      title: normalizeOptionalText(featuredHardware.title === undefined ? '' : featuredHardware.title, 'Featured Hardware heading', 120),
      description: normalizeOptionalText(featuredHardware.description === undefined ? '' : featuredHardware.description, 'Featured Hardware description', 500),
    },
    whyChoose: {
      eyebrow: normalizeOptionalText(whyChoose.eyebrow === undefined ? '' : whyChoose.eyebrow, 'Why Choose eyebrow', 100),
      title: normalizeOptionalText(whyChoose.title === undefined ? '' : whyChoose.title, 'Why Choose heading', 120),
      items: whyItems,
    },
  };
};

const normalizeSeoPayload = (data, userId) => {
  const payload = {};
  SEO_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) payload[field] = data[field];
  });

  payload.pageName = typeof payload.pageName === 'string' ? payload.pageName.trim() : '';
  if (!payload.pageName) throw new AppError('Page name is required', 400);

  if (!PAGE_TYPES.includes(payload.pageType)) throw new AppError('Choose a valid page type', 400);
  payload.routePath = normalizeRoutePath(payload.routePath);
  payload.isTemplate = payload.routePath.includes(':');

  if (payload.pageHeading !== undefined) {
    payload.pageHeading = normalizeOptionalText(payload.pageHeading, 'Page heading', 160);
  }
  if (payload.pageDescription !== undefined) {
    payload.pageDescription = normalizeDescription(payload.pageDescription, 'Page description');
  }
  if (payload.pageSections !== undefined) {
    if (!Array.isArray(payload.pageSections)) throw new AppError('Page sections must be a list', 400);
    if (payload.pageSections.length > MAX_PAGE_SECTIONS) {
      throw new AppError(`A page cannot contain more than ${MAX_PAGE_SECTIONS} editable sections`, 400);
    }
    const sectionKeys = new Set();
    payload.pageSections = payload.pageSections
      .filter((section) => section && (section.key || section.label || section.heading || section.description))
      .map((section) => {
        const key = normalizeOptionalText(section.key === undefined ? '' : section.key, 'Section key', 80);
        const label = normalizeOptionalText(section.label === undefined ? '' : section.label, 'Section label', 120);
        const heading = normalizeOptionalText(section.heading === undefined ? '' : section.heading, 'Section heading', 160);
        const description = normalizeDescription(section.description === undefined ? '' : section.description, 'Section description');
        // Optional fields: only stored when filled, so the website keeps its built-in text otherwise.
        const optional = {};
        [['eyebrow', 'Section label text', 120], ['subheading', 'Section subheading', 200], ['points', 'Section bullet points', 4000]]
          .forEach(([field, fieldLabel, maxLength]) => {
            const value = normalizeOptionalText(section[field] === undefined || section[field] === null ? '' : section[field], fieldLabel, maxLength);
            if (value) optional[field] = value;
          });
        if (!key || !/^[a-z0-9._-]+$/.test(key)) {
          throw new AppError('Each page section needs a key using lowercase letters, numbers, dots, underscores, or hyphens', 400);
        }
        if (!label) throw new AppError('Each page section needs a label', 400);
        if (sectionKeys.has(key)) throw new AppError(`Page section key "${key}" is duplicated`, 400);
        sectionKeys.add(key);
        return { key, label, heading, description, ...optional };
      });
  }

  if (payload.keywords === undefined) payload.keywords = [];
  if (typeof payload.keywords === 'string') payload.keywords = payload.keywords.split(',');
  if (!Array.isArray(payload.keywords)) throw new AppError('Keywords must be a list', 400);
  payload.keywords = [...new Set(payload.keywords.map((keyword) => String(keyword).trim()).filter(Boolean))].slice(0, 30);

  if (payload.canonicalUrl !== undefined) {
    payload.canonicalUrl = requireWebUrl(String(payload.canonicalUrl).trim(), 'Canonical URL');
  }
  if (payload.socialImageUrl !== undefined) {
    payload.socialImageUrl = requireWebUrl(String(payload.socialImageUrl).trim(), 'Social image URL', true);
  }
  if (payload.robots !== undefined && !ROBOTS_OPTIONS.includes(payload.robots)) {
    throw new AppError('Choose a valid indexing rule', 400);
  }
  if (payload.status !== undefined && !['draft', 'published'].includes(payload.status)) {
    throw new AppError('Status must be draft or published', 400);
  }

  if (payload.imageAltTexts !== undefined) {
    if (!Array.isArray(payload.imageAltTexts)) throw new AppError('Image alt text must be a list', 400);
    payload.imageAltTexts = payload.imageAltTexts
      .filter((image) => image && (image.imageUrl || image.altText))
      .map((image) => ({
        imageUrl: requireWebUrl(String(image.imageUrl || '').trim(), 'Image URL', true),
        altText: String(image.altText || '').trim(),
      }));
    if (payload.imageAltTexts.some((image) => !image.imageUrl)) {
      throw new AppError('Each image alt text entry needs an image URL or path', 400);
    }
  }

  if (payload.contentHtml !== undefined) {
    payload.contentHtml = sanitizeRichContent(payload.contentHtml);
  }
  if (payload.homeContent !== undefined) {
    if (payload.pageType !== 'home' || payload.routePath !== '/') {
      throw new AppError('Homepage section content can only be saved for the home route', 400);
    }
    payload.homeContent = normalizeHomeContent(payload.homeContent);
  }
  if (userId) payload.updatedBy = userId;
  return payload;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listSeoPages = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const match = {};
  if (PAGE_TYPES.includes(query.pageType)) match.pageType = query.pageType;
  if (['draft', 'published'].includes(query.status)) match.status = query.status;
  if (typeof query.search === 'string' && query.search.trim()) {
    const search = new RegExp(escapeRegex(query.search.trim().slice(0, 100)), 'i');
    match.$or = [{ pageName: search }, { routePath: search }, { metaTitle: search }];
  }

  const [data, total] = await Promise.all([
    SeoPage.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    SeoPage.countDocuments(match),
  ]);
  return { data, pagination: buildMeta(total, page, limit) };
};

const getSeoPage = async (id) => {
  const page = await SeoPage.findById(id).lean();
  if (!page) throw new AppError('SEO page not found', 404);
  return page;
};

const createSeoPage = async (data, userId) => SeoPage.create(normalizeSeoPayload(data, userId));

const updateSeoPage = async (id, data, userId) => {
  const page = await SeoPage.findById(id);
  if (!page) throw new AppError('SEO page not found', 404);
  Object.assign(page, normalizeSeoPayload(data, userId));
  await page.save();
  return page;
};

const deleteSeoPage = async (id) => {
  const page = await SeoPage.findById(id);
  if (!page) throw new AppError('SEO page not found', 404);
  await page.deleteOne();
};

const matchRouteTemplate = (template, routePath) => {
  const templateParts = template.split('/').filter(Boolean);
  const routeParts = routePath.split('/').filter(Boolean);
  if (templateParts.length !== routeParts.length) return null;

  const params = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const part = templateParts[index];
    if (part.startsWith(':')) params[part.slice(1)] = routeParts[index];
    else if (part !== routeParts[index]) return null;
  }
  return params;
};

const toPublicPage = (page, routeParams = {}, matchedPath = page.routePath) => {
  const applyRouteParams = (value) => String(value || '').replace(
    /\{\{([a-z0-9_-]+)\}\}/gi,
    (_, key) => routeParams[key] || ''
  );
  return {
    pageName: page.pageName,
    pageType: page.pageType,
    routePath: page.routePath,
    matchedPath,
    routeParams,
    metaTitle: applyRouteParams(page.metaTitle),
    metaDescription: applyRouteParams(page.metaDescription),
    keywords: (page.keywords || []).map(applyRouteParams),
    canonicalUrl: applyRouteParams(page.canonicalUrl),
    robots: page.robots,
    socialTitle: applyRouteParams(page.socialTitle),
    socialDescription: applyRouteParams(page.socialDescription),
    socialImageUrl: applyRouteParams(page.socialImageUrl),
    pageHeading: applyRouteParams(page.pageHeading),
    pageDescription: applyRouteParams(page.pageDescription),
    pageSections: (page.pageSections || []).map((section) => ({
      ...section,
      eyebrow: applyRouteParams(section.eyebrow),
      heading: applyRouteParams(section.heading),
      subheading: applyRouteParams(section.subheading),
      description: applyRouteParams(section.description),
      points: applyRouteParams(section.points),
    })),
    imageAltTexts: (page.imageAltTexts || []).map((image) => ({
      imageUrl: applyRouteParams(image.imageUrl),
      altText: applyRouteParams(image.altText),
    })),
    homeContent: page.homeContent ? {
      heroSlides: (page.homeContent.heroSlides || []).map((slide) => ({
        imageUrl: applyRouteParams(slide.imageUrl),
        altText: applyRouteParams(slide.altText),
        link: applyRouteParams(slide.link),
      })),
      stats: page.homeContent.stats || [],
      featuredHardware: page.homeContent.featuredHardware || {},
      whyChoose: {
        ...page.homeContent.whyChoose,
        items: page.homeContent.whyChoose?.items || [],
      },
    } : undefined,
    contentHtml: sanitizeRichContent(applyRouteParams(page.contentHtml)),
    isTemplate: page.isTemplate,
  };
};

const getPublicSeoPage = async (requestedPath) => {
  const routePath = normalizeRoutePath(requestedPath);
  const exactPage = await SeoPage.findOne({ routePath, status: 'published' }).lean();
  if (exactPage) return toPublicPage(exactPage, {});

  const templates = await SeoPage.find({ isTemplate: true, status: 'published' }).lean();
  const matchedTemplate = templates
    .map((page) => ({ page, params: matchRouteTemplate(page.routePath, routePath) }))
    .filter((match) => match.params !== null)
    .sort((a, b) => b.page.routePath.split('/').filter((part) => !part.startsWith(':')).length
      - a.page.routePath.split('/').filter((part) => !part.startsWith(':')).length)[0];
  if (!matchedTemplate) throw new AppError('Published SEO page not found', 404);
  return toPublicPage(matchedTemplate.page, matchedTemplate.params, routePath);
};

module.exports = {
  listSeoPages,
  getSeoPage,
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
  getPublicSeoPage,
  sanitizeRichContent,
  normalizeSeoPayload,
};
