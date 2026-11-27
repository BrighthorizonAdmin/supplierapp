import { Building2, CheckCircle2 } from 'lucide-react';

const HIGHLIGHTS = [
  'Dealers, orders, invoices and stock in one place',
  'Live alerts for KYC, overdue payments and low stock',
  'Role-based access for every team',
];

/** Split-screen layout for sign-in, forgot password and reset password. */
const AuthLayout = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex min-h-screen bg-canvas">
    {/* Brand panel */}
    <div className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-12 text-white lg:flex">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary-400/30 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="icon-tile h-11 w-11 rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
          <Building2 size={20} />
        </span>
        <div>
          <p className="text-[15px] font-bold leading-tight">Supplier Portal</p>
          <p className="text-xs text-primary-100">Buvvas One</p>
        </div>
      </div>

      <div className="relative">
        <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
          Run your supplier business from one dashboard.
        </h2>
        <ul className="mt-8 space-y-3.5">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-center gap-3 text-[15px] text-primary-50">
              <CheckCircle2 size={18} className="flex-shrink-0 text-primary-200" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-primary-200">© {new Date().getFullYear()} Buvvas · Supplier management</p>
    </div>

    {/* Form */}
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <span className="icon-tile mb-5 h-12 w-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-brand">
            {Icon ? <Icon size={22} /> : <Building2 size={22} />}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="card p-7">{children}</div>
      </div>
    </div>
  </div>
);

export default AuthLayout;
