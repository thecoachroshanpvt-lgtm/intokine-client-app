import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot } from './firebase';
import { TrainingScreen } from './TrainingScreen';
import { SuggestedWorkoutCard } from './SuggestedWorkoutCard';
import { InlineLoader } from './InlineLoader';

// Workouts tab of the recorded-sessions app. There are no coach sessions to schedule, so this is simply
// the workouts the coach has sent, viewed by Today, Week, Month and History.

interface Plan {
  id: string;
  planTitle: string;
  date: string;
  category: string;
  coachName: string;
  durationMinutes?: number;
  targetFocus?: string;
  planDetails?: string;
  rpeTarget?: number;
  coachSessionNotes?: string;
  structuredExercises?: any[];
  clientCompletedAt?: string;
}

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pretty = (k: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : k;
};

export const WorkoutsScreen: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [view, setView] = useState<'today' | 'week' | 'month' | 'history'>('today');
  const [anchor, setAnchor] = useState(dateKey(new Date()));
  const [selDay, setSelDay] = useState<string | null>(null);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'intokine_given_session_plans'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => { setPlans(snap.docs.map((d) => d.data() as Plan)); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [clientId]);

  if (selected) {
    return (
      <TrainingScreen
        clientId={clientId}
        workout={{
          id: selected.id,
          date: selected.date,
          planTitle: selected.planTitle,
          category: selected.category,
          planDetails: selected.planDetails || '',
          targetFocus: selected.targetFocus || '',
          durationMinutes: selected.durationMinutes || 0,
          rpeTarget: selected.rpeTarget || 0,
          coachName: selected.coachName,
          coachSessionNotes: selected.coachSessionNotes,
          structuredExercises: selected.structuredExercises,
          clientCompletedAt: selected.clientCompletedAt,
        }}
        onBack={() => setSelected(null)}
        onMarkedComplete={() => setPlans((prev) => prev.map((p) => (p.id === selected.id ? { ...p, clientCompletedAt: new Date().toISOString() } : p)))}
      />
    );
  }

  const today = dateKey(new Date());
  const byDate = (a: Plan, b: Plan) => a.date.localeCompare(b.date);
  const addDays = (k: string, n: number) => { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return dateKey(d); };

  // Week (Monday to Sunday) and month (calendar) around the date being looked at.
  const base = new Date(anchor + 'T00:00:00');
  const weekStart = addDays(anchor, -((base.getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const monthPrefix = anchor.slice(0, 7);
  const first = new Date(monthPrefix + '-01T00:00:00');
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;

  const step = (dir: -1 | 1) => {
    if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(dateKey(new Date(first.getFullYear(), first.getMonth() + dir, 1)));
  };
  const rangeLabel = view === 'week'
    ? `${pretty(weekStart)} to ${pretty(weekEnd)}`
    : first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const todays = plans.filter((p) => p.date === today).sort(byDate);
  const upcomingCount = plans.filter((p) => p.date > today && !p.clientCompletedAt).length;
  const weekPlans = plans.filter((p) => p.date >= weekStart && p.date <= weekEnd).sort(byDate);
  const monthPlans = plans.filter((p) => p.date.startsWith(monthPrefix)).sort(byDate);
  const history = plans.filter((p) => p.clientCompletedAt || p.date < today).sort((a, b) => b.date.localeCompare(a.date));

  const card = (p: Plan) => (
    <SuggestedWorkoutCard
      key={p.id}
      title={p.planTitle}
      label={p.date === today ? 'Today' : pretty(p.date)}
      hint={`${p.structuredExercises?.length || 0} exercises${p.durationMinutes ? ` · ${p.durationMinutes} mins` : ''}`}
      done={!!p.clientCompletedAt}
      onClick={() => setSelected(p)}
    />
  );
  const grouped = (list: Plan[]) => {
    const dates = Array.from(new Set(list.map((p) => p.date)));
    return dates.map((d) => (
      <div key={d} className="space-y-2">
        <span className="text-[11px] text-white/40 uppercase font-semibold block">{d === today ? 'Today' : pretty(d)}</span>
        {list.filter((p) => p.date === d).map(card)}
      </div>
    ));
  };
  const empty = (msg: string) => <p className="text-xs text-white/40 font-light text-center py-6">{msg}</p>;
  const nav = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => step(-1)} className="px-3 py-1.5 rounded-lg border border-white/[0.12] text-white/70 text-sm" aria-label="Previous">‹</button>
      <span className="text-xs font-bold text-white">{rangeLabel}</span>
      <button type="button" onClick={() => step(1)} className="px-3 py-1.5 rounded-lg border border-white/[0.12] text-white/70 text-sm" aria-label="Next">›</button>
    </div>
  );

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {loading ? (
        <InlineLoader />
      ) : plans.length === 0 ? (
        <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="font-subheader text-[17px] text-white">No workouts yet</p>
          <p className="text-[11px] text-white/50 font-light mt-1">Your coach will send your workouts here. Do them any time and mark them done.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#252525] border border-white/[0.06]">
            {([['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['history', 'History']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setView(k); setAnchor(today); }}
                className={`py-2 rounded-lg text-[11px] font-bold ${view === k ? 'bg-[#6ccbde] text-[#1c1c1c]' : 'text-white/50'}`}>{l}</button>
            ))}
          </div>

          {view === 'today' && (
            <div className="space-y-2">
              {todays.length === 0 ? empty('No workout for today.') : todays.map(card)}
              {upcomingCount > 0 && <p className="text-[11px] text-white/40 font-light text-center pt-2">{upcomingCount} more coming up. See Week or Month.</p>}
            </div>
          )}

          {view === 'week' && (() => {
            const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
            const activeKey = selDay && weekDays.includes(selDay) ? selDay : weekDays.includes(today) ? today : weekStart;
            const dayPlans = weekPlans.filter((p) => p.date === activeKey);
            return (
              <div className="space-y-4">
                {nav}
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((k) => {
                    const d = new Date(k + 'T00:00:00');
                    const isActive = k === activeKey;
                    const isToday = k === today;
                    const has = weekPlans.some((p) => p.date === k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSelDay(k)}
                        className={`rounded-xl py-2.5 flex flex-col items-center gap-1 border transition ${
                          isActive ? 'bg-gradient-to-b from-[#6ccbde]/25 to-[#6ccbde]/10 border-[#6ccbde]/50' : 'bg-[#252525] border-white/[0.06]'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-wide ${isToday ? 'text-[#6ccbde]' : 'text-white/40'}`}>
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span className={`text-base font-semibold font-mono leading-none ${isActive ? 'text-white' : 'text-white/80'}`}>{d.getDate()}</span>
                        <span className="flex gap-1 h-1.5">{has && <span className="w-1.5 h-1.5 rounded-full bg-[#6ccbde]" />}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-[#252525] border border-white/[0.06] rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-[#6ccbde]" />Workouts this week</div>
                  <div className="text-2xl font-semibold font-mono text-white mt-1">{weekPlans.length}</div>
                </div>

                <div className="space-y-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide block ${activeKey === today ? 'text-[#6ccbde]' : 'text-white/40'}`}>
                    {new Date(activeKey + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    {activeKey === today && ' · Today'}
                  </span>
                  {dayPlans.length === 0 ? (
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                      <p className="text-sm text-white/50 font-light leading-relaxed">No workout on this day.</p>
                    </div>
                  ) : (
                    dayPlans.map(card)
                  )}
                </div>
              </div>
            );
          })()}

          {view === 'month' && (
            <div className="space-y-4">
              {nav}
              <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-3">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <div key={i} className="text-[9px] font-bold text-white/35">{l}</div>)}
                  {Array.from({ length: lead }).map((_, i) => <div key={'b' + i} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const k = `${monthPrefix}-${String(i + 1).padStart(2, '0')}`;
                    const day = monthPlans.filter((p) => p.date === k);
                    const allDone = day.length > 0 && day.every((p) => p.clientCompletedAt);
                    const missed = day.length > 0 && !allDone && k < today;
                    return (
                      <div key={k} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-mono ${k === today ? 'ring-1 ring-[#6ccbde]' : ''} ${day.length ? (allDone ? 'bg-emerald-400/20 text-emerald-300' : missed ? 'bg-white/[0.06] text-white/50' : 'bg-[#6ccbde]/20 text-[#6ccbde]') : 'text-white/30'}`}>
                        <span className="font-bold">{i + 1}</span>
                        {day.length > 0 && <span className="w-1 h-1 rounded-full bg-current mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-3 text-[9px] text-white/40 mt-2">
                  <span><i className="inline-block w-2 h-2 rounded-sm bg-[#6ccbde]/50 mr-1" />Scheduled</span>
                  <span><i className="inline-block w-2 h-2 rounded-sm bg-emerald-400/50 mr-1" />Done</span>
                  <span><i className="inline-block w-2 h-2 rounded-sm bg-white/20 mr-1" />Not done</span>
                </div>
              </div>
              {monthPlans.length === 0 ? empty('No workouts this month.') : grouped(monthPlans)}
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-4">
              {history.length === 0 ? empty('Nothing here yet. Finished and past workouts show here.') : grouped(history)}
            </div>
          )}
        </>
      )}
    </div>
  );
};
