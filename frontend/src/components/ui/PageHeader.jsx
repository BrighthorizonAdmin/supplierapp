import { ArrowLeft } from 'lucide-react';

/**
 * Page hero: brand icon tile, title, subtitle and actions on the right.
 *   <PageHeader icon={ShoppingCart} title="Orders" subtitle="Track dealer orders">
 *     <button className="btn-primary">Export</button>
 *   </PageHeader>
 * Optional:
 *   badge   node shown next to the title (e.g. a StatusBadge on detail pages)
 *   back    { label, onClick } — small back link above the title
 *   compact smaller variant for detail and form pages
 */
const PageHeader = ({ icon: Icon, title, subtitle, badge, back, compact = false, children }) => (
  <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-primary-50/70 via-white to-white shadow-card ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}>
    {back && (
      <button
        type="button"
        onClick={back.onClick}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={15} /> {back.label || 'Back'}
      </button>
    )}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <span className={`icon-tile bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-brand ${compact ? 'h-12 w-12 rounded-xl' : 'h-14 w-14 rounded-2xl'}`}>
            <Icon size={compact ? 21 : 24} />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={`truncate font-bold tracking-tight text-slate-900 ${compact ? 'text-xl' : 'text-2xl'}`}>{title}</h1>
            {badge}
          </div>
          {subtitle && <div className="mt-0.5 text-[15px] text-slate-500">{subtitle}</div>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  </div>
);

export default PageHeader;
