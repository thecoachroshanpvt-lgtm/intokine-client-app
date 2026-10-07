import React, { useEffect, useState } from 'react';
import { ScheduleScreen } from './ScheduleScreen';
import { PlansScreen } from './PlansScreen';
import { ProgressScreen } from './ProgressScreen';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
  signOut,
} from './firebase';

// Builds a wa.me deep link from whatever format the contact number
// was stored in - strips everything but digits, since wa.me requires
// the full international number with no symbols or spaces.
function buildWhatsAppLink(contact: string): string {
  const digitsOnly = contact.replace(/\D/g, '');
  return `https://wa.me/${digitsOnly}`;
}

const MEAL_TIME_ICONS: Record<string, string> = {
  'Early Morning': '🌅',
  'Breakfast': '🍳',
  'Mid-Morning Snack': '🍎',
  'Pre-Workout': '⚡',
  'Lunch': '🥗',
  'Evening Snack': '🥤',
  'Pre-Dinner': '🍲',
  'Dinner': '🍽️',
  'Post-Workout': '🥤',
  'Before Bed': '🌙',
};

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
  nutritionistContact?: string;
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

  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [dietPlanLoading, setDietPlanLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-[#1c1c1c] pb-20">
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
        <ProgressScreen clientId={clientId} />
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
              {/* Hero visual - an illustrated healthy plate, not a stock photo, so it stays consistent and license-free */}
              <div
                className="relative -mx-4 -mt-4 h-28 rounded-t-2xl overflow-hidden flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(236,34,38,0.18), rgba(28,28,28,0.95) 55%, rgba(108,203,222,0.18))' }}
              >
                <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
                  {/* Plate */}
                  <circle cx="44" cy="44" r="30" fill="#2c2c2e" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
                  <circle cx="44" cy="44" r="22" stroke="white" strokeOpacity="0.12" strokeWidth="1" />

                  {/* Leafy greens */}
                  <path d="M30 38c-4-3-6-8-4-13 5 1 9 4 11 8 1 3 0 6-2 8-2 1-4 0-5-3z" fill="#4ade80" opacity="0.85" />
                  <path d="M35 40c-2-5-1-10 3-14 4 3 6 8 5 12-1 3-3 5-5 5-2 0-3-1-3-3z" fill="#22c55e" opacity="0.85" />

                  {/* Grilled protein */}
                  <ellipse cx="53" cy="46" rx="11" ry="7" fill="#c2683a" opacity="0.9" />
                  <path d="M44 43l6 6M47 42l6 6M50 41l5 5" stroke="#8a4423" strokeWidth="0.8" opacity="0.6" />

                  {/* Cherry tomato / citrus accent */}
                  <circle cx="35" cy="53" r="4.5" fill="#ec2226" />
                  <path d="M35 49l1 -2" stroke="#4ade80" strokeWidth="1" strokeLinecap="round" />

                  {/* Grain scoop */}
                  <ellipse cx="52" cy="56" rx="7" ry="4.5" fill="#f5d59a" opacity="0.9" />

                  {/* Fork and knife */}
                  <g opacity="0.5" stroke="white" strokeWidth="1.3" strokeLinecap="round">
                    <path d="M14 20v48" />
                    <path d="M11 20v10M14 20v10M17 20v10" />
                    <path d="M74 20v48" />
                    <path d="M74 20c3 0 5 3 5 7s-2 7-5 7" fill="none" />
                  </g>
                </svg>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{dietPlan.dietType}</span>
                <span className="text-[10px] text-white/40 font-light">Updated {dietPlan.lastUpdated}</span>
              </div>

              <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3">
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-semibold">Nutritionist</div>
                  <div className="text-sm text-white font-semibold">{dietPlan.nutritionistName}</div>
                </div>
                {dietPlan.nutritionistContact && (
                  <a
                    href={buildWhatsAppLink(dietPlan.nutritionistContact)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] border border-[#25D366]/30 rounded-lg px-3 py-1.5 hover:bg-[#25D366]/10 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2m0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.55-3.7 8.23-8.25 8.23m4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.78.97-.15.17-.29.19-.53.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.47-1.37-1.72-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.24.25-.4.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.67.31c-.23.25-.87.86-.87 2.09 0 1.23.9 2.42 1.02 2.58.12.17 1.76 2.68 4.27 3.76.6.26 1.06.41 1.43.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28" />
                    </svg>
                    Chat
                  </a>
                )}
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
                          <span className="text-[10px] font-semibold text-[#6ccbde] uppercase flex items-center gap-1.5">
                            <span className="text-sm">{MEAL_TIME_ICONS[meal.mealTime] || '🍴'}</span>
                            {meal.mealTime}
                          </span>
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
            </div>
          )}
        </div>
      )}

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#1c1c1c]/95 backdrop-blur-md border-t border-white/[0.08]">
        <div className="flex items-center justify-around max-w-4xl mx-auto px-2 py-2">
          {[
            {
              key: 'plans' as DashboardTab,
              label: 'Plans',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3" />
                  <path d="M9 12h6M9 16h6" />
                </svg>
              ),
            },
            {
              key: 'schedule' as DashboardTab,
              label: 'Schedule',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2v4M16 2v4" />
                </svg>
              ),
            },
            {
              key: 'progress' as DashboardTab,
              label: 'Progress',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <path d="M4 19V13M10 19V9M16 19V5M22 19H2" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              key: 'diet' as DashboardTab,
              label: 'Diet',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <path d="M7 2v6a2 2 0 0 0 4 0V2M9 8v14M18 2c-2 1-3 3-3 6s1 5 3 6v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 relative"
              >
                {active && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
                  />
                )}
                <span className={active ? '' : 'text-white/40'}>{tab.icon(active)}</span>
                <span className={`text-[9px] font-bold tracking-wide ${active ? 'text-white' : 'text-white/40'}`}>
                  {tab.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
