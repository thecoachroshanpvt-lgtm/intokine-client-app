import React, { useEffect, useMemo, useState } from 'react';
import { SupplementsCard } from './SupplementsCard';
import { FloatingWhatsApp } from './FloatingWhatsApp';
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

function niceDate(k: string): string {
  const d = new Date(k + 'T00:00:00');
  return isNaN(d.getTime()) ? k : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DietScreen: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [saveError, setSaveError] = useState('');
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
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

  // Meal consistency: the share of planned meals ticked each day. Days before the first tick do not count against the client.
  const dayFrac = (key: string) => {
    const log = logs.find((l) => l.date === key);
    return meals.length && log ? Math.min(1, (log.eaten || []).filter((id) => mealIds.has(id)).length / meals.length) : 0;
  };
  const firstDay = logs.map((l) => l.date).sort()[0] || today;
  const lastDays = (n: number, fmt: Intl.DateTimeFormatOptions) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      const key = dateKey(d);
      return { key, label: d.toLocaleDateString(undefined, fmt), frac: dayFrac(key), active: key >= firstDay, isToday: key === today };
    });
  const week = lastDays(7, { weekday: 'narrow' });
  const month = lastDays(30, { day: 'numeric' });
  const year = Array.from({ length: 12 }, (_, i) => {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (11 - i));
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    let sumFrac = 0;
    let n = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      if (key > today) break;
      if (key < firstDay) continue;
      sumFrac += dayFrac(key);
      n++;
    }
    return { key: dateKey(start), label: start.toLocaleDateString(undefined, { month: 'narrow' }), full: start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), frac: n ? sumFrac / n : 0, active: n > 0, isToday: i === 11 };
  });
  const bars = range === 'week' ? week : range === 'month' ? month : year;
  const activeBars = bars.filter((x) => x.active);
  const avgPct = activeBars.length ? Math.round((activeBars.reduce((t, x) => t + x.frac, 0) / activeBars.length) * 100) : 0;
  const barColor = (f: number) => (f >= 0.8 ? '#34d399' : f >= 0.5 ? '#fbbf24' : '#f87171');

  const macros: { label: string; eaten: number; target: number; color: string }[] = [
    { label: 'Protein', eaten: sum('proteinGrams'), target: plan.proteinGrams, color: '#6ccbde' },
    { label: 'Carbs', eaten: sum('carbsGrams'), target: plan.carbsGrams, color: '#ffffff' },
    { label: 'Fats', eaten: sum('fatGrams'), target: plan.fatGrams, color: '#ec2226' },
  ];

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
      {/* Plan name, who made it and when: first thing on the screen */}
      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Your diet plan</div>
            <div className="font-header text-2xl text-white tracking-wide leading-tight truncate">{plan.dietType}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Updated</div>
            <div className="text-xs text-white font-semibold">{niceDate(plan.lastUpdated)}</div>
          </div>
        </div>
        <div className="text-[11px] text-white/50 mt-2">Plan by <span className="text-white font-semibold">{plan.nutritionistName}</span></div>
      </div>
      {plan.nutritionistContact && <FloatingWhatsApp href={buildWhatsAppLink(plan.nutritionistContact)} />}

      {meals.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] text-white/40 uppercase font-semibold">Meal consistency</div>
              <div className="text-sm font-bold text-white font-mono">{avgPct}%<span className="text-[10px] text-white/40 font-normal ml-1.5">average</span></div>
            </div>
            <div className="inline-flex rounded-full bg-black/30 border border-white/[0.08] p-0.5">
              {([['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setRange(k)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${range === k ? 'bg-[#6ccbde] text-[#0d0e12]' : 'text-white/50'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className={`flex items-end justify-between ${range === 'month' ? 'gap-px' : 'gap-1'}`}>
            {bars.map((d: any) => (
              <div key={d.key} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${d.full || d.key}: ${d.active ? Math.round(d.frac * 100) + '%' : 'no data'}`}>
                <div className={`w-full ${range === 'month' ? '' : 'max-w-[28px]'} h-14 rounded-md bg-white/[0.06] flex items-end overflow-hidden`}>
                  <div className="w-full rounded-md" style={{ height: `${d.active ? Math.max(4, Math.round(d.frac * 100)) : 0}%`, background: barColor(d.frac) }} />
                </div>
                {range !== 'month' && <span className={`text-[9px] ${d.isToday ? 'text-white font-bold' : 'text-white/40'}`}>{d.label}</span>}
              </div>
            ))}
          </div>
          {range === 'month' && (
            <div className="flex justify-between text-[9px] text-white/40"><span>{month[0].label} (30 days ago)</span><span>Today</span></div>
          )}
          <div className="flex items-center gap-3 text-[9px] text-white/40">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} />80%+</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />50-79%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />under 50%</span>
          </div>
        </div>
      )}

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
