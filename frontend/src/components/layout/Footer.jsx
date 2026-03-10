import { useSelector } from 'react-redux';

const ROLE_LABELS = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  'inventory-manager': 'Inventory Manager',
  'onboarding-manager': 'Onboarding Manager',
  support: 'Support',
  'read-only': 'Read Only',
};

const Footer = () => {
  const { user } = useSelector((s) => s.auth);
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Admin';

  return (
    <footer className="h-9 bg-white border-t border-slate-100 flex items-center px-6 flex-shrink-0">
      <span className="text-xs text-slate-400">
        Role - based access &nbsp;•&nbsp; {roleLabel}'s View
      </span>
    </footer>
  );
};

export default Footer;
