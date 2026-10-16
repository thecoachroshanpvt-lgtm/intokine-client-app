import React from 'react';
import { consistencyColor } from './ConsistencyChart';
import type { ConsistencyRange } from './ConsistencyChart';

// Full page opened from the consistency card: the average against the target for every day, then the day-by-day log report.
export interface DetailBar {
  key: string;
  label: string; // short label for the axis
  full: string;  // long label for the report
  frac: number;  // 0..1
  active: boolean;
  isToday: boolean;
  doneIds: string[]; // items answered that day (used for the week report)
  fullDays: number;
  logged: number;
  n: number;
}

export const ConsistencyDetail: React.FC<{
  title: string;
  backLabel: string;
  range: ConsistencyRange;
  onRange: (r: ConsistencyRange) => void;
  rangeTitle: string;
  bars: DetailBar[];
  items: { id: string; label: string }[];
  avgPct: number;
  totalFull: number;
  totalLogged: number;
  totalDays: number;
  onBack: () => void;
}> = ({ title, backLabel, range, onRange, rangeTitle, bars, items, avgPct, totalFull, totalLogged, totalDays, onBack }) => {
  // Line chart of every day against the target (everything answered, 100%).
  const W = 300, H = 140, L = 26, R = 8, T = 14, B = 20;
  const iw = W - L - R, ih = H - T - B;
  const n = bars.length;
  const x = (i: number) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (f: number) => T + (1 - f) * ih;
  const pts = bars.map((b, i) => ({ b, i, px: x(i), py: y(b.frac) })).filter((p) => p.b.active);
  const line = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].px.toFixed(1)},${y(0)} L${pts[0].px.toFixed(1)},${y(0)} Z` : '';
  const showLabel = (i: number) => (range === 'week' ? true : range === 'month' ? i === 0 || i === Math.floor((n - 1) / 2) || i === n - 1 : i % 2 === 0 || i === n - 1);
  const dot = range === 'month' ? 2 : 3.2;

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[12px] font-semibold text-[#6ccbde] hover:text-white flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {backLabel}
        </button>
        <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5">
          {([['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => onRange(k)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${range === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/50'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl px-4 pt-4 pb-3" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">{title}</div>
        <div className="flex items-end justify-between mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-header text-white leading-none">{avgPct}</span>
            <span className="text-sm text-white/50 font-semibold">% average</span>
          </div>
          <span className="text-[11px] text-white/40">{rangeTitle}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([['Average', `${avgPct}%`], ['Full days', String(totalFull)], ['Days logged', `${totalLogged}/${totalDays}`]] as const).map(([l, v]) => (
          <div key={l} className="bg-[#252525] border border-white/[0.06] rounded-2xl py-3 text-center">
            <div className="text-base font-semibold text-white font-mono leading-none">{v}</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-white/40 mt-1.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-white/40 uppercase font-semibold">Every day against your target</span>
          <span className="flex items-center gap-1 text-[10px] text-[#6ccbde]"><span className="inline-block w-3 border-t border-dashed border-[#6ccbde]" />Target 100%</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Consistency for every day against the target">
          <defs>
            <linearGradient id="cdArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ccbde" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#6ccbde" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x={L - 5} y={y(g) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.35)">{Math.round(g * 100)}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(1)} y2={y(1)} stroke="#6ccbde" strokeWidth="1" strokeDasharray="4 3" />
          <text x={L - 5} y={y(1) + 3} textAnchor="end" fontSize="8" fill="#6ccbde">100</text>
          {area && <path d={area} fill="url(#cdArea)" />}
          {line && <path d={line} fill="none" stroke="#6ccbde" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map((p) => (
            <circle key={p.b.key} cx={p.px} cy={p.py} r={dot} fill={consistencyColor(p.b.frac)} stroke="#252525" strokeWidth="1" />
          ))}
          {bars.map((b, i) => showLabel(i) && (
            <text key={b.key} x={x(i)} y={H - 5} textAnchor="middle" fontSize="8" fill={b.isToday ? '#ffffff' : 'rgba(255,255,255,0.4)'}>{range === 'month' && i === n - 1 ? 'Today' : b.label}</text>
          ))}
        </svg>
        <div className="flex items-center justify-center gap-3 text-[10px] text-white/40 mt-1">
          {([['#34d399', '80%+'], ['#fbbf24', '50%+'], ['#ec2226', 'Below']] as const).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </div>
        <p className="text-[10px] text-white/30 text-center mt-1.5">The closer a dot is to the dashed line, the closer you were to doing everything.</p>
      </div>

      <div className="space-y-2.5">
        <span className="text-[11px] text-white/40 uppercase font-semibold block">Log report</span>
        <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4 space-y-3">
          {[...bars].reverse().map((d) => (
            <div key={d.key}>
              <div className="flex items-center gap-3">
                <div className={`w-24 shrink-0 text-xs ${d.isToday ? 'text-white font-bold' : 'text-white/70'}`}>{d.full}{d.isToday && range !== 'year' ? ' (today)' : ''}</div>
                <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.active ? Math.round(d.frac * 100) : 0}%`, background: consistencyColor(d.frac) }} />
                </div>
                <div className="w-12 shrink-0 text-right text-xs font-mono font-bold" style={{ color: d.active ? consistencyColor(d.frac) : 'rgba(255,255,255,0.3)' }}>{d.active ? `${Math.round(d.frac * 100)}%` : '—'}</div>
              </div>
              {range === 'year' ? (
                <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">{d.active ? `${d.fullDays} full days · ${d.logged} of ${d.n} days logged` : 'No data yet'}</div>
              ) : (
                <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">
                  {!d.active ? 'Before you started' : `${d.doneIds.length} of ${items.length} items`}
                  {range === 'week' && d.active && (
                    <span className="flex flex-wrap gap-1 mt-1">
                      {items.map((it) => {
                        const ok = d.doneIds.includes(it.id);
                        return <span key={it.id} className={`px-1.5 py-0.5 rounded-full text-[9px] ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.05] text-white/30'}`}>{ok ? '✓ ' : ''}{it.label}</span>;
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
