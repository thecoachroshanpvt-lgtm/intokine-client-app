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

// ---- Tracker graphs: one card for each tracked item (water, sleep, steps, energy, habits, symptoms...) ----
export type TGrain = 'day' | 'week' | 'month';
export interface TrackerSeries {
  id: string;
  label: string;
  category: string;
  type: 'number' | 'tick' | 'choice' | 'level';
  unit?: string;
  target?: number;
  options: string[];   // choice / level: lowest to highest
  goodHigh: boolean;   // true when a higher level is better (energy, mood); false for stress and symptoms
  isDaily: boolean;    // a daily item has Daily / Weekly / Monthly views, a weekly item (symptoms) has Weekly / Monthly
  raw: (period: string) => number | null; // the logged answer for a day (daily item) or a week starting Monday (weekly item): a number, a tick as 1 or 0, a level as its position
}

interface Pt { key: string; label: string; long: string; v: number | null; days?: Pt[] }

const CAT_TITLE: Record<string, string> = { Lifestyle: 'Lifestyle', Habits: 'Habits', Symptoms: 'Symptoms', Custom: 'Other' };
const pad2 = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateOf = (k: string) => new Date(k + 'T00:00:00');
const addDays = (k: string, n: number) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const mondayOf = (k: string) => { const d = dateOf(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); };
const longDay = (k: string) => dateOf(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const mean = (vals: (number | null)[]) => { const x = vals.filter((v): v is number => v !== null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
const num = (n: number) => String(Math.round(n * 100) / 100);
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n * 10) / 10));
const sparse = (n: number, i: number, dense: boolean) => (!dense ? true : i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0);
const GRAIN_LABEL: Record<TGrain, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const GRAIN_WORD: Record<TGrain, string> = { day: 'days', week: 'weeks', month: 'months' };

interface GraphProps { t: TrackerSeries; pts: Pt[]; sel: number; onPick: (i: number) => void; agg: boolean; word: string }

