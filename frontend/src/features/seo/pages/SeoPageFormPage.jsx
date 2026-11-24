import { useEffect, useRef } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import RichDescriptionField from '../components/RichDescriptionField';
import {
  VARIANT_FIELD_LABELS,
  WEBSITE_PAGE_OPTIONS,
  getLayoutItems,
  getLayoutSectionKeys,
  getPageLayout,
} from '../seoPageLayouts';

const PAGE_TYPES = [
  ['home', 'Home'],
  ['about', 'About'],
  ['products', 'Products listing'],
  ['product-detail', 'Product details'],
  ['solutions', 'Solutions'],
  ['dealers', 'Dealers'],
  ['blog', 'Blog listing'],
  ['blog-post', 'Blog post'],
  ['faq', 'FAQs'],
  ['custom', 'Custom page'],
];

// Website page loaded when a page type is chosen. "custom" keeps the current route.
const PAGE_TYPE_ROUTES = {
  home: '/',
  about: '/about',
  products: '/products',
  'product-detail': '/products/:categorySlug/:productSlug',
  solutions: '/solutions',
  dealers: '/dealers',
  blog: '/blog',
  'blog-post': '/blog/:slug',
  faq: '/support',
};

const ROBOTS_OPTIONS = [
  ['index,follow', 'Index and follow links'],
  ['index,nofollow', 'Index, do not follow links'],
  ['noindex,follow', 'Do not index, follow links'],
  ['noindex,nofollow', 'Do not index or follow links'],
];

const createDefaultHomeContent = () => ({
  heroSlides: [
    { imageUrl: '/assets/HeroImg1-B2S0yL4Y.jpeg', altText: 'BUVVAS TT426B thermal transfer label printer', link: '/products/label-printers/buvvas-tt426b-thermal-transfer-label-printer' },
    { imageUrl: '/assets/HeroImg2-YL5MOWYf.jpeg', altText: 'BUVVAS T-780 1D and 2D tabletop barcode scanner', link: '/products/barcode-scanners/buvvas-t-780-1d-and-2d-table-top-barcode-scanner' },
    { imageUrl: '/assets/HeroImg3-CT1J4kGg.jpeg', altText: 'Reliable POS hardware for every business', link: '/about' },
    { imageUrl: '/assets/HeroImg4-CdX3Tmpw.jpeg', altText: 'POS solutions for retail, restaurants, supermarkets, apparel, pharmacies and specialty stores', link: '/solutions' },
    { imageUrl: '/assets/HeroImg5-DCUaY3cf.jpeg', altText: 'BUVVAS HS-KH80 thermal receipt printer', link: '' },
    { imageUrl: '/assets/banner-1-CVMJ4gKF.webp', altText: 'BUVVAS featured billing hardware banner', link: '' },
  ],
  stats: [
    { value: '10,000+', label: 'Happy Businesses' },
    { value: '50+', label: 'Service Centers' },
    { value: 'Pan India', label: 'Service Network' },
    { value: '100+', label: 'Authorized Dealers' },
    { value: '24/7', label: 'Tech Support' },
    { value: '100%', label: 'Secure & Reliable' },
  ],
  featuredHardware: {
    eyebrow: 'BUVVAS product picks',
    title: 'Featured Hardware',
    description: 'Explore essential devices for your checkout and operations.',
  },
  whyChoose: {
    eyebrow: 'Why Buvvas',
    title: 'Why choose Buvvas?',
    items: [
      { title: 'All-in-One Solution', description: 'Everything you need under one roof.' },
      { title: 'Easy to Use', description: 'Simple interface & easy to use.' },
      { title: 'Reliable Hardware', description: 'High quality products built for long term.' },
      { title: 'Expert Support', description: '24/7 support from our expert team.' },
      { title: 'Regular Updates', description: 'Latest features & software updates.' },
      { title: 'Data Security', description: 'Your data is safe with us.' },
    ],
  },
});

