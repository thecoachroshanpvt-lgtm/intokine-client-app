import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
  signOut,
} from './firebase';

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
}

interface VisiblePlan {
  id: string;
  planTitle: string;
  date: string;
  category: string;
  coachName: string;
  durationMinutes?: number;
  targetFocus?: string;
}

interface ScheduledSession {
  id: string;
  date: string;
  time: string;
  coachName: string;
  sessionType: string;
  location: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
}

type DashboardTab = 'plans' | 'schedule';

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ clientId, clientName }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('plans');

  const [plans, setPlans] = useState<VisiblePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setPlansLoading(false);
      return;
    }

    // This exact query shape - both where() clauses together - is
    // required to match the Firestore security rule for this
    // collection. A broader query (or missing either clause) would
    // be rejected outright as insufficient permissions, even though
    // individual matching documents are readable.
    const plansQuery = query(
      collection(db, 'intokine_given_session_plans'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );

    const unsubscribe = onSnapshot(
      plansQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as VisiblePlan);
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPlans(results);
        setPlansLoading(false);
      },
      (err) => {
        console.warn('Could not load plans:', err);
        setPlansLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

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

  const handleSignOut = async () => {
    const { auth } = initializeClientFirebaseApp();
    if (auth) await signOut(auth);
  };

  const statusColor = (status: ScheduledSession['status']) => {
    if (status === 'Completed') return '#6ccbde';
    if (status === 'Cancelled') return '#71717a';
    if (status === 'Postponed') return '#f59e0b';
    return '#ec2226';
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Header */}
      <div
        className="px-5 pt-8 pb-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1c1c1c 0%, #1c1c1c 60%, rgba(236,34,38,0.15) 100%)' }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-30%',
            right: '-10%',
            width: '120%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #6ccbde, transparent)',
            transform: 'rotate(20deg)',
            opacity: 0.4,
          }}
        />
        <div className="flex items-center justify-between relative z-10 max-w-4xl mx-auto">
          <div>
            <p className="text-[11px] text-white/50 font-light tracking-wide">WELCOME BACK</p>
            <h1 className="font-header text-2xl text-white tracking-wide">{clientName.toUpperCase()}</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[11px] text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/15 font-semibold tracking-wide"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 max-w-4xl mx-auto">
        <div className="flex gap-2 border-b border-white/[0.08] pb-3">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'plans' ? 'bg-white/[0.08] text-white' : 'text-white/40'
            }`}
          >
            PLANS
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'schedule' ? 'bg-white/[0.08] text-white' : 'text-white/40'
            }`}
          >
            SCHEDULE
          </button>
        </div>
      </div>

      {/* Plans tab */}
      {activeTab === 'plans' && (
        <div className="px-5 pb-8 pt-4 space-y-3 max-w-4xl mx-auto">
          {plansLoading ? (
            <div className="text-center py-12 text-white/40 text-sm font-light">Loading your plans...</div>
          ) : plans.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">
                Nothing shared yet — your coach will share your training plans here once they're ready.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{plan.planTitle}</span>
                    <span className="text-[10px] font-semibold text-[#ec2226] bg-[#ec2226]/10 px-2 py-0.5 rounded-full border border-[#ec2226]/25 whitespace-nowrap">
                      {plan.date}
                    </span>
                  </div>
                  <div className="text-xs text-white/50 font-light flex items-center gap-2 flex-wrap">
                    <span>{plan.category}</span>
                    {plan.durationMinutes && (
                      <>
                        <span>·</span>
                        <span>{plan.durationMinutes} mins</span>
                      </>
                    )}
                    <span>·</span>
                    <span>Coach {plan.coachName}</span>
                  </div>
                  {plan.targetFocus && (
                    <p className="text-xs text-white/70 font-light">{plan.targetFocus}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <div className="px-5 pb-8 pt-4 space-y-2 max-w-4xl mx-auto">
          {sessionsLoading ? (
            <div className="text-center py-12 text-white/40 text-sm font-light">Loading your schedule...</div>
          ) : sessions.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">
                No sessions scheduled yet — your coach will book your sessions here.
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between gap-3">
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
            ))
          )}
        </div>
      )}
    </div>
  );
};
