// SEO Manager layouts for the Buvvas storefront pages (buvvas_ecommerce_fed), except /about
// which lives in seoPageLayouts.js. Every section key and default text below matches what the
// storefront page renders, so the editor opens prefilled with the live website copy.
//
// Heading tips shown to admins: wrap words in *asterisks* to colour them blue, and use a new
// line for a line break where the website heading has one.

const FIELD_ORDER = ['eyebrow', 'heading', 'subheading', 'description', 'points'];

const orderedFields = (defaults) => FIELD_ORDER.filter((name) => name in defaults);

/** One section with its own default text; fields are taken from the defaults given. */
const block = (key, title, defaults, extra = {}) => ({
  key,
  title,
  fields: extra.fields || orderedFields(defaults),
  defaults,
  ...extra,
});

/** Numbered sections `${prefix}-1…n` built from rows of values for `fieldNames`. */
const cardList = (prefix, itemTitle, fieldNames, rows, extra = {}) => rows.map((row, index) => ({
  key: `${prefix}-${index + 1}`,
  title: `${itemTitle} ${index + 1}`,
  fields: fieldNames,
  defaults: Object.fromEntries(fieldNames.map((name, i) => [name, row[i]])),
  ...extra,
}));

/** Existing keys whose default copy comes from the form presets. */
const presetCards = (keys, fields = ['heading', 'description'], extra = {}) => keys.map((key, index) => ({
  key,
  title: extra.itemTitle ? `${extra.itemTitle} ${index + 1}` : undefined,
  fields,
  labels: extra.labels,
}));

const lines = (...items) => items.join('\n');

const HIGHLIGHT_HINT = 'Wrap words in *asterisks* to show them in blue; a new line becomes a line break.';
const STAT = { heading: 'Value', description: 'Label' };
const NAME_DESC = { heading: 'Name', description: 'Description' };
const BADGES = { points: 'Badges (one per line)' };

// ---------------------------------------------------------------- Products

const PRODUCTS_LAYOUT = {
  hero: {
    title: 'Catalogue header',
    hint: 'On /products the heading and description appear over the video banner; on category pages they replace the category name and intro.',
    items: [block('products-hero', 'Category banner label', { eyebrow: 'BUVVAS PRODUCT CATALOGUE' })],
  },
  groups: [
    {
      title: 'Shop by Category',
      variant: 'block',
      items: [block('products-categories', 'Section heading', { eyebrow: 'Find what you need', heading: 'Shop by Category' })],
    },
    {
      title: 'Featured Collections',
      hint: 'Shown on /products only.',
      variant: 'block',
      items: [block('products-collections', 'Section heading', {
        eyebrow: 'Curated for your business', heading: 'Featured Collections', subheading: 'Buvvas Collection',
      }, { labels: { subheading: 'Label on each collection card' } })],
    },
    {
      title: 'Promotional banners',
      hint: 'Shown on /products only.',
      variant: 'cards',
      items: [
        block('products-upgrade', 'Business essentials banner', { eyebrow: 'Business essentials', heading: '', description: '' }),
        block('products-complete-solution', 'Complete solution banner', { eyebrow: 'Need a complete solution?', heading: '', description: '' }),
      ],
    },
    {
      title: 'Trending Now',
      variant: 'block',
      items: [block('products-trending', 'Section introduction', { eyebrow: 'Popular with businesses', heading: '', description: '' })],
    },
    {
      title: 'Complete catalogue',
      variant: 'block',
      items: [block('products-catalogue', 'Section heading', {
        eyebrow: 'The complete range',
        heading: 'Explore All Products',
        description: 'Browse the complete Buvvas business hardware catalogue.',
      }, { hint: 'On category pages the heading shows “Explore <category>”.' })],
    },
    {
      title: 'Customer confidence strip',
      variant: 'cards',
      items: cardList('products-benefit', 'Benefit', ['heading', 'description'], [
        ['Fast Delivery', 'Across India'],
        ['Product Warranty', 'Reliable support'],
        ['Expert Support', 'Here to help'],
        ['Secure Payments', 'Shop confidently'],
      ]),
    },
    {
      title: 'Consultation banner',
      variant: 'block',
      items: [block('products-cta', 'Bottom banner', {
        heading: 'Need help choosing the right hardware?',
        description: 'Get expert guidance and a tailored quote for your business.',
      })],
    },
  ],
};

// ---------------------------------------------------------------- Careers

const CAREERS_LAYOUT = {
  hero: {
    title: 'Hero banner',
    items: [block('career-hero', 'Hero label', { eyebrow: 'CAREERS AT BUVVAS' })],
  },
  groups: [
    {
      title: 'Open positions',
      hint: 'Job postings themselves are managed in the website code.',
      variant: 'block',
      items: [block('career-openings', 'Openings introduction', { eyebrow: 'OPPORTUNITIES', heading: '', description: '' })],
    },
    {
      title: 'Why work at BUVVAS',
      variant: 'block',
      items: [block('career-values', 'Culture & values', { eyebrow: 'GROW WITH US', heading: '', description: '' })],
    },
  ],
};

// ---------------------------------------------------------------- Solution pages

const expertPopup = (prefix) => block(`${prefix}-expert-popup`, 'Talk to expert popup', {
  heading: 'Talk to Our Expert',
  description: 'Chat on WhatsApp or call us directly.',
});

