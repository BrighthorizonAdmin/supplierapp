/**
 * Master permission registry — single source of truth for the entire RBAC system.
 *
 * PERMISSION TAXONOMY
 * ───────────────────
 * Permissions follow the pattern  <resource>:<action>
 *
 * Three layers of access are controlled here:
 *
 *  1. FEATURE ACCESS  (dashboard:read, audit:read)
 *     Controls whether a user can open the aggregated feature page.
 *     These endpoints return computed/summary data and NEVER expose raw module records.
 *     Assigning dashboard:read does NOT give access to /orders, /inventory etc.
 *
 *  2. MODULE CRUD  (orders:read, inventory:write …)
 *     Controls direct read/write access to a specific module's records.
 *     A user with orders:read can list and view individual order records.
 *
 *  3. ADMIN  (admin:read, admin:write)
 *     Controls access to users and role management screens.
 *
 * WILDCARD SUPPORT  (evaluated by rbac.middleware.js)
 *   *             → super-admin, matches every permission
 *   resource:*    → matches all actions on that resource (e.g. dealer:* grants dealer:read + dealer:write)
 *
 * RULE: Never remove a key once it is deployed — only add new ones.
 */
const ALL_PERMISSIONS = [
  // ── Feature Access ────────────────────────────────────────────────────────
  // dashboard:read  → /dashboard page + all /api/dashboard/* aggregation endpoints
  // audit:read      → /audit page + all /api/audit/analytics/* aggregation endpoints
  { key: 'dashboard:read',      label: 'View Dashboard',              group: 'Feature Access' },
  { key: 'audit:read',          label: 'View Audit & Analytics',      group: 'Feature Access' },

  // ── Dealer & Documents ────────────────────────────────────────────────────
  { key: 'dealer:read',         label: 'View Dealers',                group: 'Dealer' },
  { key: 'dealer:write',        label: 'Create / Edit Dealers',       group: 'Dealer' },
  { key: 'documents:read',      label: 'View Documents',              group: 'Dealer' },
  { key: 'documents:write',     label: 'Manage Documents',            group: 'Dealer' },

  // ── Inventory ─────────────────────────────────────────────────────────────
  { key: 'inventory:read',      label: 'View Inventory',              group: 'Inventory' },
  { key: 'inventory:write',     label: 'Manage Inventory',            group: 'Inventory' },
  { key: 'products:read',       label: 'View Products',               group: 'Inventory' },
  { key: 'products:write',      label: 'Manage Products',             group: 'Inventory' },
  { key: 'warehouse:read',      label: 'View Warehouses',             group: 'Inventory' },
  { key: 'warehouse:write',     label: 'Manage Warehouses',           group: 'Inventory' },

  // ── Orders ────────────────────────────────────────────────────────────────
  { key: 'orders:read',         label: 'View Orders',                 group: 'Orders' },
  { key: 'orders:write',        label: 'Manage Orders',               group: 'Orders' },
  { key: 'retailOrders:read',   label: 'View Retail Orders',          group: 'Orders' },
  { key: 'retailOrders:write',  label: 'Manage Retail Orders',        group: 'Orders' },
  { key: 'returns:read',        label: 'View Returns',                group: 'Orders' },
  { key: 'returns:write',       label: 'Manage Returns',              group: 'Orders' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { key: 'finance:read',        label: 'View Finance Reports',        group: 'Finance' },
  { key: 'finance:write',       label: 'Manage Finance',              group: 'Finance' },
  { key: 'payments:read',       label: 'View Payments',               group: 'Finance' },
  { key: 'payments:write',      label: 'Manage Payments',             group: 'Finance' },
  { key: 'invoices:read',       label: 'View Invoices',               group: 'Finance' },
  { key: 'invoices:write',      label: 'Manage Invoices',             group: 'Finance' },

  // ── Marketing ─────────────────────────────────────────────────────────────
  { key: 'marketing:read',      label: 'View Marketing Leads',        group: 'Marketing' },
  { key: 'marketing:write',     label: 'Manage Marketing Leads',      group: 'Marketing' },

  // ── System ────────────────────────────────────────────────────────────────
  { key: 'notifications:read',  label: 'View Notifications',          group: 'System' },
  { key: 'notifications:write', label: 'Manage Notifications',        group: 'System' },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { key: 'admin:read',          label: 'View Users & Roles',          group: 'Admin' },
  { key: 'admin:write',         label: 'Manage Users & Roles',        group: 'Admin' },
];

/**
 * Returns true if the given permission key exists in the registry.
 */
const isValidPermission = (perm) => ALL_PERMISSIONS.some((p) => p.key === perm);

/**
 * Default role definitions seeded into the DB on first startup (or upserted on every startup).
 *
 * Role design rules:
 *  - dashboard:read  must be added to any role that needs the main dashboard page
 *  - audit:read      grants the analytics/audit page (aggregated data only — no module CRUD)
 *  - Module permissions (orders:read etc.) grant access to the raw module APIs
 *  - admin:read/write must be assigned explicitly — never bundled implicitly
 */
const DEFAULT_ROLES = [
  // ── System Roles (isSystem: true → cannot be deleted) ─────────────────────
  {
    name: 'super-admin',
    description: 'Full unrestricted access. Cannot be deleted or modified.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'admin',
    description: 'Broad access across all modules. Cannot be deleted.',
    permissions: [
      'dashboard:read', 'audit:read',
      'dealer:read', 'dealer:write', 'documents:read', 'documents:write',
      'inventory:read', 'inventory:write', 'products:read', 'products:write',
      'warehouse:read', 'warehouse:write',
      'orders:read', 'orders:write', 'retailOrders:read', 'retailOrders:write',
      'returns:read', 'returns:write',
      'finance:read', 'payments:read', 'payments:write', 'invoices:read', 'invoices:write',
      'marketing:read', 'marketing:write',
      'notifications:read',
      'admin:read', 'admin:write',
    ],
    isSystem: true,
  },

  // ── Operational Roles ─────────────────────────────────────────────────────
  {
    name: 'finance',
    description: 'Access to financial data, payments, invoices, and the dashboard.',
    permissions: [
      'dashboard:read',
      'finance:read', 'finance:write',
      'payments:read', 'payments:write',
      'invoices:read', 'invoices:write',
      'returns:read',
      'dealer:read', 'orders:read',
    ],
    isSystem: false,
  },
  {
    name: 'inventory-manager',
    description: 'Manages stock, products, and warehouses.',
    permissions: [
      'dashboard:read',
      'inventory:read', 'inventory:write',
      'products:read', 'products:write',
      'warehouse:read', 'warehouse:write',
      'returns:read', 'returns:write',
      'orders:read',
    ],
    isSystem: false,
  },
  {
    name: 'onboarding-manager',
    description: 'Manages dealer onboarding, KYC document verification, and audit logs.',
    permissions: [
      'dashboard:read', 'audit:read',
      'dealer:read', 'dealer:write',
      'documents:read', 'documents:write',
    ],
    isSystem: false,
  },
  {
    name: 'support',
    description: 'Read-only view of dealers, orders, returns, and notifications.',
    permissions: [
      'dashboard:read',
      'dealer:read', 'orders:read',
      'retailOrders:read', 'returns:read',
      'notifications:read',
    ],
    isSystem: false,
  },
  {
    name: 'marketing',
    description: 'Full access to marketing leads pipeline.',
    permissions: [
      'dashboard:read',
      'marketing:read', 'marketing:write',
      'dealer:read',
    ],
    isSystem: false,
  },
  {
    name: 'analyst',
    description: 'Analytics and audit dashboard access. Views aggregated metrics — no raw module records.',
    permissions: ['audit:read'],
    isSystem: false,
  },
  {
    name: 'read-only',
    description: 'Read access across most modules. Default role for new users.',
    permissions: [
      'dashboard:read',
      'dealer:read', 'orders:read', 'retailOrders:read',
      'inventory:read', 'products:read',
      'finance:read', 'payments:read', 'invoices:read',
      'returns:read',
    ],
    isSystem: false,
  },
];

module.exports = { ALL_PERMISSIONS, DEFAULT_ROLES, isValidPermission };
