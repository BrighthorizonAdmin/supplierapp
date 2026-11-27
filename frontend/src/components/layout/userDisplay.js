export const ROLE_LABELS = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  'inventory-manager': 'Inventory Manager',
  'onboarding-manager': 'Onboarding Manager',
  support: 'Support',
  'read-only': 'Read Only',
};

export const getRoleLabel = (role) => {
  const roles = Array.isArray(role) ? role : [role].filter(Boolean);
  return roles.map((r) => ROLE_LABELS[r] || r).join(', ') || 'Admin';
};

export const getInitials = (name) => (
  name ? name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() : 'SU'
);
