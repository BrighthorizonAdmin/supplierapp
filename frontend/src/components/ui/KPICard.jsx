import { TrendingUp, TrendingDown } from 'lucide-react';

const COLOR_MAP = {
  blue:   { icon: 'bg-blue-100 text-blue-600' },
  green:  { icon: 'bg-green-100 text-green-600' },
  red:    { icon: 'bg-red-100 text-red-600' },
  yellow: { icon: 'bg-amber-100 text-amber-600' },
  purple: { icon: 'bg-purple-100 text-purple-600' },
  orange: { icon: 'bg-orange-100 text-orange-600' },
};

/**
 * KPICard — Figma-aligned metric card
 * Props:
 *   title        string   — metric label
 *   value        string|number — main value
 *   icon         LucideIcon
 *   color        'blue'|'green'|'red'|'yellow'|'purple'|'orange'
 *   trend        number   — e.g. 18 or -11 (percentage)
 *   trendLabel   string   — e.g. "vs last year", "need review"
 *   subtitle     string   — small note below value
 */
const KPICard = ({ title, value, icon: Icon, color = 'blue', trend, trendLabel = 'vs last year', subtitle }) => {
  const cls = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      {/* Title + Icon row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide leading-tight">
          {title}
        </p>
        {Icon && (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cls.icon}`}>
            <Icon size={19} />
          </div>
        )}
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-slate-800 mb-2 leading-tight">{value ?? '—'}</p>

      {/* Trend + subtitle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {trend !== undefined ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              trend >= 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
          </span>
        ) : (
          <span />
        )}
        {subtitle && (
          <p className="text-xs text-slate-400 leading-tight">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default KPICard;
