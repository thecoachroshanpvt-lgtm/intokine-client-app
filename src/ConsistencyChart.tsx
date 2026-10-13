import React from 'react';

// One simple consistency card used by Diet (meals) and Routine (daily items): a big average, a bar for each day / month, and a tap for day-by-day details.
export interface ConsistencyBar {
  key: string;
  label: string;
  frac: number; // 0..1
  active: boolean; // false before the client started
  isToday: boolean;
}

export type ConsistencyRange = 'week' | 'month' | 'year';

export const consistencyColor = (f: number) => (f >= 0.8 ? '#34d399' : f >= 0.5 ? '#fbbf24' : '#ec2226');

export const ConsistencyChart: React.FC<{
  title: string;
  bars: ConsistencyBar[];
  range: ConsistencyRange;
  onRange: (r: ConsistencyRange) => void;
  avgPct: number;
  fullDays: number;
  periodLabel: string;
  onOpen: () => void;
}> = ({ title, bars, range, onRange, avgPct, fullDays, periodLabel, onOpen }) => {
  const dense = range === 'month';
  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] pt-1">{title}</div>
        <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 shrink-0">
          {([['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => onRange(k)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${range === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/50'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-header text-white leading-none">{avgPct}</span>
          <span className="text-sm text-white/50 font-semibold">% average</span>
        </div>
        <div className="text-right text-[11px] text-white/40 leading-snug">
          <div>{periodLabel}</div>
          <div><span className="text-white font-bold font-mono">{fullDays}</span> full {fullDays === 1 ? 'day' : 'days'}</div>
        </div>
      </div>

      <button type="button" onClick={onOpen} className="w-full text-left" aria-label="Open day by day details">
        <div className={`relative flex items-end justify-between ${dense ? 'gap-[2px]' : 'gap-2'}`}>
          {bars.map((d) => {
            const h = d.active ? Math.max(4, Math.round(d.frac * 100)) : 0;
            const c = consistencyColor(d.frac);
            return (
              <div key={d.key} className="flex-1 min-w-0 flex flex-col items-center">
                <div className="relative w-full h-20 rounded-md bg-white/[0.05] overflow-hidden">
                  {d.active && (
                    <div className="absolute bottom-0 inset-x-0 rounded-sm" style={{ height: `${h}%`, background: `linear-gradient(180deg, ${c}, ${c}99)` }} />
                  )}
                </div>
                {!dense && (
                  <span className={`mt-1.5 text-[9px] truncate max-w-full ${d.isToday ? 'text-white font-bold' : 'text-white/40'}`}>{d.label}</span>
                )}
              </div>
            );
          })}
        </div>
        {dense && <div className="flex justify-between text-[9px] text-white/40 mt-1.5"><span>30 days ago</span><span>Today</span></div>}

        <div className="flex items-center justify-between mt-3 text-[10px]">
          <span className="flex items-center gap-2.5 text-white/40">
            {([['#34d399', '80%+'], ['#fbbf24', '50%+'], ['#ec2226', 'Below']] as const).map(([c, l]) => (
              <span key={l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </span>
          <span className="font-semibold text-[#6ccbde]">Tap for details ›</span>
        </div>
      </button>
    </div>
  );
};
