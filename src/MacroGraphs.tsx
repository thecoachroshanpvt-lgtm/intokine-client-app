import React, { useState } from 'react';

// Calories, protein, carbs and fats against the daily target: Daily / Weekly / Monthly, arrows to look back, the number on every bar.
// Used by the Client App (Diet tab) and by Nutrition OS. Days that still wait for the nutritionist to add macros are marked in amber.
export interface MacroSeries {
  id: string;
  label: string;
  unit: string;
  target: number;
  color: string;
}

type Grain = 'day' | 'week' | 'month';
interface Pt { key: string; label: string; long: string; v: number | null; wait: boolean; days?: Pt[] }

const pad2 = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateOf = (k: string) => new Date(k + 'T00:00:00');
const addDays = (k: string, n: number) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const mondayOf = (k: string) => { const d = dateOf(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); };
const longDay = (k: string) => dateOf(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const mean = (vals: (number | null)[]) => { const x = vals.filter((v): v is number => v !== null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
const round = (n: number) => Math.round(n * 10) / 10;
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));
const GRAIN_LABEL: Record<Grain, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

const Card: React.FC<{
  s: MacroSeries;
  value: (id: string, day: string) => number | null;
  pending: (day: string) => boolean;
  today: string;
  firstDay: string;
  cardClass: string;
}> = ({ s, value, pending, today, firstDay, cardClass }) => {
  const [g, setG] = useState<Grain>('day');
  const [off, setOff] = useState(0);
  const [pick, setPick] = useState<number | null>(null);

  const dayPt = (k: string): Pt => ({
    key: k,
    label: String(dateOf(k).getDate()),
    long: longDay(k),
    v: k > today || k < firstDay ? null : value(s.id, k),
    wait: k <= today && k >= firstDay && pending(k),
  });

  let pts: Pt[] = [];
  let rangeText = '';
  if (g === 'day') {
    const n = 7;
    const end = addDays(today, -off * n);
    pts = Array.from({ length: n }, (_, i) => {
      const k = addDays(end, -(n - 1 - i));
      return { ...dayPt(k), label: dateOf(k).toLocaleDateString(undefined, { weekday: 'narrow' }) };
    });
    rangeText = `${longDay(pts[0].key)} to ${longDay(pts[n - 1].key)}`;
  } else if (g === 'week') {
    const n = 8;
    const endMon = addDays(mondayOf(today), -off * n * 7);
    pts = Array.from({ length: n }, (_, i) => {
      const mon = addDays(endMon, -(n - 1 - i) * 7);
      const days = Array.from({ length: 7 }, (_, j) => dayPt(addDays(mon, j)));
      return { key: mon, label: `${dateOf(mon).getDate()}/${dateOf(mon).getMonth() + 1}`, long: `Week of ${longDay(mon)}`, v: mean(days.map((d) => d.v)), wait: days.some((d) => d.wait), days };
    });
    rangeText = `${longDay(pts[0].key)} to ${longDay(addDays(pts[n - 1].key, 6))}`;
  } else {
    const n = 12;
    const now = dateOf(today);
    pts = Array.from({ length: n }, (_, i) => {
      const first = new Date(now.getFullYear(), now.getMonth() - off * n - (n - 1 - i), 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      const days: Pt[] = [];
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(dayPt(keyOf(d)));
      return { key: keyOf(first), label: first.toLocaleDateString(undefined, { month: 'narrow' }), long: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), v: mean(days.map((d) => d.v)), wait: days.some((d) => d.wait), days };
    });
    rangeText = `${pts[0].long} to ${pts[n - 1].long}`;
  }

  const sel = pick !== null && pick < pts.length ? pick : (() => { for (let i = pts.length - 1; i >= 0; i--) if (pts[i].v !== null) return i; return pts.length - 1; })();
  const chosen = pts[sel];
  const canBack = pts[0].key > (g === 'day' ? firstDay : g === 'week' ? mondayOf(firstDay) : keyOf(new Date(dateOf(firstDay).getFullYear(), dateOf(firstDay).getMonth(), 1)));
  const agg = g !== 'day';

  const W = 300, H = 118, L = 4, R = 4, T = 16, B = 16;
  const iw = W - L - R, ih = H - T - B;
  const top = Math.max(s.target, ...pts.map((p) => p.v ?? 0), 1) * 1.1;
  const n = pts.length;
  const slot = iw / n;
  const bw = Math.min(20, slot * 0.66);
  const ty = T + ih - (s.target / top) * ih;
  const logged = pts.filter((p) => p.v !== null);
  const avg = logged.length ? mean(logged.map((p) => p.v)) : null;
  const near = (v: number) => v >= s.target * 0.9 && v <= s.target * 1.1; // within 10% of the target
  const val = (v: number | null) => (v === null ? '—' : `${compact(v)}${s.unit ? ' ' + s.unit : ''}`);
  const listTop = Math.max(s.target, ...(chosen.days || []).map((d) => d.v ?? 0), 1);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-white truncate">{s.label}</span>
        <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 shrink-0">
          {(['day', 'week', 'month'] as Grain[]).map((k) => (
            <button key={k} type="button" onClick={() => { setG(k); setOff(0); setPick(null); }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${g === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/45'}`}>{GRAIN_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button type="button" disabled={!canBack} onClick={() => { setOff(off + 1); setPick(null); }} className="w-7 h-7 rounded-lg border border-white/[0.1] text-white/70 text-sm disabled:opacity-25" aria-label="Earlier">‹</button>
        <span className="text-[10px] text-white/50 text-center px-2">{rangeText}</span>
        <button type="button" disabled={off === 0} onClick={() => { setOff(off - 1); setPick(null); }} className="w-7 h-7 rounded-lg border border-white/[0.1] text-white/70 text-sm disabled:opacity-25" aria-label="Later">›</button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={L} x2={W - R} y1={ty} y2={ty} stroke="#6ccbde" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - R} y={ty - 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#6ccbde">Target {compact(s.target)}{s.unit ? ' ' + s.unit : ''}</text>
        <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="rgba(255,255,255,0.1)" />
        {pts.map((p, i) => {
          const h = p.v ? (p.v / top) * ih : 0;
          const cx = L + i * slot + slot / 2;
          return (
            <g key={p.key} onClick={() => setPick(i)} style={{ cursor: 'pointer' }}>
              <rect x={L + i * slot} y={0} width={slot} height={H} fill={i === sel ? 'rgba(255,255,255,0.06)' : 'transparent'} rx="3" />
              {p.v ? <rect x={cx - bw / 2} y={T + ih - h} width={bw} height={h} rx="2.5" fill={near(p.v) ? '#34d399' : s.color} opacity={near(p.v) ? 1 : 0.75} /> : null}
              {p.v && n <= 14 ? <text x={cx} y={T + ih - h - 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="rgba(255,255,255,0.85)">{compact(p.v)}{p.wait ? '+' : ''}</text> : null}
              {p.wait ? <circle cx={cx} cy={T + ih - 5} r="2.6" fill="#fbbf24" /> : null}
              <text x={cx} y={H - 3} textAnchor="middle" fontSize="8" fill={i === sel ? '#ffffff' : 'rgba(255,255,255,0.4)'}>{p.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-white/45 mt-1">
        Target {round(s.target)} {s.unit} · {logged.length} {g === 'day' ? 'days' : g === 'week' ? 'weeks' : 'months'} logged{avg !== null ? ` · average ${round(avg)}` : ''}
        {pts.some((p) => p.wait) ? <span className="text-amber-300"> · amber dot: waiting for the nutritionist's macros</span> : null}
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-white">{chosen.long}</span>
          <span className="text-[11px] font-mono font-bold text-[#6ccbde]">{val(chosen.v === null ? null : round(chosen.v))}{agg && chosen.v !== null ? ' avg' : ''}{chosen.wait ? ' (+ waiting)' : ''}</span>
        </div>
        {chosen.days && chosen.days.length > 0 ? (
          <div className="mt-2 space-y-1">
            <span className="text-[9px] uppercase font-bold text-white/35 block">Each day</span>
            {chosen.days.filter((d) => d.v !== null || d.wait).map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 shrink-0 text-white/60">{d.long}</span>
                <span className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  {d.v ? <span className="block h-full rounded-full" style={{ width: `${Math.min(100, ((d.v as number) / listTop) * 100)}%`, background: near(d.v as number) ? '#34d399' : s.color }} /> : null}
                </span>
                <span className="shrink-0 font-mono font-bold text-white">{val(d.v === null ? null : round(d.v))}{d.wait ? <span className="text-amber-300"> +?</span> : null}</span>
              </div>
            ))}
            {chosen.days.every((d) => d.v === null && !d.wait) ? <span className="text-[10px] text-white/35">Nothing logged in this period.</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const MacroGraphs: React.FC<{
  series: MacroSeries[];
  value: (id: string, day: string) => number | null;
  pending: (day: string) => boolean;
  today: string;
  firstDay: string;
  cardClass?: string;
}> = ({ series, value, pending, today, firstDay, cardClass = 'bg-[#252525] border border-white/[0.06] rounded-2xl p-4' }) => (
  <div className="space-y-3">
    {series.map((s) => <Card key={s.id} s={s} value={value} pending={pending} today={today} firstDay={firstDay} cardClass={cardClass} />)}
  </div>
);
