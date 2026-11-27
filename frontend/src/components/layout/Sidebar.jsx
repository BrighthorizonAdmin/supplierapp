import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Building2, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { toggleSidebar } from '../../store/uiSlice';
import { usePermission } from '../../routes/ProtectedRoute';
import { logout } from '../../features/auth/authSlice';
import { NAV_SECTIONS, TONES } from './navConfig';
import { getInitials, getRoleLabel } from './userDisplay';

const Sidebar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
  const { user } = useSelector((s) => s.auth);
  const kpis = useSelector((s) => s.dashboard.kpis);
  const { hasPermission } = usePermission();

  const handleLogout = () => {
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const sections = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.perm || hasPermission(item.perm)) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-full flex-col border-r border-slate-200/80 bg-sidebar transition-[width] duration-200 ${
        sidebarOpen ? 'w-64' : 'w-[72px]'
      }`}
    >
      {/* Brand */}
      <div className={`flex h-[68px] flex-shrink-0 items-center gap-3 border-b border-slate-200/80 ${sidebarOpen ? 'px-4' : 'justify-center px-2'}`}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-brand">
          <Building2 size={19} />
        </div>
        {sidebarOpen && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-slate-900">Supplier Portal</p>
            <p className="truncate text-xs leading-tight text-slate-500">Buvvas One</p>
          </div>
        )}
        {sidebarOpen && (
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      {!sidebarOpen && (
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="mx-auto mt-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex > 0 ? 'mt-4' : ''}>
            {sidebarOpen ? (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {section.label}
              </p>
            ) : (
              sectionIndex > 0 && <div className="mx-2 mb-3 h-px bg-slate-200" />
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, tone, count, end }) => {
                const countValue = (Array.isArray(count) ? count : [count].filter(Boolean))
                  .reduce((sum, key) => sum + (Number(kpis?.[key]) || 0), 0);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end !== false}
                    title={sidebarOpen ? undefined : label}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl py-1.5 text-sm transition-colors ${
                        sidebarOpen ? 'px-2' : 'justify-center px-0'
                      } ${isActive
                        ? 'bg-primary-100/70 font-semibold text-slate-900'
                        : 'font-medium text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`icon-tile h-8 w-8 ${isActive ? 'bg-primary-600 text-white shadow-brand' : TONES[tone] || TONES.slate}`}>
                          <Icon size={16} />
                        </span>
                        {sidebarOpen && <span className="flex-1 truncate">{label}</span>}
                        {countValue > 0 && (sidebarOpen ? (
                          <span className={`text-xs font-semibold tabular-nums ${isActive ? 'text-primary-700' : 'text-slate-400'}`}>
                            {countValue > 99 ? '99+' : countValue}
                          </span>
                        ) : (
                          <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
                        ))}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={`flex flex-shrink-0 items-center gap-3 border-t border-slate-200/80 py-3 ${sidebarOpen ? 'px-4' : 'justify-center px-2'}`}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
          {getInitials(user?.name)}
        </div>
        {sidebarOpen && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">{user?.name || 'Supplier user'}</p>
              <p className="truncate text-xs leading-tight text-slate-500">{getRoleLabel(user?.role)}</p>
            </div>
            <button
              onClick={() => navigate('/changePassword')}
              className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              title="Change password"
            >
              <KeyRound size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
