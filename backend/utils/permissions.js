/**
 * Master list of all available permissions in the system.
 * This is the single source of truth — defines what CAN be assigned to roles.
 * Never remove entries from here; only add new ones.
 */
const ALL_PERMISSIONS = [
  // Dashboard
  { key: 'dashboard:read',      label: 'View Dashboard',        group: 'Dashboard' },

  // Dealer
  { key: 'dealer:read',         label: 'View Dealers',           group: 'Dealer' },
  { key: 'dealer:write',        label: 'Create / Edit Dealers',  group: 'Dealer' },

  // Documents
  { key: 'documents:read',      label: 'View Documents',         group: 'Documents' },
  { key: 'documents:write',     label: 'Manage Documents',       group: 'Documents' },

  // Inventory
  { key: 'inventory:read',      label: 'View Inventory',         group: 'Inventory' },
  { key: 'inventory:write',     label: 'Manage Inventory',       group: 'Inventory' },

  // Products
  { key: 'products:read',       label: 'View Products',          group: 'Products' },
  { key: 'products:write',      label: 'Manage Products',        group: 'Products' },

  // Warehouse
  { key: 'warehouse:read',      label: 'View Warehouses',        group: 'Warehouse' },
  { key: 'warehouse:write',     label: 'Manage Warehouses',      group: 'Warehouse' },

  // Orders
  { key: 'orders:read',         label: 'View Orders',            group: 'Orders' },
  { key: 'orders:write',        label: 'Manage Orders',          group: 'Orders' },
  { key: 'retailOrders:read',   label: 'View Retail Orders',     group: 'Orders' },
  { key: 'retailOrders:write',  label: 'Manage Retail Orders',   group: 'Orders' },

  // Returns
  { key: 'returns:read',        label: 'View Returns',           group: 'Returns' },
  { key: 'returns:write',       label: 'Manage Returns',         group: 'Returns' },

  // Finance
  { key: 'finance:read',        label: 'View Finance Reports',   group: 'Finance' },
  { key: 'finance:write',       label: 'Manage Finance',         group: 'Finance' },
  { key: 'payments:read',       label: 'View Payments',          group: 'Finance' },
  { key: 'payments:write',      label: 'Manage Payments',        group: 'Finance' },
  { key: 'invoices:read',       label: 'View Invoices',          group: 'Finance' },
  { key: 'invoices:write',      label: 'Manage Invoices',        group: 'Finance' },

  // System
  { key: 'notifications:read',  label: 'View Notifications',     group: 'System' },
  { key: 'notifications:write', label: 'Manage Notifications',   group: 'System' },
  { key: 'audit:read',          label: 'View Audit Logs',        group: 'System' },

  // Admin
  { key: 'admin:read',          label: 'View Users & Roles',     group: 'Admin' },
  { key: 'admin:write',         label: 'Manage Users & Roles',   group: 'Admin' },
];

/**
 * Returns true if the given permission key exists in the registry.
 */
const isValidPermission = (perm) => ALL_PERMISSIONS.some((p) => p.key === perm);

/**
 * Default role definitions used to seed the DB on first startup.
 * Maps role name → permission keys.
 */
const DEFAULT_ROLES = [
  {
    name: 'super-admin',
    description: 'Full access to everything. Cannot be deleted.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'admin',
    description: 'Broad access across all modules except super-admin functions.',
    permissions: [
      'dashboard:read',
      'dealer:read', 'dealer:write', 'documents:read', 'documents:write',
      'inventory:read', 'inventory:write', 'products:read', 'products:write',
      'warehouse:read', 'warehouse:write', 'orders:read', 'orders:write',
      'retailOrders:read', 'retailOrders:write', 'returns:read', 'returns:write',
      'payments:read', 'payments:write', 'invoices:read', 'invoices:write',
      'notifications:read', 'audit:read', 'finance:read', 'admin:read', 'admin:write',
    ],
    isSystem: true,
  },
  {
    name: 'finance',
    description: 'Access to financial data, payments, and invoices.',
    permissions: [
      'dashboard:read', 'finance:read', 'finance:write',
      'payments:read', 'payments:write', 'invoices:read', 'invoices:write',
      'returns:read', 'dealer:read', 'orders:read',
    ],
    isSystem: false,
  },
  {
    name: 'inventory-manager',
    description: 'Manages stock, products, and warehouses.',
    permissions: [
      'dashboard:read', 'inventory:read', 'inventory:write',
      'products:read', 'products:write', 'warehouse:read', 'warehouse:write',
      'returns:read', 'returns:write', 'orders:read',
    ],
    isSystem: false,
  },
  {
    name: 'onboarding-manager',
    description: 'Manages dealer onboarding and document verification.',
    permissions: [
      'dashboard:read', 'dealer:read', 'dealer:write',
      'documents:read', 'documents:write', 'audit:read',
    ],
    isSystem: false,
  },
  {
    name: 'support',
    description: 'Read-only view of dealers, orders, returns, and notifications.',
    permissions: [
      'dashboard:read', 'dealer:read', 'orders:read',
      'retailOrders:read', 'returns:read', 'notifications:read',
    ],
    isSystem: false,
  },
  {
    name: 'read-only',
    description: 'Read access across most modules.',
    permissions: [
      'dashboard:read', 'dealer:read', 'orders:read', 'retailOrders:read',
      'inventory:read', 'products:read', 'finance:read', 'payments:read',
      'invoices:read', 'returns:read',
    ],
    isSystem: false,
  },
];

module.exports = { ALL_PERMISSIONS, DEFAULT_ROLES, isValidPermission };