const PAGE_SECTION_PRESETS = {
  '/about': [
    {
      key: 'vision',
      label: 'Our Vision',
      heading: "India's most trusted partner for billing hardware",
      description: "Our vision is to become India's most trusted provider of POS systems and billing hardware by delivering innovation, quality and exceptional customer experiences that help businesses succeed.",
    },
    {
      key: 'mission',
      label: 'Our Mission',
      heading: 'Our mission',
      description: 'to empower businesses with reliable POS systems and billing hardware that simplify processes and support sustainable growth.',
    },
  ],
  '/solutions': [
    {
      key: 'solutions-overview-supporting',
      label: 'About Buvvas: Supporting paragraph',
      heading: '',
      description: 'From retail counters and restaurants to warehouses and healthcare businesses, we aim to make business technology accessible, connected and easier to use.',
    },
  ],
  '/solutions/retail': [
    { key: 'retail-ecosystem-copy', label: 'Retail ecosystem description', heading: '', description: 'Everything you need to run your retail business efficiently.' },
  ],
  '/solutions/restaurant': [
    { key: 'restaurant-ecosystem-copy', label: 'Restaurant solution description', heading: '', description: 'Everything your restaurant needs under one roof.' },
  ],
  '/solutions/pharmacy': [
    { key: 'pharmacy-tagline', label: 'Pharmacy hero tagline', heading: 'Smart Hardware. Better Control. Stronger Pharmacies.', description: '' },
  ],
  '/solutions/hospitality': [
    { key: 'hospitality-ecosystem-copy', label: 'Hospitality ecosystem description', heading: '', description: 'Everything you need for smooth and efficient operations' },
  ],
  '/products': [
    { key: 'products-upgrade', label: 'Business essentials feature', heading: 'Upgrade Your Business Setup', description: 'Find dependable hardware for everyday operations.' },
    { key: 'products-complete-solution', label: 'Complete solution feature', heading: 'Hardware That Works Together', description: 'Get expert guidance for the right product combination.' },
    { key: 'products-trending', label: 'Trending products introduction', heading: 'Trending Now', description: 'Explore popular products from our live catalogue.' },
  ],
  '/products/:categoryslug': [
    { key: 'products-upgrade', label: 'Business essentials feature', heading: 'Upgrade Your Business Setup', description: 'Find dependable hardware for everyday operations.' },
    { key: 'products-complete-solution', label: 'Complete solution feature', heading: 'Hardware That Works Together', description: 'Get expert guidance for the right product combination.' },
    { key: 'products-trending', label: 'Trending products introduction', heading: 'Trending Now', description: 'Explore popular products from our live catalogue.' },
  ],
  '/brand': [
    { key: 'brand-why-title', label: 'Why Buvvas section heading', heading: 'Everything You Need. All in One Place.', description: '' },
    { key: 'why-faster-billing', label: 'Why Buvvas: Faster Billing', heading: 'Faster Billing', description: 'Reduce billing time & increase efficiency.' },
    { key: 'why-premium-quality', label: 'Why Buvvas: Premium Quality', heading: 'Premium Quality', description: 'Reliable hardware built for long life.' },
    { key: 'why-easy-integration', label: 'Why Buvvas: Easy Integration', heading: 'Easy Integration', description: 'Works with 100+ software & apps.' },
    { key: 'why-expert-support', label: 'Why Buvvas: Expert Support', heading: 'Expert Support', description: 'Dedicated support for smooth operations.' },
    { key: 'why-warranty', label: 'Why Buvvas: Warranty', heading: 'Warranty', description: '1 year warranty on all hardware.' },
  ],
  '/dealers': [
    { key: 'dealer-benefits-heading', label: 'Dealer benefits heading', heading: 'Become an Authorized BUVVAS Dealer', description: "Join 1000+ dealers growing their business with India's smart billing infrastructure brand." },
    { key: 'dealer-high-margins', label: 'Dealer benefit: High Profit Margins', heading: 'High Profit Margins', description: 'Attractive dealer pricing with strong margins.' },
    { key: 'dealer-marketing-support', label: 'Dealer benefit: Marketing Support', heading: 'Marketing Support', description: 'Co-branded kits, leads & campaign assistance.' },
    { key: 'dealer-training', label: 'Dealer benefit: Training & Onboarding', heading: 'Training & Onboarding', description: 'Complete product and sales training.' },
    { key: 'dealer-priority-service', label: 'Dealer benefit: Priority Service', heading: 'Priority Service', description: 'Dedicated dealer helpline & fast replacement.' },
  ],
  '/support': [
    { key: 'support-call', label: 'Support channel: Call', heading: 'Call Support', description: 'Speak with our experts and get the assistance you need.' },
    { key: 'support-whatsapp', label: 'Support channel: WhatsApp', heading: 'WhatsApp', description: 'Connect with our team for quick help and product enquiries.' },
    { key: 'support-email', label: 'Support channel: Email', heading: 'Email Support', description: 'Share your questions and let us help you find the right solution.' },
    { key: 'support-network', label: 'Support channel: Service Network', heading: 'Service Network', description: 'Get assistance through our service and dealer network.' },
    { key: 'support-contact-intro', label: 'Support contact introduction', heading: "We're Just a Call Away", description: 'Whether you need product guidance or technical assistance, our team is ready to help.' },
    { key: 'support-faq-gst', label: 'FAQ: GST-ready billing', heading: 'Is BUVVAS billing software GST-ready?', description: 'Yes. BUVVAS POS solutions support GST-compliant billing, automated tax calculations, GST invoices and reports to help simplify your business accounting.' },
    { key: 'support-faq-installation', label: 'FAQ: Installation and training', heading: 'Do you provide installation and training?', description: 'Yes. We provide installation assistance and onboarding guidance to help your team understand and use your BUVVAS POS system efficiently.' },
    { key: 'support-faq-warranty', label: 'FAQ: Warranty', heading: 'What is the warranty on BUVVAS hardware?', description: 'Our hardware products come with warranty coverage according to the individual product warranty terms. Contact our team for product-specific details.' },
    { key: 'support-faq-multistore', label: 'FAQ: Multiple stores', heading: 'Can BUVVAS POS manage multiple stores?', description: 'Our POS solutions can support business operations across multiple outlets, depending on the software package and features selected.' },
    { key: 'support-faq-assistance', label: 'FAQ: Technical assistance', heading: 'How can I get technical assistance?', description: 'You can reach our support team through phone, WhatsApp or email for assistance with installation, configuration, troubleshooting and product-related queries.' },
  ],
  '/get-quote': [
    { key: 'quote-response-time', label: 'Quote form: Response time', heading: 'Send Us a Message', description: 'We usually reply within a few hours.' },
  ],
  '/partner': [
    { key: 'partner-form-intro', label: 'Partner form introduction', heading: 'Request Your Free Consultation', description: 'Fill in your details and our partnerships team will reach out within 24 hours.' },
  ],
  '/career': [
    { key: 'career-openings', label: 'Open positions', heading: 'Find your place at BUVVAS', description: 'Explore our current openings and find a role that fits your skills.' },
    { key: 'career-values', label: 'Why work at Buvvas', heading: 'Good people. Meaningful work.', description: 'At BUVVAS, we value curiosity, collaboration and a willingness to make things better. Whether you are starting your career or bringing years of experience, we would love to hear from you.' },
  ],
  '/careers': [
    { key: 'career-openings', label: 'Open positions', heading: 'Find your place at BUVVAS', description: 'Explore our current openings and find a role that fits your skills.' },
    { key: 'career-values', label: 'Why work at Buvvas', heading: 'Good people. Meaningful work.', description: 'At BUVVAS, we value curiosity, collaboration and a willingness to make things better. Whether you are starting your career or bringing years of experience, we would love to hear from you.' },
  ],
  '/privacy-policy': [
    { key: 'privacy-information', label: 'Privacy policy: Information we collect', heading: '1. Information We Collect', description: 'Depending on how you interact with BUVVAS, we may collect different types of information.' },
    { key: 'privacy-use', label: 'Privacy policy: How information is used', heading: '2. How We Use Your Information', description: 'BUVVAS may use the information collected for legitimate business purposes, including:' },
    { key: 'privacy-enquiries', label: 'Privacy policy: Enquiry forms', heading: '3. Enquiry Forms and Lead Information', description: 'Our website, advertisements, social media campaigns, and other marketing channels may contain enquiry, quotation, or lead forms.' },
    { key: 'privacy-cookies', label: 'Privacy policy: Cookies', heading: '4. Cookies and Similar Technologies', description: 'Our website may use cookies, pixels, tags, analytics tools, and similar technologies to improve website functionality and understand how visitors use our website.' },
    { key: 'privacy-payments', label: 'Privacy policy: Payment security', heading: '5. Payment and Transaction Security', description: 'Where online payment facilities are available, payments may be processed through authorized third-party payment service providers.' },
    { key: 'privacy-sharing', label: 'Privacy policy: Sharing information', heading: '6. Sharing of Information', description: 'BUVVAS does not sell or rent your personal information to third parties.' },
    { key: 'privacy-partners', label: 'Privacy policy: Business partners', heading: '7. Business Partners and Service Providers', description: 'BUVVAS may work with software providers, hardware suppliers, distributors, channel partners, installation teams, service providers, technology vendors, and other business partners.' },
    { key: 'privacy-security', label: 'Privacy policy: Data security', heading: '8. Data Security', description: 'BUVVAS takes reasonable administrative, technical, and organizational measures to protect personal and business information.' },
    { key: 'privacy-marketing', label: 'Privacy policy: Marketing communications', heading: '9. Marketing and Promotional Communications', description: 'Subject to applicable law and your communication preferences, BUVVAS may contact you regarding new products, product updates, special offers and relevant service information.' },
    { key: 'privacy-third-party', label: 'Privacy policy: Third-party services', heading: '10. Third-Party Websites and Services', description: 'Our website may contain links to or integrations with third-party websites and services.' },
    { key: 'privacy-retention', label: 'Privacy policy: Data retention', heading: '11. Data Retention', description: 'BUVVAS may retain personal and business information for as long as reasonably necessary for the purposes for which it was collected.' },
    { key: 'privacy-rights', label: 'Privacy policy: Your rights', heading: '12. Your Privacy Rights', description: 'Depending on applicable law, you may have certain rights regarding your personal information.' },
    { key: 'privacy-children', label: 'Privacy policy: Children', heading: "13. Children's Privacy", description: 'The BUVVAS website and our products and services are primarily intended for businesses, professionals, and individuals who are legally permitted to use such services.' },
    { key: 'privacy-changes', label: 'Privacy policy: Policy changes', heading: '14. Changes to This Privacy Policy', description: 'BUVVAS may update or modify this Privacy Policy from time to time to reflect changes in our business practices, products, services, website functionality, technology, or legal requirements.' },
    { key: 'privacy-contact', label: 'Privacy policy: Contact us', heading: '15. Contact Us', description: 'If you have any questions, concerns, requests, or complaints regarding this Privacy Policy or the handling of your personal information, you can contact BUVVAS.' },
    { key: 'privacy-consent', label: 'Privacy policy: Consent', heading: '16. Consent and Acknowledgement', description: 'By accessing or using www.buvvas.com, submitting an enquiry or lead form, requesting a quotation or demonstration, purchasing our products or services, or voluntarily providing information to BUVVAS, you acknowledge that you have read and understood this Privacy Policy.' },
  ],
};

