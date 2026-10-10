import React, { useEffect, useMemo, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
} from './firebase';
import { TrainingScreen } from './TrainingScreen';
import { InlineLoader } from './InlineLoader';

interface ScheduleScreenProps {
  clientId: string;
  clientName: string;
}

interface ScheduledSession {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  coachName: string;
  sessionType: string;
  location: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
}

interface SuggestedPlan {
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
  isSuggestedWorkout?: boolean;
  clientCompletedAt?: string;
}

type ViewMode = 'today' | 'week' | 'month';

// Local calendar date (YYYY-MM-DD). toISOString() would use UTC and shift the
// day for anyone ahead of UTC (e.g. Dubai) during the first hours of the day.
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// "14:00" -> { clock: "2:00", period: "PM" }; anything unexpected is shown as-is.
function formatTime(t: string): { clock: string; period: string } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, period: h >= 12 ? 'PM' : 'AM' };
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ clientId, clientName }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [plans, setPlans] = useState<SuggestedPlan[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<SuggestedPlan | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setSessionsLoading(false);
      return;
    }

    const sessionsQuery = query(
      collection(db, 'intokine_sessions'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as ScheduledSession);
        results.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());
        setSessions(results);
        setSessionsLoading(false);
      },
      (err) => {
        console.warn('Could not load schedule:', err);
        setSessionsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const plansQuery = query(
      collection(db, 'intokine_given_session_plans'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );
    const unsubscribe = onSnapshot(
      plansQuery,
      (snapshot) => setPlans(snapshot.docs.map((d) => d.data() as SuggestedPlan)),
      (err) => console.warn('Could not load suggested workouts:', err)
    );
    return () => unsubscribe();
  }, [clientId]);

  const statusColor = (status: ScheduledSession['status']) => {
    if (status === 'Completed') return '#6ccbde';
    if (status === 'Cancelled') return '#71717a';
    if (status === 'Postponed') return '#f59e0b';
    return '#ec2226';
  };

  const todayKey = toDateKey(new Date());
  const todaysWorkouts = plans.filter((p) => p.date === todayKey);

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === todayKey),
    [sessions, todayKey]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const monthGrid = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = startOfWeek(firstOfMonth);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [monthCursor]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, ScheduledSession[]> = {};
    sessions.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [sessions]);

  const renderSessionCard = (s: ScheduledSession) => {
    const d = parseDateKey(s.date);
    const t = formatTime(s.time);
    const color = statusColor(s.status);
    return (
      <div key={s.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3 flex items-center gap-3">
        <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">
            {d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
          </div>
          <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{d ? d.getDate() : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
            {d ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            {t ? (
              <>
                <span className="text-base font-semibold font-mono text-white leading-none">{t.clock}</span>
                <span className="text-[10px] font-bold text-white/50">{t.period}</span>
              </>
            ) : (
              <span className="text-sm font-bold text-white">{s.time || 'Time TBC'}</span>
            )}
          </div>
          <div className="text-xs font-semibold text-white/80 mt-1 truncate">{s.sessionType}</div>
          <div className="text-[11px] text-white/40 font-light truncate">{s.location} · Coach {s.coachName}</div>
        </div>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
          style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
        >
          {s.status.toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {/* View mode toggle */}
      <div className="flex gap-2 bg-white/[0.04] rounded-xl p-1">
        {(['today', 'week', 'month'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode);
              setSelectedMonthDay(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === mode ? 'bg-white/[0.1] text-white' : 'text-white/40'
            }`}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      {sessionsLoading ? (
        <InlineLoader />
      ) : (
        <>
          {viewMode === 'today' && (
            <div className="space-y-2">
              {todaySessions.length === 0 ? (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">Nothing scheduled for today.</p>
                </div>
              ) : (
                todaySessions.map(renderSessionCard)
              )}
              {todaysWorkouts.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] text-white/40 uppercase font-semibold block">Suggested workout</span>
                  {todaysWorkouts.map((w) => {
                    const done = !!w.clientCompletedAt;
                    const color = done ? '#34d399' : '#ec2226';
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWorkout(w)}
                        className="w-full text-left bg-gradient-to-br from-[#ec2226]/20 to-[#6ccbde]/15 hover:from-[#ec2226]/25 hover:to-[#6ccbde]/20 border border-[#6ccbde]/20 rounded-2xl p-4 flex items-center gap-3 transition"
                      >
                        <div className="w-12 h-12 shrink-0 rounded-full bg-[#0b0c10]/60 border border-white/10 flex items-center justify-center">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6ccbde" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">Do it yourself</div>
                          <div className="text-base font-bold text-white mt-1.5 truncate">{w.planTitle}</div>
                          <div className="text-[11px] text-white/50 font-light truncate">
                            Do it any time today
                            {w.durationMinutes ? ` · ${w.durationMinutes} mins` : ''}
                          </div>
                        </div>
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
                          style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                        >
                          {done ? 'DONE' : 'ASSIGNED'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewMode === 'week' && (() => {
            const activeKey = selectedWeekDay && weekDays.some((d) => toDateKey(d) === selectedWeekDay) ? selectedWeekDay : todayKey;
            const activeDate = weekDays.find((d) => toDateKey(d) === activeKey) || weekDays[0];
            const daySessions = sessionsByDate[activeKey] || [];
            const dayWorkouts = plans.filter((p) => p.date === activeKey);
            const weekSessionCount = weekDays.reduce((n, d) => n + (sessionsByDate[toDateKey(d)] || []).length, 0);
            const weekWorkoutCount = weekDays.reduce((n, d) => n + plans.filter((p) => p.date === toDateKey(d)).length, 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((d) => {
                    const key = toDateKey(d);
                    const isActive = key === activeKey;
                    const isToday = key === todayKey;
                    const hasSession = (sessionsByDate[key] || []).length > 0;
                    const hasWorkout = plans.some((p) => p.date === key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedWeekDay(key)}
                        className={`rounded-xl py-2.5 flex flex-col items-center gap-1 border transition ${
                          isActive
                            ? 'bg-gradient-to-b from-[#ec2226]/25 to-[#6ccbde]/20 border-[#6ccbde]/50'
                            : 'bg-[#242426] border-white/[0.06]'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-wide ${isToday ? 'text-[#6ccbde]' : 'text-white/40'}`}>
                          {d.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span className={`text-base font-semibold font-mono leading-none ${isActive ? 'text-white' : 'text-white/80'}`}>{d.getDate()}</span>
                        <span className="flex gap-1 h-1.5">
                          {hasSession && <span className="w-1.5 h-1.5 rounded-full bg-[#ec2226]" />}
                          {hasWorkout && <span className="w-1.5 h-1.5 rounded-full bg-[#6ccbde]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-[#ec2226]" />Coach sessions</div>
                    <div className="text-2xl font-semibold font-mono text-white mt-1">{weekSessionCount}</div>
                  </div>
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/40"><span className="w-1.5 h-1.5 rounded-full bg-[#6ccbde]" />Suggested workouts</div>
                    <div className="text-2xl font-semibold font-mono text-white mt-1">{weekWorkoutCount}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide block ${activeKey === todayKey ? 'text-[#6ccbde]' : 'text-white/40'}`}>
                    {activeDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    {activeKey === todayKey && ' · Today'}
                  </span>
                  {daySessions.length === 0 && dayWorkouts.length === 0 ? (
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                      <p className="text-sm text-white/50 font-light leading-relaxed">No session or workout on this day.</p>
                    </div>
                  ) : (
                    <>
                      {daySessions.map(renderSessionCard)}
                      {dayWorkouts.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setSelectedWorkout(w)}
                          className="w-full text-left bg-gradient-to-br from-[#ec2226]/20 to-[#6ccbde]/15 border border-[#6ccbde]/20 rounded-2xl p-4 flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">Suggested workout</div>
                            <div className="text-base font-bold text-white mt-1.5 truncate">{w.planTitle}</div>
                            {w.durationMinutes ? <div className="text-[11px] text-white/50 font-light">{w.durationMinutes} mins</div> : null}
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start" style={{ color: w.clientCompletedAt ? '#34d399' : '#ec2226', borderColor: w.clientCompletedAt ? '#34d39940' : '#ec222640' }}>
                            {w.clientCompletedAt ? 'DONE' : 'ASSIGNED'}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {viewMode === 'month' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                  className="text-white/50 hover:text-white px-2"
                >
                  ←
                </button>
                <span className="text-sm font-semibold text-white">
                  {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                  className="text-white/50 hover:text-white px-2"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 font-semibold uppercase">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((d) => {
                  const key = toDateKey(d);
                  const inMonth = d.getMonth() === monthCursor.getMonth();
                  const hasSession = !!sessionsByDate[key]?.length;
                  const isToday = key === todayKey;
                  if (selectedWorkout) {
    return (
      <TrainingScreen
        workout={{
          id: selectedWorkout.id,
          date: selectedWorkout.date,
          planTitle: selectedWorkout.planTitle,
          category: selectedWorkout.category,
          planDetails: selectedWorkout.planDetails || '',
          targetFocus: selectedWorkout.targetFocus || '',
          durationMinutes: selectedWorkout.durationMinutes || 0,
          rpeTarget: selectedWorkout.rpeTarget || 0,
          coachName: selectedWorkout.coachName,
          coachSessionNotes: selectedWorkout.coachSessionNotes,
          structuredExercises: selectedWorkout.structuredExercises,
          clientCompletedAt: selectedWorkout.clientCompletedAt,
        }}
        onBack={() => setSelectedWorkout(null)}
        onMarkedComplete={() => {
          setPlans((prev) => prev.map((p) => (p.id === selectedWorkout.id ? { ...p, clientCompletedAt: new Date().toISOString() } : p)));
        }}
      />
    );
  }

  return (
                    <button
                      key={key}
                      onClick={() => setSelectedMonthDay(key)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative ${
                        inMonth ? 'text-white' : 'text-white/20'
                      } ${selectedMonthDay === key ? 'bg-white/[0.15]' : 'hover:bg-white/[0.06]'} ${isToday ? 'border border-[#6ccbde]/50' : ''}`}
                    >
                      {d.getDate()}
                      {hasSession && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#ec2226]" />}
                    </button>
                  );
                })}
              </div>

              {selectedMonthDay && (
                <div className="space-y-2 pt-2">
                  {(sessionsByDate[selectedMonthDay] || []).length === 0 ? (
                    <div className="text-xs text-white/40 font-light text-center py-4">No session on this day.</div>
                  ) : (
                    (sessionsByDate[selectedMonthDay] || []).map(renderSessionCard)
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
