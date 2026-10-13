import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc } from './firebase';

// Lifestyle routine: a few quick things every day, a short check-in every week, and a monthly update.
// Weight and waist come from the coach's assessments, diet from meal ticks, and exercise from sessions and workouts, so none of those are asked here.
// Everything is saved to intokine_routine_logs and shows up automatically in the nutritionist's Tracker.
// Document id = <clientId>_<daily|weekly|monthly>_<period>   (period = day, Monday of the week, or YYYY-MM)

type Kind = 'daily' | 'weekly' | 'monthly';
type Vals = Record<string, any>;

interface RoutineLog {
  kind: Kind;
  period: string;
  date: string;
  values: Vals;
}

// Exercise comes from sessions and suggested workouts, and protein/macros from the meals ticked in the Diet tab, so they are not asked here.
const DAILY_HABITS = ['Post-meal walk', 'Dinner on time', 'No sugary drinks', 'Supplements taken'];
const ENERGY = ['Low', 'Okay', 'High'];
const DIGESTION = ['Good', 'Bloated', 'Constipated', 'Loose'];
const STRUGGLES = ['Sugar cravings', 'Emotional eating', 'Late-night eating', 'Outside food'];
const SYMPTOMS = ['Bloating', 'Constipation', 'Acidity / reflux', 'Low energy', 'Headaches', 'Sugar cravings'];
const LEVELS = ['None', 'Mild', 'Moderate', 'Severe'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayKey = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return dateKey(x);
};
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
      on ? 'bg-[#6ccbde] text-black border-[#6ccbde]' : 'border-white/15 text-white/70'
    }`}
  >
    {children}
  </button>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">{children}</div>
);

const inputCls =
  'w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6ccbde]';

const Stepper: React.FC<{ value?: number; step: number; unit: string; max: number; onChange: (v: number) => void }> = ({ value, step, unit, max, onChange }) => {
  const v = value ?? 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(0, round(v - step)))} className="w-10 h-10 rounded-full border border-white/15 text-white text-lg active:bg-white/10">−</button>
      <div className="min-w-[80px] text-center">
        <span className="text-xl font-semibold text-white font-mono">{value === undefined ? '—' : v}</span>
        <span className="text-[11px] text-white/40 ml-1">{unit}</span>
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, round(v + step)))} className="w-10 h-10 rounded-full border border-white/15 text-white text-lg active:bg-white/10">+</button>
    </div>
  );
};

export const RoutineScreen: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [open, setOpen] = useState<Kind | ''>('daily');
  const [error, setError] = useState('');
  // Re-check the date once a minute so "today" rolls over at midnight.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const today = dateKey(now);
  const week = mondayKey(now);
  const month = monthKey(now);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    // The clientId filter is required by the security rule for this collection.
    const unsub = onSnapshot(
      query(collection(db, 'intokine_routine_logs'), where('clientId', '==', clientId)),
      (snap) => setLogs(snap.docs.map((d) => d.data() as RoutineLog)),
      (e) => console.warn('Could not load routine:', e)
    );
    return () => unsub();
  }, [clientId]);

  const find = (kind: Kind, period: string) => logs.find((l) => l.kind === kind && l.period === period);
  const dailyToday = find('daily', today);
  const weeklyNow = find('weekly', week);
  const monthlyNow = find('monthly', month);

  const save = async (kind: Kind, period: string, values: Vals): Promise<boolean> => {
    const clean = JSON.parse(JSON.stringify(values));
    // Show it straight away; the database listener confirms it.
    setLogs((prev) => [...prev.filter((l) => !(l.kind === kind && l.period === period)), { kind, period, date: today, values: clean }]);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_routine_logs', `${clientId}_${kind}_${period}`), {
        clientId,
        kind,
        period,
        date: today,
        values: clean,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.warn('Could not save routine:', e);
      setError('Could not save. Please check your connection and try again.');
      return false;
    }
  };

  // ----- daily (saves on every tap) -----
  const dv: Vals = dailyToday?.values || {};
  const setDaily = (patch: Vals) => save('daily', today, { ...dv, ...patch });
  const toggleIn = (key: string, item: string) => {
    const cur: string[] = Array.isArray(dv[key]) ? dv[key] : [];
    setDaily({ [key]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] });
  };
  const habitsDone = (Array.isArray(dv.habits) ? dv.habits.length : 0);

  // last 7 days strip
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    const l = find('daily', key);
    const n = l && Array.isArray(l.values.habits) ? l.values.habits.length : 0;
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), logged: !!l, frac: n / DAILY_HABITS.length, isToday: key === today };
  });
  const loggedDays = strip.filter((s) => s.logged).length;

  // ----- weekly / monthly (local form, Save button) -----
  const [wf, setWf] = useState<Vals>({});
  const [mf, setMf] = useState<Vals>({});
  const [wSaved, setWSaved] = useState(false);
  const [mSaved, setMSaved] = useState(false);
  useEffect(() => { setWf(weeklyNow?.values || {}); }, [week, !!weeklyNow]);
  useEffect(() => { setMf(monthlyNow?.values || {}); }, [month, !!monthlyNow]);

  const card = (kind: Kind, title: string, sub: string, done: boolean, body: React.ReactNode) => (
    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(open === kind ? '' : kind)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-[11px] text-white/40 font-light">{sub}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#ec2226]/15 text-[#ec2226]'}`}>
          {done ? 'Done' : 'To do'}
        </span>
      </button>
      {open === kind && <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4">{body}</div>}
    </div>
  );

  const dailyDone = !!dailyToday && (dv.waterL !== undefined || dv.sleepH !== undefined || habitsDone > 0);

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-[0.15em]">My routine</div>
            <div className="font-header text-3xl text-white tracking-wide leading-none mt-1">
              {loggedDays}<span className="text-sm font-light text-white/50 ml-1 font-sans">/ 7 days logged</span>
            </div>
          </div>
          <div className="text-right text-[10px] text-white/40">Your nutritionist sees<br />this automatically</div>
        </div>
        <div className="flex items-end justify-between gap-1">
          {strip.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full h-10 bg-white/[0.06] rounded-md flex items-end overflow-hidden">
                <div className="w-full rounded-md" style={{ height: d.logged ? `${Math.max(14, d.frac * 100)}%` : 0, background: 'linear-gradient(180deg, #6ccbde, #ec2226)' }} />
              </div>
              <span className={`text-[9px] font-bold ${d.isToday ? 'text-white' : 'text-white/30'}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-[#ec2226]">{error}</p>}

      {/* DAILY */}
      {card('daily', 'Today', 'Takes about a minute. Saves as you tap.', dailyDone, (
        <>
          <div>
            <Label>Water</Label>
            <Stepper value={dv.waterL} step={0.25} unit="litres" max={10} onChange={(v) => setDaily({ waterL: v })} />
          </div>
          <div>
            <Label>Sleep last night</Label>
            <Stepper value={dv.sleepH} step={0.5} unit="hours" max={14} onChange={(v) => setDaily({ sleepH: v })} />
          </div>
          <div>
            <Label>Steps</Label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="e.g. 7500"
              defaultValue={dv.steps ?? ''}
              key={`steps-${today}-${dv.steps ?? ''}`}
              onBlur={(e) => {
                const n = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
                if (n !== dv.steps) setDaily({ steps: n });
              }}
              className={inputCls + ' max-w-[180px]'}
            />
          </div>
          <div>
            <Label>What did you do today?</Label>
            <div className="flex flex-wrap gap-2">
              {DAILY_HABITS.map((h) => <Chip key={h} on={(dv.habits || []).includes(h)} onClick={() => toggleIn('habits', h)}>{h}</Chip>)}
            </div>
          </div>
          <div>
            <Label>Anything tough today?</Label>
            <div className="flex flex-wrap gap-2">
              {STRUGGLES.map((h) => <Chip key={h} on={(dv.struggles || []).includes(h)} onClick={() => toggleIn('struggles', h)}>{h}</Chip>)}
            </div>
          </div>
          <div>
            <Label>Energy today</Label>
            <div className="flex flex-wrap gap-2">
              {ENERGY.map((s) => <Chip key={s} on={dv.energy === s} onClick={() => setDaily({ energy: dv.energy === s ? undefined : s })}>{s}</Chip>)}
            </div>
          </div>
          <div>
            <Label>Digestion today</Label>
            <div className="flex flex-wrap gap-2">
              {DIGESTION.map((s) => <Chip key={s} on={dv.digestion === s} onClick={() => setDaily({ digestion: dv.digestion === s ? undefined : s })}>{s}</Chip>)}
            </div>
          </div>
          <div>
            <Label>Stress today</Label>
            <div className="flex flex-wrap gap-2">
              {['Low', 'Mild', 'Moderate', 'High'].map((s) => <Chip key={s} on={dv.stress === s} onClick={() => setDaily({ stress: dv.stress === s ? undefined : s })}>{s}</Chip>)}
            </div>
          </div>
        </>
      ))}

      {/* WEEKLY */}
      {card('weekly', 'This week', 'A short check-in, once a week.', !!weeklyNow, (
        <>
          <div>
            <Label>Symptoms this week</Label>
            <div className="space-y-2.5">
              {SYMPTOMS.map((sy) => (
                <div key={sy}>
                  <div className="text-xs text-white/80 mb-1">{sy}</div>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((lv) => (
                      <Chip key={lv} on={(wf.symptoms || {})[sy] === lv} onClick={() => setWf({ ...wf, symptoms: { ...(wf.symptoms || {}), [sy]: (wf.symptoms || {})[sy] === lv ? '' : lv } })}>{lv}</Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Mood and stress this week</Label>
            <div className="flex flex-wrap gap-2">
              {['Good', 'Okay', 'Stressed', 'Needs attention'].map((s) => <Chip key={s} on={wf.mood === s} onClick={() => setWf({ ...wf, mood: wf.mood === s ? undefined : s })}>{s}</Chip>)}
            </div>
          </div>
          <div>
            <Label>What was difficult? (optional)</Label>
            <textarea rows={2} value={wf.note ?? ''} onChange={(e) => setWf({ ...wf, note: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
          <button
            type="button"
            onClick={async () => { if (await save('weekly', week, wf)) { setWSaved(true); setTimeout(() => setWSaved(false), 2500); } }}
            className="w-full py-3 rounded-xl bg-[#ec2226] text-white text-sm font-bold"
          >
            {wSaved ? 'Saved ✓' : weeklyNow ? 'Update this week' : 'Save this week'}
          </button>
        </>
      ))}

      {/* MONTHLY */}
      {card('monthly', 'This month', 'A quick health update, once a month.', !!monthlyNow, (
        <>
          <div>
            <Label>Any change in your health? (optional)</Label>
            <textarea rows={2} placeholder="New diagnosis, test results, illness, injury..." value={mf.healthChange ?? ''} onChange={(e) => setMf({ ...mf, healthChange: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
          <div>
            <Label>Medicine or supplement changes (optional)</Label>
            <textarea rows={2} value={mf.medChange ?? ''} onChange={(e) => setMf({ ...mf, medChange: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
          <div>
            <Label>Questions for your nutritionist (optional)</Label>
            <textarea rows={2} value={mf.questions ?? ''} onChange={(e) => setMf({ ...mf, questions: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
          <button
            type="button"
            onClick={async () => { if (await save('monthly', month, mf)) { setMSaved(true); setTimeout(() => setMSaved(false), 2500); } }}
            className="w-full py-3 rounded-xl bg-[#ec2226] text-white text-sm font-bold"
          >
            {mSaved ? 'Saved ✓' : monthlyNow ? 'Update this month' : 'Save this month'}
          </button>
        </>
      ))}
    </div>
  );
};