const SOLUTION_FEATURE_PRESETS = {
  '/solutions/retail': [
    ['fast-billing', 'Fast Billing', 'Reduce billing time & serve more customers'],
    ['barcode-billing', 'Barcode Billing', 'Accurate billing with barcode scanning'],
    ['inventory-management', 'Inventory Management', 'Real-time stock tracking & alerts'],
    ['gst-billing', 'GST Billing', 'Generate GST invoices & stay compliant'],
    ['sales-reports', 'Sales Reports', 'Detailed reports for better decisions'],
    ['multi-store-management', 'Multi-Store Management', 'Manage multiple stores from one place'],
  ],
  '/solutions/restaurant': [
    ['fast-billing', 'Fast Billing', 'Serve customers quickly.'],
    ['kot-management', 'KOT Management', 'Instant kitchen order transfer.'],
    ['table-management', 'Table Management', 'Track dine-in orders efficiently.'],
    ['inventory-management', 'Inventory Management', 'Monitor stock levels.'],
    ['gst-billing', 'GST Billing', 'Generate compliant invoices.'],
    ['sales-reports', 'Sales Reports', 'Track business performance.'],
    ['multi-outlet-support', 'Multi-Outlet Support', 'Manage multiple branches.'],
    ['customer-management', 'Customer Management', 'Improve customer retention.'],
  ],
  '/solutions/pharmacy': [
    ['quality-you-can-trust', 'Quality You Can Trust', 'Branded & reliable hardware solutions.'],
    ['end-to-end-support', 'End-to-End Support', "From setup to after-sales support, we're with you."],
    ['expertise', 'Expertise You Can Count On', 'Years of experience in pharmacy automation.'],
    ['value-for-money', 'Value for Money', 'Best solutions at competitive prices.'],
    ['quick-service', 'Quick Service', 'Fast response and minimal downtime.'],
    ['scalable-solutions', 'Scalable Solutions', 'Perfect for single stores or large chains.'],
  ],
  '/solutions/hospitality': [
    ['premium-hardware', 'Premium Hardware', 'Best quality hardware for long-term use.'],
    ['trusted-technology', 'Trusted Technology', 'Latest technology for better performance.'],
    ['fast-installation', 'Fast Installation', 'Quick setup and hassle-free installation.'],
    ['pan-india-support', 'Pan India Support', 'Service support across 500+ locations.'],
    ['reliable-performance', 'Reliable Performance', 'Built for continuous and heavy usage.'],
    ['dedicated-service', 'Dedicated Service', 'Expert team for your complete support.'],
  ],
};

const EMPTY_SECTION = { eyebrow: '', heading: '', subheading: '', description: '', points: '' };

const withoutBlankFields = (section = {}) => Object.fromEntries(
  Object.entries(section).filter(([, value]) => !(typeof value === 'string' && !value.trim()))
);

// Prefilled sections for a route, in website order: the layout's items (with their
// built-in website text) first, then any other presets for the route.
const getPageSectionPresets = (routePath) => {
  const presets = [
    ...(PAGE_SECTION_PRESETS[routePath] || []),
    ...(SOLUTION_FEATURE_PRESETS[routePath] || []).map(([, heading, description], index) => ({
      key: `${routePath.split('/').pop()}-feature-${index + 1}`,
      label: `Feature: ${heading}`,
      heading,
      description,
    })),
  ];
  const presetByKey = new Map(presets.map((section) => [section.key, section]));
  const layoutItems = getLayoutItems(getPageLayout(routePath));
  const layoutKeys = new Set(layoutItems.map((item) => item.key));
  return [
    ...layoutItems.map((item) => ({
      key: item.key,
      label: item.title || item.key,
      ...EMPTY_SECTION,
      ...(item.defaults || {}),
      ...withoutBlankFields(presetByKey.get(item.key)),
    })),
    ...presets.filter((section) => !layoutKeys.has(section.key)).map((section) => ({ ...EMPTY_SECTION, ...section })),
  ];
};

const WEBSITE_ORIGIN = 'https://buvvas.com';
const WEBSITE_SOCIAL_IMAGE = '/og-default.png';

