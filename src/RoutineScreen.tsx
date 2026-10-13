import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  useEffect(() => {
    if (!detail) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-popup-open');
    };
  }, [detail]);
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
  const valueOf = (fu: FollowUp, it: TrackItem, d = now) => logFor(fu.id, it.freq, periodFor(it.freq, d))?.values?.[it.id];

  const setValue = async (fu: FollowUp, it: TrackItem, value: any) => {
    const period = periodFor(it.freq, new Date());
    const prev = logFor(fu.id, it.freq, period)?.values || {};
    const values: Record<string, any> = { ...prev };
    if (value === undefined || value === '') delete values[it.id];
    else values[it.id] = value;
    // Show it straight away; the database listener confirms it.
    setLogs((all) => [...all.filter((l) => !(l.followUpId === fu.id && l.freq === it.freq && l.period === period)), { followUpId: fu.id, freq: it.freq, period, values }]);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_routine_logs', `${clientId}_${fu.id}_${it.freq}_${period}`), {
        clientId,
        followUpId: fu.id,
        freq: it.freq,
        period,
        date: today,
        values,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not save routine:', e);
      setError('Could not save. Please check your connection and try again.');
    }
  };

  // Supplements are ticked in the Diet tab, not here.
  const itemsFor = (freq: Freq) => active.flatMap((fu) => fu.items.filter((i) => i.freq === freq && i.category !== 'Supplements').map((it) => ({ fu, it })));
  const isDone = (fu: FollowUp, it: TrackItem) => {
    const v = valueOf(fu, it);
    return it.type === 'tick' ? v === true : v !== undefined && v !== '';
  };

  // Routine consistency: the share of daily items answered each day. Days before the first answer do not count against the client.
  const dailyItems = itemsFor('daily');
  const answeredOn = (key: string) =>
    dailyItems.filter(({ fu, it }) => {
      const v = logFor(fu.id, 'daily', key)?.values?.[it.id];
      return it.type === 'tick' ? v === true : v !== undefined && v !== '';
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

  const control = (fu: FollowUp, it: TrackItem) => {
    const v = valueOf(fu, it);
    if (it.type === 'number') return <NumberControl item={it} value={typeof v === 'number' ? v : undefined} onChange={(n) => setValue(fu, it, n)} />;
    if (it.type === 'tick')
      return (
        <button type="button" onClick={() => setValue(fu, it, v === true ? false : true)} aria-pressed={v === true}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition ${v === true ? 'bg-emerald-500/10 border-emerald-500/30' : 'border-white/15'}`}>
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${v === true ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent'}`}>✓</span>
          <span className="text-xs text-white/80">{v === true ? 'Done' : 'Tap when done'}</span>
        </button>
      );
    if (it.type === 'choice' || it.type === 'level') {
      const opts = it.options && it.options.length ? it.options : LEVELS;
      return <div className="flex flex-wrap gap-2">{opts.map((o) => <Chip key={o} on={v === o} onClick={() => setValue(fu, it, v === o ? undefined : o)}>{o}</Chip>)}</div>;
    }
    return <TextControl value={typeof v === 'string' ? v : undefined} onChange={(t) => setValue(fu, it, t)} />;
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
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-[11px] text-white/40 font-light">{sub}</div>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${all ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#ec2226]/15 text-[#ec2226]'}`}>
            {all ? 'All done' : `${done}/${list.length}`}
          </span>
        </button>
        {open === freq && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4">
            {list.map(({ fu, it }) => (
              <div key={fu.id + it.id}>
                <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">{it.label}{it.detail ? <span className="normal-case font-normal text-white/50"> · {it.detail}</span> : null}</div>
                {control(fu, it)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const notes = active.filter((f) => f.note && f.note.trim());

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {dailyItems.length > 0 && (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde]">Routine consistency</div>
              <div className="text-[11px] text-white/40"><span className="text-white font-bold font-mono text-sm">{avgPct}%</span> average</div>
            </div>
            <div className="inline-flex rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 shrink-0">
              {([['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setRange(k)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${range === k ? 'bg-[#6ccbde]/15 text-[#6ccbde]' : 'text-white/50'}`}>{l}</button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setDetail(true)} className="w-full text-left" aria-label="Open day by day details">
            <div className="relative pt-[14px]">
              <div className="absolute inset-x-0 top-[14px] h-16 pointer-events-none">
                <div className="absolute inset-x-0 top-0 border-t border-white/[0.08]" />
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/[0.08]" />
                <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.14]" />
              </div>
              <div className={`relative flex items-end justify-between ${range === 'month' ? 'gap-px' : 'gap-1.5'}`}>
                {bars.map((d) => {
                  const h = d.active ? Math.max(3, Math.round(d.frac * 100)) : 0;
                  return (
                    <div key={d.key} className="flex-1 min-w-0 h-16 relative flex justify-center">
                      {d.active && range !== 'month' && (
                        <span className="absolute left-0 right-0 text-center text-[8px] font-mono text-white/60" style={{ bottom: `calc(${h}% + 2px)` }}>{Math.round(d.frac * 100)}</span>
                      )}
                      <div className="absolute bottom-0 w-full max-w-[26px] rounded-t-md" style={{ height: `${h}%`, background: barColor(d.frac) }} />
                    </div>
                  );
                })}
              </div>
            </div>
            {range !== 'month' ? (
              <div className="flex justify-between gap-1.5 mt-1">
                {bars.map((d) => (
                  <span key={d.key} className={`flex-1 min-w-0 text-center text-[9px] truncate ${d.isToday ? 'text-white font-bold' : 'text-white/40'}`}>{d.label}</span>
                ))}
              </div>
            ) : (
              <div className="flex justify-between text-[9px] text-white/40 mt-1"><span>30 days ago</span><span>Today</span></div>
            )}
            <div className="text-center text-[10px] font-semibold text-[#6ccbde] mt-2">Tap for day-by-day details</div>
          </button>
        </div>
      )}

      {detail && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5" onClick={() => setDetail(false)}>
          <div data-no-pull className="anim-card w-full max-w-md max-h-[80vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
              <div>
                <div className="text-sm font-semibold text-white">{range === 'week' ? 'Weekly' : range === 'month' ? 'Monthly' : 'Yearly'} routine consistency</div>
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
      {section('weekly', 'This week', 'Once a week.')}
      {section('monthly', 'This month', 'Once a month.')}
    </div>
  );
};
