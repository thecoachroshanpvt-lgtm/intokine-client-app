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
    <div className="min-h-screen bg-[#0c0d10]">
      {/* Header */}
      <div className="px-5 pt-8 pb-6 bg-gradient-to-b from-orange-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400">Welcome back,</p>
            <h1 className="text-xl font-bold text-white">{clientName}</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Plans list */}
      <div className="px-5 pb-8 space-y-3">
        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">Your Training Plans</h2>

        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-sm">Loading your plans...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center">
            <p className="text-sm text-neutral-400">
              Nothing shared yet - your coach will share your training plans here once they're ready.
            </p>
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{plan.planTitle}</span>
                <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                  {plan.date}
                </span>
              </div>
              <div className="text-xs text-neutral-400 flex items-center gap-2 flex-wrap">
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
                <p className="text-xs text-neutral-300">{plan.targetFocus}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
