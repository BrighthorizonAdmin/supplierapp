import { TrendingUp, TrendingDown } from 'lucide-react';

// Top accent bar, soft background tint and icon tile per colour.
const COLOR_MAP = {
  blue:   { bar: 'bg-primary-500', tint: 'from-primary-50/80', icon: 'bg-primary-100/80 text-primary-600' },
  green:  { bar: 'bg-emerald-600', tint: 'from-emerald-50/80', icon: 'bg-emerald-100/80 text-emerald-700' },
  red:    { bar: 'bg-red-500',     tint: 'from-red-50/80',     icon: 'bg-red-100/80 text-red-600' },
  yellow: { bar: 'bg-amber-500',   tint: 'from-amber-50/80',   icon: 'bg-amber-100/80 text-amber-700' },
  purple: { bar: 'bg-violet-500',  tint: 'from-violet-50/80',  icon: 'bg-violet-100/80 text-violet-600' },
  orange: { bar: 'bg-orange-500',  tint: 'from-orange-50/80',  icon: 'bg-orange-100/80 text-orange-600' },
};

/**
 * KPICard — stat card with a coloured top bar.
 * Props:
 *   title        string   — metric label
 *   value        string|number — main value
 *   icon         LucideIcon
 *   color        'blue'|'green'|'red'|'yellow'|'purple'|'orange'
 *   trend        number   — e.g. 18 or -11 (percentage)
 *   trendLabel   string   — e.g. "vs last year"
 *   subtitle     node     — small note below value
 *   onClick      function — makes the card a button
 *   active       boolean  — highlights the card (e.g. the filter it applies is on)
 */
const KPICard = ({ title, value, icon: Icon, color = 'blue', trend, trendLabel = 'vs last year', subtitle, onClick, active = false }) => {
  const cls = COLOR_MAP[color] || COLOR_MAP.blue;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${cls.tint} to-white to-60% p-5 text-left shadow-card transition-all hover:shadow-card-hover ${
        active ? 'border-primary-300 ring-4 ring-primary-100' : 'border-slate-200/80'
      } ${onClick ? 'w-full cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${cls.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-slate-600">{title}</p>
        {Icon && (
          <span className={`icon-tile h-10 w-10 rounded-xl ${cls.icon}`}>
            <Icon size={18} />
          </span>
        )}
      </div>

      <p className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
        {trend !== undefined && trend !== null && (
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend}%
            <span className="font-normal text-slate-500">{trendLabel}</span>
          </span>
        )}
        {subtitle && <span className="leading-snug">{subtitle}</span>}
      </div>
    </Wrapper>
  );
};

export default KPICard;
