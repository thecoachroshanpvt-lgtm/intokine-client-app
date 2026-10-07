import React, { useEffect, useMemo, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
} from './firebase';

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
  const [monthCursor, setMonthCursor] = useState(() => new Date());
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

  const statusColor = (status: ScheduledSession['status']) => {
    if (status === 'Completed') return '#6ccbde';
    if (status === 'Cancelled') return '#71717a';
    if (status === 'Postponed') return '#f59e0b';
    return '#ec2226';
  };

  const todayKey = toDateKey(new Date());

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
          <div className="font-header text-2xl text-white leading-none mt-1.5 mb-1 tabular-nums">{d ? d.getDate() : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
            {d ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            {t ? (
              <>
                <span className="font-header text-2xl text-white leading-none tabular-nums tracking-wide">{t.clock}</span>
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
        <div className="text-center py-12 text-white/40 text-sm font-light">Loading your schedule...</div>
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
            </div>
          )}

          {viewMode === 'week' && (
            <div className="space-y-2">
              {weekDays.map((d) => {
                const key = toDateKey(d);
                const daySessions = sessionsByDate[key] || [];
                const isToday = key === todayKey;
                return (
                  <div key={key}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${isToday ? 'text-[#6ccbde]' : 'text-white/40'}`}>
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {isToday && ' · Today'}
                    </div>
                    {daySessions.length === 0 ? (
                      <div className="text-xs text-white/30 font-light pb-2">No session</div>
                    ) : (
                      <div className="space-y-2 pb-2">{daySessions.map(renderSessionCard)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