// Number (water, sleep, steps): a bar for each period with its value on top. The dashed line is the target; bars that reached it are green.
const NumberGraph: React.FC<GraphProps> = ({ t, pts, sel, onPick, word }) => {
  const W = 300, H = 112, L = 4, R = 4, T = 16, B = 16;
  const iw = W - L - R, ih = H - T - B;
  const top = Math.max(t.target || 0, ...pts.map((p) => p.v ?? 0), 1) * 1.08;
  const n = pts.length;
  const slot = iw / n;
  const bw = Math.min(18, slot * 0.66);
  const logged = pts.filter((p) => p.v !== null);
  const reached = t.target ? logged.filter((p) => (p.v as number) >= t.target!).length : 0;
  const avg = logged.length ? logged.reduce((a, p) => a + (p.v as number), 0) / logged.length : 0;
  const ty = t.target ? T + ih - (t.target / top) * ih : 0;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {t.target ? <line x1={L} x2={W - R} y1={ty} y2={ty} stroke="#6ccbde" strokeWidth="1" strokeDasharray="4 3" /> : null}
        <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="rgba(255,255,255,0.1)" />
        {pts.map((p, i) => {
          const h = p.v ? (p.v / top) * ih : 0;
          const hit = t.target ? (p.v ?? 0) >= t.target : false;
          const cx = L + i * slot + slot / 2;
          return (
            <g key={p.key} onClick={() => onPick(i)} style={{ cursor: 'pointer' }}>
              <rect x={L + i * slot} y={0} width={slot} height={H} fill={i === sel ? 'rgba(255,255,255,0.06)' : 'transparent'} rx="3" />
              {p.v ? <rect x={cx - bw / 2} y={T + ih - h} width={bw} height={h} rx="2.5" fill={hit ? '#34d399' : '#6ccbde'} opacity={hit ? 1 : 0.75} /> : null}
              {p.v && n <= 14 ? <text x={cx} y={T + ih - h - 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="rgba(255,255,255,0.85)">{compact(p.v)}</text> : null}
              {sparse(n, i, n > 8) && <text x={cx} y={H - 3} textAnchor="middle" fontSize="8" fill={i === sel ? '#ffffff' : 'rgba(255,255,255,0.4)'}>{p.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-white/45 mt-1">
        {t.target ? `Target ${num(t.target)} ${t.unit || ''} · reached on ${reached} of ${logged.length} ${word}` : `Average ${num(avg)} ${t.unit || ''}`}
        {t.target && logged.length > 0 ? ` · average ${num(avg)}` : ''}
      </div>
    </>
  );
};

// Habit: a circle for each period. Green tick = done, red cross = not done. Weekly and monthly circles show the share done.
const TickGraph: React.FC<GraphProps> = ({ t, pts, sel, onPick, agg, word }) => {
  const known = pts.filter((p) => p.v !== null);
  const doneN = known.filter((p) => p.v === 1).length;
  const avg = known.length ? Math.round((known.reduce((a, p) => a + (p.v as number), 0) / known.length) * 100) : 0;
  const big = pts.length <= 12;
  return (
    <>
      <div className={`flex flex-wrap ${pts.length <= 8 ? 'justify-between' : 'gap-1.5'}`}>
        {pts.map((p, i) => {
          const v = p.v;
          const size = big ? 'w-8 h-8 text-[12px]' : 'w-[18px] h-[18px] text-[9px]';
          const tone = v === null ? 'border border-white/10 text-white/20' : agg ? (v >= 0.8 ? 'bg-emerald-400/25 text-emerald-300' : v >= 0.5 ? 'bg-amber-400/20 text-amber-300' : 'bg-red-400/20 text-red-300') : v === 1 ? 'bg-emerald-400/25 text-emerald-300' : 'bg-red-400/20 text-red-300';
          return (
            <button key={p.key} type="button" onClick={() => onPick(i)} className="flex flex-col items-center gap-1">
              <div className={`${size} rounded-full flex items-center justify-center font-bold ${tone} ${i === sel ? 'ring-1 ring-white/70' : ''}`}>{v === null ? '·' : agg ? (big ? Math.round(v * 100) : '') : v === 1 ? '✓' : '✕'}</div>
              {big && <span className={`text-[8px] ${i === sel ? 'text-white' : 'text-white/40'}`}>{p.label}</span>}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-white/45 mt-1.5">{agg ? `Done about ${avg}% of the time` : `Done ${doneN} of ${known.length} ${word}`}</div>
    </>
  );
};

// Level (energy, stress, mood, symptoms): the answer for each period on a scale from lowest to highest.
const LevelGraph: React.FC<GraphProps> = ({ t, pts, sel, onPick }) => {
  const opts = t.options;
  const k = Math.max(1, opts.length - 1);
  const W = 300, rowH = 17, T = 8, B = 16, L = 54, R = 8;
  const H = T + B + k * rowH;
  const iw = W - L - R;
  const n = pts.length;
  const x = (i: number) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => T + (1 - v / k) * (H - T - B);
  const have = pts.map((p, i) => ({ p, i })).filter((q) => q.p.v !== null);
  const path = have.map((q, j) => `${j === 0 ? 'M' : 'L'}${x(q.i).toFixed(1)},${y(q.p.v as number).toFixed(1)}`).join(' ');
  const colorOf = (v: number) => { const r = v / k; const good = t.goodHigh ? r : 1 - r; return good >= 0.67 ? '#34d399' : good >= 0.34 ? '#fbbf24' : '#ec2226'; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {opts.map((o, i) => (
        <g key={o}>
          <line x1={L} x2={W - R} y1={y(i)} y2={y(i)} stroke="rgba(255,255,255,0.07)" />
          <text x={L - 6} y={y(i) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.45)">{o.length > 10 ? o.slice(0, 9) + '…' : o}</text>
        </g>
      ))}
      {path && have.length > 1 && <path d={path} fill="none" stroke="rgba(108,203,222,0.55)" strokeWidth="1.4" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <g key={p.key} onClick={() => onPick(i)} style={{ cursor: 'pointer' }}>
          <rect x={x(i) - iw / n / 2} y={0} width={iw / n} height={H} fill={i === sel ? 'rgba(255,255,255,0.06)' : 'transparent'} rx="3" />
          {p.v !== null && <circle cx={x(i)} cy={y(p.v)} r={n > 12 ? 2.6 : 3.8} fill={colorOf(p.v)} stroke="#252525" strokeWidth="1" />}
          {sparse(n, i, n > 8) && <text x={x(i)} y={H - 3} textAnchor="middle" fontSize="8" fill={i === sel ? '#ffffff' : 'rgba(255,255,255,0.4)'}>{p.label}</text>}
        </g>
      ))}
    </svg>
  );
};

// What one value looks like in words.
const valueText = (t: TrackerSeries, v: number | null, agg: boolean) => {
  if (v === null) return '—';
  if (t.type === 'number') return `${compact(v)} ${t.unit || ''}`.trim();
  if (t.type === 'tick') return agg ? `${Math.round(v * 100)}% done` : v === 1 ? 'Done' : 'Not done';
  return t.options[Math.min(t.options.length - 1, Math.max(0, Math.round(v)))] || '—';
};

// One tracker with its own Daily / Weekly / Monthly switch, arrows to look further back, and a day-by-day list for the week or month you tap.
const TrackerCard: React.FC<{ t: TrackerSeries; today: string; firstDay: string; dailySpan: number }> = ({ t, today, firstDay, dailySpan }) => {
  const grains: TGrain[] = t.isDaily ? ['day', 'week', 'month'] : ['week', 'month'];
  const [g, setG] = useState<TGrain>(grains[0]);
  const [off, setOff] = useState(0); // how many windows back from now
  const [pick, setPick] = useState<number | null>(null);
  const grain = grains.includes(g) ? g : grains[0];

  const dayVal = (k: string): number | null => {
    if (k > today) return null;
    const r = t.raw(k);
    if (t.type === 'tick') return k < firstDay || (k === today && r !== 1) ? null : r === 1 ? 1 : 0;
    return r;
  };
  const weekVal = (m: string): number | null => {
    if (m > today) return null;
    const r = t.raw(m);
    if (t.type === 'tick') return addDays(m, 6) < firstDay || (m === mondayOf(today) && r !== 1) ? null : r === 1 ? 1 : 0;
    return r;
  };
  const dayPt = (k: string): Pt => ({ key: k, label: String(dateOf(k).getDate()), long: longDay(k), v: dayVal(k) });

  let pts: Pt[] = [];
  let rangeText = '';
  if (grain === 'day') {
    const n = dailySpan;
    const end = addDays(today, -off * n);
    pts = Array.from({ length: n }, (_, i) => {
      const k = addDays(end, -(n - 1 - i));
      return { ...dayPt(k), label: n === 7 ? dateOf(k).toLocaleDateString(undefined, { weekday: 'narrow' }) : String(dateOf(k).getDate()) };
    });
    rangeText = `${longDay(pts[0].key)} to ${longDay(pts[n - 1].key)}`;
  } else if (grain === 'week') {
    const n = 8;
    const endMon = addDays(mondayOf(today), -off * n * 7);
    pts = Array.from({ length: n }, (_, i) => {
      const mon = addDays(endMon, -(n - 1 - i) * 7);
      const wk: Pt = { key: mon, label: `${dateOf(mon).getDate()}/${dateOf(mon).getMonth() + 1}`, long: `Week of ${longDay(mon)}`, v: null };
      if (t.isDaily) {
        wk.days = Array.from({ length: 7 }, (_, j) => dayPt(addDays(mon, j)));
        wk.v = mean(wk.days.map((d) => d.v));
      } else wk.v = weekVal(mon);
      return wk;
    });
    rangeText = `${longDay(pts[0].key)} to ${longDay(addDays(pts[n - 1].key, 6))}`;
  } else {
    const n = t.isDaily ? 12 : 6;
    const now = dateOf(today);
    pts = Array.from({ length: n }, (_, i) => {
      const first = new Date(now.getFullYear(), now.getMonth() - off * n - (n - 1 - i), 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      const days: Pt[] = [];
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
        const k = keyOf(d);
        if (t.isDaily) days.push(dayPt(k));
        else if (d.getDay() === 1) days.push({ key: k, label: String(d.getDate()), long: `Week of ${longDay(k)}`, v: weekVal(k) });
      }
      return { key: keyOf(first), label: first.toLocaleDateString(undefined, { month: n > 6 ? 'narrow' : 'short' }), long: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), v: mean(days.map((d) => d.v)), days };
    });
    rangeText = `${pts[0].long} to ${pts[n - 1].long}`;
  }

  const sel = pick !== null && pick < pts.length ? pick : (() => { for (let i = pts.length - 1; i >= 0; i--) if (pts[i].v !== null) return i; return pts.length - 1; })();
  const chosen = pts[sel];
  const agg = grain !== 'day' && !(grain === 'week' && !t.isDaily);
  const word = grain === 'day' ? (t.type === 'tick' ? 'days' : 'logged days') : GRAIN_WORD[grain];
  const canBack = pts[0].key > firstDay;
  const props: GraphProps = { t, pts, sel, onPick: setPick, agg, word };
  const listTop = Math.max(t.target || 0, ...(chosen.days || []).map((d) => d.v ?? 0), 1);

  return (
    <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-white truncate">{t.label}</span>
        <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 shrink-0">
          {grains.map((k) => (
            <button key={k} type="button" onClick={() => { setG(k); setOff(0); setPick(null); }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${grain === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/45'}`}>{GRAIN_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button type="button" disabled={!canBack} onClick={() => { setOff(off + 1); setPick(null); }} className="w-7 h-7 rounded-lg border border-white/[0.1] text-white/70 text-sm disabled:opacity-25" aria-label="Earlier">‹</button>
        <span className="text-[10px] text-white/50 text-center px-2">{rangeText}</span>
        <button type="button" disabled={off === 0} onClick={() => { setOff(off - 1); setPick(null); }} className="w-7 h-7 rounded-lg border border-white/[0.1] text-white/70 text-sm disabled:opacity-25" aria-label="Later">›</button>
      </div>

      {t.type === 'number' ? <NumberGraph {...props} /> : t.type === 'tick' ? <TickGraph {...props} /> : <LevelGraph {...props} />}

      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-white">{chosen.long}</span>
          <span className="text-[11px] font-mono font-bold text-[#6ccbde]">{valueText(t, chosen.v, agg)}{agg && t.type === 'number' ? ' avg' : ''}</span>
        </div>
        {chosen.days && chosen.days.length > 0 ? (
          <div className="mt-2 space-y-1">
            <span className="text-[9px] uppercase font-bold text-white/35 block">{t.isDaily ? 'Each day' : 'Each week'}</span>
            {chosen.days.map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 shrink-0 text-white/60">{d.long.replace('Week of ', '')}</span>
                {t.type === 'number' ? (
                  <span className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    {d.v ? <span className="block h-full rounded-full" style={{ width: `${Math.min(100, ((d.v as number) / listTop) * 100)}%`, background: t.target && (d.v as number) >= t.target ? '#34d399' : '#6ccbde' }} /> : null}
                  </span>
                ) : <span className="flex-1" />}
                <span className={`shrink-0 font-mono font-bold ${d.v === null ? 'text-white/25' : t.type === 'tick' ? (d.v === 1 ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>{valueText(t, d.v, false)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const TrackerGraphs: React.FC<{ trackers: TrackerSeries[]; today: string; firstDay: string; dailySpan: number }> = ({ trackers, today, firstDay, dailySpan }) => {
  const cats = Object.keys(CAT_TITLE).filter((c) => trackers.some((t) => t.category === c));
  if (trackers.length === 0) return null;
  return (
    <div className="space-y-4">
      {cats.map((c) => (
        <div key={c} className="space-y-2">
          <span className="text-[11px] text-white/40 uppercase font-semibold block">{CAT_TITLE[c]}</span>
          {trackers.filter((t) => t.category === c).map((t) => <TrackerCard key={t.id} t={t} today={today} firstDay={firstDay} dailySpan={dailySpan} />)}
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
  today?: string;
  firstDay?: string;
  dailySpan?: number;
  avgPct: number;
  totalFull: number;
  totalLogged: number;
  totalDays: number;
  onBack: () => void;
}> = ({ title, backLabel, range, onRange, rangeTitle, bars, items, trackers, today, firstDay, dailySpan, avgPct, totalFull, totalLogged, totalDays, onBack }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const allRows = [...bars].reverse();
  const rows = showAll ? allRows : allRows.slice(0, 7);
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

      {trackers && trackers.length > 0 && today && firstDay && <TrackerGraphs trackers={trackers} today={today} firstDay={firstDay} dailySpan={dailySpan || 7} />}

      <div className="space-y-2">
        <span className="text-[11px] text-white/40 uppercase font-semibold block">Log report</span>
        <div className="bg-[#252525] border border-white/[0.06] rounded-2xl overflow-hidden">
          {rows.map((d, idx) => {
            const pct = Math.round(d.frac * 100);
            const col = d.active ? consistencyColor(d.frac) : 'rgba(255,255,255,0.2)';
            const canOpen = range !== 'year' && d.active;
            const isOpen = open === d.key && canOpen;
            return (
              <div key={d.key} className={idx > 0 ? 'border-t border-white/[0.06]' : ''}>
                <button type="button" disabled={!canOpen} onClick={() => setOpen(isOpen ? null : d.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] ${d.isToday ? 'text-white font-bold' : 'text-white/85'}`}>{d.full}{d.isToday && range !== 'year' ? ' · Today' : ''}</span>
                    <span className="block text-[10px] text-white/40 mt-0.5">
                      {!d.active ? 'Before you started' : range === 'year' ? `${d.fullDays} full days · ${d.logged} of ${d.n} logged` : `${d.doneIds.length} of ${items.length} done`}
                    </span>
                  </span>
                  <span className="text-[13px] font-mono font-bold shrink-0" style={{ color: col }}>{d.active ? `${pct}%` : '—'}</span>
                  {canOpen && <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-white/30 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 -mt-1 space-y-1.5">
                    {items.map((it) => {
                      const ok = d.doneIds.includes(it.id);
                      return (
                        <div key={it.id} className="flex items-center gap-2 text-[12px]">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${ok ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.06] text-white/30'}`}>{ok ? '✓' : '·'}</span>
                          <span className={ok ? 'text-white/80' : 'text-white/40'}>{it.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {allRows.length > 7 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="w-full py-3 border-t border-white/[0.06] text-[11px] font-semibold text-[#6ccbde]">
              {showAll ? 'Show fewer' : `Show all ${allRows.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
