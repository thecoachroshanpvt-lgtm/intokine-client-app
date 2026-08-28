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

interface AssessmentSnapshot {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercentage: number;
  vo2Max: number;
  benchPress1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
  targetMilestone?: string;
}

type DashboardTab = 'plans' | 'schedule' | 'progress';

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ clientId, clientName }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('plans');

  const [plans, setPlans] = useState<VisiblePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSnapshot[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
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

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setAssessmentsLoading(false);
      return;
    }

    // This exact query shape - both where() clauses together - is
    // required to match the Firestore security rule for this
    // collection, same pattern as the training plans query above.
    const assessmentsQuery = query(
      collection(db, 'intokine_assessments'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );

    const unsubscribe = onSnapshot(
      assessmentsQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as AssessmentSnapshot);
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAssessments(results);
        setAssessmentsLoading(false);
      },
      (err) => {
        console.warn('Could not load progress:', err);
        setAssessmentsLoading(false);
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
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'progress' ? 'bg-white/[0.08] text-white' : 'text-white/40'
            }`}
          >
            PROGRESS
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

      {/* Progress tab */}
      {activeTab === 'progress' && (
        <div className="px-5 pb-8 pt-4 space-y-3 max-w-4xl mx-auto">
          {assessmentsLoading ? (
            <div className="text-center py-12 text-white/40 text-sm font-light">Loading your progress...</div>
          ) : assessments.length === 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">
                No progress reports shared yet — your coach will share your assessment results here.
              </p>
            </div>
          ) : (
            assessments.map((a) => (
              <div key={a.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                <div className="text-sm font-semibold text-white">{a.date}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <div className="text-[9px] text-white/40 uppercase">Weight</div>
                    <div className="text-sm font-bold text-white font-mono">{a.weightKg} kg</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <div className="text-[9px] text-white/40 uppercase">Body Fat</div>
                    <div className="text-sm font-bold text-white font-mono">{a.bodyFatPercentage}%</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-2">
                    <div className="text-[9px] text-white/40 uppercase">VO2 Max</div>
                    <div className="text-sm font-bold text-white font-mono">{a.vo2Max}</div>
                  </div>
                </div>
                {(a.benchPress1RM || a.squat1RM || a.deadlift1RM) && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {a.benchPress1RM && (
                      <div className="bg-white/[0.03] rounded-xl p-2">
                        <div className="text-[9px] text-white/40 uppercase">Bench 1RM</div>
                        <div className="text-sm font-bold text-[#ec2226] font-mono">{a.benchPress1RM} kg</div>
                      </div>
                    )}
                    {a.squat1RM && (
                      <div className="bg-white/[0.03] rounded-xl p-2">
                        <div className="text-[9px] text-white/40 uppercase">Squat 1RM</div>
                        <div className="text-sm font-bold text-[#ec2226] font-mono">{a.squat1RM} kg</div>
                      </div>
                    )}
                    {a.deadlift1RM && (
                      <div className="bg-white/[0.03] rounded-xl p-2">
                        <div className="text-[9px] text-white/40 uppercase">Deadlift 1RM</div>
                        <div className="text-sm font-bold text-[#ec2226] font-mono">{a.deadlift1RM} kg</div>
                      </div>
                    )}
                  </div>
                )}
                {a.targetMilestone && (
                  <div className="text-xs text-[#6ccbde] font-light">🎯 {a.targetMilestone}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
