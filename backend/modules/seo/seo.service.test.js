const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSeoPayload } = require('./seo.service');

const pagePayload = (overrides = {}) => ({
  pageName: 'Home',
  pageType: 'home',
  routePath: '/',
  pageHeading: 'Welcome to Buvvas',
  pageDescription: 'POS hardware for growing businesses.',
  homeContent: {
    heroSlides: [{ imageUrl: '/images/home-hero.webp', altText: 'POS checkout', link: '/products' }],
    stats: [{ value: '10,000+', label: 'Happy Businesses' }],
    featuredHardware: { title: 'Featured Hardware', description: 'Explore essential devices.' },
    whyChoose: {
      title: 'Why choose Buvvas?',
      items: [{ title: 'Expert Support', description: 'Help whenever you need it.' }],
    },
  },
  ...overrides,
});

test('normalizes editable homepage section content', () => {
  const payload = normalizeSeoPayload(pagePayload());

  assert.equal(payload.pageHeading, 'Welcome to Buvvas');
  assert.equal(payload.homeContent.heroSlides[0].imageUrl, '/images/home-hero.webp');
  assert.equal(payload.homeContent.stats[0].label, 'Happy Businesses');
  assert.equal(payload.homeContent.whyChoose.items[0].title, 'Expert Support');
});

test('rejects unsafe homepage image URLs', () => {
  assert.throws(
    () => normalizeSeoPayload(pagePayload({
      homeContent: { heroSlides: [{ imageUrl: 'javascript:alert(1)' }] },
    })),
    /Hero image URL must be an HTTP or HTTPS URL/
  );
});

test('restricts homepage section content to the home route', () => {
  assert.throws(
    () => normalizeSeoPayload(pagePayload({ pageType: 'about', routePath: '/about' })),
    /Homepage section content can only be saved for the home route/
  );
});

test('normalizes editable copy for route-specific page sections', () => {
  const payload = pagePayload({
    pageType: 'about',
    routePath: '/about',
    pageSections: [{
      key: 'vision',
      label: 'Our Vision',
      heading: '  A clearer heading  ',
      description: '  Updated page copy.  ',
    }],
  });
  delete payload.homeContent;

  const normalized = normalizeSeoPayload(payload);

  assert.deepEqual(normalized.pageSections, [{
    key: 'vision',
    label: 'Our Vision',
    heading: 'A clearer heading',
    description: 'Updated page copy.',
  }]);
});

test('rejects duplicate editable page section keys', () => {
  const payload = pagePayload({
    pageSections: [
      { key: 'vision', label: 'Vision', heading: 'Vision', description: 'First.' },
      { key: 'vision', label: 'Mission', heading: 'Mission', description: 'Second.' },
    ],
  });

  assert.throws(
    () => normalizeSeoPayload(payload),
    /Page section key "vision" is duplicated/
  );
});

test('keeps optional page section fields only when they are filled', () => {
  const payload = pagePayload({
    pageType: 'about',
    routePath: '/about',
    pageSections: [{
      key: 'about-dealers',
      label: 'Dealers',
      eyebrow: ' DEALERS ',
      heading: 'Grow with BUVVAS',
      subheading: '',
      description: 'Join our network.',
      points: 'Strong margins\nTraining',
    }],
  });
  delete payload.homeContent;

  assert.deepEqual(normalizeSeoPayload(payload).pageSections, [{
    key: 'about-dealers',
    label: 'Dealers',
    heading: 'Grow with BUVVAS',
    description: 'Join our network.',
    eyebrow: 'DEALERS',
    points: 'Strong margins\nTraining',
  }]);
});

test('sanitizes formatted page section descriptions', () => {
  const payload = pagePayload({
    pageType: 'about',
    routePath: '/about',
    pageDescription: '<h2 class="ql-align-center">Intro</h2><p><strong>Bold</strong> <span class="ql-font-serif">serif</span></p><script>alert(1)</script>',
    pageSections: [
      { key: 'vision', label: 'Vision', heading: 'Vision', description: '<p><br></p>' },
      { key: 'mission', label: 'Mission', heading: 'Mission', description: 'Plain text & more' },
    ],
  });
  delete payload.homeContent;

  const normalized = normalizeSeoPayload(payload);

  assert.equal(
    normalized.pageDescription,
    '<h2 style="text-align:center">Intro</h2><p><strong>Bold</strong> <span style="font-family:serif">serif</span></p>'
  );
  assert.equal(normalized.pageSections[0].description, '');
  assert.equal(normalized.pageSections[1].description, 'Plain text & more');
});

