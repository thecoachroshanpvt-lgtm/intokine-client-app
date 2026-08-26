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

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ clientId, clientName }) => {
  const [plans, setPlans] = useState<VisiblePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
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
        setLoading(false);
      },
      (err) => {
        console.warn('Could not load plans:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  const handleSignOut = async () => {
    const { auth } = initializeClientFirebaseApp();
    if (auth) await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Header */}
      <div
        className="px-5 pt-8 pb-7 relative overflow-hidden"
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

      {/* Plans list */}
      <div className="px-5 pb-8 space-y-3 -mt-1 max-w-4xl mx-auto">
        <h2 className="text-[11px] font-semibold text-[#6ccbde] uppercase tracking-[0.15em] px-1 pt-2">
          Your Training Plans
        </h2>

        {loading ? (
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
    </div>
  );
};
