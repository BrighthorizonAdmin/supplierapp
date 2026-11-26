// Editor layouts that mirror the Buvvas storefront pages (buvvas_ecommerce_fed).
// Each layout lists the page's editable blocks in the order they appear on the website,
// and only shows the fields that page actually renders for each section key.
//
// Group variants:
//   block  – one or more full-width heading/description blocks
//   cards  – a grid of feature / benefit cards
//   faq    – question & answer accordion items
//   policy – numbered policy clauses (title + opening paragraph)

import { SITE_PAGE_LAYOUTS } from './seoSiteLayouts';

const DESCRIPTION = ['description'];
const BOTH = ['heading', 'description'];

export const PAGE_LAYOUTS = {
  '/about': {
    hero: {
      title: 'Hero video banner',
      items: [{
        key: 'about-hero', title: 'Hero label', fields: ['eyebrow'],
        defaults: { eyebrow: 'ABOUT BUVVAS' },
      }],
    },
    groups: [
      {
        title: 'Hero stats',
        hint: 'The four counters at the bottom of the hero video.',
        variant: 'cards',
        items: [
          ['7+', 'Years Experience'],
          ['100+', 'Businesses Served'],
          ['Pan India', 'Support'],
          ['Complete', 'POS Hardware Solutions'],
        ].map(([heading, description], index) => ({
          key: `about-stat-${index + 1}`,
          title: `Stat ${index + 1}`,
          fields: BOTH,
          labels: { heading: 'Value', description: 'Label' },
          defaults: { heading, description },
        })),
      },
      {
        title: 'Our Vision & Mission',
        variant: 'block',
        items: [
          {
            key: 'vision', title: 'Our Vision', fields: ['eyebrow', 'heading', 'description', 'points'],
            defaults: {
              eyebrow: 'OUR VISION',
              points: [
                'Reliable POS and billing hardware for every business',
                'Honest guidance, so you buy only what you need',
                'Quality products backed by installation and after-sales support',
                'Technology that grows with you, from one counter to many outlets',
              ].join('\n'),
            },
          },
          {
            key: 'mission', title: 'Our Mission', fields: BOTH,
            labels: { heading: 'Label', description: 'Mission statement' },
          },
        ],
      },
      {
        title: 'How BUVVAS Works',
        variant: 'block',
        items: [
          {
            key: 'about-how-intro', title: 'Section introduction', fields: ['eyebrow', 'heading', 'description'],
            defaults: {
              eyebrow: 'HOW BUVVAS WORKS',
              heading: 'Four Teams. One Complete Solution.',
              description: 'Every team at BUVVAS plays an important role in delivering the right products, developing digital solutions and providing reliable customer assistance from the first enquiry to after-sales support.',
            },
          },
          ...[
            ['What BUVVAS Does', 'BUVVAS provides complete POS and billing hardware solutions that help businesses manage their daily operations efficiently.', [
              'POS systems and billing machines', 'Thermal receipt and label printers', 'Barcode scanners and cash drawers',
              'Solutions for retail, restaurants, cafes and other businesses', 'Reliable products to support smooth business operations',
            ]],
            ['What Sales Team Does', 'Our sales team understands each customer’s business requirements and helps them choose the right products.', [
              'Understand customer needs and business type', 'Explain product features and specifications',
              'Recommend suitable POS and billing solutions', 'Share product details and quotations',
              'Coordinate with customers throughout the purchase process',
            ]],
            ['What Technical Team Does', 'Our IT team develops and maintains the digital platforms and software solutions that power BUVVAS operations and make online business easier.', [
              'Develop and maintain billing software solutions', 'Build and manage the BUVVAS dealer portal',
              'Develop and maintain web applications', 'Create and improve online ordering platforms',
              'Enhance website features and digital business operations', 'Maintain system performance, functionality and updates',
            ]],
            ['What Customer Support Does', 'Our customer support team is available 24/7 to assist customers with product-related questions, technical concerns and service requirements.', [
              'Provide 24/7 customer assistance', 'Guide customers through product installation and setup',
              'Help configure POS systems and connect devices', 'Assist with printers, barcode scanners and other hardware',
              'Resolve technical issues and troubleshoot problems', 'Provide product usage guidance and after-sales support',
            ]],
          ].map(([heading, description, points], index) => ({
            key: `about-how-${index + 1}`,
            title: `Step 0${index + 1}`,
            fields: ['heading', 'description', 'points'],
            labels: { points: 'Steps (one per line)' },
            defaults: { heading, description, points: points.join('\n') },
          })),
          {
            key: 'about-how-closing', title: 'Closing line', fields: DESCRIPTION,
            defaults: { description: 'At BUVVAS, our teams work together to provide dependable products, innovative digital platforms, technical solutions and 24/7 customer support.' },
          },
        ],
      },
      {
        title: 'Our Journey',
        variant: 'block',
        items: [
          {
            key: 'about-journey-intro', title: 'Section introduction', fields: ['eyebrow', 'heading', 'description'],
            defaults: {
              eyebrow: 'OUR JOURNEY',
              heading: 'Growing with businesses across India',
              description: 'From our beginning to today, discover how BUVVAS continues to grow.',
            },
          },
          ...[
            ['FOUNDATION', 'November 28, 2019', 'The Beginning of BUVVAS', 'BUVVAS started with a vision to provide reliable POS and billing solutions.'],
            ['EXPANSION', 'Our Growth', 'Serving Different Businesses', 'Expanded our solutions for retail stores, pharmacies, restaurants and cafes.'],
            ['NEW SOLUTIONS', 'Expanding Our Solutions', 'A Complete Product Range', 'Introduced POS systems, printers, barcode scanners, cash drawers and kiosks.'],
            ['OUR PRESENT', 'Today', 'Growing Across India', 'Providing reliable billing hardware and support to businesses across India.'],
          ].map(([eyebrow, subheading, heading, description], index) => ({
            key: `about-timeline-${index + 1}`,
            title: `Milestone ${index + 1}`,
            fields: ['eyebrow', 'subheading', 'heading', 'description'],
            labels: { eyebrow: 'Tag', subheading: 'Date / period' },
            defaults: { eyebrow, subheading, heading, description },
          })),
        ],
      },
      {
        title: 'Meet Our Team',
        variant: 'block',
        items: [
          {
            key: 'about-team-intro', title: 'Section introduction', fields: ['eyebrow', 'heading', 'description'],
            defaults: {
              eyebrow: 'MEET OUR TEAM',
              heading: 'The People Behind BUVVAS',
              description: 'Meet the people who work together every day to serve our customers and make BUVVAS what it is.',
            },
          },
        ],
      },
      {
        title: 'Team members',
        variant: 'cards',
        items: [
          ['CH.BALAKRISHNA', 'DIRECTOR', 'Provides leadership and strategic direction to BUVVAS, guiding the company’s growth while ensuring a strong focus on quality, customer satisfaction and reliable business solutions.'],
          ['V.PRASANTH REDDY', 'HEAD OF SALES', 'Leads the sales team, builds strong customer relationships and helps businesses identify the right POS and billing solutions to meet their operational requirements.'],
          ['K.SHOBA RANI', 'DIGITAL MARKETING MANAGER', 'Oversees digital marketing activities, brand communication and online engagement, helping strengthen BUVVAS’s digital presence and connect with more businesses.'],
          ['R.BHANU CHANDU', 'TECHNICAL SUPPORT LEAD', 'Leads technical support activities, assisting customers with product setup, troubleshooting and technical guidance to ensure smooth and reliable business operations.'],
        ].map(([heading, eyebrow, description], index) => ({
          key: `about-team-${index + 1}`,
          title: `Member ${index + 1}`,
          fields: ['heading', 'eyebrow', 'description'],
          labels: { heading: 'Name', eyebrow: 'Role', description: 'Message' },
          defaults: { heading, eyebrow, description },
        })),
      },
      {
        title: 'Brand statement banner',
        variant: 'block',
        items: [{
          key: 'about-brand-statement', title: 'Blue banner', fields: BOTH,
          labels: { description: 'Quote' },
          defaults: {
            heading: 'Powering Every Transaction. Simplifying Every Business.',
            description: 'From intelligent billing software and reliable POS hardware to essential business consumables, BUVVAS brings everything together to help restaurants and retail businesses operate smarter and grow confidently.',
          },
        }],
      },
      {
        title: 'BUVVAS in Action',
        variant: 'block',
        items: [{
          key: 'about-action-intro', title: 'Photo gallery section', fields: ['eyebrow', 'heading', 'description', 'subheading'],
          labels: { subheading: 'Tagline below the gallery' },
          defaults: {
            eyebrow: 'OUR WORK',
            heading: 'BUVVAS in Action',
            description: 'A closer look at our people, products and the businesses we support every day.',
            subheading: 'REAL WORK. REAL PEOPLE. REAL SOLUTIONS.',
          },
        }],
      },
      {
        title: 'Voices of Trust',
        variant: 'block',
        items: [
          {
            key: 'about-voices-intro', title: 'Customer stories introduction', fields: ['eyebrow', 'heading', 'subheading', 'description'],
            labels: { subheading: 'Highlighted second line' },
            defaults: {
              eyebrow: 'VOICES OF TRUST',
              heading: 'Stories That Speak',
              subheading: 'Trust That Lasts.',
              description: 'Real businesses. Real experiences. Discover how BUVVAS helps businesses work smarter with dependable POS and billing solutions.',
            },
          },
          {
            key: 'about-voices-closing', title: 'Closing line', fields: DESCRIPTION,
            defaults: { description: 'Every business has a story. We are proud to be part of theirs.' },
          },
        ],
      },
      {
        title: 'Dealers',
        variant: 'block',
        items: [{
          key: 'about-dealers', title: 'Dealer partner banner', fields: ['eyebrow', 'heading', 'description', 'points'],
          labels: { points: 'Dealer perks (one per line)' },
          defaults: {
            eyebrow: 'DEALERS',
            heading: 'Grow with BUVVAS as a dealer partner',
            description: 'Find a BUVVAS dealer near you, or join our network and bring reliable billing hardware to your city.',
            points: [
              'Attractive dealer pricing with strong margins',
              'Co-branded kits, leads and campaign support',
              'Complete product and sales training',
              'Dedicated dealer helpline and fast replacement',
            ].join('\n'),
          },
        }],
      },
      {
        title: 'Google Reviews',
        hint: 'Shown only when Google reviews are available.',
        variant: 'block',
        items: [{
          key: 'about-reviews', title: 'Reviews heading', fields: ['eyebrow', 'heading'],
          defaults: { eyebrow: 'GOOGLE REVIEWS', heading: 'What Our Customers Say' },
        }],
      },
    ],
  },
  ...SITE_PAGE_LAYOUTS,
};