const WEBSITE_PAGE_CONTENT = {
  '/': {
    pageName: 'Home',
    pageType: 'home',
    metaTitle: 'POS Machines, Receipt Printers & Barcode Scanners | BUVVAS',
    metaDescription: 'BUVVAS supplies POS machines, thermal receipt printers, barcode scanners, label printers and cash drawers, with billing solutions for retail stores, restaurants and pharmacies across India.',
    keywordsText: 'POS machines, receipt printers, barcode scanners, label printers, cash drawers, billing solutions, retail, restaurants, pharmacies, BUVVAS',
    pageHeading: 'Complete Billing Solutions for Retail & Restaurants',
    pageDescription: 'BUVVAS supplies POS machines, thermal receipt printers, barcode scanners, label printers and cash drawers, with billing solutions for retail stores, restaurants and pharmacies across India.',
  },
  '/products': {
    pageName: 'Products',
    pageType: 'products',
    metaTitle: 'POS Hardware | POS Machines, Printers & Scanners',
    metaDescription: 'Shop POS machines, receipt and label printers, barcode scanners, cash drawers and POS consumables from BUVVAS — built for Indian retail, restaurants and pharmacies.',
    keywordsText: 'POS hardware, POS machines, receipt printers, label printers, barcode scanners, cash drawers, POS consumables, BUVVAS',
    pageHeading: 'Everything To Run Your Counter',
    pageDescription: 'Shop POS machines, receipt and label printers, barcode scanners, cash drawers and POS consumables from BUVVAS — built for Indian retail, restaurants and pharmacies.',
  },
  '/solutions': {
    pageName: 'Solutions',
    pageType: 'solutions',
    metaTitle: 'POS & Billing Solutions for Retail, Restaurants & Pharmacies',
    metaDescription: 'Complete POS and billing solutions — POS machines, receipt printers, barcode scanners and cash drawers for retail stores, restaurants, cafes, pharmacies, supermarkets and warehouses.',
    keywordsText: 'POS solutions, billing solutions, retail POS, restaurant POS, pharmacy POS, receipt printers, barcode scanners, cash drawers',
    pageHeading: 'Technology That Moves Business Forward.',
    pageDescription: 'Buvvas brings together smart POS technology, business software and reliable hardware to help businesses manage their everyday operations more efficiently.',
  },
  '/solutions/retail': {
    pageName: 'Retail Solutions',
    pageType: 'solutions',
    metaTitle: 'Retail POS System & Billing Solutions for Stores',
    metaDescription: 'Retail POS hardware for supermarkets, fashion, electronics and mobile stores — POS machines, barcode scanners, receipt and label printers, cash drawers and billing software.',
    keywordsText: 'retail POS, retail billing, POS machines, barcode scanners, receipt printers, label printers, cash drawers',
    pageHeading: 'Everything Your Retail Store Needs To Bill Faster & Sell Smarter',
    pageDescription: 'From supermarkets and fashion stores to electronics and mobile shops, BUVVAS provides complete retail billing infrastructure to help businesses serve customers faster and manage inventory efficiently.',
  },
  '/solutions/restaurant': {
    pageName: 'Restaurant Solutions',
    pageType: 'solutions',
    metaTitle: 'Restaurant POS System & KOT Billing Solutions',
    metaDescription: 'Restaurant POS and KOT solutions for restaurants, cafes, cloud kitchens and food courts — fast billing, KOT management and printing, table management and sales reports.',
    keywordsText: 'restaurant POS, restaurant billing, KOT printer, table management, kitchen automation, restaurant reports',
    pageHeading: 'Complete Restaurant POS & KOT Solutions',
    pageDescription: 'Streamline your restaurant operations with smart POS systems, KOT printers, billing software, barcode solutions, and real-time reporting.',
  },
  '/solutions/pharmacy': {
    pageName: 'Pharmacy Solutions',
    pageType: 'solutions',
    metaTitle: 'Pharmacy POS & Billing Hardware for Medical Stores',
    metaDescription: 'Pharmacy POS hardware for retail pharmacies, chains and hospital pharmacies — billing, inventory and operations made simpler with reliable BUVVAS hardware and support.',
    keywordsText: 'pharmacy POS, pharmacy billing, medical store hardware, pharmacy inventory, POS hardware',
    pageHeading: 'Pharmacy Solutions',
    pageDescription: 'Complete hardware solutions to simplify billing, inventory & operations for Retail Pharmacies, Chains and Hospitals.',
  },
  '/solutions/hospitality': {
    pageName: 'Hospitality Solutions',
    pageType: 'solutions',
    metaTitle: 'Hospitality POS Hardware for Hotels, Resorts & Chains',
    metaDescription: 'Hospitality billing infrastructure — POS machines, KOT and receipt printers, cash drawers and customer displays for hotels, resorts, franchise chains and multi-location businesses.',
    keywordsText: 'hospitality POS, hotel POS, resort billing, restaurant hardware, KOT printers, customer displays',
    pageHeading: 'Complete Hospitality Billing Infrastructure',
    pageDescription: 'Deliver faster service and streamline operations with reliable hardware solutions designed for hotels, resorts, franchise chains and multi-location businesses.',
  },
  '/brand': {
    pageName: 'Why BUVVAS',
    pageType: 'custom',
    metaTitle: 'Why BUVVAS | POS & Billing Solutions for Every Business',
    metaDescription: 'Upgrade your billing experience with BUVVAS — complete POS and billing solutions for retail stores, restaurants and every business, with GST-ready hardware and pan-India support.',
    keywordsText: 'BUVVAS, POS solutions, billing hardware, GST-ready POS, retail billing, restaurant billing, pan-India support',
    pageHeading: 'Upgrade Your Billing Experience With BUVVAS',
    pageDescription: 'Complete POS & Billing Solutions for Retail Stores, Restaurants & Every Business.',
  },
  '/about': {
    pageName: 'About BUVVAS',
    pageType: 'about',
    metaTitle: 'About BUVVAS | POS & Billing Solutions Provider in India',
    metaDescription: 'BUVVAS is a trusted provider of POS systems, billing hardware and business automation devices, helping businesses of all sizes streamline operations across India.',
    keywordsText: 'about BUVVAS, POS systems, billing hardware, business automation, POS provider India',
    pageHeading: 'Trusted POS & Billing Solutions Provider in India',
    pageDescription: 'We help businesses of every size, from single-counter shops to multi-location franchises, bill faster and run smoother with reliable POS and billing hardware.',
  },
  '/dealers': {
    pageName: 'Dealers',
    pageType: 'dealers',
    metaTitle: 'Service Center & Dealer Locator | Find BUVVAS Dealers',
    metaDescription: 'Find BUVVAS service centers and authorized dealers near you. Search by pincode, city or state, or apply to become an authorized BUVVAS dealer.',
    keywordsText: 'BUVVAS dealers, POS service centers, authorized dealers India, dealer locator',
    pageHeading: 'Service Center & Dealer Locator',
    pageDescription: 'Find nearest BUVVAS service centers and authorized dealers across India.',
  },
  '/partner': {
    pageName: 'Partner With BUVVAS',
    pageType: 'custom',
    metaTitle: 'Become a Channel Partner | BUVVAS POS Partner Program',
    metaDescription: "Partner with India's trusted POS and billing solutions brand. Request a free consultation on product pricing, partnership benefits and margins.",
    keywordsText: 'BUVVAS channel partner, POS dealership, POS distributor, reseller partnership',
    pageHeading: 'Become a Channel Partner',
    pageDescription: "Partner with India's trusted POS & billing solutions brand. Our team will walk you through pricing, margins and everything you need to get started.",
  },
  '/support': {
    pageName: 'Support',
    pageType: 'custom',
    metaTitle: 'POS Support & Contact | 24/7 Help from BUVVAS',
    metaDescription: 'Get expert help with your POS hardware — installation, troubleshooting and warranty. Call, WhatsApp or email BUVVAS support, or find a service center near you.',
    keywordsText: 'BUVVAS support, POS technical support, POS installation, warranty support, service centers',
    pageHeading: "We're Here to Keep Your Business Moving.",
    pageDescription: 'From POS installation to technical assistance, our team is here to make your business operations smoother, simpler and more reliable.',
  },
  '/get-quote': {
    pageName: 'Get a Quote',
    pageType: 'custom',
    metaTitle: 'Get a Quote for POS Hardware & Billing Solutions',
    metaDescription: 'Share your requirements and the BUVVAS team will get back to you with a tailored quote for POS machines, printers, scanners and billing solutions.',
    keywordsText: 'POS quote, POS hardware quote, billing solutions, POS machines, receipt printers',
    pageHeading: "Let's Find the Right POS Solution",
    pageDescription: 'Share your requirements and our team will get back to you with a tailored quote.',
  },
  '/career': {
    pageName: 'Careers',
    pageType: 'custom',
    metaTitle: 'Careers at BUVVAS',
    metaDescription: 'Do meaningful work, learn continuously and help businesses grow through smarter technology.',
    keywordsText: 'BUVVAS careers, jobs in business technology, POS careers',
    pageHeading: 'Build your future with BUVVAS.',
    pageDescription: 'Do meaningful work, learn continuously and help businesses grow through smarter technology.',
  },
  '/careers': {
    pageName: 'Careers',
    pageType: 'custom',
    metaTitle: 'Careers at BUVVAS',
    metaDescription: 'Do meaningful work, learn continuously and help businesses grow through smarter technology.',
    keywordsText: 'BUVVAS careers, jobs in business technology, POS careers',
    canonicalPath: '/career',
    pageHeading: 'Build your future with BUVVAS.',
    pageDescription: 'Do meaningful work, learn continuously and help businesses grow through smarter technology.',
  },
  '/blog': {
    pageName: 'Blog',
    pageType: 'blog',
    metaTitle: 'BUVVAS Blog | Billing, POS Hardware & Retail Tips',
    metaDescription: 'Tips, guides and stories on billing, POS hardware and running a smarter retail, restaurant or pharmacy business.',
    keywordsText: 'BUVVAS blog, POS tips, billing hardware, retail tips, restaurant technology',
    pageHeading: 'Insights For Modern Businesses',
    pageDescription: 'Tips, guides and stories on billing, POS hardware and running a smarter business.',
  },
  '/privacy-policy': {
    pageName: 'Privacy Policy',
    pageType: 'custom',
    metaTitle: 'Privacy Policy',
    metaDescription: 'How BUVVAS collects, uses, shares and protects the personal and business information you provide on buvvas.com.',
    keywordsText: 'BUVVAS privacy policy, personal information, business information, data protection',
    pageHeading: 'BUVVAS Privacy Policy',
    pageDescription: 'Welcome to www.buvvas.com, the official website of BUVVAS ("BUVVAS", "we", "us", or "our"). At BUVVAS, we respect your privacy and are committed to protecting the personal and business information you share with us. This Privacy Policy explains what information we collect, how we use it, when it may be shared, and the measures we take to protect it when you visit our website, submit an enquiry, request a quotation or demonstration, purchase our products, or communicate with us.\n\nBy accessing or using www.buvvas.com, you acknowledge that you have read and understood this Privacy Policy.',
  },
  '/franchise': {
    pageName: 'Franchise',
    pageType: 'custom',
    metaTitle: 'BUVVAS Franchise Opportunity | Start Your POS Business',
    metaDescription: 'Start your own POS hardware business with a BUVVAS franchise. Get a trusted brand, a complete product range, training, marketing and technical support.',
    keywordsText: 'BUVVAS franchise, POS franchise, POS hardware business, billing solutions franchise',
    pageHeading: 'Build your own business with a BUVVAS franchise',
    pageDescription: 'Bring trusted POS hardware and billing solutions to businesses in your city. We provide the brand, the products, the training and the support — you build the business.',
  },
  // Route templates: the storefront builds titles from the live product / post,
  // so only identify the page and leave metadata blank unless the admin overrides it.
  '/products/:categoryslug': { pageName: 'Product category', pageType: 'products' },
  '/products/:categoryslug/:productslug': { pageName: 'Product details', pageType: 'product-detail' },
  '/blog/:slug': { pageName: 'Blog post', pageType: 'blog-post' },
};

