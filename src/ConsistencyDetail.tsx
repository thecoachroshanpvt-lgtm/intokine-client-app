import React, { useState } from 'react';
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

// One tracked item (water, sleep, energy, a habit, a symptom...) over the chosen period.
export interface TrackerPoint { key: string; label: string; v: number | null }
export interface TrackerSeries {
  id: string;
  label: string;
  category: string;
  type: 'number' | 'tick' | 'choice' | 'level';
  unit?: string;
  target?: number;
  options: string[];     // choice / level: lowest to highest
  goodHigh: boolean;     // true when a higher level is better (energy, mood); false for stress and symptoms
  views: Partial<Record<TGrain, TrackerPoint[]>>; // the points for each view
  grains: TGrain[];                                // the views this item can show (a weekly item has no daily view)
}
export type TGrain = 'day' | 'week' | 'month';
// What the graph components work with: one view of one tracker.
interface View extends Omit<TrackerSeries, 'views' | 'grains'> { points: TrackerPoint[]; agg: boolean; word: string; weekly: boolean }

const CAT_TITLE: Record<string, string> = { Lifestyle: 'Lifestyle', Habits: 'Habits', Symptoms: 'Symptoms', Custom: 'Other' };
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

const sparse = (n: number, i: number, dense: boolean) => (!dense ? true : i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0);

