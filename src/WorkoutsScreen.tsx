import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot } from './firebase';
import { TrainingScreen } from './TrainingScreen';
import { SuggestedWorkoutCard } from './SuggestedWorkoutCard';
import { InlineLoader } from './InlineLoader';

// Workouts tab of the recorded-sessions app. There are no coach sessions to schedule, so this is simply
// the list of workouts the coach has sent: today and upcoming first, then the ones already done or past.

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
  const open = plans.filter((p) => !p.clientCompletedAt && p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const earlier = plans.filter((p) => p.clientCompletedAt || p.date < today).sort((a, b) => b.date.localeCompare(a.date));

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

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-5">
      {loading ? (
        <InlineLoader />
      ) : plans.length === 0 ? (
        <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="font-subheader text-[17px] text-white">No workouts yet</p>
          <p className="text-[11px] text-white/50 font-light mt-1">Your coach will send your workouts here. Do them any time and mark them done.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <span className="text-[11px] text-white/40 uppercase font-semibold block">To do</span>
            {open.length === 0 ? <p className="text-xs text-white/40 font-light">You are all caught up.</p> : open.map(card)}
          </div>
          {earlier.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-white/40 uppercase font-semibold block">Earlier</span>
              {earlier.map(card)}
            </div>
          )}
        </>
      )}
    </div>
  );
};