// Keep the page's layout sections in website order, using saved copy where it exists,
// and keep any extra (custom) sections the admin added.
const mergePageSections = (saved = [], defaults = []) => {
  const savedByKey = new Map(saved.map((section) => [section.key, section]));
  const defaultKeys = new Set(defaults.map((section) => section.key));
  return [
    // Blank saved fields fall back to the website copy, exactly as the website itself does.
    ...defaults.map((section) => (savedByKey.has(section.key)
      ? { ...section, ...withoutBlankFields(savedByKey.get(section.key)) }
      : section)),
    ...saved.filter((section) => !defaultKeys.has(section.key)),
  ];
};

const withBrandSuffix = (title = '') => (
  title && !/\bBUVVAS\b/i.test(title) ? `${title} | BUVVAS` : title
);

const getSeoPageDefaults = (routePath = '/') => {
  const path = String(routePath || '/');
  const routeKey = path.trim().toLowerCase().replace(/\/+$/, '') || '/';
  const preset = WEBSITE_PAGE_CONTENT[routeKey] || {};
  const metaTitle = withBrandSuffix(preset.metaTitle);
  const metaDescription = preset.metaDescription || '';
  const canonicalPath = preset.canonicalPath || (routeKey.includes(':') ? '' : routeKey);
  const pageName = preset.pageName || routeKey.split('/').filter(Boolean)
    .map((part) => part.replace(/[-_]/g, ' '))
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Home';
  const routeSegments = routeKey.split('/').filter(Boolean);
  const pageType = preset.pageType
    || (routeKey.startsWith('/products/')
      ? routeSegments.length > 2 ? 'product-detail' : 'products'
      : routeKey.startsWith('/blog/') ? 'blog-post' : 'custom');

  return {
    pageName,
    pageType,
    routePath: path,
    metaTitle,
    metaDescription,
    keywordsText: preset.keywordsText || '',
    canonicalUrl: canonicalPath
      ? `${WEBSITE_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`
      : '',
    robots: 'index,follow',
    socialTitle: metaTitle,
    socialDescription: metaDescription,
    socialImageUrl: WEBSITE_SOCIAL_IMAGE,
    imageAltTexts: [],
    pageHeading: preset.pageHeading || '',
    pageDescription: preset.pageDescription || '',
    pageSections: getPageSectionPresets(routeKey),
    homeContent: createDefaultHomeContent(),
    contentHtml: '',
    status: 'draft',
  };
};

