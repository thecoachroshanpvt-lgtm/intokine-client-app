import { IS_RECORDED } from './variant';
import React, { useEffect, useMemo, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc } from './firebase';
import { ConsistencyShare } from './ConsistencyShare';

// Home: one overall consistency score for the last 30 days, made from four parts -
// Diet (meals ticked), Routine (follow-up items answered), Sessions (coach sessions attended) and Workouts (suggested workouts done).
// A part with nothing due yet is left out of the overall score. Today only counts once something is done today.

const DAYS = 30;
// App colours only: green when strong, cyan when building, red when low (no yellow).
const consistencyColor = (f: number) => (f >= 0.8 ? '#34d399' : f >= 0.5 ? '#6ccbde' : '#ec2226');
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayKey = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dateKey(x);
};
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

type Freq = 'daily' | 'weekly' | 'monthly';
interface FuItem { id: string; label?: string; type: string; freq: Freq }
interface FollowUp { id: string; date?: string; active?: boolean; items?: FuItem[] }
interface RoutineLog { followUpId: string; freq: Freq; period: string; values?: Record<string, any> }
interface MealLog { date: string; eaten?: string[] }
interface Meal { id: string }

const answered = (type: string, v: any) => (type === 'tick' ? v === true : type === 'number' ? typeof v === 'number' && v > 0 : v !== undefined && v !== '' && v !== null);

interface Part { key: string; label: string; done: number; total: number; frac: number | null }

