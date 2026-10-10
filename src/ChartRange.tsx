import React, { useEffect, useState } from 'react';

export type ChartRangeKey = '6' | '12' | 'all';

/** Above this many updates, "All" turns into a plain trend line (no labels) because dots and bars would be too tiny to read or tap. */
const TREND_FROM = 30;

/**
 * Shared by every progress chart. Shows the latest 6 updates by default so numbers and dates never
 * pile up. Chips switch to Last 12 / All, and arrows page back through older updates.
 * With a very long history, "All" becomes a simple trend line.
 */
export function useChartRange<T>(data: T[]) {
  const [range, setRange] = useState<ChartRangeKey>('6');
  const [offset, setOffset] = useState(0); // how many of the newest updates are skipped (paging back)
  const [selected, setSelected] = useState<number | null>(null);
  const total = data.length;

  const windowSize = range === '6' ? 6 : 12;
  const isAll = range === 'all';
  const trend = isAll && total > TREND_FROM;

  // Keep the offset valid even if data shrinks (for example an update was deleted).
  const maxOffset = Math.max(0, total - windowSize);
  const safeOffset = isAll ? 0 : Math.min(offset, maxOffset);
  const end = total - safeOffset;
  const start = isAll ? 0 : Math.max(0, end - windowSize);
  const visible = data.slice(start, end);

  // A new update, a changed range or a page change clears a tapped dot and goes back to the newest page.
  useEffect(() => {
    setSelected(null);
  }, [range, safeOffset, total]);
  useEffect(() => {
    setOffset(0);
  }, [total]);

  const pickRange = (r: ChartRangeKey) => {
    setRange(r);
    setOffset(0);
  };

  const options: { key: ChartRangeKey; label: string }[] = [{ key: '6', label: 'Last 6' }];
  if (total > 6) options.push({ key: '12', label: 'Last 12' });
  if (total > 12) options.push({ key: 'all', label: 'All' });

  const canGoOlder = !isAll && start > 0;
  const canGoNewer = !isAll && safeOffset > 0;
  const showArrows = !isAll && total > windowSize;

  const arrowCls = (on: boolean) =>
    `w-6 h-5 flex items-center justify-center rounded-full border text-[10px] leading-none ${
      on ? 'text-white/70 border-white/20 active:bg-white/10' : 'text-white/15 border-white/5'
    }`;

  const chips =
    total > 6 ? (
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-h-[20px]">
          {showArrows && (
            <>
              <button type="button" disabled={!canGoOlder} onClick={() => setOffset(safeOffset + windowSize)} className={arrowCls(canGoOlder)} aria-label="Older updates">
                ◀
              </button>
              <span className="text-[9px] text-white/40 font-mono">
                {start + 1}–{end} of {total}
              </span>
              <button type="button" disabled={!canGoNewer} onClick={() => setOffset(Math.max(0, safeOffset - windowSize))} className={arrowCls(canGoNewer)} aria-label="Newer updates">
                ▶
              </button>
            </>
          )}
          {isAll && <span className="text-[9px] text-white/40 font-mono">{trend ? `Trend of ${total} updates` : `All ${total} updates`}</span>}
        </div>
        <div className="flex gap-1">
          {options.map((o) => {
            const active = range === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => pickRange(o.key)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition ${
                  active ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/50' : 'bg-transparent text-white/40 border-white/10'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return { visible, chips, selected, setSelected, trend };
}

/**
 * Plain trend line(s) for very long histories: no value labels, no dots, only the first and last date
 * and the latest value. Each series is scaled to itself so different units (km and minutes) both stay visible.
 */
export const TrendLine: React.FC<{
  dates: string[];
  series: { values: (number | undefined)[]; color: string; unit?: string }[];
}> = ({ dates, series }) => {
  const W = 300;
  const H = 120;
  const padX = 12;
  const top = 22;
  const bottom = 24;
  const n = dates.length;
  const x = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }} preserveAspectRatio="none">
      {series.map((s, si) => {
        const nums = s.values.filter((v): v is number => v !== undefined);
        if (nums.length === 0) return null;
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;
        const y = (v: number) => top + (H - top - bottom) - ((v - min) / range) * (H - top - bottom);
        const pts = s.values.map((v, i) => (v === undefined ? null : { x: x(i), y: y(v), v })).filter(Boolean) as { x: number; y: number; v: number }[];
        const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const last = pts[pts.length - 1];
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last.x} cy={last.y} r="3" fill={s.color} />
            <text x={Math.min(last.x, W - 20)} y={Math.max(10, last.y - 7 - si * 0)} fontSize="8" fill="white" fillOpacity="0.9" textAnchor="middle" fontFamily="monospace">
              {last.v}{s.unit || ''}
            </text>
          </g>
        );
      })}
      {n > 0 && (
        <>
          <text x={padX} y={H - 6} fontSize="7" fill="white" fillOpacity="0.4" textAnchor="start">{dates[0].slice(5)}</text>
          <text x={W - padX} y={H - 6} fontSize="7" fill="white" fillOpacity="0.4" textAnchor="end">{dates[n - 1].slice(5)}</text>
        </>
      )}
    </svg>
  );
};