// Number (water, sleep, steps): a bar for each day, the dashed line is the target, bars that reached it turn green.
const NumberGraph: React.FC<{ t: View }> = ({ t }) => {
  const W = 300, H = 96, L = 4, R = 4, T = 8, B = 16;
  const iw = W - L - R, ih = H - T - B;
  const vals = t.points.map((p) => p.v ?? 0);
  const top = Math.max(t.target || 0, ...vals, 1) * 1.1;
  const n = t.points.length;
  const slot = iw / n;
  const bw = Math.min(16, slot * 0.62);
  const logged = t.points.filter((p) => p.v !== null);
  const reached = t.target ? logged.filter((p) => (p.v as number) >= t.target!).length : 0;
  const avg = logged.length ? logged.reduce((a, p) => a + (p.v as number), 0) / logged.length : 0;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {t.target ? <line x1={L} x2={W - R} y1={T + ih - (t.target / top) * ih} y2={T + ih - (t.target / top) * ih} stroke="#6ccbde" strokeWidth="1" strokeDasharray="4 3" /> : null}
        <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="rgba(255,255,255,0.1)" />
        {t.points.map((p, i) => {
          const h = p.v ? (p.v / top) * ih : 0;
          const hit = t.target ? (p.v ?? 0) >= t.target : false;
          return (
            <g key={p.key}>
              {p.v ? <rect x={L + i * slot + (slot - bw) / 2} y={T + ih - h} width={bw} height={h} rx="2.5" fill={hit ? '#34d399' : '#6ccbde'} opacity={hit ? 1 : 0.75} /> : null}
              {sparse(n, i, n > 8) && <text x={L + i * slot + slot / 2} y={H - 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">{p.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-white/45 mt-1">
        {t.target
          ? `Target ${fmtNum(t.target)} ${t.unit || ''} · reached on ${reached} of ${logged.length} ${t.word}`
          : `Average ${fmtNum(avg)} ${t.unit || ''}`}
        {t.target && logged.length > 0 ? ` · average ${fmtNum(avg)}` : ''}
      </div>
    </>
  );
};

// Habit: a circle for each day. Green tick = done, red cross = not done.
const TickGraph: React.FC<{ t: View }> = ({ t }) => {
  const known = t.points.filter((p) => p.v !== null);
  const doneN = t.agg ? 0 : known.filter((p) => p.v === 1).length;
  const avg = known.length ? Math.round((known.reduce((a, p) => a + (p.v as number), 0) / known.length) * 100) : 0;
  const big = t.points.length <= 8;
  return (
    <>
      <div className={`flex flex-wrap ${big ? 'justify-between' : 'gap-1'}`}>
        {t.points.map((p) => {
          const v = p.v;
          const size = big ? 'w-8 h-8 text-[13px]' : 'w-[18px] h-[18px] text-[9px]';
          const tone = v === null ? 'border border-white/10 text-transparent' : t.agg ? (v >= 0.8 ? 'bg-emerald-400/25 text-emerald-300' : v >= 0.5 ? 'bg-amber-400/20 text-amber-300' : 'bg-red-400/20 text-red-300') : v === 1 ? 'bg-emerald-400/25 text-emerald-300' : 'bg-red-400/20 text-red-300';
          return (
            <div key={p.key} className="flex flex-col items-center gap-1">
              <div className={`${size} rounded-full flex items-center justify-center font-bold ${tone}`}>{v === null ? '·' : t.agg ? (big ? Math.round(v * 100) : '') : v === 1 ? '✓' : '✕'}</div>
              {big && <span className="text-[8px] text-white/40">{p.label}</span>}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-white/45 mt-1.5">{t.agg ? `Done about ${avg}% of the time` : `Done ${doneN} of ${known.length} ${t.word}`}</div>
    </>
  );
};

// Level (energy, stress, mood, symptoms): the answer for each day on a scale from lowest to highest.
const LevelGraph: React.FC<{ t: View }> = ({ t }) => {
  const opts = t.options;
  const k = Math.max(1, opts.length - 1);
  const W = 300, rowH = 17, T = 8, B = 16, L = 54, R = 8;
  const H = T + B + k * rowH;
  const iw = W - L - R;
  const n = t.points.length;
  const x = (i: number) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => T + (1 - v / k) * (H - T - B);
  const pts = t.points.map((p, i) => ({ p, i })).filter((q) => q.p.v !== null);
  const path = pts.map((q, j) => `${j === 0 ? 'M' : 'L'}${x(q.i).toFixed(1)},${y(q.p.v as number).toFixed(1)}`).join(' ');
  const colorOf = (v: number) => { const r = v / k; const good = t.goodHigh ? r : 1 - r; return good >= 0.67 ? '#34d399' : good >= 0.34 ? '#fbbf24' : '#ec2226'; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {opts.map((o, i) => (
        <g key={o}>
          <line x1={L} x2={W - R} y1={y(i)} y2={y(i)} stroke="rgba(255,255,255,0.07)" />
          <text x={L - 6} y={y(i) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.45)">{o.length > 10 ? o.slice(0, 9) + '…' : o}</text>
        </g>
      ))}
      {path && pts.length > 1 && <path d={path} fill="none" stroke="rgba(108,203,222,0.55)" strokeWidth="1.4" strokeLinejoin="round" />}
      {pts.map((q) => <circle key={q.p.key} cx={x(q.i)} cy={y(q.p.v as number)} r={n > 12 ? 2.4 : 3.6} fill={colorOf(q.p.v as number)} stroke="#252525" strokeWidth="1" />)}
      {t.points.map((p, i) => sparse(n, i, n > 8) && <text key={p.key} x={x(i)} y={H - 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">{p.label}</text>)}
    </svg>
  );
};

const GRAIN_LABEL: Record<TGrain, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const GRAIN_WORD: Record<TGrain, string> = { day: 'days', week: 'weeks', month: 'months' };

// One tracker with its own Daily / Weekly / Monthly switch.
const TrackerCard: React.FC<{ t: TrackerSeries }> = ({ t }) => {
  const [g, setG] = useState<TGrain>(t.grains[0]);
  const grain = t.grains.includes(g) ? g : t.grains[0];
  const v: View = { ...t, points: t.views[grain] || [], agg: grain !== 'day', word: grain === 'day' ? (t.type === 'tick' ? 'days' : 'logged days') : GRAIN_WORD[grain], weekly: grain === 'week' };
  return (
    <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-sm font-semibold text-white truncate">{t.label}</span>
        <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 shrink-0">
          {t.grains.map((k) => (
            <button key={k} type="button" onClick={() => setG(k)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${grain === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/45'}`}>{GRAIN_LABEL[k]}</button>
          ))}
        </div>
      </div>
      {t.type === 'number' ? <NumberGraph t={v} /> : t.type === 'tick' ? <TickGraph t={v} /> : <LevelGraph t={v} />}
    </div>
  );
};

export const TrackerGraphs: React.FC<{ trackers: TrackerSeries[] }> = ({ trackers }) => {
  const cats = Object.keys(CAT_TITLE).filter((c) => trackers.some((t) => t.category === c));
  if (trackers.length === 0) return null;
  return (
    <div className="space-y-4">
      {cats.map((c) => (
        <div key={c} className="space-y-2">
          <span className="text-[11px] text-white/40 uppercase font-semibold block">{CAT_TITLE[c]}</span>
          {trackers.filter((t) => t.category === c).map((t) => <TrackerCard key={t.id} t={t} />)}
        </div>
      ))}
    </div>
  );
};

export const ConsistencyDetail: React.FC<{
  title: string;
  backLabel: string;
  range: ConsistencyRange;
  onRange: (r: ConsistencyRange) => void;
  rangeTitle: string;
  bars: DetailBar[];
  items: { id: string; label: string }[];
  trackers?: TrackerSeries[];
  avgPct: number;
  totalFull: number;
  totalLogged: number;
  totalDays: number;
  onBack: () => void;
}> = ({ title, backLabel, range, onRange, rangeTitle, bars, items, trackers, avgPct, totalFull, totalLogged, totalDays, onBack }) => {
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

      {trackers && trackers.length > 0 && <TrackerGraphs trackers={trackers} />}

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
