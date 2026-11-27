import {
  LayoutDashboard, BarChart3, Megaphone, FileSignature, ReceiptText, Truck, ShoppingCart, Zap,
  UserPlus, Store, Package, Tag, Boxes, Wallet, BookOpenText, CreditCard, RotateCcw, Repeat,
  ShieldCheck, LifeBuoy, MessageSquare, Newspaper, Search, Star, Users, KeyRound, Settings,
} from 'lucide-react';

/**
 * Sidebar sections, in order. Each item:
 *   to, label, icon, perm   — route, text, lucide icon, required permission
 *   tone                    — icon tile colour (see TONES)
 *   count                   — dashboard KPI key (or keys, summed) for the badge on the right
 *   end                     — false when child routes should keep the item active
 */
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:read', tone: 'blue' },
      { to: '/audit', label: 'Analytics', icon: BarChart3, perm: 'audit:read', tone: 'violet' },
    ],
  },
  {
    label: 'Sell',
    items: [
      { to: '/marketing-leads', label: 'Marketing leads', icon: Megaphone, perm: 'marketing:read', tone: 'teal', end: false },
      { to: '/quotes', label: 'Quotes', icon: FileSignature, perm: 'invoices:read', tone: 'amber', end: false },
      { to: '/invoices', label: 'Sales invoices', icon: ReceiptText, perm: 'invoices:read', tone: 'blue', end: false },
      { to: '/delivery-challan', label: 'Delivery challan', icon: Truck, perm: 'invoices:read', tone: 'teal', end: false },
      { to: '/orders', label: 'Orders', icon: ShoppingCart, perm: 'orders:read', tone: 'violet', end: false },
      { to: '/flash-sales', label: 'Flash sale', icon: Zap, perm: 'flashsale:read', tone: 'rose', end: false },
    ],
  },
  {
    label: 'Dealers',
    items: [
      { to: '/onboarding', label: 'Onboarding', icon: UserPlus, perm: 'dealer:read', tone: 'green', count: 'pendingApprovals' },
      { to: '/dealers', label: 'Dealer management', icon: Store, perm: 'dealer:read', tone: 'blue', end: false },
    ],
  },
  {
    label: 'Catalog & stock',
    items: [
      { to: '/products', label: 'Product catalog', icon: Package, perm: 'products:read', tone: 'amber', end: false },
      { to: '/hsn-codes', label: 'HSN codes', icon: Tag, perm: 'products:read', tone: 'slate' },
      { to: '/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory:read', tone: 'teal', end: false, count: ['outOfStockAlerts', 'lowStockAlerts'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Finance overview', icon: Wallet, perm: 'finance:read', tone: 'green' },
      { to: '/finance/ledger', label: 'Ledger', icon: BookOpenText, perm: 'payments:read', tone: 'violet' },
      { to: '/payments', label: 'Payments & credits', icon: CreditCard, perm: 'payments:read', tone: 'blue' },
    ],
  },
  {
    label: 'After-sales',
    items: [
      { to: '/returns', label: 'Returns', icon: RotateCcw, perm: 'returns:read', tone: 'rose', count: 'pendingReturns' },
      { to: '/exchanges', label: 'Exchanges', icon: Repeat, perm: 'returns:read', tone: 'amber' },
      { to: '/warranty', label: 'Warranty', icon: ShieldCheck, perm: 'orders:read', tone: 'green', end: false, count: 'warrantyPending' },
      { to: '/support', label: 'Support tickets', icon: LifeBuoy, perm: 'support:read', tone: 'blue', end: false, count: 'serviceRequests' },
    ],
  },
  {
    label: 'Website',
    items: [
      { to: '/website-enquiries', label: 'Website enquiries', icon: MessageSquare, perm: 'enquiries:read', tone: 'teal', end: false },
      { to: '/blog', label: 'Blog', icon: Newspaper, perm: 'blog:read', tone: 'amber', end: false },
      { to: '/seo', label: 'SEO manager', icon: Search, perm: 'seo:read', tone: 'violet', end: false },
      { to: '/product-reviews', label: 'Product reviews', icon: Star, perm: 'reviews:read', tone: 'rose' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { to: '/usermanagement', label: 'User management', icon: Users, perm: 'users:manage', tone: 'blue' },
      { to: '/rolemanagement', label: 'Role permissions', icon: KeyRound, perm: 'users:manage', tone: 'violet' },
      { to: '/notifications', label: 'Settings', icon: Settings, perm: 'notifications:read', tone: 'slate' },
    ],
  },
];

/** Icon tile colours (background + icon colour). Full class names so Tailwind keeps them. */
export const TONES = {
  blue: 'bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100',
  violet: 'bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100',
  teal: 'bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-100',
  green: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  red: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100',
};

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label }))
);

// Pages reached from inside a section (not in the sidebar) still get a breadcrumb.
const EXTRA_ROUTES = [
  { to: '/retail-orders', label: 'Retail orders', section: 'Sell' },
  { to: '/warranty-lookup', label: 'Warranty lookup', section: 'After-sales' },
  { to: '/addnew-dealer', label: 'Add dealer', section: 'Dealers' },
  { to: '/notifications/all', label: 'All notifications', section: 'Setup' },
  { to: '/changePassword', label: 'Change password', section: 'Account' },
];

/**
 * Breadcrumb trail for a path: section › page › (New | Edit | Details | Print).
 * Uses the longest matching route so /finance/ledger wins over /finance.
 */
export const getBreadcrumbs = (pathname) => {
  const routes = [...ALL_NAV_ITEMS, ...EXTRA_ROUTES].sort((a, b) => b.to.length - a.to.length);
  const match = routes.find((route) => pathname === route.to || pathname.startsWith(`${route.to}/`));
  if (!match) return [{ label: 'Buvvas One' }];

  const crumbs = [{ label: match.section }, { label: match.label, to: match.to }];
  const rest = pathname.slice(match.to.length).split('/').filter(Boolean);
  if (rest.length) {
    const last = rest[rest.length - 1];
    const sub = { new: 'New', edit: 'Edit', print: 'Print' }[last] || 'Details';
    crumbs.push({ label: sub });
  }
  return crumbs;
};