export const DEFAULT_PAGE_LAYOUT = { hero: { title: 'Page header' }, groups: [] };

const COMMON_FIELD_LABELS = {
  eyebrow: 'Small label above heading',
  subheading: 'Subheading',
  points: 'Bullet points (one per line)',
};

export const VARIANT_FIELD_LABELS = {
  block: { ...COMMON_FIELD_LABELS, heading: 'Heading', description: 'Description' },
  cards: { ...COMMON_FIELD_LABELS, heading: 'Title', description: 'Description' },
  faq: { ...COMMON_FIELD_LABELS, heading: 'Question', description: 'Answer' },
  policy: { ...COMMON_FIELD_LABELS, heading: 'Clause title', description: 'Opening paragraph' },
};

/** Layout items in page order, for building prefilled sections. */
export const getLayoutItems = (layout) => [
  ...(layout.hero?.items || []),
  ...layout.groups.flatMap((group) => group.items),
];

export const getPageLayout = (routePath = '') => {
  const routeKey = String(routePath || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
  return PAGE_LAYOUTS[routeKey] || DEFAULT_PAGE_LAYOUT;
};

export const getLayoutSectionKeys = (layout) => new Set([
  ...(layout.hero?.items || []).map((item) => item.key),
  ...layout.groups.flatMap((group) => group.items.map((item) => item.key)),
]);

// Website pages the SEO Manager can configure, used by the page picker on new records.
export const WEBSITE_PAGE_OPTIONS = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/brand', 'Why BUVVAS'],
  ['/products', 'Products'],
  ['/products/:categorySlug', 'Product category (template)'],
  ['/products/:categorySlug/:productSlug', 'Product details (template)'],
  ['/solutions', 'Solutions'],
  ['/solutions/retail', 'Solutions – Retail'],
  ['/solutions/restaurant', 'Solutions – Restaurant'],
  ['/solutions/pharmacy', 'Solutions – Pharmacy'],
  ['/solutions/hospitality', 'Solutions – Hospitality'],
  ['/dealers', 'Dealers'],
  ['/partner', 'Partner With BUVVAS'],
  ['/franchise', 'Franchise'],
  ['/support', 'Support'],
  ['/get-quote', 'Get a Quote'],
  ['/career', 'Careers'],
  ['/blog', 'Blog'],
  ['/blog/:slug', 'Blog post (template)'],
  ['/privacy-policy', 'Privacy Policy'],
];