export const OverallProgressCard: React.FC<{
  clientId: string;
  startDate: string | null;
  plans: { date: string; isSuggestedWorkout?: boolean; clientCompletedAt?: string }[];
  sessions: { date: string; status?: string; attendanceStatus?: string }[];
  clientName?: string;
}> = ({ clientId, startDate, plans, sessions, clientName }) => {
  const [share, setShare] = useState(false);
  const [ownName, setOwnName] = useState('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [planFrom, setPlanFrom] = useState<string | null>(null);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [otherActs, setOtherActs] = useState<{ name: string; date: string }[]>([]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const u1 = onSnapshot(
      query(collection(db, 'intokine_nutrition_plans'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => {
        const stamp = (d: any) => Number(String(d.id || '').split('-')[1]) || 0;
        const newest = [...snap.docs].sort((a, b) => stamp(b) - stamp(a))[0];
        const data: any = newest?.data();
        setMeals(Array.isArray(data?.meals) ? data.meals : []);
        const ts = data ? stamp(data) : 0;
        setPlanFrom(ts ? dateKey(new Date(ts)) : null);
      },
      () => {}
    );
    const u2 = onSnapshot(query(collection(db, 'intokine_meal_logs'), where('clientId', '==', clientId)), (s) => setMealLogs(s.docs.map((d) => d.data() as MealLog)), () => {});
    const u3 = onSnapshot(
      query(collection(db, 'intokine_followups'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (s) => setFollowUps(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as FollowUp)),
      () => {}
    );
    const u4 = onSnapshot(query(collection(db, 'intokine_routine_logs'), where('clientId', '==', clientId)), (s) => setRoutineLogs(s.docs.map((d) => d.data() as RoutineLog)), () => {});
    const u5 = onSnapshot(doc(db, 'intokine_clients', clientId), (s) => setOwnName(String((s.data() as any)?.name || '')), () => {});
    const u6 = onSnapshot(query(collection(db, 'intokine_other_activities'), where('clientId', '==', clientId)), (s) => setOtherActs(s.docs.map((d) => d.data() as any)), () => {});
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [clientId]);

  // The four parts for a window: the last N days, or everything since the client started ('all').
  const build = (span: number | 'all'): Part[] => {
    const now = new Date();
    const today = dateKey(now);
    const from = new Date(now);
    from.setDate(from.getDate() - ((span === 'all' ? DAYS : span) - 1));
    let winStart = dateKey(from);
    // The score starts from the date the coach set when resetting the client; if there is none, from the earliest thing the client did.
    // A package renewal never moves it.
    const earliest = [...mealLogs.map((l) => l.date), ...sessions.map((s) => s.date), ...plans.map((p) => p.date)].filter(Boolean).sort()[0];
    if (span === 'all') {
      const floor = new Date(now);
      floor.setDate(floor.getDate() - 1100);
      const base = startDate && startDate <= today ? startDate : earliest && earliest <= today ? earliest : winStart;
      winStart = base < dateKey(floor) ? dateKey(floor) : base;
    } else {
      const joined = startDate || earliest;
      if (joined && joined > winStart && joined <= today) winStart = joined;
    }
    const days: string[] = [];
    for (let k = winStart; k <= today; ) {
      days.push(k);
      const d = new Date(k + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      k = dateKey(d);
    }
    const make = (key: string, label: string, done: number, total: number): Part => ({ key, label, done, total, frac: total > 0 ? Math.min(1, done / total) : null });

    // Diet: each day counts the share of planned meals ticked.
    let dDone = 0, dTotal = 0;
    if (meals.length > 0) {
      const ids = new Set(meals.map((m) => m.id));
      days.forEach((k) => {
        if (planFrom && k < planFrom) return;
        const eaten = (mealLogs.find((l) => l.date === k)?.eaten || []).filter((id) => ids.has(id)).length;
        if (k === today && eaten === 0) return;
        dDone += Math.min(1, eaten / meals.length);
        dTotal += 1;
      });
    }

    // Routine: every item of every active follow-up, once per day / week / month.
    let rDone = 0, rTotal = 0;
    const seenItems = new Set<string>(); // an item added twice (dietitian and coach) counts once, the newest copy
    followUps.filter((f) => f.active !== false).sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((f) => {
      (f.items || []).forEach((it) => {
        const dupKey = (it.label || '').trim().toLowerCase();
        if (seenItems.has(dupKey)) return;
        if (dupKey === 'any change in my health or medicines' || dupKey === 'questions for my dietitian') return; // retired items
        seenItems.add(dupKey);
        const periods = new Set<string>();
        days.forEach((k) => {
          if (f.date && k < f.date) return;
          const d = new Date(k + 'T00:00:00');
          periods.add(it.freq === 'daily' ? k : it.freq === 'weekly' ? mondayKey(d) : monthKey(d));
        });
        const current = it.freq === 'daily' ? today : it.freq === 'weekly' ? mondayKey(now) : monthKey(now);
        periods.forEach((p) => {
          const ok = answered(it.type, routineLogs.find((l) => l.followUpId === f.id && l.freq === it.freq && l.period === p)?.values?.[it.id]);
          if (p === current && !ok) return;
          rTotal += 1;
          if (ok) rDone += 1;
        });
      });
    });

    // Sessions: attended out of attended + absent (a session nobody has marked yet is not counted).
    let sDone = 0, sTotal = 0;
    sessions.forEach((s) => {
      if (s.date < winStart || s.date > today) return;
      const att = s.attendanceStatus;
      if (s.status === 'Completed' || att === 'Present' || att === 'Late') { sDone += 1; sTotal += 1; }
      else if (att === 'Absent' || att === 'No Show') sTotal += 1;
    });

    // Workouts: suggested workouts marked complete out of those given.
    let wDone = 0, wTotal = 0;
    plans.forEach((p) => {
      if (!p.isSuggestedWorkout || p.date < winStart || p.date > today) return;
      const ok = !!p.clientCompletedAt;
      if (p.date === today && !ok) return;
      wTotal += 1;
      if (ok) wDone += 1;
    });

    const all = [make('diet', 'Diet', dDone, dTotal), make('routine', 'Routine', rDone, rTotal), make('sessions', 'Sessions', sDone, sTotal), make('workouts', 'Workouts', wDone, wTotal)];
    // The recorded-sessions app has no coach sessions to attend.
    return IS_RECORDED ? all.filter((x) => x.key !== 'sessions') : all;
  };
  const parts = useMemo<Part[]>(() => build(DAYS), [meals, planFrom, mealLogs, followUps, routineLogs, sessions, plans, startDate]);
  const allTime = useMemo<Part[]>(() => build('all'), [meals, planFrom, mealLogs, followUps, routineLogs, sessions, plans, startDate]);

  const live = parts.filter((p) => p.frac !== null);
  const overall = live.length ? Math.round((live.reduce((a, p) => a + (p.frac as number), 0) / live.length) * 100) : null;
  const ringColor = overall === null ? 'rgba(255,255,255,0.15)' : consistencyColor(overall / 100);
  const R = 40, C = 2 * Math.PI * R;
  // The share card: the big score, Diet and Routine are the last 30 days (a client can always recover to 100);
  // Workouts is the total number of sessions and suggested workouts done since the start.
  const shareParts = useMemo(() => {
    const by = (k: string) => parts.find((p) => p.key === k);
    const wp = allTime.filter((p) => p.key === 'sessions' || p.key === 'workouts');
    const doneTotal = wp.reduce((a, p) => a + p.done, 0);
    const totalAll = wp.reduce((a, p) => a + p.total, 0);
    const out: { key: string; label: string; frac: number | null; count?: number; sub?: string }[] = [];
    (['diet', 'routine'] as const).forEach((k) => { const p = by(k); if (p) out.push({ key: k, label: p.label, frac: p.frac }); });
    out.push({ key: 'workouts', label: 'Workouts', frac: totalAll > 0 ? Math.min(1, doneTotal / totalAll) : null, count: Math.round(doneTotal) });
    return out;
  }, [parts, allTime]);
  // Other activities: how many different ones this month (football, cricket, badminton ...). Shown above the big score on the share card.
  const variety = useMemo(() => {
    const month = monthKey(new Date());
    return new Set(otherActs.filter((a) => (a.date || '').startsWith(month)).map((a) => String(a.name || '').trim().toLowerCase()).filter(Boolean)).size;
  }, [otherActs]);

  return (
    <>
    <div role="button" tabIndex={0} onClick={() => setShare(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShare(true); }}
      className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-transform">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40 uppercase font-semibold">Your consistency</span>
        <span className="text-[10px] text-white/40">Last {DAYS} days</span>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="relative w-[92px] h-[92px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            {overall !== null && (
              <circle cx="50" cy="50" r={R} fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - overall / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-header text-[26px] text-white leading-none">{overall === null ? '--' : overall}</span>
            <span className="text-[9px] text-white/40 mt-0.5">{overall === null ? 'no data' : 'overall %'}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          {parts.map((p) => {
            const pct = p.frac === null ? null : Math.round(p.frac * 100);
            const col = p.frac === null ? 'rgba(255,255,255,0.2)' : consistencyColor(p.frac);
            return (
              <div key={p.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-white/80">{p.label}</span>
                  <span className="text-[11px] font-mono text-white/60">{pct === null ? 'Not started' : `${pct}%`}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.08] mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, backgroundColor: col, transition: 'width .6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-semibold text-[#6ccbde]">
        <span>Tap to share your card</span>
        <span aria-hidden>›</span>
      </div>
    </div>
    {share && <ConsistencyShare name={clientName || ownName} overall={overall} days={DAYS} parts={shareParts} variety={variety} onClose={() => setShare(false)} />}
    </>
  );
};
