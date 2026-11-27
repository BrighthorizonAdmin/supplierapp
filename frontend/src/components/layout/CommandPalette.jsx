import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { usePermission } from '../../routes/ProtectedRoute';
import { ALL_NAV_ITEMS, TONES } from './navConfig';

/** Ctrl/⌘ + K quick navigation across every page the user can open. */
const CommandPalette = ({ onClose }) => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_NAV_ITEMS
      .filter((item) => !item.perm || hasPermission(item.perm))
      .filter((item) => !q || `${item.label} ${item.section}`.toLowerCase().includes(q));
  }, [query, hasPermission]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query]);

  const go = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') go(results[active]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={17} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to a page…"
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">No matching pages</li>}
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <button
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                    index === active ? 'bg-primary-50 text-slate-900' : 'text-slate-600'
                  }`}
                >
                  <span className={`icon-tile h-8 w-8 ${TONES[item.tone] || TONES.slate}`}><Icon size={15} /></span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <span className="text-xs text-slate-400">{item.section}</span>
                  {index === active && <CornerDownLeft size={14} className="text-slate-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
