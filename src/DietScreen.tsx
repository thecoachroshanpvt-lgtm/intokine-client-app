import React, { useEffect, useMemo, useState } from 'react';
import { SupplementsCard } from './SupplementsCard';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc } from './firebase';

// Builds a wa.me deep link from whatever format the contact number was stored in.
function buildWhatsAppLink(contact: string): string {
  return `https://wa.me/${contact.replace(/\D/g, '')}`;
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
const MEAL_ORDER = Object.keys(MEAL_TIME_ICONS);

interface MealItem {
  id: string;
  name: string;
  portion: string;
}

interface MealVariant {
  id: string;
  label?: string;
  items: MealItem[];
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

interface MealEntry {
  id: string;
  mealTime: string;
  description: string;
  variants?: MealVariant[];
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
  supplements?: { id: string; name: string; detail?: string }[];
  lastUpdated: string;
}

interface MealLog {
  date: string;
  eaten: string[];
  supplementsTaken?: string[];
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DietScreen: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [saveError, setSaveError] = useState('');
  const [pickedVar, setPickedVar] = useState<Record<string, number>>({}); // which option tab is open on each meal
  // Re-check the date once a minute so the checklist resets at midnight.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const today = dateKey(new Date());

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
      return;
    }
    // Both where() clauses together are required by the Firestore security rule for this collection.
    const unsub = onSnapshot(
      query(collection(db, 'intokine_nutrition_plans'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => {
        const first = snap.docs[0];
        setPlan(first ? (first.data() as DietPlan) : null);
        setLoading(false);
      },
      (err) => {
        console.warn('Could not load diet plan:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'intokine_meal_logs'), where('clientId', '==', clientId)),
      (snap) => setLogs(snap.docs.map((d) => d.data() as MealLog)),
      (err) => console.warn('Could not load meal log:', err)
    );
    return () => unsub();
  }, [clientId]);

  const meals = useMemo(
    () => [...(plan?.meals || [])].sort((a, b) => MEAL_ORDER.indexOf(a.mealTime) - MEAL_ORDER.indexOf(b.mealTime)),
    [plan]
  );
  const mealIds = new Set(meals.map((m) => m.id));
  const todayLog = logs.find((l) => l.date === today);
  const eatenToday = new Set((todayLog?.eaten || []).filter((id) => mealIds.has(id)));

  const suppTaken = new Set(todayLog?.supplementsTaken || []);
  const toggleSupplement = async (id: string) => {
    const next = new Set(suppTaken);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const supplementsTaken = Array.from(next);
    setLogs((prev) => [...prev.filter((l) => l.date !== today), { eaten: [], ...(prev.find((l) => l.date === today) || {}), date: today, supplementsTaken }]);
    setSaveError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_meal_logs', `${clientId}_${today}`), { clientId, date: today, supplementsTaken, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Could not save supplement tick:', e);
      setSaveError('Could not save that tick. Please check your connection and try again.');
    }
  };

  const toggleMeal = async (mealId: string) => {
    const next = new Set(eatenToday);
    if (next.has(mealId)) next.delete(mealId);
    else next.add(mealId);
    const eaten = Array.from(next);
    // Show the tick straight away; the database listener confirms it.
    setLogs((prev) => {
      const others = prev.filter((l) => l.date !== today);
      return [...others, { ...(prev.find((l) => l.date === today) || {}), date: today, eaten }];
    });
    setSaveError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_meal_logs', `${clientId}_${today}`), {
        clientId,
        date: today,
        eaten,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Could not save meal tick:', e);
      setSaveError('Could not save that tick. Please check your connection and try again.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-white/40 text-sm font-light">Loading your diet plan...</div>;
  }

  if (!plan) {
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            No diet plan shared yet — your coach will share your plan here once it's ready.
          </p>
        </div>
      </div>
    );
  }

  const sum = (key: 'calories' | 'proteinGrams' | 'carbsGrams' | 'fatGrams') =>
    meals.filter((m) => eatenToday.has(m.id)).reduce((s, m) => s + (m[key] || 0), 0);
  const eatenKcal = sum('calories');
  const kcalPct = plan.dailyCalories > 0 ? Math.min(100, Math.round((eatenKcal / plan.dailyCalories) * 100)) : 0;
  const allDone = meals.length > 0 && eatenToday.size === meals.length;

  // Last 7 days, oldest first
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    const log = logs.find((l) => l.date === key);
    const count = log ? (log.eaten || []).filter((id) => mealIds.has(id)).length : 0;
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), frac: meals.length ? count / meals.length : 0, isToday: key === today };
  });

  const macros: { label: string; eaten: number; target: number; color: string }[] = [
    { label: 'Protein', eaten: sum('proteinGrams'), target: plan.proteinGrams, color: '#6ccbde' },
    { label: 'Carbs', eaten: sum('carbsGrams'), target: plan.carbsGrams, color: '#ffffff' },
    { label: 'Fats', eaten: sum('fatGrams'), target: plan.fatGrams, color: '#ec2226' },
  ];

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {meals.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3">
          <div className="text-[10px] text-white/40 uppercase font-semibold mb-2">Last 7 days</div>
          <div className="flex items-end justify-between gap-1">
            {week.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full max-w-[28px] h-10 rounded-md bg-white/[0.06] flex items-end overflow-hidden">
                  <div className="w-full" style={{ height: `${Math.round(d.frac * 100)}%`, background: d.frac >= 1 ? '#34d399' : 'linear-gradient(180deg,#6ccbde,#ec2226)' }} />
                </div>
                <span className={`text-[9px] ${d.isToday ? 'text-white font-bold' : 'text-white/40'}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan header */}
      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{plan.dietType}</span>
          <span className="text-[10px] text-white/40 font-light shrink-0">Updated {plan.lastUpdated}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Plan by</div>
            <div className="text-sm text-white font-semibold truncate">{plan.nutritionistName}</div>
          </div>
          {plan.nutritionistContact && (
            <a
              href={buildWhatsAppLink(plan.nutritionistContact)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] border border-[#25D366]/30 rounded-lg px-3 py-1.5 hover:bg-[#25D366]/10 transition shrink-0"
            >
              Chat on WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Today */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-[0.15em]">Today</div>
            <div className="font-header text-3xl text-white tracking-wide leading-none mt-1">
              {eatenKcal}<span className="text-sm font-light text-white/50 ml-1 font-sans">/ {plan.dailyCalories} kcal</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-white font-mono">{eatenToday.size}/{meals.length}</div>
            <div className="text-[10px] text-white/40 uppercase">meals</div>
          </div>
        </div>
        <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${kcalPct}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {macros.map((m) => (
            <div key={m.label} className="bg-black/20 rounded-xl p-2">
              <div className="text-[9px] text-white/40 uppercase">{m.label}</div>
              <div className="text-xs font-bold font-mono" style={{ color: m.color }}>{m.eaten}<span className="text-white/40 font-normal">/{m.target}g</span></div>
            </div>
          ))}
          <div className="bg-black/20 rounded-xl p-2">
            <div className="text-[9px] text-white/40 uppercase">Water</div>
            <div className="text-xs font-bold text-white font-mono">{plan.hydrationLiters}L</div>
          </div>
        </div>
        {allDone && <p className="text-xs text-emerald-400 font-semibold text-center">All meals done today. Great work!</p>}
      </div>

      {/* Meals checklist */}
      {meals.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-white/40 uppercase font-semibold">Tap a meal when you have eaten it</div>
          {meals.map((meal) => {
            const done = eatenToday.has(meal.id);
            const options = meal.variants || [];
            const multi = options.length > 1;
            const vi = multi ? Math.min(pickedVar[meal.id] || 0, options.length - 1) : 0;
            const shown = options.length > 0 ? options[vi] : undefined;
            const kcal = shown?.calories || meal.calories;
            const prot = shown?.proteinGrams ?? meal.proteinGrams;
            const carb = shown?.carbsGrams ?? meal.carbsGrams;
            const fat = shown?.fatGrams ?? meal.fatGrams;
            return (
              <div key={meal.id} className={`rounded-2xl border transition overflow-hidden ${done ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#242426] border-white/[0.06]'}`}>
                {multi && (
                  <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    {options.map((v, i) => (
                      <button key={v.id} type="button" onClick={() => setPickedVar((p) => ({ ...p, [meal.id]: i }))}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${i === vi ? 'bg-[#6ccbde] text-[#0d0e12] border-[#6ccbde]' : 'border-white/15 text-white/60'}`}>
                        {v.label?.trim() || `Option ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              <button
                type="button"
                onClick={() => toggleMeal(meal.id)}
                aria-pressed={done}
                className="w-full text-left p-3 flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs ${
                    done ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent'
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="flex-1 min-w-0 space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[#6ccbde] uppercase flex items-center gap-1.5">
                      <span className="text-sm">{MEAL_TIME_ICONS[meal.mealTime] || '🍴'}</span>
                      {meal.mealTime}
                    </span>
                  </span>
                  {shown ? (
                    <span className="block">
                      {shown.items.map((it) => (
                        <span key={it.id} className={`flex items-baseline justify-between gap-3 text-xs font-light leading-relaxed ${done ? 'text-white/50' : 'text-white/90'}`}>
                          <span>{it.name}</span>
                          {it.portion ? <span className="text-white/50 font-mono text-[11px] shrink-0">{it.portion}</span> : null}
                        </span>
                      ))}
                      {multi && <span className="block text-[10px] text-white/30 mt-1">Choose one option.</span>}
                    </span>
                  ) : (
                    <span className={`block text-xs font-light leading-relaxed ${done ? 'text-white/50' : 'text-white/90'}`}>{meal.description}</span>
                  )}
                  {(kcal || prot || carb || fat) ? (
                    <span className="grid grid-cols-4 gap-1.5 pt-1.5">
                      {([['kcal', kcal, '', '#fbbf24'], ['Protein', prot, 'g', '#6ccbde'], ['Carbs', carb, 'g', '#ffffff'], ['Fats', fat, 'g', '#ec2226']] as const).map(([label, val, unit, color]) => (
                        <span key={label} className="rounded-lg bg-black/25 py-1.5 text-center">
                          <span className="block text-sm font-bold font-mono leading-none" style={{ color }}>{val || 0}<span className="text-[9px] font-normal text-white/40">{unit}</span></span>
                          <span className="block text-[9px] text-white/40 uppercase mt-1">{label}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
              </div>
            );
          })}
          {saveError && <p className="text-xs text-[#ec2226]">{saveError}</p>}
        </div>
      )}

      {/* Last 7 days */}
      <SupplementsCard items={plan.supplements || []} taken={suppTaken} onToggle={toggleSupplement} />

      {plan.notes && (
        <div>
          <div className="text-[10px] text-white/40 uppercase font-semibold mb-1">Notes from your coach</div>
          <div className="text-xs text-white/70 font-light whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-3">{plan.notes}</div>
        </div>
      )}
    </div>
  );
};
