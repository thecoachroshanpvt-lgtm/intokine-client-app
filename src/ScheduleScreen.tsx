import React, { useEffect, useMemo, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  doc,
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

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
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
  const [requestedSessionIds, setRequestedSessionIds] = useState<Set<string>>(new Set());
  const [rescheduleModalSession, setRescheduleModalSession] = useState<ScheduledSession | null>(null);
  const [newDateInput, setNewDateInput] = useState('');
  const [newTimeInput, setNewTimeInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
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

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    const requestsQuery = query(
      collection(db, 'intokine_reschedule_requests'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const pendingSessionIds = new Set(
        snapshot.docs
          .map((d) => d.data())
          .filter((r: any) => r.status === 'Pending')
          .map((r: any) => r.sessionId)
      );
      setRequestedSessionIds(pendingSessionIds);
    });

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

  const renderSessionCard = (s: ScheduledSession) => (
    <div key={s.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{s.date} {s.time && `· ${s.time}`}</div>
          <div className="text-xs text-white/50 font-light mt-0.5">
            {s.sessionType} · {s.location} · Coach {s.coachName}
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
          style={{ color: statusColor(s.status), borderColor: `${statusColor(s.status)}40`, backgroundColor: `${statusColor(s.status)}15` }}
        >
          {s.status.toUpperCase()}
        </span>
      </div>

      {s.status === 'Scheduled' && (
        requestedSessionIds.has(s.id) ? (
          <div className="text-[11px] text-[#6ccbde] font-light">Reschedule requested — waiting on your coach</div>
        ) : (
          <button
            onClick={() => {
              setRescheduleModalSession(s);
              setNewDateInput('');
              setNewTimeInput('');
              setReasonInput('');
            }}
            className="text-[11px] font-semibold text-white/60 hover:text-white border border-white/15 rounded-lg px-3 py-1.5 transition"
          >
            Request Reschedule
          </button>
        )
      )}
    </div>
  );

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

      {rescheduleModalSession && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1c1c1c] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white">Request Reschedule</h4>
              <button onClick={() => setRescheduleModalSession(null)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-white/50 font-light">
              Current: {rescheduleModalSession.date} {rescheduleModalSession.time && `· ${rescheduleModalSession.time}`}
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-white/50 uppercase font-semibold block mb-1">New Date</label>
                <input
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase font-semibold block mb-1">New Time</label>
                <input
                  type="time"
                  value={newTimeInput}
                  onChange={(e) => setNewTimeInput(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase font-semibold block mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. Work conflict"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
                />
              </div>
            </div>

            <button
              disabled={!newDateInput || !newTimeInput || submittingRequest}
              onClick={async () => {
                const { db } = initializeClientFirebaseApp();
                if (!db || !rescheduleModalSession) return;
                setSubmittingRequest(true);
                try {
                  const requestId = `RESCHED-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
                  const requestData: any = {
                    id: requestId,
                    clientId,
                    clientName,
                    sessionId: rescheduleModalSession.id,
                    originalDate: rescheduleModalSession.date,
                    originalTime: rescheduleModalSession.time,
                    requestedDate: newDateInput,
                    requestedTime: newTimeInput,
                    status: 'Pending',
                    createdAt: new Date().toISOString(),
                  };
                  if (reasonInput.trim()) {
                    requestData.reason = reasonInput.trim();
                  }
                  await setDoc(doc(db, 'intokine_reschedule_requests', requestId), requestData);
                  setRescheduleModalSession(null);
                } catch (e) {
                  console.warn('Could not submit reschedule request:', e);
                } finally {
                  setSubmittingRequest(false);
                }
              }}
              className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-xl disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
            >
              {submittingRequest ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