export const SITE_PAGE_LAYOUTS = {
  '/': {
    hero: null,
    groups: [
      {
        title: 'Shop by category',
        variant: 'block',
        items: [block('home-categories', 'Category mosaic', {
          eyebrow: 'Explore BUVVAS',
          heading: 'Shop by category',
          subheading: 'Smart checkout',
          points: lines('POS Systems', 'Receipt Printers', 'Barcode Scanners', 'Label Printers', 'Cash Drawers'),
        }, { labels: { subheading: 'Label on the large POS tile', points: 'Tile names, in order (one per line)' } })],
      },
      {
        title: 'Promo panels',
        variant: 'cards',
        items: [
          block('home-promo-1', 'Products panel', {
            eyebrow: 'Business technology', heading: 'Latest POS & Billing Hardware',
            description: 'Smart tools for faster checkout and smoother operations.',
          }),
          block('home-promo-2', 'Solutions panel', {
            eyebrow: 'Made for your business', heading: 'Complete Business Setups',
            description: 'Find hardware and solutions that fit the way you work.',
          }),
        ],
      },
      {
        title: 'Industries we serve',
        variant: 'block',
        items: [block('home-sectors-intro', 'Section heading', {
          eyebrow: 'Industries we serve', heading: 'Solutions across business sectors',
        })],
      },
      {
        title: 'Business sectors',
        variant: 'cards',
        items: cardList('home-sector', 'Sector', ['eyebrow', 'heading', 'description'], [
          ['Food service', 'Food & Beverage (F&B)', 'Smart billing and operations for food businesses.'],
          ['Retail commerce', 'Retail & Supermarkets', 'Connected checkout and inventory for modern retail.'],
          ['Healthcare retail', 'Healthcare & Pharmacy', 'Reliable billing and stock control for pharmacies.'],
          ['Guest experiences', 'Hospitality & Entertainment', 'Seamless transactions for guest-focused venues.'],
          ['Inventory operations', 'Warehousing & Distribution', 'Visibility across inventory, storage and dispatch.'],
          ['Automated checkout', 'Self-Service & Automation', 'Faster ordering through self-service technology.'],
        ], { labels: { eyebrow: 'Tag', heading: 'Sector name' } }),
      },
      {
        title: 'Franchise opportunity',
        variant: 'block',
        items: [block('home-franchise', 'Franchise section', {
          eyebrow: 'Franchise opportunity',
          heading: 'Own a BUVVAS franchise.',
          subheading: "Grow with India's businesses.",
          description: 'Bring BUVVAS POS hardware and billing solutions to retailers, restaurants and pharmacies in your city — backed by our products, training and service network.',
        }, { labels: { subheading: 'Highlighted second line' } })],
      },
      {
        title: 'Franchise benefits',
        variant: 'cards',
        items: cardList('home-franchise-benefit', 'Benefit', ['heading', 'description'], [
          ['Established brand', 'Launch under a POS brand businesses already recognise and trust.'],
          ['Complete product range', 'POS systems, printers, scanners, cash drawers and accessories.'],
          ['Training & tech support', 'Sales, installation and after-sales guidance from day one.'],
          ['Marketing assistance', 'Brand creatives, launch support and local lead generation.'],
        ]),
      },
      {
        title: 'Franchise stats',
        variant: 'cards',
        items: cardList('home-franchise-stat', 'Stat', ['heading', 'description'], [
          ['1000+', 'Partners across India'],
          ['7+', 'Years in POS hardware'],
          ['Pan India', 'Service network'],
        ], { labels: STAT }),
      },
      {
        title: 'Franchise path to launch',
        variant: 'cards',
        items: [
          block('home-franchise-steps', 'Steps heading', { heading: 'Your path to launch' }),
          ...cardList('home-franchise-step', 'Step', ['heading', 'description'], [
            ['Apply online', 'Share your details in a short form.'],
            ['Discovery call', 'Discuss your city, goals and fit.'],
            ['Agreement & setup', 'Finalise terms and train your team.'],
            ['Launch & grow', 'Go live with ongoing support.'],
          ]),
        ],
      },
      {
        title: 'Google reviews',
        variant: 'block',
        items: [block('home-reviews-intro', 'Reviews heading', {
          eyebrow: 'Customer experiences',
          heading: 'Trusted by businesses.',
          subheading: 'Appreciated by customers.',
          description: 'Real feedback from customers who have chosen BUVVAS for their business technology needs.',
        }, { labels: { subheading: 'Highlighted second line' } })],
      },
      {
        title: 'Featured Hardware products',
        hint: 'Product cards below the Featured Hardware heading (edited in Homepage sections).',
        variant: 'cards',
        items: cardList('home-product', 'Product', ['heading', 'description'], [
          ['POS Machines', 'Android & Windows POS Systems'],
          ['Receipt Printers', 'High-Speed Thermal Printing'],
          ['Barcode Scanners', 'Fast & Accurate Scanning'],
          ['Label Printers', 'High Quality Label Printing'],
          ['Cash Drawers', 'Secure Cash Management'],
        ], { labels: NAME_DESC }),
      },
      {
        title: 'Bundle & expert panels',
        variant: 'cards',
        items: [
          block('home-promo-3', 'Bundle panel', {
            eyebrow: 'Build your setup', heading: 'Bundle Your Essentials',
            description: 'Bring your billing and printing hardware together.',
          }),
          block('home-promo-4', 'Expert panel', {
            eyebrow: 'Need a hand?', heading: 'Talk to a Product Expert',
            description: 'Get help choosing the right hardware for your business.',
          }),
        ],
      },
      {
        title: 'Trusted by',
        variant: 'block',
        items: [block('home-trusted', 'Logos heading', { eyebrow: 'Our customers', heading: 'Trusted by thousands of businesses' })],
      },
    ],
  },

  '/brand': {
    hero: {
      title: 'Hero banner',
      items: [block('brand-hero', 'Hero label & badges', {
        eyebrow: "India's smart billing infrastructure brand",
        points: lines('GST Ready', '1 Year Warranty', 'Pan India Support', 'Fast Installation'),
      }, { labels: BADGES })],
    },
    groups: [
      {
        title: 'Why choose BUVVAS',
        variant: 'block',
        items: [block('brand-why-title', 'Section heading', { eyebrow: 'WHY CHOOSE BUVVAS', heading: '' })],
      },
      {
        title: 'Why BUVVAS cards',
        variant: 'cards',
        items: presetCards(['why-faster-billing', 'why-premium-quality', 'why-easy-integration', 'why-expert-support', 'why-warranty']),
      },
      {
        title: 'Products by category',
        variant: 'block',
        items: [block('brand-products-intro', 'Section heading', { eyebrow: 'OUR PRODUCT RANGE', heading: 'Browse Products By Category' })],
      },
      {
        title: 'Trusted by',
        variant: 'block',
        items: [block('brand-trusted', 'Logos heading', { eyebrow: 'TRUSTED BY THOUSANDS OF BUSINESSES' })],
      },
    ],
  },

  '/products': PRODUCTS_LAYOUT,
  '/products/:categoryslug': PRODUCTS_LAYOUT,

  '/solutions': {
    hero: {
      title: 'About Buvvas introduction',
      hint: 'The heading and description of the “Get to know us” block below the hero image.',
      items: [block('solutions-overview', 'Section label', { eyebrow: 'GET TO KNOW US' })],
    },
    groups: [
      {
        title: 'About Buvvas',
        variant: 'block',
        items: [
          { key: 'solutions-overview-supporting', title: 'Supporting paragraph', fields: ['description'] },
          block('solutions-impact', 'Growing impact card', {
            eyebrow: 'OUR GROWING IMPACT', heading: '1071+', description: 'Businesses Empowered',
          }, { labels: { heading: 'Big number', description: 'Label' } }),
        ],
      },
      {
        title: 'Stats',
        variant: 'cards',
        items: cardList('solutions-stat', 'Stat', ['heading', 'subheading', 'description'], [
          ['1071+', 'Businesses Empowered', 'Growing businesses powered by Buvvas'],
          ['Pan India', 'Nationwide Presence', 'Serving businesses across India'],
          ['500+', 'Dealer Network', 'A growing network of partners'],
          ['24/7', 'Customer Support', 'Support when businesses need it'],
        ], { labels: { heading: 'Value', subheading: 'Label' } }),
      },
      {
        title: 'Solutions by industry',
        variant: 'block',
        items: [block('solutions-industries-intro', 'Section heading', {
          eyebrow: 'SOLUTIONS BY INDUSTRY', heading: 'Technology For', subheading: 'Every Business.',
          description: 'Explore connected business solutions built around the needs of different industries.',
        }, { labels: { subheading: 'Highlighted words' } })],
      },
      {
        title: 'Industry cards',
        variant: 'cards',
        items: cardList('solutions-industry', 'Industry', ['eyebrow', 'heading', 'description'], [
          ['F&B', 'Food & Beverage', 'Smarter restaurant, cafe and food service operations.'],
          ['SUPPLY CHAIN', 'Warehouse & Distribution', 'Stay in control of stock, inventory and distribution.'],
          ['COMMERCE', 'Retail', 'Simplify retail billing, inventory and daily operations.'],
          ['GUEST EXPERIENCE', 'Hospitality', 'Connected business solutions for hospitality operations.'],
          ['HEALTH', 'Healthcare', 'Organised billing and inventory for healthcare businesses.'],
          ['TECHNOLOGY', 'Self-service & Automation', 'Make customer interactions faster and more convenient.'],
        ], { labels: { eyebrow: 'Tag' } }),
      },
      {
        title: 'Products in action',
        variant: 'block',
        items: [block('solutions-videos-intro', 'Video section heading', {
          eyebrow: 'WATCH BUVVAS IN ACTION', heading: 'See Our Products', subheading: 'In Action.',
          description: 'Explore our product demonstrations, features and technology through videos.',
        }, { labels: { subheading: 'Highlighted words' } })],
      },
      {
        title: 'Shop by category',
        variant: 'block',
        items: [block('solutions-categories-intro', 'Section heading', {
          eyebrow: 'EXPLORE BUVVAS', heading: 'Shop By Category',
          description: 'Discover smart technology designed to power your business.',
          subheading: 'EXPLORE OUR COMPLETE PRODUCT RANGE',
        }, { fields: ['eyebrow', 'heading', 'description', 'subheading'], labels: { subheading: 'Line below the categories' } })],
      },
      {
        title: 'Why choose BUVVAS',
        variant: 'block',
        items: [block('solutions-why-intro', 'Section heading', {
          eyebrow: 'THE BUVVAS ADVANTAGE', heading: 'Why Choose BUVVAS?',
          description: 'Everything you need to simplify sourcing and grow your business.',
        })],
      },
      {
        title: 'Advantage cards',
        variant: 'cards',
        items: cardList('solutions-why', 'Card', ['heading', 'description'], [
          ['Business Expertise', 'Solutions designed around real business requirements.'],
          ['Complete Solutions', 'Hardware, software and business technology together.'],
          ['Pan India Support', 'A growing nationwide service and dealer network.'],
          ['Reliable Technology', 'Dependable products for everyday operations.'],
          ['Easy Integration', 'Solutions that work together across business operations.'],
          ['Customer First', 'Dedicated assistance and long-term support.'],
        ]),
      },
      {
        title: 'Trusted partners',
        variant: 'block',
        items: [
          block('solutions-partners-intro', 'Section heading', {
            eyebrow: 'OUR TECHNOLOGY ECOSYSTEM', heading: 'Trusted Brands.', subheading: 'Stronger Together.',
            description: 'We work with recognised technology brands to bring reliable and compatible business solutions to our customers.',
          }, { labels: { subheading: 'Highlighted words' } }),
          block('solutions-partners-footer', 'Line below the logos', { description: 'POWERED BY TRUSTED TECHNOLOGY PARTNERS' }),
        ],
      },
    ],
  },

  '/solutions/retail': {
    hero: {
      title: 'Hero banner',
      items: [
        block('retail-hero', 'Hero label & product line', {
          eyebrow: "India's smart retail billing solutions",
          points: lines('POS Machines', 'Barcode Scanners', 'Receipt Printers', 'Label Printers', 'Cash Drawers', 'Billing Software'),
        }, { labels: { points: 'Product line under the heading (one per line)' } }),
        block('retail-hero-badges', 'Feature badges', {
          points: lines('Fast Checkout', 'Real-Time Inventory', 'Accurate Billing', 'Better Business Insights'),
        }, { labels: BADGES }),
      ],
    },
    groups: [
      {
        title: 'Challenges',
        hint: HIGHLIGHT_HINT,
        variant: 'cards',
        items: [
          block('retail-challenges-intro', 'Section heading', { heading: 'IS YOUR STORE FACING THESE *CHALLENGES?*' }),
          ...cardList('retail-challenge', 'Challenge', ['heading', 'description'], [
            ['Long Billing Queues', 'Customers leave when billing takes too long.'],
            ['Manual Product Search', 'Staff waste time searching products manually.'],
            ['Inventory Confusion', 'No visibility into stock levels.'],
            ['Pricing Mistakes', 'Manual billing leads to errors.'],
          ]),
        ],
      },
      {
        title: 'Retail billing ecosystem',
        hint: HIGHLIGHT_HINT,
        variant: 'cards',
        items: [
          block('retail-ecosystem-copy', 'Section heading', {
            heading: 'ONE COMPLETE *RETAIL BILLING ECOSYSTEM*', description: '',
          }),
          ...cardList('retail-ecosystem', 'Device', ['heading', 'description'], [
            ['Barcode Scanner', 'Scan products instantly.'],
            ['Receipt Printer', 'Print bills in seconds.'],
            ['POS Machine', ''],
            ['Label Printer', 'Create professional barcode labels.'],
            ['Cash Drawer', 'Secure cash management.'],
            ['Billing Software', 'Track sales and inventory.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Powerful features',
        hint: HIGHLIGHT_HINT,
        variant: 'cards',
        items: [
          block('retail-features-intro', 'Section heading', { heading: 'POWERFUL *FEATURES* THAT GROW YOUR BUSINESS' }),
          ...presetCards(Array.from({ length: 6 }, (_, i) => `retail-feature-${i + 1}`), undefined, { itemTitle: 'Feature' }),
        ],
      },
      {
        title: 'Retail businesses we serve',
        hint: HIGHLIGHT_HINT,
        variant: 'cards',
        items: [
          block('retail-businesses-intro', 'Section heading', { heading: '*RETAIL* BUSINESSES WE SERVE' }),
          ...cardList('retail-business', 'Business', ['heading', 'description'], [
            ['Supermarkets', 'Fast checkout & inventory management'],
            ['Fashion Stores', 'Size-wise inventory & barcode billing.'],
            ['Electronics Stores', 'Product inventory & warranty tracking'],
            ['Mobile Stores', 'IMEI tracking & sales management'],
            ['Pharmacies', 'Expiry & batch tracking made easy'],
            ['Gift & Stationery', 'Quick billing & stock management'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'How it works',
        hint: HIGHLIGHT_HINT,
        variant: 'block',
        items: [block('retail-how', 'Billing flow', {
          heading: 'HOW *BUVVAS RETAIL BILLING* WORKS',
          points: lines('Product Picked', 'Barcode Scan', 'POS Billing', 'Payment Collection', 'Receipt Printing', 'Inventory Updated', 'Sales Report Generated'),
        }, { labels: { points: 'Steps (one per line)' } })],
      },
      {
        title: 'Why retailers choose BUVVAS',
        variant: 'cards',
        items: [
          block('retail-why-intro', 'Section heading', { heading: 'WHY RETAILERS CHOOSE BUVVAS' }),
          ...cardList('retail-why', 'Reason', ['heading', 'description'], [
            ['Complete Retail Infrastructure', 'All essential hardware & software in one place'],
            ['Easy to Use', 'Simple interface for faster operations'],
            ['Reliable Hardware', 'Premium quality products built to last'],
            ['Expert Support', '24/7 support from our experts'],
            ['Fast Installation', 'Quick setup & on-site installation'],
            ['Pan India Service', '500+ service centers across India'],
          ]),
        ],
      },
      {
        title: 'Videos',
        variant: 'block',
        items: [block('retail-videos', 'Video section subtitle', { description: 'Watch how BUVVAS POS, printers & scanners power retail checkout.' })],
      },
      {
        title: 'Products',
        variant: 'cards',
        items: cardList('retail-product', 'Product', ['heading', 'description'], [
          ['POS Machines', 'High performance POS for fast & accurate billing.'],
          ['Barcode Scanners', 'Fast & accurate scanning for quick billing.'],
          ['Receipt Printers', 'High speed printers for clear & quick receipts.'],
          ['Label Printers', 'Print barcode labels for better inventory control.'],
          ['Cash Drawers', 'Secure cash storage with strong build.'],
        ], { labels: NAME_DESC }),
      },
      {
        title: 'Call to action',
        hint: HIGHLIGHT_HINT,
        variant: 'cards',
        items: [
          block('retail-cta', 'CTA banner', {
            heading: 'Ready To Upgrade Your\nRetail Billing System?',
            description: 'Faster Billing. Better Inventory Control. Smarter Business Decisions.',
          }, { multilineHeading: true }),
          ...cardList('retail-footer-stat', 'Stat', ['heading', 'description'], [
            ['10,000+', 'Happy Businesses'],
            ['50+', 'Service Centers'],
            ['100+', 'Authorized Dealers'],
            ['24/7', 'Support'],
          ], { labels: STAT }),
        ],
      },
      { title: 'Popup', variant: 'block', items: [expertPopup('retail')] },
    ],
  },

  '/solutions/restaurant': {
    hero: {
      title: 'Hero banner',
      items: [
        block('restaurant-hero', 'Hero label & product line', {
          eyebrow: "INDIA'S SMART RESTAURANT BILLING SOLUTIONS",
          points: lines('Fast Billing', 'KOT Management', 'Table Orders', 'Kitchen Automation'),
        }, { labels: { points: 'Line under the heading (one per line)' } }),
        block('restaurant-hero-checklist', 'Checklist', {
          points: lines('Faster Billing', 'Table Management', 'KOT & Kitchen Integration', 'Sales & Inventory Reports'),
        }, { labels: { points: 'Checklist items (one per line)' } }),
        block('restaurant-hero-badges', 'Badges beside the photo', {
          points: lines('Faster Service', 'Instant KOT Printing', 'Real-Time Reports', 'Better Kitchen Efficiency'),
        }, { labels: BADGES }),
      ],
    },
    groups: [
      {
        title: 'Stats strip',
        variant: 'cards',
        items: cardList('restaurant-stat', 'Stat', ['heading', 'description'], [
          ['10,000+', 'Happy Businesses'],
          ['50+', 'Service Centers'],
          ['100+', 'Authorized Dealers'],
          ['24/7', 'Support'],
          ['100%', 'Reliable Solutions'],
        ], { labels: STAT }),
      },
      {
        title: 'Challenges',
        variant: 'cards',
        items: [
          block('restaurant-challenges-intro', 'Section heading', { heading: 'COMMON RESTAURANT CHALLENGES' }),
          ...cardList('restaurant-challenge', 'Challenge', ['heading', 'description'], [
            ['Long Billing Queues', 'Slow billing affects customer experience.'],
            ['Order Miscommunication', 'Manual order handling causes mistakes.'],
            ['Kitchen Delays', 'Late order processing impacts service quality.'],
          ]),
        ],
      },
      {
        title: 'Restaurant solution',
        hint: HIGHLIGHT_HINT,
        variant: 'block',
        items: [
          block('restaurant-ecosystem-copy', 'Section heading', {
            heading: 'ONE COMPLETE\nRESTAURANT SOLUTION', description: '',
          }, { multilineHeading: true }),
          block('restaurant-ecosystem', 'Devices around the POS', {
            points: lines('Receipt Printer', 'KOT Printer', 'Kitchen Display', 'Cash Drawer', 'Billing Software', 'Reports Dashboard'),
          }, { labels: { points: 'Device names, in order (one per line)' } }),
        ],
      },
      {
        title: 'Powerful features',
        variant: 'cards',
        items: [
          block('restaurant-features-intro', 'Section heading', { heading: 'POWERFUL FEATURES FOR YOUR RESTAURANT' }),
          ...presetCards(Array.from({ length: 8 }, (_, i) => `restaurant-feature-${i + 1}`), undefined, { itemTitle: 'Feature' }),
        ],
      },
      {
        title: 'Restaurant types',
        variant: 'cards',
        items: [
          block('restaurant-types-intro', 'Section heading', { heading: 'SOLUTIONS FOR EVERY TYPE OF RESTAURANT' }),
          ...cardList('restaurant-type', 'Type', ['heading', 'description'], [
            ['Restaurants', 'Complete billing, KOT & kitchen automation.'],
            ['Cafes', 'Fast billing and enhanced customer service.'],
            ['Cloud Kitchens', 'Centralized order & kitchen management.'],
            ['Food Courts', 'Multi-counter billing support.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Products',
        variant: 'cards',
        items: [
          block('restaurant-products-intro', 'Section heading', { heading: 'PRODUCTS FOR RESTAURANTS' }),
          ...cardList('restaurant-product', 'Product', ['heading', 'description'], [
            ['POS Machines', 'High performance billing systems.'],
            ['KOT Printers', 'Instant order printing for kitchen.'],
            ['Receipt Printers', 'Fast & reliable bill printing.'],
            ['Cash Drawers', 'Secure cash management.'],
            ['Kitchen Display', 'Real-time order management.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Videos',
        variant: 'block',
        items: [block('restaurant-videos', 'Video section subtitle', { description: 'Watch how BUVVAS POS & billing hardware works in real restaurants.' })],
      },
      {
        title: 'How BUVVAS works',
        variant: 'block',
        items: [block('restaurant-how', 'Order flow', {
          heading: 'HOW BUVVAS WORKS',
          points: lines('Customer Places Order', 'Order Sent to POS', 'KOT Printed in Kitchen', 'Food Prepared', 'Billing Completed', 'Receipt Generated', 'Customer Served', 'Inventory Auto Update'),
        }, { labels: { points: 'Steps (one per line)' } })],
      },
      {
        title: 'Why restaurants choose BUVVAS',
        variant: 'cards',
        items: [
          block('restaurant-why-intro', 'Section heading', { heading: 'WHY RESTAURANTS CHOOSE BUVVAS' }),
          ...cardList('restaurant-why', 'Reason', ['heading', 'description'], [
            ['All-in-One Solution', 'Complete everything you need under one roof.'],
            ['Easy to Use', 'Simple interface & easy to operate.'],
            ['Reliable Hardware', 'High quality products built for long term.'],
            ['Expert Support', '24/7 support from our experts.'],
            ['Fast Installation', 'Quick setup & implementation.'],
            ['Secure Data', 'Your data is safe with us.'],
          ]),
        ],
      },
      {
        title: 'Trusted by & call to action',
        variant: 'block',
        items: [
          block('restaurant-trusted', 'Logos heading', { heading: 'TRUSTED BY RESTAURANT BUSINESSES' }),
          block('restaurant-cta', 'CTA banner', {
            heading: 'Ready To Serve Faster & Smarter?',
            points: lines('Complete Restaurant Billing', 'KOT Printing', 'Kitchen Automation', 'Real-Time Reports'),
          }, { labels: { points: 'Highlights (one per line)' } }),
        ],
      },
    ],
  },

  '/solutions/pharmacy': {
    hero: {
      title: 'Hero banner',
      items: [
        block('pharmacy-tagline', 'Hero label & tagline', { eyebrow: 'Pharmacy POS & hardware', heading: '' },
          { labels: { heading: 'Tagline (below the heading)' } }),
        block('pharmacy-hero-badges', 'Feature badges', {
          points: lines('Reliable Performance', 'Seamless Operations', 'Trusted After Sales Support'),
        }, { labels: BADGES }),
      ],
    },
    groups: [
      {
        title: 'Trusted by',
        variant: 'cards',
        items: [
          block('pharmacy-types-intro', 'Section heading', { eyebrow: 'TRUSTED BY', heading: 'Leading Pharmacies. Trusted by Thousands.' }),
          ...cardList('pharmacy-type', 'Pharmacy type', ['heading', 'description'], [
            ['Retail Pharmacies', 'Empowering independent pharmacies with smart hardware.'],
            ['Pharmacy Chains', 'Centralized operations across multiple branches.'],
            ['Hospital Pharmacies', 'Built for high-volume billing and inventory control.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Hardware ecosystem',
        variant: 'cards',
        items: [
          block('pharmacy-ecosystem-intro', 'Section heading', { eyebrow: 'BUVVAS HARDWARE ECOSYSTEM', heading: 'Built for Every Pharmacy Need' }),
          ...cardList('pharmacy-ecosystem', 'Product', ['heading', 'description'], [
            ['POS Systems', 'Fast billing, easy to use and highly reliable.'],
            ['Barcode Scanner', 'Accurate scanning for medicines and inventory.'],
            ['Receipt Printer', 'High-speed printing for quick billing.'],
            ['Label Printer', 'Print barcodes, price labels & stickers.'],
            ['Cash Drawer', 'Secure cash management with durability.'],
          ], { labels: NAME_DESC }),
          block('pharmacy-ecosystem-strip', 'Highlights strip', {
            points: lines('100% Genuine Products', 'Wide Range of Models', 'Installation & Training', 'AMC & Support', 'Pan India Service'),
          }, { labels: { points: 'Highlights (one per line)' } }),
        ],
      },
      {
        title: 'Why choose BUVVAS',
        variant: 'cards',
        items: [
          block('pharmacy-why-intro', 'Section heading', { eyebrow: 'WHY CHOOSE BUVVAS?', heading: 'Your Reliable Pharmacy Hardware Partner' }),
          ...presetCards(Array.from({ length: 6 }, (_, i) => `pharmacy-feature-${i + 1}`), undefined, { itemTitle: 'Reason' }),
        ],
      },
      {
        title: 'Videos',
        variant: 'block',
        items: [block('pharmacy-videos', 'Video section subtitle', { description: 'Watch how BUVVAS hardware handles medicine scanning, labeling & billing.' })],
      },
      {
        title: 'Page footer',
        variant: 'block',
        items: [block('pharmacy-footer', 'Footer text', {
          description: 'Empowering Pharmacies with Reliable Hardware Solutions.',
          points: lines('GST Billing', 'AMC Support', 'Pan India Service'),
        }, { labels: { description: 'Tagline', points: 'Bottom bar items (one per line)' } })],
      },
      { title: 'Popup', variant: 'block', items: [expertPopup('pharmacy')] },
    ],
  },

  '/solutions/hospitality': {
    hero: {
      title: 'Hero banner',
      items: [
        block('hospitality-hero', 'Hero label & product line', {
          eyebrow: "INDIA'S SMART HOSPITALITY HARDWARE SOLUTIONS",
          points: lines('POS Machines', 'KOT Printers', 'Receipt Printers', 'Cash Drawers', 'Customer Displays'),
        }, { labels: { points: 'Product line under the heading (one per line)' } }),
        block('hospitality-hero-badges', 'Icon badges', {
          points: lines('Faster Billing', 'Better Kitchen Communication', 'Reliable Hardware', 'Easy Integration'),
        }, { labels: BADGES }),
        block('hospitality-hero-side-badges', 'Badges beside the photo', {
          points: lines('Faster Operations', 'Instant Printing', 'Hospitality Ready', 'Reliable Hardware'),
        }, { labels: BADGES }),
      ],
    },
    groups: [
      {
        title: 'Stats strip',
        variant: 'cards',
        items: cardList('hospitality-stat', 'Stat', ['heading', 'description'], [
          ['10,000+', 'Happy Businesses'],
          ['100+', 'Authorized Dealers'],
          ['50+', 'Service Locations'],
          ['24/7', 'Support'],
        ], { labels: STAT }),
      },
      {
        title: 'Challenges',
        variant: 'cards',
        items: [
          block('hospitality-challenges-intro', 'Section heading', { heading: 'COMMON OPERATIONAL CHALLENGES' }),
          ...cardList('hospitality-challenge', 'Challenge', ['heading', 'description'], [
            ['Slow Billing Process', 'Long queues and slow billing impact guest experience.'],
            ['Kitchen Communication Delays', 'Manual order handling and delays affect service quality.'],
            ['Cash Handling Issues', 'Manual cash management leads to errors and inefficiencies.'],
            ['Outdated Hardware', 'Old and unreliable hardware slows down your operations.'],
          ]),
        ],
      },
      {
        title: 'Hospitality ecosystem',
        variant: 'cards',
        items: [
          block('hospitality-ecosystem-copy', 'Section heading', { heading: 'A COMPLETE HOSPITALITY ECOSYSTEM', description: '' }),
          ...cardList('hospitality-ecosystem', 'Device', ['heading', 'description'], [
            ['KOT Printer', 'Instant order communication to the kitchen.'],
            ['Receipt Printer', 'Fast and clear billing with easy receipt printing.'],
            ['POS Machine', 'Powerful and reliable billing at your fingertips.'],
            ['Cash Drawer', 'Secure cash management for your business.'],
            ['Customer Display', 'Transparent customer interaction and trust.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Products we provide',
        variant: 'cards',
        items: [
          block('hospitality-products-intro', 'Section heading', { heading: 'PRODUCTS WE PROVIDE' }),
          ...cardList('hospitality-product', 'Product', ['heading', 'description'], [
            ['POS Machines', 'High performance POS machines for fast and accurate billing.'],
            ['KOT Printers', 'Reliable KOT printers for smooth kitchen order management.'],
            ['Receipt Printers', 'High speed printers for every billing counter.'],
            ['Cash Drawers', 'Durable and secure cash drawers with strong build quality.'],
            ['Customer Displays', 'Clear and bright displays for better customer experience.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Industries we serve',
        variant: 'cards',
        items: [
          block('hospitality-industries-intro', 'Section heading', { heading: 'INDUSTRIES WE SERVE' }),
          ...cardList('hospitality-industry', 'Industry', ['heading', 'description'], [
            ['Hotel Chains', 'Reliable hardware for smooth hotel operations.'],
            ['Resorts', 'Enhance guest experience with faster service.'],
            ['Franchise Restaurant Chains', 'Standardized hardware across all locations.'],
            ['Banquet Halls', 'Efficient billing for events and large gatherings.'],
            ['Multi-Outlet Businesses', 'Consistent performance across every outlet.'],
            ['Hospitality Groups', 'One trusted partner for all your hardware needs.'],
          ], { labels: NAME_DESC }),
        ],
      },
      {
        title: 'Why choose BUVVAS',
        variant: 'cards',
        items: [
          block('hospitality-why-intro', 'Section heading', { heading: 'WHY CHOOSE BUVVAS' }),
          ...presetCards(Array.from({ length: 6 }, (_, i) => `hospitality-feature-${i + 1}`), undefined, { itemTitle: 'Reason' }),
        ],
      },
      {
        title: 'Videos',
        variant: 'block',
        items: [block('hospitality-videos', 'Video section subtitle', { description: 'Watch how BUVVAS POS & billing hardware fits front-desk and F&B operations.' })],
      },
      {
        title: 'Consultation form',
        hint: HIGHLIGHT_HINT,
        variant: 'block',
        items: [
          block('hospitality-consultation', 'Form introduction', {
            heading: 'FIND THE RIGHT\nHOSPITALITY\nHARDWARE SETUP',
            description: 'Tell us about your business and our experts will suggest the best hardware for your needs.',
            points: lines('Expert Guidance', 'Best Solutions', 'On-time Support'),
          }, { multilineHeading: true, labels: { points: 'Checklist (one per line)' } }),
          block('hospitality-form-success', 'Thank-you message', {
            heading: 'Thank you!',
            description: 'Our hospitality hardware expert will reach out to you shortly.',
          }),
        ],
      },
      {
        title: 'Call to action',
        hint: HIGHLIGHT_HINT,
        variant: 'block',
        items: [block('hospitality-cta', 'CTA banner', {
          heading: 'Ready To Upgrade Your\nHospitality Operations?',
          description: 'Reliable Hardware Solutions For Your Growing Business.',
        }, { multilineHeading: true })],
      },
    ],
  },

  '/dealers': {
    hero: {
      title: 'Dealer locator banner',
      items: cardList('dealers-stat', 'Hero stat', ['heading', 'description'], [
        ['500+', 'Service Centers'],
        ['1000+', 'Authorized Dealers'],
      ], { labels: STAT }),
    },
    groups: [
      {
        title: 'Become a dealer',
        hint: 'Call-to-action section below the dealer locator.',
        variant: 'block',
        items: [block('dealer-benefits-heading', 'Section heading', { eyebrow: 'PARTNER WITH BUVVAS', heading: '', description: '' })],
      },
      {
        title: 'Dealer benefits',
        variant: 'cards',
        items: presetCards(['dealer-high-margins', 'dealer-marketing-support', 'dealer-training', 'dealer-priority-service'], undefined, { itemTitle: 'Benefit' }),
      },
      {
        title: 'Dealer mobile app',
        variant: 'block',
        items: [block('dealers-app', 'App banner', {
          eyebrow: 'DEALER MOBILE APP',
          heading: 'BUVVAS Dealer App',
          description: 'Manage orders, track payments & deliveries, and raise support tickets — right from your phone.',
        })],
      },
      {
        title: 'Dealer application form',
        variant: 'cards',
        items: [
          block('dealers-application', 'Form header', {
            eyebrow: 'DEALER APPLICATION',
            heading: 'Apply to Become a Dealer',
            description: 'Tell us about your business and our team will get in touch with you.',
          }),
          block('dealers-application-success', 'Thank-you message', {
            heading: 'Application Submitted!',
            description: 'Our team will contact you shortly.',
          }),
        ],
      },
    ],
  },

  '/support': {
    hero: {
      title: 'Hero banner',
      items: [block('support-hero', 'Hero label & highlights', {
        eyebrow: 'BUVVAS CUSTOMER CARE',
        points: lines('Expert Guidance', 'Reliable Support', 'Every Step of the Way'),
      }, { labels: { points: 'Highlights below the buttons (one per line)' } })],
    },
    groups: [
      {
        title: 'Support channels',
        variant: 'cards',
        items: presetCards(['support-call', 'support-whatsapp', 'support-email', 'support-network'], undefined, { itemTitle: 'Channel' }),
      },
      {
        title: 'Contact section',
        variant: 'block',
        items: [block('support-contact-intro', 'Contact introduction', {
          eyebrow: "LET'S CONNECT", heading: '', description: '', subheading: 'NEED QUICK ASSISTANCE?',
        }, { fields: ['eyebrow', 'heading', 'description', 'subheading'], labels: { subheading: 'Label above the message button' } })],
      },
      {
        title: 'Contact card',
        variant: 'cards',
        items: cardList('support-contact', 'Contact', ['heading', 'points'], [
          ['Phone / WhatsApp', lines('+91 91339 19190', 'Mon – Sun, 9AM – 9PM IST')],
          ['Email Support', 'info@buvvas.com'],
          ['Service Network', lines('500+ Service Centers across India', '1000+ Authorized Dealers')],
        ], { labels: { points: 'Lines (one per line)' } }),
      },
      {
        title: 'FAQ section',
        variant: 'block',
        items: [block('support-faq-intro', 'FAQ heading', {
          eyebrow: 'HERE TO HELP',
          heading: "Questions? We've Got Answers.",
          description: 'Everything you need to know about our POS solutions, products and support services.',
        })],
      },
      {
        title: 'Frequently asked questions',
        variant: 'faq',
        items: presetCards(['support-faq-gst', 'support-faq-installation', 'support-faq-warranty', 'support-faq-multistore', 'support-faq-assistance']),
      },
      {
        title: 'Closing banner',
        variant: 'block',
        items: [block('support-cta', 'Bottom banner', {
          eyebrow: 'YOUR BUSINESS MATTERS TO US',
          heading: "Let's Find the Right Solution for Your Business.",
          description: 'Connect with BUVVAS experts for product guidance, technical assistance and business support.',
        })],
      },
    ],
  },

  '/get-quote': {
    hero: {
      title: 'Hero banner',
      items: [block('quote-hero', 'Hero label', { eyebrow: 'GET A QUOTE' })],
    },
    groups: [
      {
        title: 'Quote form',
        variant: 'cards',
        items: [
          { key: 'quote-response-time', title: 'Form heading', fields: ['heading', 'description'] },
          block('quote-form-success', 'Thank-you message', {
            heading: 'Message Sent!',
            description: 'Our team will get back to you within 24 hours.',
          }),
        ],
      },
      {
        title: 'Contact information',
        variant: 'cards',
        items: [
          block('quote-contact-intro', 'Section heading', {
            heading: 'Contact Information',
            subheading: 'Average response time: under 2 hours',
          }, { labels: { subheading: 'Response time badge' } }),
          ...cardList('quote-contact', 'Contact', ['heading', 'points'], [
            ['Phone / WhatsApp', lines('+91 80919 82838', 'Mon – Sun, 9AM – 9PM IST')],
            ['Email', lines('sales@buvvas.com', 'support@buvvas.com')],
            ['Service Network', lines('500+ Service Centers across India', '1000+ Authorized Dealers')],
          ], { labels: { points: 'Lines (one per line)' } }),
        ],
      },
    ],
  },

  '/partner': {
    hero: {
      title: 'Hero panel',
      items: [block('partner-hero', 'Hero label & checklist', {
        eyebrow: 'BECOME A CHANNEL PARTNER',
        points: lines(
          'Full product & pricing overview tailored to your business',
          'Expert consultation on partnership benefits & margins',
          'Attractive margins based on your business volume',
          'No commitment — explore at your own pace',
        ),
      }, { labels: { points: 'Checklist (one per line)' } })],
    },
    groups: [
      {
        title: 'Trust stats',
        variant: 'cards',
        items: cardList('partner-stat', 'Stat', ['heading', 'description'], [
          ['1000+', 'Partners'],
          ['7+', 'Years Trusted'],
          ['Pan India', 'Support'],
        ], { labels: STAT }),
      },
      {
        title: 'Consultation form',
        variant: 'cards',
        items: [
          block('partner-form-intro', 'Form introduction', {
            heading: '', description: '', subheading: 'No cost to apply. Free consultation included.',
          }, { fields: ['heading', 'description', 'subheading'], labels: { subheading: 'Note below the submit button' } }),
          block('partner-form-success', 'Thank-you message', {
            heading: 'Application Submitted!',
            description: 'Our partnerships team will contact you shortly.',
          }),
        ],
      },
    ],
  },

  '/franchise': {
    hero: {
      title: 'Hero banner',
      items: [block('franchise-hero', 'Hero label & points', {
        eyebrow: 'Franchise opportunity',
        points: lines(
          'Sell and service a complete POS hardware range',
          'Structured onboarding, product and sales training',
          'Marketing assets and launch support for your city',
        ),
      }, { labels: { points: 'Hero points (one per line)' } })],
    },
    groups: [
      {
        title: 'Hero stats',
        variant: 'cards',
        items: cardList('franchise-stat', 'Stat', ['heading', 'description'], [
          ['1000+', 'Partners nationwide'],
          ['7+', 'Years of trust'],
          ['Pan India', 'Support network'],
        ], { labels: STAT }),
      },
      {
        title: 'Why partner with us',
        variant: 'cards',
        items: [
          block('franchise-why', 'Section heading', {
            eyebrow: 'Why partner with us',
            heading: 'Everything you need to launch and scale',
            description: 'A BUVVAS franchise gives you a ready product range, proven processes and a team that supports you at every stage.',
          }),
          ...cardList('franchise-benefit', 'Benefit', ['heading', 'description'], [
            ['Trusted brand from day one', 'Open under a recognised POS brand instead of building credibility from scratch.'],
            ['Complete product portfolio', 'POS machines, receipt & label printers, barcode scanners, cash drawers and accessories.'],
            ['Training & onboarding', 'Product, installation and sales training so your team is ready before launch.'],
            ['Marketing support', 'Brand creatives, launch campaigns and help generating local business leads.'],
            ['Technical backup', 'Escalation support for installations, troubleshooting and warranty service.'],
            ['Recurring revenue', 'Hardware sales plus consumables, upgrades, AMC and service create repeat business.'],
          ]),
        ],
      },
      {
        title: "Markets you'll serve",
        variant: 'block',
        items: [block('franchise-markets', 'Markets section', {
          eyebrow: "Markets you'll serve",
          heading: 'Every business that bills is a customer',
          description: 'POS hardware is essential across industries, giving your franchise a wide and steady customer base.',
          points: lines('Retail & supermarkets', 'Restaurants & QSR', 'Pharmacies', 'Cafés & bakeries', 'Hospitality', 'Warehouses & distribution'),
        }, { labels: { points: 'Markets, in order (one per line)' } })],
      },
      {
        title: 'Who should apply',
        variant: 'block',
        items: [block('franchise-ideal', 'Ideal partner panel', {
          eyebrow: 'Who should apply',
          heading: 'The ideal BUVVAS franchise partner',
          points: lines(
            'Entrepreneurs looking to start a technology business',
            'IT, computer or mobile retailers expanding their range',
            'Existing distributors and system integrators',
            'Service professionals with local business networks',
          ),
          description: 'A commitment to customer service and a strong local network matter more than technical background — we train you on the rest.',
        }, { fields: ['eyebrow', 'heading', 'points', 'description'], labels: { points: 'Profiles (one per line)', description: 'Note below the list' } })],
      },
      {
        title: 'How it works',
        variant: 'cards',
        items: [
          block('franchise-process', 'Section heading', { eyebrow: 'How it works', heading: 'From application to launch in five steps' }),
          ...cardList('franchise-step', 'Step', ['heading', 'description'], [
            ['Apply', 'Share your details using the franchise application form.'],
            ['Discovery call', 'Our franchise team understands your goals, city and background.'],
            ['Evaluation & agreement', 'We walk you through the model, investment and terms in detail.'],
            ['Setup & training', 'Onboarding, product training and launch planning with our team.'],
            ['Launch & grow', 'Go live with marketing support and ongoing technical backup.'],
          ]),
        ],
      },
      {
        title: 'FAQ section',
        variant: 'block',
        items: [
          block('franchise-faq-intro', 'FAQ heading', {
            eyebrow: 'Franchise FAQs',
            heading: 'Questions before you apply?',
            description: 'Here are answers to what prospective franchise partners ask us most.',
            subheading: 'Prefer to talk first?',
          }, { fields: ['eyebrow', 'heading', 'description', 'subheading'], labels: { subheading: 'Call box label' } }),
        ],
      },
      {
        title: 'Franchise FAQs',
        variant: 'faq',
        items: [
          ...cardList('franchise-faq', 'Question', ['heading', 'description'], [
            ['What investment is required to start a BUVVAS franchise?', 'Investment depends on the city and the scale you plan to operate at. Our franchise team shares a complete breakdown during the discovery call.'],
            ['Do I need prior experience in POS or IT hardware?', 'Prior experience helps but is not mandatory. We provide product, installation and sales training as part of onboarding.'],
            ['How is a franchise different from becoming a channel partner?', 'A franchise operates as a dedicated BUVVAS business in its territory with brand, marketing and launch support. Channel partners resell BUVVAS products alongside their existing business.'],
            ['How soon will the team contact me after I apply?', 'Our franchise team usually reaches out within 24–48 working hours of receiving your application.'],
          ]),
        ],
      },
      {
        title: 'Application form',
        variant: 'cards',
        items: [
          block('franchise-application', 'Form header', {
            heading: 'Franchise application',
            description: 'Tell us about yourself and our franchise team will get in touch.',
            subheading: 'No cost to apply. Your details are shared only with the BUVVAS franchise team.',
          }, { fields: ['heading', 'description', 'subheading'], labels: { subheading: 'Note below the submit button' } }),
          block('franchise-application-success', 'Thank-you message', {
            heading: 'Application submitted!',
            description: 'Thank you for your interest. Our franchise team will contact you shortly.',
          }),
        ],
      },
    ],
  },

  '/career': CAREERS_LAYOUT,
  '/careers': CAREERS_LAYOUT,

  '/blog': {
    hero: {
      title: 'Blog header',
      items: [block('blog-hero', 'Header label', { eyebrow: 'BUVVAS BLOG' })],
    },
    groups: [],
  },

  '/blog/:slug': {
    hero: {
      title: 'Post header',
      hint: 'Leave the heading blank to use the blog post title. Use {{slug}} to insert the post slug.',
      headingLabel: 'Post heading override',
      descriptionLabel: 'Introduction (below the title)',
    },
    groups: [],
  },

  '/privacy-policy': {
    hero: { title: 'Policy header', descriptionLabel: 'Introduction' },
    groups: [
      {
        title: 'Dates & footer',
        variant: 'block',
        items: [block('privacy-dates', 'Policy dates', {
          heading: 'August 20, 2026',
          subheading: 'August 20, 2026',
          description: 'BUVVAS · www.buvvas.com · sales@buvvas.com · +91 9100011767',
          eyebrow: 'Monday to Saturday | 9:00 AM – 6:00 PM (IST)',
        }, {
          fields: ['heading', 'subheading', 'description', 'eyebrow'],
          labels: { heading: 'Effective date', subheading: 'Last updated date', description: 'Footer contact line', eyebrow: 'Footer hours line' },
        })],
      },
      {
        title: 'Policy clauses',
        hint: 'Each clause title and its opening paragraph, in website order. Sub-headings and bullet lists inside a clause stay as on the website.',
        variant: 'policy',
        items: [
          'privacy-information', 'privacy-use', 'privacy-enquiries', 'privacy-cookies',
          'privacy-payments', 'privacy-sharing', 'privacy-partners', 'privacy-security',
          'privacy-marketing', 'privacy-third-party', 'privacy-retention', 'privacy-rights',
          'privacy-children', 'privacy-changes', 'privacy-consent',
        ].map((key) => ({ key, fields: ['heading', 'description'] })),
      },
      {
        title: 'Contact Us clause',
        variant: 'block',
        items: [{
          key: 'privacy-contact',
          title: 'Contact Us',
          fields: ['heading', 'description', 'points'],
          labels: { heading: 'Clause title', description: 'Opening paragraph', points: 'Contact lines (one per line)' },
          defaults: {
            points: lines(
              'Website: www.buvvas.com',
              'Email: sales@buvvas.com',
              'Phone: +91 9100011767',
              'Business Hours: Monday to Saturday, 9:00 AM – 6:00 PM (IST)',
            ),
          },
        }],
      },
    ],
  },
};
