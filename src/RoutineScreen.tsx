import React, { useEffect, useState } from 'react';
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

  // last 7 days: share of today's-type items answered each day
  const dailyItems = itemsFor('daily');
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    const done = dailyItems.filter(({ fu, it }) => {
      const v = logFor(fu.id, 'daily', key)?.values?.[it.id];
      return it.type === 'tick' ? v === true : v !== undefined && v !== '';
    }).length;
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), frac: dailyItems.length ? done / dailyItems.length : 0, isToday: key === today };
  });

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
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
          <div className="text-[10px] text-white/40 uppercase font-bold tracking-[0.15em]">My routine · last 7 days</div>
          <div className="flex items-end justify-between gap-1">
            {strip.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full h-10 bg-white/[0.06] rounded-md flex items-end overflow-hidden">
                  <div className="w-full rounded-md" style={{ height: `${d.frac * 100}%`, background: 'linear-gradient(180deg, #6ccbde, #ec2226)' }} />
                </div>
                <span className={`text-[9px] font-bold ${d.isToday ? 'text-white' : 'text-white/30'}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
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