const QUILL_MODULES = {
  toolbar: [
    [{ font: ['serif', 'monospace'] }, { size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const INPUT_CLASS = 'input w-full';
const LABEL_CLASS = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

const SeoPageFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: getSeoPageDefaults('/'),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'imageAltTexts' });
  const { fields: heroFields, append: appendHero, remove: removeHero } = useFieldArray({
    control,
    name: 'homeContent.heroSlides',
  });
  const { fields: statFields, append: appendStat, remove: removeStat } = useFieldArray({
    control,
    name: 'homeContent.stats',
  });
  const { fields: whyFields, append: appendWhy, remove: removeWhy } = useFieldArray({
    control,
    name: 'homeContent.whyChoose.items',
  });
  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    control,
    name: 'pageSections',
  });
  const metaTitle = watch('metaTitle');
  const metaDescription = watch('metaDescription');
  const routePath = watch('routePath');
  const pageType = watch('pageType');
  const previousRoutePath = useRef(routePath);
  const previousPageType = useRef(pageType);
  const isHomeRoute = pageType === 'home' && routePath === '/';
  const pageLayout = getPageLayout(routePath);
  const layoutSectionKeys = getLayoutSectionKeys(pageLayout);
  const sectionIndexByKey = new Map(sectionFields.map((field, index) => [field.key, index]));
  const extraSectionIndexes = sectionFields
    .map((field, index) => (layoutSectionKeys.has(field.key) ? -1 : index))
    .filter((index) => index >= 0);
  const selectedWebsitePage = WEBSITE_PAGE_OPTIONS.find(
    ([path]) => path.toLowerCase() === String(routePath || '').trim().toLowerCase()
  )?.[0] || '';

  const renderLayoutItem = (item, variant, position) => {
    const index = sectionIndexByKey.get(item.key);
    if (index === undefined) return null;
    const labels = VARIANT_FIELD_LABELS[variant] || VARIANT_FIELD_LABELS.block;
    const fieldsToShow = item.fields || ['heading', 'description'];
    const title = item.title || (variant === 'faq'
      ? `Question ${position + 1}`
      : variant === 'policy'
        ? `Clause ${position + 1}`
        : variant === 'cards' ? `Card ${position + 1}` : sectionFields[index].label);
    // Section intros/headings span the full row even inside a card grid.
    const isWide = variant !== 'cards' || item.wide || /-(intro|copy|heading)$/.test(item.key);

    return (
      <div key={item.key} className={`space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 ${
        isWide ? 'sm:col-span-2' : ''
      }`}>
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        {fieldsToShow.map((fieldName) => {
          const label = item.labels?.[fieldName] || item[`${fieldName}Label`] || labels[fieldName];
          const name = `pageSections.${index}.${fieldName}`;
          if (fieldName === 'heading' && item.multilineHeading) {
            return (
              <div key={fieldName}>
                <label className={LABEL_CLASS}>{label} <span className="normal-case tracking-normal text-slate-400">(each line shows on its own line)</span></label>
                <textarea {...register(name, { maxLength: 160 })} rows={3} className={INPUT_CLASS} />
              </div>
            );
          }
          if (fieldName === 'description') {
            return (
              <div key={fieldName}>
                <label className={LABEL_CLASS}>{label}</label>
                <RichDescriptionField control={control} name={name} compact={variant === 'cards'} />
              </div>
            );
          }
          if (fieldName === 'points') {
            return (
              <div key={fieldName}>
                <label className={LABEL_CLASS}>{label}</label>
                <textarea {...register(name, { maxLength: 4000 })} className={`${INPUT_CLASS} min-h-32`} />
              </div>
            );
          }
          return (
            <div key={fieldName}>
              <label className={LABEL_CLASS}>{label}</label>
              <input {...register(name, { maxLength: { eyebrow: 120, heading: 160, subheading: 200 }[fieldName] })}
                className={INPUT_CLASS} />
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    api.get(`/seo/${id}`)
      .then(({ data }) => {
        if (!active) return;
        const saved = data.data;
        const defaults = getSeoPageDefaults(saved.routePath);
        const savedHome = saved.homeContent || {};
        const defaultHome = defaults.homeContent;
        const metaTitleValue = saved.metaTitle || defaults.metaTitle;
        const metaDescriptionValue = saved.metaDescription || defaults.metaDescription;
        reset({
          ...defaults,
          ...saved,
          pageName: saved.pageName || defaults.pageName,
          pageType: saved.pageType || defaults.pageType,
          routePath: saved.routePath,
          metaTitle: metaTitleValue,
          metaDescription: metaDescriptionValue,
          keywordsText: saved.keywords?.length
            ? saved.keywords.join(', ')
            : defaults.keywordsText,
          canonicalUrl: saved.canonicalUrl || defaults.canonicalUrl,
          robots: saved.robots || defaults.robots,
          socialTitle: saved.socialTitle || metaTitleValue,
          socialDescription: saved.socialDescription || metaDescriptionValue,
          socialImageUrl: saved.socialImageUrl || defaults.socialImageUrl,
          imageAltTexts: saved.imageAltTexts?.length
            ? saved.imageAltTexts
            : defaults.imageAltTexts,
          pageHeading: saved.pageHeading || defaults.pageHeading,
          pageDescription: saved.pageDescription || defaults.pageDescription,
          pageSections: mergePageSections(saved.pageSections || [], defaults.pageSections),
          homeContent: {
            ...defaultHome,
            ...savedHome,
            heroSlides: savedHome.heroSlides?.length
              ? savedHome.heroSlides
              : defaultHome.heroSlides,
            stats: savedHome.stats?.length ? savedHome.stats : defaultHome.stats,
            featuredHardware: {
              ...defaultHome.featuredHardware,
              ...savedHome.featuredHardware,
            },
            whyChoose: {
              ...defaultHome.whyChoose,
              ...savedHome.whyChoose,
              items: savedHome.whyChoose?.items?.length
                ? savedHome.whyChoose.items
                : defaultHome.whyChoose.items,
            },
          },
          contentHtml: saved.contentHtml || '',
          status: saved.status || defaults.status,
        });
      })
      .catch((err) => {
        if (active) {
          toast.error(err.response?.data?.message || 'Unable to load SEO page.');
          navigate('/seo');
        }
      });
    return () => { active = false; };
  }, [id, isEdit, navigate, reset]);

  useEffect(() => {
    if (isEdit || previousRoutePath.current === routePath) return;
    previousRoutePath.current = routePath;
    previousPageType.current = getSeoPageDefaults(routePath).pageType;
    reset(getSeoPageDefaults(routePath));
  }, [isEdit, reset, routePath]);

  // Choosing a page type loads that type's website page (route, copy and sections),
  // unless the current route already belongs to that type.
  useEffect(() => {
    if (isEdit || !pageType || previousPageType.current === pageType) return;
    previousPageType.current = pageType;
    const currentRoute = previousRoutePath.current;
    if (getSeoPageDefaults(currentRoute).pageType === pageType) return;
    const nextRoute = PAGE_TYPE_ROUTES[pageType];
    if (!nextRoute) return;
    previousRoutePath.current = nextRoute;
    reset({ ...getSeoPageDefaults(nextRoute), pageType });
  }, [isEdit, pageType, reset]);

  const onSubmit = async (values) => {
    const { keywordsText, ...data } = values;
    data.keywords = keywordsText.split(',').map((keyword) => keyword.trim()).filter(Boolean);
    data.imageAltTexts = data.imageAltTexts.filter((image) => image.imageUrl || image.altText);
    if (data.pageType !== 'home' || data.routePath !== '/') delete data.homeContent;
    try {
      if (isEdit) {
        await api.put(`/seo/${id}`, data);
        toast.success('SEO page saved.');
      } else {
        await api.post('/seo', data);
        toast.success('SEO page created.');
      }
      navigate('/seo');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save SEO page.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <button onClick={() => navigate('/seo')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to SEO Manager
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit SEO Page' : 'Add SEO Page'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add SEO settings for an existing website route. This will not create a new ecommerce page.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Page</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Page name *</label>
              <input {...register('pageName', { required: 'Page name is required' })}
                className={INPUT_CLASS} placeholder="e.g. Home" />
              {errors.pageName && <p className="mt-1 text-xs text-red-600">{errors.pageName.message}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Page type *</label>
              <select {...register('pageType', { required: true })} className={INPUT_CLASS}>
                {PAGE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className={LABEL_CLASS}>Website page</label>
              <select
                className={INPUT_CLASS}
                value={selectedWebsitePage}
                onChange={(event) => {
                  if (event.target.value) setValue('routePath', event.target.value);
                }}
              >
                <option value="">Other route (type it below)</option>
                {WEBSITE_PAGE_OPTIONS.map(([path, label]) => (
                  <option key={path} value={path}>{label} — {path}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Choosing a page prefills its current website copy and arranges the editor to match that page.
              </p>
            </div>
          )}
          <div>
            <label className={LABEL_CLASS}>Website route *</label>
            <input {...register('routePath', { required: 'Website route is required' })}
              className={INPUT_CLASS} placeholder="/about or /products/:categorySlug/:productSlug" />
            {errors.routePath && <p className="mt-1 text-xs text-red-600">{errors.routePath.message}</p>}
            {routePath?.includes(':') && (
              <p className="mt-1 text-xs text-blue-700">
                Reusable route template. Buvvas examples: /products/:categorySlug/:productSlug and /blog/:slug. Specific published routes take precedence; use tokens such as {'{{slug}}'} in metadata or copy.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Search engine metadata</h2>
          <div>
            <label className={LABEL_CLASS}>Meta title</label>
            <input {...register('metaTitle', { maxLength: 70 })} className={INPUT_CLASS}
              placeholder="A clear title for this page" />
            <p className={`mt-1 text-right text-xs ${metaTitle?.length > 70 ? 'text-red-600' : 'text-slate-400'}`}>
              {metaTitle?.length || 0}/70
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>Meta description</label>
            <textarea {...register('metaDescription', { maxLength: 320 })} className={`${INPUT_CLASS} min-h-24`}
              placeholder="Summarize what visitors will find on this page." />
            <p className={`mt-1 text-right text-xs ${metaDescription?.length > 320 ? 'text-red-600' : 'text-slate-400'}`}>
              {metaDescription?.length || 0}/320
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>Keywords</label>
            <input {...register('keywordsText')} className={INPUT_CLASS}
              placeholder="comma-separated keywords" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Canonical URL</label>
              <input {...register('canonicalUrl')} type="url" className={INPUT_CLASS}
                placeholder="https://www.example.com/page" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Search visibility</label>
              <select {...register('robots')} className={INPUT_CLASS}>
                {ROBOTS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Social sharing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Social title</label>
              <input {...register('socialTitle')} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Social image URL</label>
              <input {...register('socialImageUrl')} className={INPUT_CLASS}
                placeholder="https://… or /uploads/…" />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Social description</label>
            <textarea {...register('socialDescription')} className={`${INPUT_CLASS} min-h-20`} />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">Image alt text</h2>
              <p className="mt-1 text-xs text-slate-500">Add an image URL or path and its accessible description.</p>
            </div>
            <button type="button" onClick={() => append({ imageUrl: '', altText: '' })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <Plus size={14} /> Add image
            </button>
          </div>
          {fields.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-400">No image alt text entries added.</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input {...register(`imageAltTexts.${index}.imageUrl`)} className={INPUT_CLASS}
                placeholder="Image URL or path" aria-label="Image URL or path" />
              <input {...register(`imageAltTexts.${index}.altText`)} className={INPUT_CLASS}
                placeholder="Descriptive alt text" aria-label="Image alt text" />
              <button type="button" onClick={() => remove(index)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove image alt text">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>

        {(!isHomeRoute || pageLayout.groups.length > 0) && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-800">{isHomeRoute ? 'Homepage content' : 'Page content'}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Arranged in the same order as the website page and prefilled with its current copy.
                Clear a field to keep the website’s built-in text.
                {isHomeRoute && ' Hero banners, stats, Featured Hardware and Why Choose are edited in Homepage sections below.'}
              </p>
            </div>

            {!isHomeRoute && pageLayout.hero && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">{pageLayout.hero?.title || 'Page header'}</h3>
                {pageLayout.hero?.hint && <p className="mt-0.5 text-xs text-slate-500">{pageLayout.hero.hint}</p>}
              </div>
              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div>
                  <label className={LABEL_CLASS}>{pageLayout.hero?.headingLabel || 'Heading'}</label>
                  <input {...register('pageHeading', { maxLength: 160 })} className={INPUT_CLASS}
                    placeholder="Main page heading" />
                </div>
                {(pageLayout.hero?.items || []).map((item, position) => renderLayoutItem(item, 'block', position))}
                <div>
                  <label className={LABEL_CLASS}>{pageLayout.hero?.descriptionLabel || 'Description'}</label>
                  <RichDescriptionField control={control} name="pageDescription" />
                </div>
              </div>
            </div>
            )}

            {pageLayout.groups.map((group) => {
              const items = group.items.filter((item) => sectionIndexByKey.has(item.key));
              if (!items.length) return null;
              return (
                <div key={group.title} className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">{group.title}</h3>
                    {group.hint && <p className="mt-0.5 text-xs text-slate-500">{group.hint}</p>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((item, position) => renderLayoutItem(item, group.variant, position))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">Additional sections</h2>
              <p className="mt-1 text-xs text-slate-500">
                Extra heading and paragraph blocks shown at the bottom of the page, after its existing content.
              </p>
            </div>
            <button type="button" onClick={() => appendSection({
              key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              label: 'Additional section',
              heading: '',
              description: '',
            })}
              disabled={sectionFields.length >= 60}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={14} /> Add section
            </button>
          </div>
          {extraSectionIndexes.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
              No additional sections added.
            </p>
          )}
          {extraSectionIndexes.map((index) => (
            <div key={sectionFields[index].id} className="space-y-3 rounded-lg border border-slate-100 p-3">
              <input type="hidden" {...register(`pageSections.${index}.key`)} />
              <div className="flex items-center justify-between gap-3">
                <input {...register(`pageSections.${index}.label`, { required: 'Section label is required' })}
                  className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 focus:ring-0"
                  aria-label={`Section label ${index + 1}`} />
                <button type="button" onClick={() => removeSection(index)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove page section">
                  <Trash2 size={16} />
                </button>
              </div>
              {errors.pageSections?.[index]?.label && (
                <p className="text-xs text-red-600">{errors.pageSections[index].label.message}</p>
              )}
              <div>
                <label className={LABEL_CLASS}>Section heading</label>
                <input {...register(`pageSections.${index}.heading`)} className={INPUT_CLASS}
                  placeholder="Section heading" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Paragraphs / description</label>
                <RichDescriptionField control={control} name={`pageSections.${index}.description`} />
              </div>
            </div>
          ))}
        </section>

        {isHomeRoute && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-800">Homepage sections</h2>
              <p className="mt-1 text-xs text-slate-500">
                Defaults match the React storefront. Relative image paths resolve on the storefront; leave a section empty to keep its current content.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Relative banner paths do not preview in the supplier dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Hero banners</h3>
                <button type="button" onClick={() => appendHero({ imageUrl: '', altText: '', link: '' })}
                  disabled={heroFields.length >= 12}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus size={14} /> Add banner
                </button>
              </div>
              {heroFields.length === 0 && (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  The current website banners stay in place until you add at least one custom banner.
                </p>
              )}
              {heroFields.map((field, index) => {
                const imageUrl = watch(`homeContent.heroSlides.${index}.imageUrl`);
                return (
                  <div key={field.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {imageUrl && /^https?:\/\//i.test(imageUrl) && (
                      <img src={imageUrl} alt="" className="col-span-full max-h-40 w-full rounded-md bg-slate-50 object-contain" />
                    )}
                    <input {...register(`homeContent.heroSlides.${index}.imageUrl`)} className={INPUT_CLASS}
                      placeholder="Image URL or path" aria-label={`Hero image URL ${index + 1}`} />
                    <input {...register(`homeContent.heroSlides.${index}.altText`)} className={INPUT_CLASS}
                      placeholder="Image alt text" aria-label={`Hero image alt text ${index + 1}`} />
                    <input {...register(`homeContent.heroSlides.${index}.link`)} className={INPUT_CLASS}
                      placeholder="Optional link (e.g. /products)" aria-label={`Hero banner link ${index + 1}`} />
                    <button type="button" onClick={() => removeHero(index)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove hero banner">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Homepage stats strip</h3>
                <button type="button" onClick={() => appendStat({ value: '', label: '' })}
                  disabled={statFields.length >= 6}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus size={14} /> Add stat
                </button>
              </div>
              {statFields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input {...register(`homeContent.stats.${index}.value`)} className={INPUT_CLASS}
                    placeholder="Value" aria-label={`Stat value ${index + 1}`} />
                  <input {...register(`homeContent.stats.${index}.label`)} className={INPUT_CLASS}
                    placeholder="Label" aria-label={`Stat label ${index + 1}`} />
                  <button type="button" onClick={() => removeStat(index)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove stat">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Featured Hardware</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Eyebrow</label>
                  <input {...register('homeContent.featuredHardware.eyebrow')} className={INPUT_CLASS}
                    placeholder="BUVVAS product picks" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Heading</label>
                  <input {...register('homeContent.featuredHardware.title')} className={INPUT_CLASS}
                    placeholder="Featured Hardware" />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Description</label>
                <textarea {...register('homeContent.featuredHardware.description')}
                  className={`${INPUT_CLASS} min-h-20`} placeholder="Section description" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Why Choose Buvvas</h3>
                <button type="button" onClick={() => appendWhy({ title: '', description: '' })}
                  disabled={whyFields.length >= 12}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus size={14} /> Add item
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Eyebrow</label>
                  <input {...register('homeContent.whyChoose.eyebrow')} className={INPUT_CLASS}
                    placeholder="Why Buvvas" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Heading</label>
                  <input {...register('homeContent.whyChoose.title')} className={INPUT_CLASS}
                    placeholder="Why choose Buvvas?" />
                </div>
              </div>
              {whyFields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input {...register(`homeContent.whyChoose.items.${index}.title`)} className={INPUT_CLASS}
                    placeholder="Item heading" aria-label={`Why Choose heading ${index + 1}`} />
                  <input {...register(`homeContent.whyChoose.items.${index}.description`)} className={INPUT_CLASS}
                    placeholder="Item description" aria-label={`Why Choose description ${index + 1}`} />
                  <button type="button" onClick={() => removeWhy(index)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove Why Choose item">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-800">Additional page content</h2>
          <p className="mb-3 text-xs text-slate-500">
            Add formatted content below the page’s existing sections. Use this for additional headings, descriptions, lists, and links.
          </p>
          <Controller
            name="contentHtml"
            control={control}
            render={({ field }) => (
              <ReactQuill
                theme="snow"
                value={field.value || ''}
                onChange={field.onChange}
                modules={QUILL_MODULES}
                className="bg-white [&_.ql-container]:min-h-[280px] [&_.ql-container]:text-sm"
              />
            )}
          />
        </section>

        <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className={LABEL_CLASS}>Publication status</label>
            <select {...register('status')} className={`${INPUT_CLASS} min-w-48`}>
              <option value="draft">Draft (not public)</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/seo')}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-50">
              <Save size={15} /> {isSubmitting ? 'Saving…' : 'Save SEO Page'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default SeoPageFormPage;
