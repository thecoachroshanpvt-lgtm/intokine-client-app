import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConsistencyChart } from './ConsistencyChart';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc } from './firebase';

// Routine: shows ONLY what the dietitian added for this client (a follow-up note and the things to track).
// Each item is asked daily, weekly or monthly. Answers save as the client taps and appear in the dietitian's Tracker.
//
// intokine_followups/{id}                                          written by the dietitian
// intokine_routine_logs/{clientId}_{followUpId}_{freq}_{period}    written by the client
//   period = the day (daily), the Monday of the week (weekly) or YYYY-MM (monthly)

type Freq = 'daily' | 'weekly' | 'monthly';
type ItemType = 'number' | 'tick' | 'choice' | 'level' | 'text';

interface TrackItem {
  id: string;
  category: string;
  type: ItemType;
  label: string;
  freq: Freq;
  unit?: string;
  step?: number;
  target?: number;
  options?: string[];
  detail?: string;
}

interface FollowUp {
  id: string;
  date: string;
  note: string;
  items: TrackItem[];
  active: boolean;
  nextDate?: string;
  updatedAt?: string;
}

interface RoutineLog {
  followUpId: string;
  freq: Freq;
  period: string;
  values: Record<string, any>;
}

// An item counts as done when it has a real answer: a tick is on, a number is above 0 (water, sleep, steps at 0 are not done), anything else is filled in.
const hasAnswer = (type: ItemType, v: any) => {
  if (type === 'tick') return v === true;
  if (type === 'number') return typeof v === 'number' && v > 0;
  return v !== undefined && v !== '';
};

interface PendingChange { fu: FollowUp; it: TrackItem; value: any }

const LEVELS = ['None', 'Mild', 'Moderate', 'Severe'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayKey = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dateKey(x);
};
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const periodFor = (freq: Freq, d: Date) => (freq === 'daily' ? dateKey(d) : freq === 'weekly' ? mondayKey(d) : monthKey(d));

