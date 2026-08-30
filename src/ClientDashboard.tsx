import React, { useEffect, useState } from 'react';
import { ScheduleScreen } from './ScheduleScreen';
import { PlansScreen } from './PlansScreen';
import { MiniLineChart } from './MiniLineChart';
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

interface MealEntry {
  id: string;
  mealTime: string;
  description: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

interface DietPlan {
  id: string;
  nutritionistName: string;
  dietType: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  hydrationLiters: number;
  notes: string;
  meals?: MealEntry[];
  lastUpdated: string;
}

type DashboardTab = 'plans' | 'schedule' | 'progress' | 'diet';

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ clientId, clientName }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('plans');

  const [assessments, setAssessments] = useState<AssessmentSnapshot[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [dietPlanLoading, setDietPlanLoading] = useState(true);

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
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setDietPlanLoading(false);
      return;
    }

    // This exact query shape - both where() clauses together - is
    // required to match the Firestore security rule for this
    // collection, same pattern used throughout this file.
    const dietQuery = query(
      collection(db, 'intokine_nutrition_plans'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );

    const unsubscribe = onSnapshot(
      dietQuery,
      (snapshot) => {
        // A client has at most one active diet plan at a time.
        const first = snapshot.docs[0];
        setDietPlan(first ? (first.data() as DietPlan) : null);
        setDietPlanLoading(false);
      },
      (err) => {
        console.warn('Could not load diet plan:', err);
        setDietPlanLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);


  const handleSignOut = async () => {
    const { auth } = initializeClientFirebaseApp();
    if (auth) await signOut(auth);
  };

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'plans', label: 'Plans' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'progress', label: 'Progress' },
    { key: 'diet', label: 'Diet' },
  ];

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Header */}
      <div
        className="px-5 pt-8 pb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1c1c1c 0%, #1c1c1c 55%, rgba(236,34,38,0.12) 100%)' }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-40%',
            right: '-15%',
            width: '140%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #ec2226, #6ccbde, transparent)',
            transform: 'rotate(18deg)',
            opacity: 0.35,
          }}
        />
        <div className="flex items-center justify-between relative z-10 max-w-4xl mx-auto">
          <div>
            <p className="text-[10px] text-white/40 font-semibold tracking-[0.2em]">WELCOME BACK</p>
            <h1 className="font-header text-3xl text-white tracking-wide leading-tight mt-0.5">{clientName.toUpperCase()}</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[10px] text-white/50 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/25 font-bold tracking-[0.15em] transition"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Tabs - underline style, active indicator carries the brand gradient */}
      <div className="px-5 max-w-4xl mx-auto sticky top-0 z-20 bg-[#1c1c1c]/95 backdrop-blur-sm">
        <div className="flex gap-1 border-b border-white/[0.08]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-[11px] font-bold tracking-[0.1em] transition ${
                activeTab === tab.key ? 'text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {tab.label.toUpperCase()}
              {activeTab === tab.key && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans tab */}
      {activeTab === 'plans' && (
        <PlansScreen clientId={clientId} clientName={clientName} />
      )}

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <ScheduleScreen clientId={clientId} clientName={clientName} />
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
            <>
              {(() => {
                // Charts read oldest-to-newest, left-to-right - the
                // opposite order from the cards below, which show
                // newest-first.
                const chronological = [...assessments].reverse();
                const weightData = chronological.map((a) => ({ date: a.date, value: a.weightKg }));
                const bodyFatData = chronological.map((a) => ({ date: a.date, value: a.bodyFatPercentage }));
                const vo2Data = chronological.map((a) => ({ date: a.date, value: a.vo2Max }));
                const muscleData = chronological
                  .filter((a) => a.muscleMassKg != null)
                  .map((a) => ({ date: a.date, value: a.muscleMassKg as number }));

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Body Weight</span>
                      <MiniLineChart data={weightData} color="#ec2226" unit="kg" />
                    </div>
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Body Fat</span>
                      <MiniLineChart data={bodyFatData} color="#f59e0b" unit="%" />
                    </div>
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Skeletal Muscle Mass</span>
                      <MiniLineChart data={muscleData} color="#6ccbde" unit="kg" />
                    </div>
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">VO2 Max</span>
                      <MiniLineChart data={vo2Data} color="#a78bfa" unit="" />
                    </div>
                  </div>
                );
              })()}

              {assessments.map((a) => (
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
              ))}
            </>
          )}
        </div>
      )}

      {/* Diet tab */}
      {activeTab === 'diet' && (
        <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
          {dietPlanLoading ? (
            <div className="text-center py-12 text-white/40 text-sm font-light">Loading your diet plan...</div>
          ) : !dietPlan ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">
                No diet plan shared yet — your nutritionist will share your plan here once it's ready.
              </p>
            </div>
          ) : (
            <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{dietPlan.dietType}</span>
                <span className="text-[10px] text-white/40 font-light">Updated {dietPlan.lastUpdated}</span>
              </div>

              <div className="text-center py-4 rounded-xl relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
                <div className="text-[10px] text-white/40 uppercase font-bold tracking-[0.15em]">Daily Target</div>
                <div className="font-header text-4xl text-white tracking-wide mt-1">{dietPlan.dailyCalories}<span className="text-sm font-light text-white/50 ml-1.5 font-sans">kcal</span></div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <div className="text-[9px] text-white/40 uppercase">Protein</div>
                  <div className="text-sm font-bold text-[#6ccbde] font-mono">{dietPlan.proteinGrams}g</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <div className="text-[9px] text-white/40 uppercase">Carbs</div>
                  <div className="text-sm font-bold text-white font-mono">{dietPlan.carbsGrams}g</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <div className="text-[9px] text-white/40 uppercase">Fats</div>
                  <div className="text-sm font-bold text-[#ec2226] font-mono">{dietPlan.fatGrams}g</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <div className="text-[9px] text-white/40 uppercase">Water</div>
                  <div className="text-sm font-bold text-white font-mono">{dietPlan.hydrationLiters}L</div>
                </div>
              </div>

              {dietPlan.meals && dietPlan.meals.length > 0 && (() => {
                const mealOrder = ['Early Morning', 'Breakfast', 'Mid-Morning Snack', 'Pre-Workout', 'Lunch', 'Evening Snack', 'Pre-Dinner', 'Dinner', 'Post-Workout', 'Before Bed'];
                const sortedMeals = [...dietPlan.meals].sort(
                  (a, b) => mealOrder.indexOf(a.mealTime) - mealOrder.indexOf(b.mealTime)
                );

                return (
                  <div className="space-y-2">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Meals by Time</div>
                    {sortedMeals.map((meal) => (
                      <div key={meal.id} className="bg-white/[0.03] rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-[#6ccbde] uppercase">{meal.mealTime}</span>
                          {meal.calories !== undefined && (
                            <span className="text-[10px] text-white/40 font-mono">{meal.calories} kcal</span>
                          )}
                        </div>
                        <p className="text-xs text-white/90 font-light">{meal.description}</p>
                        {(meal.proteinGrams !== undefined || meal.carbsGrams !== undefined || meal.fatGrams !== undefined) && (
                          <div className="flex items-center gap-3 text-[10px] text-white/40 font-mono">
                            {meal.proteinGrams !== undefined && <span>P {meal.proteinGrams}g</span>}
                            {meal.carbsGrams !== undefined && <span>C {meal.carbsGrams}g</span>}
                            {meal.fatGrams !== undefined && <span>F {meal.fatGrams}g</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {dietPlan.notes && (
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-semibold mb-1">Additional Notes</div>
                  <div className="text-xs text-white/70 font-light whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-3">
                    {dietPlan.notes}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-white/40 font-light">Nutritionist: {dietPlan.nutritionistName}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