const inputCls =
  'bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6ccbde]';

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${on ? 'bg-[#6ccbde] text-black border-[#6ccbde]' : 'border-white/15 text-white/70'}`}
  >
    {children}
  </button>
);

// Energy, stress and mood are updated on a slider: drag the handle or tap the line, and the answer is saved when you let go.
const METER_LABELS = ['energy', 'stress', 'mood'];
const MeterControl: React.FC<{ item: TrackItem; options: string[]; value?: string; onChange: (v: string | undefined) => void }> = ({ item, options, value, onChange }) => {
  const label = item.label.toLowerCase();
  // Left to right the slider always goes from "less" to "more" (mood lists Good first, so it is turned around).
  const opts = label === 'mood' ? [...options].reverse() : options;
  const n = opts.length;
  const sel = value === undefined ? -1 : opts.indexOf(value);
  const [drag, setDrag] = useState<number | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const shown = drag !== null ? drag : sel;
  const pct = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const indexAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (n - 1));
  };
  return (
    <div data-no-pull className="max-w-[320px]">
      <div className="flex items-center justify-between mb-2 min-h-[20px]">
        <span className="text-[11px] text-white/35">{shown >= 0 ? 'Slide to change' : 'Slide or tap to set'}</span>
        <span className="text-sm font-bold text-white">{shown >= 0 ? opts[shown] : '—'}</span>
      </div>
      <div className="px-3.5">
        <div
          ref={trackRef}
          className="relative h-8 select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(indexAt(e.clientX)); }}
          onPointerMove={(e) => { if (drag !== null) { const k = indexAt(e.clientX); if (k !== drag) setDrag(k); } }}
          onPointerUp={(e) => { const k = indexAt(e.clientX); setDrag(null); if (k !== sel) onChange(opts[k]); }}
          onPointerCancel={() => setDrag(null)}
        >
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-white/[0.14]" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
            style={{ width: `${shown >= 0 ? pct(shown) : 0}%`, background: '#6ccbde', transition: drag !== null ? 'none' : 'width 0.15s ease-out' }} />
          {opts.map((o, i) => (
            <span key={o} className="absolute top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-[#1c1c1c] border border-white/25" style={{ left: `${pct(i)}%`, marginLeft: -2.5 }} />
          ))}
          <div
            className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-white"
            style={{ left: `${pct(shown >= 0 ? shown : 0)}%`, transform: 'translate(-50%, -50%)', opacity: shown >= 0 ? 1 : 0.5, transition: drag !== null ? 'none' : 'left 0.15s ease-out' }}
          />
        </div>
      </div>
      <div className="relative h-4 mx-3.5 mt-0.5">
        {opts.map((o, i) => (
          <span key={o} className={`absolute text-[10px] whitespace-nowrap ${shown === i ? 'font-bold text-white' : 'text-white/35'}`}
            style={{ left: `${pct(i)}%`, transform: `translateX(${n > 1 ? (i === 0 ? '-14px' : i === n - 1 ? 'calc(-100% + 14px)' : '-50%') : '-50%'})` }}>{o}</span>
        ))}
      </div>
    </div>
  );
};

const NumberControl: React.FC<{ item: TrackItem; value?: number; onChange: (v: number | undefined) => void }> = ({ item, value, onChange }) => {
  const step = item.step || 1;
  const round = (n: number) => Math.round(n * 100) / 100;
  const v = value ?? 0;
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => { setText(value === undefined ? '' : String(value)); }, [value]);
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={() => onChange(Math.max(0, round(v - step)))} className="w-10 h-10 rounded-full border border-white/15 text-white text-lg active:bg-white/10 shrink-0">−</button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={text}
        placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = text === '' ? undefined : Math.max(0, Number(text));
          if (n !== value) onChange(n);
        }}
        className={inputCls + ' w-24 text-center font-mono'}
      />
      <button type="button" onClick={() => onChange(round(v + step))} className="w-10 h-10 rounded-full border border-white/15 text-white text-lg active:bg-white/10 shrink-0">+</button>
      <span className="text-[11px] text-white/40">{item.unit}{item.target ? ` · aim ${item.target}` : ''}</span>
    </div>
  );
};

const TextControl: React.FC<{ value?: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  return <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== (value ?? '') && onChange(text)} className={inputCls + ' w-full resize-none'} />;
};

export const RoutineScreen: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Freq | ''>('daily');
  const [error, setError] = useState('');
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
  const [detail, setDetail] = useState(false); // the day-by-day popup of the consistency card
  // Same as the other popups: the page behind stays still and pull-to-refresh is off while it is open.
  // Updates are collected first and only saved after the client confirms them in a popup.
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  useEffect(() => {
    if (!detail && !confirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-popup-open');
    };
  }, [detail, confirmOpen]);
  // Ticks, meters and choices open the popup right after the tap. Numbers (water, sleep, steps) and notes do not, so the client can tap + / - as many times as needed; a "Review & save" bar appears instead.
  const pendingKeys = Object.keys(pending);
  const lastType = pendingKeys.length > 0 ? pending[pendingKeys[pendingKeys.length - 1]].it.type : '';
  const quietChange = lastType === 'number' || lastType === 'text';
  useEffect(() => {
    if (pendingKeys.length === 0 || confirmOpen || quietChange) return;
    const t = window.setTimeout(() => setConfirmOpen(true), 80);
    return () => window.clearTimeout(t);
  }, [pending, confirmOpen]);
  // Re-check the date once a minute so "today" rolls over at midnight.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const today = dateKey(now);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
      return;
    }
    // Both where() clauses are required by the security rule: the client only sees follow-ups shown to them.
    const u1 = onSnapshot(
      query(collection(db, 'intokine_followups'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => {
        setFollowUps(
          snap.docs.map((d) => {
            const f = { id: d.id, ...(d.data() as any) } as FollowUp;
            // Mood is always a daily item, even in a follow-up saved when it was weekly.
            return { ...f, items: (f.items || []).map((i) => (i.label.toLowerCase() === 'mood' && i.type === 'choice' ? { ...i, freq: 'daily' as Freq } : i)) };
          })
        );
        setLoading(false);
      },
      (e) => {
        console.warn('Could not load follow-ups:', e);
        setLoading(false);
      }
    );
    const u2 = onSnapshot(
      query(collection(db, 'intokine_routine_logs'), where('clientId', '==', clientId)),
      (snap) => setLogs(snap.docs.map((d) => d.data() as RoutineLog)),
      (e) => console.warn('Could not load routine:', e)
    );
    return () => { u1(); u2(); };
  }, [clientId]);

  const active = followUps.filter((f) => f.active).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const logFor = (fuId: string, freq: Freq, period: string) => logs.find((l) => l.followUpId === fuId && l.freq === freq && l.period === period);
  const pkey = (fu: FollowUp, it: TrackItem) => `${fu.id}|${it.id}`;
  const savedValueOf = (fu: FollowUp, it: TrackItem, d = now) => logFor(fu.id, it.freq, periodFor(it.freq, d))?.values?.[it.id];
  // What the screen shows: the change waiting for confirmation, or else what is saved.
  const valueOf = (fu: FollowUp, it: TrackItem, d = now) => {
    const p = pending[pkey(fu, it)];
    return p ? p.value : savedValueOf(fu, it, d);
  };
  const norm = (type: ItemType, v: any) => (type === 'tick' ? v === true : type === 'number' ? (typeof v === 'number' && v > 0 ? v : undefined) : v === '' || v === null ? undefined : v);

  // A change is only collected here; nothing is saved until the client confirms it.
  const setValue = (fu: FollowUp, it: TrackItem, value: any) => {
    setError('');
    const k = pkey(fu, it);
    setPending((all) => {
      const next = { ...all };
      delete next[k];
      if (norm(it.type, value) !== norm(it.type, savedValueOf(fu, it))) next[k] = { fu, it, value: value === '' ? undefined : value };
      return next;
    });
  };
  const undoChanges = () => { setPending({}); setConfirmOpen(false); setError(''); };
  const confirmSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      // One database document per follow-up and how often it is asked.
      const groups = new Map<string, { fu: FollowUp; freq: Freq; period: string; changes: { it: TrackItem; value: any }[] }>();
      (Object.values(pending) as PendingChange[]).forEach(({ fu, it, value }) => {
        const period = periodFor(it.freq, new Date());
        const gk = `${fu.id}|${it.freq}|${period}`;
        if (!groups.has(gk)) groups.set(gk, { fu, freq: it.freq, period, changes: [] });
        groups.get(gk)!.changes.push({ it, value });
      });
      const written: RoutineLog[] = [];
      for (const g of Array.from(groups.values())) {
        const values: Record<string, any> = { ...(logFor(g.fu.id, g.freq, g.period)?.values || {}) };
        g.changes.forEach(({ it, value }) => {
          if (value === undefined || value === '') delete values[it.id];
          else values[it.id] = value;
        });
        await setDoc(doc(db, 'intokine_routine_logs', `${clientId}_${g.fu.id}_${g.freq}_${g.period}`), {
          clientId,
          followUpId: g.fu.id,
          freq: g.freq,
          period: g.period,
          date: today,
          values,
          updatedAt: new Date().toISOString(),
        });
        written.push({ followUpId: g.fu.id, freq: g.freq, period: g.period, values });
      }
      // Show it straight away; the database listener confirms it.
      setLogs((all) => [...all.filter((l) => !written.some((w) => w.followUpId === l.followUpId && w.freq === l.freq && w.period === l.period)), ...written]);
      setPending({});
      setConfirmOpen(false);
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      console.warn('Could not save routine:', e);
      setError('Could not save. Please check your connection and try again.');
    }
    setSaving(false);
  };
  const describe = (it: TrackItem, v: any) => {
    if (it.type === 'tick') return v === true ? '✓ Done' : 'Not done';
    if (v === undefined || v === '' || v === null) return 'Cleared';
    if (it.type === 'number') return `${v}${it.unit ? ' ' + it.unit : ''}`;
    return String(v);
  };

  // Supplements are ticked in the Diet tab, not here.
  // The same item added by both the dietitian and the coach (for example "Low energy") is asked once: the newest follow-up's copy is kept.
  const itemsFor = (freq: Freq) => {
    const seen = new Set<string>();
    return active.flatMap((fu) =>
      fu.items
        .filter((i) => i.freq === freq && i.category !== 'Supplements')
        .filter((i) => {
          const k = i.label.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((it) => ({ fu, it }))
    );
  };
  const isDone = (fu: FollowUp, it: TrackItem) => {
    return hasAnswer(it.type, valueOf(fu, it));
  };

  // Weekly check-in: from Saturday the popup asks for this week's items. If a week ends with them unanswered, the popup stays on any day until they are filled in.
  // It cannot be closed until every item is answered.
  const [wDraft, setWDraft] = useState<Record<string, any>>({});
  const [wSaving, setWSaving] = useState(false);
  const [wError, setWError] = useState('');
  const gateAnswered = (it: TrackItem, v: any) => (it.type === 'tick' ? typeof v === 'boolean' : hasAnswer(it.type, v));
  const weeklyList = itemsFor('weekly');
  const isWeekend = now.getDay() === 6 || now.getDay() === 0;
  const thisMonday = mondayKey(now);
  const prevMondayDate = new Date(now);
  prevMondayDate.setDate(prevMondayDate.getDate() - 7 - ((now.getDay() + 6) % 7));
  const prevMonday = dateKey(prevMondayDate);
  const prevSaturdayDate = new Date(prevMondayDate);
  prevSaturdayDate.setDate(prevSaturdayDate.getDate() + 5);
  const prevSaturday = dateKey(prevSaturdayDate);
  const savedAt = (fu: FollowUp, it: TrackItem, period: string) => logFor(fu.id, 'weekly', period)?.values?.[it.id];
  type GateItem = { fu: FollowUp; it: TrackItem; period: string; label: string; k: string };
  const gateItems: GateItem[] = [
    // Last week, still unanswered (only for follow-ups last changed before last weekend, so a newly added item waits for the next weekend).
    ...weeklyList
      .filter(({ fu, it }) => ((fu.updatedAt || fu.date || '').slice(0, 10) < prevSaturday) && !gateAnswered(it, savedAt(fu, it, prevMonday)))
      .map(({ fu, it }) => ({ fu, it, period: prevMonday, label: 'Last week', k: `${prevMonday}|${pkey(fu, it)}` })),
    // This week, from Saturday.
    ...(isWeekend
      ? weeklyList
          .filter(({ fu, it }) => !gateAnswered(it, savedAt(fu, it, thisMonday)))
          .map(({ fu, it }) => ({ fu, it, period: thisMonday, label: 'This week', k: `${thisMonday}|${pkey(fu, it)}` }))
      : []),
  ];
  const gateOpen = !loading && gateItems.length > 0;
  useEffect(() => {
    if (!gateOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-popup-open');
    };
  }, [gateOpen]);
  const weeklyLeft = gateItems.filter((g) => !gateAnswered(g.it, wDraft[g.k])).length;
  const saveWeekly = async () => {
    setWSaving(true);
    setWError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      const groups = new Map<string, { fu: FollowUp; period: string; changes: { it: TrackItem; value: any }[] }>();
      gateItems.forEach((g) => {
        const gk = `${g.fu.id}|${g.period}`;
        if (!groups.has(gk)) groups.set(gk, { fu: g.fu, period: g.period, changes: [] });
        groups.get(gk)!.changes.push({ it: g.it, value: wDraft[g.k] });
      });
      const written: RoutineLog[] = [];
      for (const g of Array.from(groups.values())) {
        const values: Record<string, any> = { ...(logFor(g.fu.id, 'weekly', g.period)?.values || {}) };
        g.changes.forEach(({ it, value }) => { values[it.id] = value; });
        await setDoc(doc(db, 'intokine_routine_logs', `${clientId}_${g.fu.id}_weekly_${g.period}`), {
          clientId,
          followUpId: g.fu.id,
          freq: 'weekly',
          period: g.period,
          date: today,
          values,
          updatedAt: new Date().toISOString(),
        });
        written.push({ followUpId: g.fu.id, freq: 'weekly', period: g.period, values });
      }
      setLogs((all) => [...all.filter((l) => !written.some((w) => w.followUpId === l.followUpId && w.freq === l.freq && w.period === l.period)), ...written]);
      setWDraft({});
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      console.warn('Could not save weekly check-in:', e);
      setWError('Could not save. Please check your connection and try again.');
    }
    setWSaving(false);
  };

  // Routine consistency: the share of daily items answered each day. Days before the first answer do not count against the client.
  const dailyItems = itemsFor('daily');
  const answeredOn = (key: string) =>
    dailyItems.filter(({ fu, it }) => {
      const v = logFor(fu.id, 'daily', key)?.values?.[it.id];
      return hasAnswer(it.type, v);
    });
  const dayFrac = (key: string) => (dailyItems.length ? Math.min(1, answeredOn(key).length / dailyItems.length) : 0);
  const firstDay = logs.filter((l) => l.freq === 'daily').map((l) => l.period).sort()[0] || today;
  const lastDays = (n: number, fmt: Intl.DateTimeFormatOptions) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      const key = dateKey(d);
      return {
        key,
        label: d.toLocaleDateString(undefined, fmt),
        full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        frac: dayFrac(key),
        done: answeredOn(key),
        active: key >= firstDay,
        isToday: key === today,
        fullDays: 0,
        logged: 0,
        n: 1,
      };
    });
  const week = lastDays(7, { weekday: 'short' });
  const month = lastDays(30, { day: 'numeric' });
  const year = Array.from({ length: 12 }, (_, i) => {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (11 - i));
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    let sumFrac = 0;
    let n = 0;
    let fullDays = 0;
    let logged = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      if (key > today) break;
      if (key < firstDay) continue;
      const f = dayFrac(key);
      sumFrac += f;
      n++;
      if (f >= 0.999) fullDays++;
      if (f > 0) logged++;
    }
    return {
      key: dateKey(start),
      label: start.toLocaleDateString(undefined, { month: 'short' }),
      full: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      frac: n ? sumFrac / n : 0,
      done: [] as typeof dailyItems,
      active: n > 0,
      isToday: i === 11,
      fullDays,
      logged,
      n,
    };
  });
  const bars = range === 'week' ? week : range === 'month' ? month : year;
  const activeBars = bars.filter((x) => x.active);
  const avgPct = activeBars.length ? Math.round((activeBars.reduce((t, x) => t + x.frac, 0) / activeBars.length) * 100) : 0;
  const barColor = (f: number) => (f >= 0.8 ? '#34d399' : f >= 0.5 ? '#fbbf24' : '#ec2226');
  const totalFull = range === 'year' ? activeBars.reduce((t, x) => t + x.fullDays, 0) : activeBars.filter((x) => x.frac >= 0.999).length;
  const totalLogged = range === 'year' ? activeBars.reduce((t, x) => t + x.logged, 0) : activeBars.filter((x) => x.frac > 0).length;
  const totalDays = range === 'year' ? activeBars.reduce((t, x) => t + x.n, 0) : activeBars.length;
  const rangeTitle = range === 'week' ? 'Last 7 days' : range === 'month' ? 'Last 30 days' : 'Last 12 months';

  if (loading) return <div className="text-center py-12 text-white/40 text-sm font-light">Loading your routine...</div>;

  if (active.length === 0) {
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            Your dietitian has not added a follow-up yet. Once they do, your notes and what to track will show here.
          </p>
        </div>
      </div>
    );
  }

  const control = (fu: FollowUp, it: TrackItem) => controlFor(it, valueOf(fu, it), (val) => setValue(fu, it, val));
  const controlFor = (it: TrackItem, v: any, set: (value: any) => void) => {
    if (it.type === 'number') return <NumberControl item={it} value={typeof v === 'number' ? v : undefined} onChange={(n) => set(n)} />;
    if (it.type === 'tick')
      return (
        <button type="button" onClick={() => set(v === true ? false : true)} aria-pressed={v === true}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition ${v === true ? 'bg-emerald-500/10 border-emerald-500/30' : 'border-white/15'}`}>
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${v === true ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent'}`}>✓</span>
          <span className="text-xs text-white/80">{v === true ? 'Done' : 'Tap when done'}</span>
        </button>
      );
    if (it.type === 'choice' || it.type === 'level') {
      const opts = it.options && it.options.length ? it.options : LEVELS;
      if (METER_LABELS.includes(it.label.trim().toLowerCase())) return <MeterControl item={it} options={opts} value={typeof v === 'string' ? v : undefined} onChange={(o) => set(o)} />;
      return <div className="flex flex-wrap gap-2">{opts.map((o) => <Chip key={o} on={v === o} onClick={() => set(v === o ? undefined : o)}>{o}</Chip>)}</div>;
    }
    return <TextControl value={typeof v === 'string' ? v : undefined} onChange={(t) => set(t)} />;
  };

  const section = (freq: Freq, title: string, sub: string) => {
    const list = itemsFor(freq);
    if (list.length === 0) return null;
    const done = list.filter(({ fu, it }) => isDone(fu, it)).length;
    const all = done === list.length;
    return (
      <div className="bg-[#252525] border border-white/[0.06] rounded-2xl overflow-hidden">
        <button type="button" onClick={() => setOpen(open === freq ? '' : freq)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
          <div className="min-w-0">
            <div className="font-subheader text-[17px] text-white">{title}</div>
            <div className="text-[11px] text-white/40 font-light">{sub}</div>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${all ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#ec2226]/15 text-[#ec2226]'}`}>
            {all ? 'All done' : `${done}/${list.length}`}
          </span>
        </button>
        {open === freq && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4">
            {list.map(({ fu, it }) => {
              // Habits are one tappable row: the tick circle, then the habit and its note.
              if (it.type === 'tick') {
                const on = valueOf(fu, it) === true;
                return (
                  <button key={fu.id + it.id} type="button" onClick={() => setValue(fu, it, on ? false : true)} aria-pressed={on}
                    className={`w-full flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition ${on ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent ik-nudge'}`} aria-hidden>✓</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${on ? 'text-white/50' : 'text-white'}`}>{it.label}</span>
                      {it.detail ? <span className="block text-[11px] text-white/45 font-light">{it.detail}</span> : null}
                    </span>
                    <span className={`text-[10px] font-semibold shrink-0 ${on ? 'text-emerald-400' : 'text-white/35'}`}>{on ? 'Done' : 'Tap when done'}</span>
                  </button>
                );
              }
              // A tracker with no answer yet blinks gently, the same as the habit circles, to nudge the client.
              const answered = hasAnswer(it.type, valueOf(fu, it));
              return (
                <div key={fu.id + it.id} className={`rounded-xl border -mx-2.5 px-2.5 py-2 ${answered ? 'border-transparent' : 'ik-nudge-box'}`}>
                  <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">{it.label}{it.detail ? <span className="normal-case font-normal text-white/50"> · {it.detail}</span> : null}</div>
                  {control(fu, it)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const notes = active.filter((f) => f.note && f.note.trim());
  const todayDone = answeredOn(today).length;
  // Streak: days in a row with every daily item done (today counts once it is complete).
  let streak = 0;
  for (let i = todayDone === dailyItems.length ? 0 : 1; i < 400; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    if (key < firstDay || dayFrac(key) < 0.999) break;
    streak++;
  }

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {dailyItems.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">Today's routine</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-4xl font-header text-white leading-none">{todayDone}</span>
                <span className="text-sm text-white/50 font-semibold">of {dailyItems.length} done</span>
              </div>
            </div>
            <div className="text-right text-[11px] text-white/40 leading-snug pt-0.5">
              <div><span className="text-white font-bold font-mono">{streak}</span> day streak</div>
              <div>{todayDone === dailyItems.length ? 'All done' : `${dailyItems.length - todayDone} to go`}</div>
            </div>
          </div>
          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.round((todayDone / dailyItems.length) * 100)}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
          </div>
          <div className="text-[11px] text-white/45 font-light">
            {todayDone === dailyItems.length ? 'Great work, today is complete.' : todayDone === 0 ? 'Start with the first item below.' : 'Keep going, you are on your way.'}
          </div>
        </div>
      )}

      {pendingKeys.length > 0 && !confirmOpen && createPortal(
        <div className="fixed left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
          <div className="anim-card pointer-events-auto w-full max-w-md rounded-2xl bg-[#1c1c1c] border border-[#ec2226]/50 shadow-2xl p-3">
            <div className="flex items-center justify-between gap-3 mb-2.5 px-1">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{pendingKeys.length} unsaved {pendingKeys.length === 1 ? 'change' : 'changes'}</div>
                <div className="text-[11px] text-white/45 truncate">{(Object.values(pending) as PendingChange[]).map((c) => c.it.label).join(', ')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={undoChanges} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Undo</button>
              <button type="button" onClick={() => setConfirmOpen(true)} className="flex-[2] py-2.5 rounded-xl bg-[#ec2226] text-white text-xs font-bold">Review & save</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {savedMsg && (
        <div className="fixed left-0 right-0 bottom-28 z-40 flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-bold shadow-lg">Update saved</span>
        </div>
      )}

      {gateOpen && createPortal(
        <div className="anim-overlay fixed inset-0 z-[130] bg-black/80 flex items-center justify-center p-5">
          <div data-no-pull className="anim-card w-full max-w-sm max-h-[85vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true">
            <div className="p-4 border-b border-white/[0.08]">
              <div className="font-subheader text-[17px] text-white">Weekly check-in</div>
              <div className="text-[11px] text-white/40">Fill in all to continue</div>
            </div>
            <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
              {gateItems.map((g, i) => {
                const { it, k } = g;
                const v = wDraft[k];
                const set = (val: any) => setWDraft((d) => ({ ...d, [k]: val }));
                const heading = i === 0 || gateItems[i - 1].period !== g.period;
                return (
                  <div key={k}>
                    {heading && gateItems.some((x) => x.period !== g.period) && (
                      <div className="font-subheader text-[13px] uppercase tracking-wide text-[#6ccbde] mb-3">{g.label}</div>
                    )}
                    <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">{it.label}{it.detail ? <span className="normal-case font-normal text-white/50"> · {it.detail}</span> : null}</div>
                    {it.type === 'tick' ? (
                      <div className="flex gap-2">
                        <Chip on={v === true} onClick={() => set(true)}>Yes</Chip>
                        <Chip on={v === false} onClick={() => set(false)}>No</Chip>
                      </div>
                    ) : controlFor(it, v, set)}
                  </div>
                );
              })}
              {wError && <p className="text-xs text-[#ec2226]">{wError}</p>}
            </div>
            <div className="p-3 border-t border-white/[0.08]">
              <button type="button" disabled={weeklyLeft > 0 || wSaving} onClick={saveWeekly} className="w-full py-3 rounded-xl bg-[#ec2226] disabled:bg-[#252525] disabled:text-white/40 text-white text-sm font-bold">
                {wSaving ? 'Saving...' : weeklyLeft === 0 ? 'Save' : `${weeklyLeft} left to fill`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmOpen && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5">
          <div data-no-pull className="anim-card w-full max-w-sm max-h-[80vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/[0.08]">
              <div className="font-subheader text-[17px] text-white">Confirm your update</div>
              <div className="text-[11px] text-white/40">Check it and confirm to save</div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2" style={{ overscrollBehavior: 'contain' }}>
              {(Object.values(pending) as PendingChange[]).map(({ fu, it, value }) => (
                <div key={fu.id + it.id} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-white/70 min-w-0">{it.label}</span>
                  <span className={`font-bold text-right min-w-0 break-words ${it.type === 'tick' && value !== true ? 'text-white/40' : 'text-white'}`}>{describe(it, value)}</span>
                </div>
              ))}
              {error && <p className="text-xs text-[#ec2226] pt-1">{error}</p>}
            </div>
            <div className="p-3 border-t border-white/[0.08] flex items-center gap-2">
              <button type="button" disabled={saving} onClick={undoChanges} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Cancel</button>
              <button type="button" disabled={saving} onClick={confirmSave} className="flex-[2] py-2.5 rounded-xl bg-[#ec2226] disabled:opacity-60 text-white text-xs font-bold">{saving ? 'Saving...' : 'Confirm & save'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {detail && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5" onClick={() => setDetail(false)}>
          <div data-no-pull className="anim-card w-full max-w-md max-h-[80vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
              <div>
                <div className="font-subheader text-[17px] text-white">{range === 'week' ? 'Weekly' : range === 'month' ? 'Monthly' : 'Yearly'} routine consistency</div>
                <div className="text-[11px] text-white/40">{rangeTitle}</div>
              </div>
              <button type="button" onClick={() => setDetail(false)} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 pb-2">
              {([['Average', `${avgPct}%`], ['Full days', String(totalFull)], ['Days logged', `${totalLogged}/${totalDays}`]] as const).map(([l, v]) => (
                <div key={l} className="bg-black/30 rounded-xl py-2 text-center">
                  <div className="text-sm font-bold text-white font-mono">{v}</div>
                  <div className="text-[9px] text-white/40 uppercase mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="overflow-y-auto px-4 pb-4 pt-2 space-y-2.5" style={{ overscrollBehavior: 'contain' }}>
              {[...bars].reverse().map((d) => (
                <div key={d.key}>
                  <div className="flex items-center gap-3">
                    <div className={`w-24 shrink-0 text-xs ${d.isToday ? 'text-white font-bold' : 'text-white/70'}`}>{d.full}{d.isToday && range !== 'year' ? ' (today)' : ''}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.active ? Math.round(d.frac * 100) : 0}%`, background: barColor(d.frac) }} />
                    </div>
                    <div className="w-12 shrink-0 text-right text-xs font-mono font-bold" style={{ color: d.active ? barColor(d.frac) : 'rgba(255,255,255,0.3)' }}>{d.active ? `${Math.round(d.frac * 100)}%` : '—'}</div>
                  </div>
                  {range === 'year' ? (
                    <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">{d.active ? `${d.fullDays} full days · ${d.logged} of ${d.n} days logged` : 'No data yet'}</div>
                  ) : (
                    <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">
                      {!d.active ? 'Before you started' : `${d.done.length} of ${dailyItems.length} items`}
                      {range === 'week' && d.active && (
                        <span className="flex flex-wrap gap-1 mt-1">
                          {dailyItems.map(({ fu, it }) => {
                            const ok = d.done.some((x) => x.fu.id === fu.id && x.it.id === it.id);
                            return (
                              <span key={fu.id + it.id} className={`px-1.5 py-0.5 rounded-full text-[9px] ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.05] text-white/30'}`}>{ok ? '✓ ' : ''}{it.label}</span>
                            );
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {notes.map((f) => (
        <div key={f.id} className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-[0.12em]">From your dietitian</span>
            <span className="text-[10px] text-white/30">{f.date}</span>
          </div>
          <p className="text-sm text-white/85 font-light leading-relaxed whitespace-pre-wrap">{f.note}</p>
          {f.nextDate && <p className="text-[11px] text-white/40">Next follow-up: {f.nextDate}</p>}
        </div>
      ))}

      {error && <p className="text-xs text-[#ec2226]">{error}</p>}

      {section('daily', 'Today', 'Saves as you tap.')}
      {section('monthly', 'This month', 'Once a month.')}

      {dailyItems.length > 0 && (
        <ConsistencyChart title="Routine consistency" bars={bars} range={range} onRange={setRange} avgPct={avgPct} fullDays={totalFull} periodLabel={rangeTitle} onOpen={() => setDetail(true)} />
      )}
    </div>
  );
};
