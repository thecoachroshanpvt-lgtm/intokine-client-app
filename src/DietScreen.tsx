import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SupplementsCard } from './SupplementsCard';
import { ConsistencyChart } from './ConsistencyChart';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from './firebase';
import { MealLogSheet } from './MealLogSheet';
import type { SheetMeal, SheetResult } from './MealLogSheet';
import { MacroGraphs } from './MacroGraphs';
import { OwnMealSheet } from './OwnMealSheet';
import { IS_RECORDED } from './variant';
import type { OwnMealResult } from './OwnMealSheet';
import { dayMacros, addDaysKey, PHOTO_DAYS, PORTIONS, reviewApplies, reviewHasMacros } from './dietMacros';
import type { MealEntry as LoggedMeal, MealReview } from './dietMacros';

// Builds a wa.me deep link from whatever format the contact number was stored in.
function buildWhatsAppLink(contact: string): string {
  return `https://wa.me/${contact.replace(/\D/g, '')}`;
}
// A real number only: the "+971 50 000 0000" placeholder (used when a staff member was added without a number) and anything too short do not count.
function isRealContact(contact?: string): boolean {
  const d = (contact || '').replace(/\D/g, '');
  return !(contact || '').includes('@') && d.length >= 8 && d !== '971500000000' && !/^(\d)\1+$/.test(d);
}

const MEAL_TIME_ICONS: Record<string, string> = {
  'Early Morning': '🍋',
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
// A soft photo on the right of each meal card. Files live in public/meal-photos/ ; a meal without a photo file simply shows the plain card.
const MEAL_PHOTOS: Record<string, string> = {
  'Early Morning': 'early-morning',
  'Breakfast': 'breakfast',
  'Mid-Morning Snack': 'mid-morning-snack',
  'Pre-Workout': 'pre-workout',
  'Lunch': 'lunch',
  'Evening Snack': 'evening-snack',
  'Pre-Dinner': 'pre-dinner',
  'Dinner': 'dinner',
  'Post-Workout': 'post-workout',
  'Before Bed': 'before-bed',
};
const mealCardBackground = (mealTime: string) => {
  const photo = MEAL_PHOTOS[mealTime];
  const fade = 'linear-gradient(90deg, #252525 38%, rgba(37,37,37,0.86) 100%), linear-gradient(180deg, rgba(37,37,37,0) 40%, rgba(37,37,37,0.94) 72%)';
  return photo ? `${fade}, url(/${photo}.jpg), url(/meal-photos/${photo}.jpg)` : '#252525';
};

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
  targetCalories?: number; // set by the nutritionist in the Builder; used instead of the meal total when present
  selfLog?: boolean; // targets only: the client adds their own meals and macros
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
  entries?: Record<string, LoggedMeal>;
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
  const [detail, setDetail] = useState(false); // the day-by-day popup of the consistency card
  // Supplement ticks are collected first and only saved after the client confirms them in a popup.
  // Meals are logged one by one in their own popup (photo, option, amount).
  const [reviews, setReviews] = useState<Record<string, Record<string, MealReview>>>({}); // date -> meal id -> nutritionist review
  const [sheetMeal, setSheetMeal] = useState<string | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [macroPage, setMacroPage] = useState(false);
  // Targets-only plans: 'new' = adding a meal, an id = editing that meal.
  const [ownSheet, setOwnSheet] = useState<string | null>(null);
  const [ownSaving, setOwnSaving] = useState(false);
  const [ownError, setOwnError] = useState('');
  const [pendingSupps, setPendingSupps] = useState<Set<string> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  // Same as the other popups in the app: the page behind stays still and the pull-to-refresh is switched off while it is open.
  useEffect(() => {
    if (!detail && !confirmOpen && !sheetMeal && !ownSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-popup-open');
    };
  }, [detail, confirmOpen, sheetMeal, ownSheet]);
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
        // If an older copy of the plan is still stored, show the newest one (plan ids carry their creation time).
        const stamp = (d: any) => Number(String(d.id || '').split('-')[1]) || 0;
        const newest = [...snap.docs].sort((a, b) => stamp(b) - stamp(a) || String(b.data().lastUpdated || '').localeCompare(String(a.data().lastUpdated || '')))[0];
        setPlan(newest ? (newest.data() as DietPlan) : null);
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

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'intokine_meal_reviews'), where('clientId', '==', clientId)),
      (snap) => {
        const next: Record<string, Record<string, MealReview>> = {};
        snap.docs.forEach((d) => {
          const x = d.data() as any;
          if (x.date) next[x.date] = x.meals || {};
        });
        setReviews(next);
      },
      (err) => console.warn('Could not load nutritionist reviews:', err)
    );
    return () => unsub();
  }, [clientId]);

  // Meal photos are kept for 14 days. Once a day this phone removes this client's photos that are older than that (free storage stays small).
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const flag = `intokine_photo_cleanup_${clientId}`;
    try {
      if (localStorage.getItem(flag) === dateKey(new Date())) return;
    } catch { /* storage unavailable: just clean up */ }
    const now = dateKey(new Date());
    (async () => {
      try {
        for (let i = PHOTO_DAYS + 1; i <= PHOTO_DAYS + 14; i++) {
          await deleteDoc(doc(db, 'intokine_meal_photos', `${clientId}_${addDaysKey(now, -i)}`));
        }
        try { localStorage.setItem(flag, now); } catch { /* ignore */ }
      } catch (e) {
        console.warn('Photo cleanup skipped:', e);
      }
    })();
  }, [clientId]);

  const meals = useMemo(
    () => [...(plan?.meals || [])].sort((a, b) => MEAL_ORDER.indexOf(a.mealTime) - MEAL_ORDER.indexOf(b.mealTime)),
    [plan]
  );
  const mealIds = new Set(meals.map((m) => m.id));
  const todayLog = logs.find((l) => l.date === today);
  const eatenToday = new Set((todayLog?.eaten || []).filter((id) => mealIds.has(id)));

  const suppTaken = new Set(todayLog?.supplementsTaken || []);
  const flip = (base: Set<string>, id: string) => {
    const n = new Set(base);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((x) => b.has(x));
  const shownSupps = pendingSupps ?? suppTaken;
  const suppsChanged = pendingSupps !== null && !sameSet(pendingSupps, suppTaken);
  const dirty = suppsChanged;

  const toggleSupplement = (id: string) => setPendingSupps(flip(pendingSupps ?? suppTaken, id));
  const undoChanges = () => {
    setPendingSupps(null);
    setConfirmOpen(false);
    setSaveError('');
  };

  // When the client has finished tapping (a very short pause after the last tap), the confirmation popup opens by itself.
  useEffect(() => {
    if (!dirty || confirmOpen) return;
    const t = window.setTimeout(() => setConfirmOpen(true), 80);
    return () => window.clearTimeout(t);
  }, [dirty, pendingSupps, confirmOpen]);

  const confirmSave = async () => {
    setSaving(true);
    setSaveError('');
    const payload: Record<string, any> = { clientId, date: today, updatedAt: new Date().toISOString() };
    if (suppsChanged) payload.supplementsTaken = Array.from(pendingSupps!);
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_meal_logs', `${clientId}_${today}`), payload, { merge: true });
      setLogs((prev) => [...prev.filter((l) => l.date !== today), { eaten: [], ...(prev.find((l) => l.date === today) || {}), date: today, ...(suppsChanged ? { supplementsTaken: payload.supplementsTaken } : {}) }]);
      setPendingSupps(null);
      setConfirmOpen(false);
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      console.warn('Could not save update:', e);
      setSaveError('Could not save. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const portionLabel = (v?: number) => (PORTIONS.find((x) => x.value === v) || PORTIONS[1]).label;

  const sheetData = (m: MealEntry): SheetMeal => ({
    id: m.id,
    mealTime: m.mealTime,
    description: m.description,
    base: { kcal: m.calories || 0, p: m.proteinGrams || 0, c: m.carbsGrams || 0, f: m.fatGrams || 0 },
    variants: (m.variants || []).map((v, i) => ({
      id: v.id,
      label: v.label?.trim() || `Option ${i + 1}`,
      lines: v.items.map((it) => (it.portion ? `${it.name} · ${it.portion}` : it.name)),
      macros: { kcal: v.calories || m.calories || 0, p: v.proteinGrams ?? m.proteinGrams ?? 0, c: v.carbsGrams ?? m.carbsGrams ?? 0, f: v.fatGrams ?? m.fatGrams ?? 0 },
    })),
  });

  // Saves one meal: the photo first (its own small document), then the meal entry in today's log.
  const saveMeal = async (meal: MealEntry, r: SheetResult) => {
    setSheetSaving(true);
    setSheetError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      const at = new Date().toISOString();
      if (r.photoDataUrl) {
        await setDoc(
          doc(db, 'intokine_meal_photos', `${clientId}_${today}`),
          { clientId, date: today, updatedAt: at, photos: { [meal.id]: { dataUrl: r.photoDataUrl, mealTime: meal.mealTime, at } } },
          { merge: true }
        );
      }
      const entry: Record<string, any> = { status: r.status, at };
      if (r.status === 'eaten') {
        if (r.variantId) entry.variantId = r.variantId;
        if (r.variantLabel) entry.variantLabel = r.variantLabel;
        entry.portion = r.portion || 1;
        if (r.macros) entry.macros = r.macros;
        entry.photo = true;
      } else if (r.status === 'else') {
        entry.note = r.note || '';
        entry.photo = true;
      }
      const eaten = new Set(eatenToday);
      if (r.status === 'eaten' || r.status === 'else') eaten.add(meal.id);
      else eaten.delete(meal.id);
      // Only this meal's entry is replaced (mergeFields), so the other meals and the supplements of the day stay as they are.
      await setDoc(
        doc(db, 'intokine_meal_logs', `${clientId}_${today}`),
        { clientId, date: today, updatedAt: at, eaten: Array.from(eaten), entries: { [meal.id]: entry } },
        { mergeFields: ['clientId', 'date', 'updatedAt', 'eaten', `entries.${meal.id}`] }
      );
      setLogs((old) => {
        const cur = old.find((l) => l.date === today);
        const next: MealLog = { ...(cur || { date: today, eaten: [] }), date: today, eaten: Array.from(eaten), entries: { ...(cur?.entries || {}), [meal.id]: entry as LoggedMeal } };
        return [...old.filter((l) => l.date !== today), next];
      });
      setSheetMeal(null);
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      console.warn('Could not save meal:', e);
      setSheetError('Could not save. Please check your connection and try again.');
    } finally {
      setSheetSaving(false);
    }
  };

  // Meals the client added themselves (targets-only plans), in meal-time order.
  const ownMeals = Object.entries<LoggedMeal>(todayLog?.entries || {})
    .filter(([, e]) => e && e.own && e.status === 'eaten' && e.macros)
    .map(([id, e]) => ({ id, e }))
    .sort((a, b) => MEAL_ORDER.indexOf(a.e.mealTime || '') - MEAL_ORDER.indexOf(b.e.mealTime || '') || String(a.e.at || '').localeCompare(String(b.e.at || '')));

  // Saves (or deletes) one own meal in today's log. Same document as the other meals, only this meal's entry is replaced.
  const saveOwn = async (id: string, r: OwnMealResult | null) => {
    setOwnSaving(true);
    setOwnError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      const at = new Date().toISOString();
      const entry: Record<string, any> = r
        ? { status: 'eaten', own: true, mealTime: r.mealTime, note: r.note, portion: 1, macros: r.macros, at }
        : { status: 'none', own: true, at };
      const eaten = new Set(todayLog?.eaten || []);
      if (r) eaten.add(id);
      else eaten.delete(id);
      await setDoc(
        doc(db, 'intokine_meal_logs', `${clientId}_${today}`),
        { clientId, date: today, updatedAt: at, eaten: Array.from(eaten), entries: { [id]: entry } },
        { mergeFields: ['clientId', 'date', 'updatedAt', 'eaten', `entries.${id}`] }
      );
      setLogs((old) => {
        const cur = old.find((l) => l.date === today);
        const next: MealLog = { ...(cur || { date: today, eaten: [] }), date: today, eaten: Array.from(eaten), entries: { ...(cur?.entries || {}), [id]: entry as LoggedMeal } };
        return [...old.filter((l) => l.date !== today), next];
      });
      setOwnSheet(null);
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      console.warn('Could not save meal:', e);
      setOwnError('Could not save. Please check your connection and try again.');
    } finally {
      setOwnSaving(false);
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

  // Targets-only plan: the client adds their own meals (online/offline clients app only, not Zaki).
  const selfOn = !!plan.selfLog && !IS_RECORDED;
  // What was really eaten today: the option and amount the client picked, plus the macros the nutritionist added for "something else".
  const todayRes = dayMacros(meals, todayLog, reviews[today]);
  const eatenKcal = todayRes.total.kcal;
  const kcalTarget = plan.targetCalories || plan.dailyCalories;
  const kcalPct = kcalTarget > 0 ? Math.min(100, Math.round((eatenKcal / kcalTarget) * 100)) : 0;
  const allDone = meals.length > 0 && eatenToday.size === meals.length;

  // Meal consistency: the share of planned meals ticked each day. Days before the first tick do not count against the client.
  const tickedOn = (key: string) => {
    const log = logs.find((l) => l.date === key);
    return log ? (log.eaten || []).filter((id) => mealIds.has(id)) : [];
  };
  const dayFrac = (key: string) => (meals.length ? Math.min(1, tickedOn(key).length / meals.length) : 0);
  const firstDay = logs.map((l) => l.date).sort()[0] || today;
  const lastDays = (n: number, fmt: Intl.DateTimeFormatOptions) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      const key = dateKey(d);
      return {
        key,
        label: d.toLocaleDateString(undefined, fmt),
        full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        frac: dayFrac(key),
        ticked: tickedOn(key),
        active: key >= firstDay,
        isToday: key === today,
        fullDays: 0,
        logged: 0,
        n: 1,
      };
    });
  const week = lastDays(7, { weekday: 'short' });
  const month = lastDays(30, { day: 'numeric' });
  const year = Array.from({ length: 12 }, (_, i) => {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (11 - i));
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    let sumFrac = 0;
    let n = 0;
    let fullDays = 0;
    let logged = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      if (key > today) break;
      if (key < firstDay) continue;
      const f = dayFrac(key);
      sumFrac += f;
      n++;
      if (f >= 0.999) fullDays++;
      if (f > 0) logged++;
    }
    return {
      key: dateKey(start),
      label: start.toLocaleDateString(undefined, { month: 'short' }),
      full: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      frac: n ? sumFrac / n : 0,
      ticked: [] as string[],
      active: n > 0,
      isToday: i === 11,
      fullDays,
      logged,
      n,
    };
  });
  const bars = range === 'week' ? week : range === 'month' ? month : year;
  const activeBars = bars.filter((x) => x.active);
  const avgPct = activeBars.length ? Math.round((activeBars.reduce((t, x) => t + x.frac, 0) / activeBars.length) * 100) : 0;
  const barColor = (f: number) => (f >= 0.8 ? '#34d399' : f >= 0.5 ? '#fbbf24' : '#ec2226');
  const totalFull = range === 'year' ? activeBars.reduce((t, x) => t + x.fullDays, 0) : activeBars.filter((x) => x.frac >= 0.999).length;
  const totalLogged = range === 'year' ? activeBars.reduce((t, x) => t + x.logged, 0) : activeBars.filter((x) => x.ticked.length > 0).length;
  const totalDays = range === 'year' ? activeBars.reduce((t, x) => t + x.n, 0) : activeBars.length;
  const rangeTitle = range === 'week' ? 'Last 7 days' : range === 'month' ? 'Last 30 days' : 'Last 12 months';

  const macros: { label: string; eaten: number; target: number; color: string }[] = [
    { label: 'Protein', eaten: Math.round(todayRes.total.p), target: plan.proteinGrams, color: '#6ccbde' },
    { label: 'Carbs', eaten: Math.round(todayRes.total.c), target: plan.carbsGrams, color: '#ffffff' },
    { label: 'Fats', eaten: Math.round(todayRes.total.f), target: plan.fatGrams, color: '#ec2226' },
  ];

  // Macro graphs page: every day against the target, same look as the Routine graphs.
  if (macroPage) {
    const cache = new Map<string, ReturnType<typeof dayMacros>>();
    const resOf = (day: string) => {
      let r = cache.get(day);
      if (!r) { r = dayMacros(meals, logs.find((l) => l.date === day), reviews[day]); cache.set(day, r); }
      return r;
    };
    const value = (id: string, day: string): number | null => {
      const r = resOf(day);
      if (!r.logged) return null;
      return id === 'kcal' ? r.total.kcal : id === 'p' ? r.total.p : id === 'c' ? r.total.c : r.total.f;
    };
    const series = [
      { id: 'kcal', label: 'Calories', unit: 'kcal', target: kcalTarget, color: '#ffffff' },
      { id: 'p', label: 'Protein', unit: 'g', target: plan.proteinGrams, color: '#6ccbde' },
      { id: 'c', label: 'Carbs', unit: 'g', target: plan.carbsGrams, color: '#c084fc' },
      { id: 'f', label: 'Fats', unit: 'g', target: plan.fatGrams, color: '#ec2226' },
    ];
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto space-y-4">
        <button onClick={() => setMacroPage(false)} className="text-[12px] font-semibold text-[#6ccbde] hover:text-white flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Diet
        </button>
        <div className="rounded-2xl px-4 py-4" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
          <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">Macro progress</div>
          <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">What you ate each day against your daily targets. Green bars are within 10% of the target. An amber dot means a meal is still waiting for your nutritionist's macros.</p>
        </div>
        <MacroGraphs series={series} value={value} pending={(d) => resOf(d).pending > 0} today={today} firstDay={firstDay} />
      </div>
    );
  }

  return (
    <div className={`px-5 pt-4 max-w-4xl mx-auto space-y-4 pb-8`}>
      {ownSheet && selfOn && (() => {
        const ex = ownSheet !== 'new' ? ownMeals.find((x) => x.id === ownSheet)?.e : undefined;
        const id = ownSheet === 'new' ? `own-${Date.now()}` : ownSheet;
        return <OwnMealSheet key={ownSheet} mealTimes={MEAL_ORDER} icons={MEAL_TIME_ICONS} existing={ex} saving={ownSaving} error={ownError}
          onSave={(r) => saveOwn(id, r)} onDelete={() => saveOwn(ownSheet, null)} onClose={() => setOwnSheet(null)} />;
      })()}
      {sheetMeal && (() => {
        const m = meals.find((x) => x.id === sheetMeal);
        if (!m) return null;
        const e = todayLog?.entries?.[m.id];
        return <MealLogSheet key={m.id} meal={sheetData(m)} existing={e} saving={sheetSaving} error={sheetError} onSave={(r) => saveMeal(m, r)} onClose={() => setSheetMeal(null)} />;
      })()}
      {/* Plan and today in one card: name, who made it, then how today is going */}
      <div className="rounded-2xl p-4 space-y-4" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div>
          <div className="font-header text-2xl text-white leading-tight">{plan.dietType}</div>
          <div className="text-[11px] text-white/40 mt-0.5">Plan by <span className="text-white/70 font-medium">{plan.nutritionistName}</span> · Updated {niceDate(plan.lastUpdated)}</div>
        </div>
        <div>
          <div className="flex items-end justify-between">
            <div className="font-header text-3xl text-white tracking-wide leading-none">
              {eatenKcal}<span className="text-sm font-light text-white/50 ml-1 font-sans">/ {kcalTarget} kcal</span>
            </div>
            <div className="text-xs text-white/50">{selfOn ? <><span className="text-white font-semibold font-mono">{ownMeals.length}</span> {ownMeals.length === 1 ? 'meal' : 'meals'} logged</> : <><span className="text-white font-semibold font-mono">{eatenToday.size}/{meals.length}</span> meals</>}</div>
          </div>
          <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden mt-2.5">
            <div className="h-full rounded-full transition-all" style={{ width: `${kcalPct}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-white/[0.08] text-center">
          {macros.map((m) => (
            <div key={m.label} className="px-1">
              <div className="text-xs font-bold font-mono" style={{ color: m.color }}>{m.eaten}<span className="text-white/35 font-normal">/{m.target}g</span></div>
              <div className="text-[9px] text-white/40 uppercase mt-0.5">{m.label}</div>
            </div>
          ))}
          <div className="px-1">
            <div className="text-xs font-bold text-white font-mono">{plan.hydrationLiters}L</div>
            <div className="text-[9px] text-white/40 uppercase mt-0.5">Water</div>
          </div>
        </div>
        {todayRes.pending > 0 && <p className="text-[11px] text-amber-300 text-center">{todayRes.pending} {todayRes.pending === 1 ? 'meal is' : 'meals are'} waiting for your nutritionist to add the macros</p>}
        {allDone && <p className="text-xs text-emerald-400 font-semibold text-center">All meals done today. Great work!</p>}
      </div>
      {(plan.notes || '').trim() && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] mb-2">Notes from your coach</div>
          <div className="text-xs text-white/60 font-light whitespace-pre-wrap leading-relaxed">{(plan.notes || '').trim()}</div>
        </div>
      )}

      {isRealContact(plan.nutritionistContact) && <FloatingWhatsApp href={buildWhatsAppLink(plan.nutritionistContact)} />}

      {detail && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5" onClick={() => setDetail(false)}>
          <div data-no-pull className="anim-card w-full max-w-md max-h-[80vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
              <div>
                <div className="font-subheader text-[17px] text-white">{range === 'week' ? 'Weekly' : range === 'month' ? 'Monthly' : 'Yearly'} meal consistency</div>
                <div className="text-[11px] text-white/40">{rangeTitle}</div>
              </div>
              <button type="button" onClick={() => setDetail(false)} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 pb-2">
              {([['Average', `${avgPct}%`], ['Full days', String(totalFull)], ['Days logged', `${totalLogged}/${totalDays}`]] as const).map(([l, v]) => (
                <div key={l} className="bg-black/30 rounded-xl py-2 text-center">
                  <div className="text-sm font-bold text-white font-mono">{v}</div>
                  <div className="text-[9px] text-white/40 uppercase mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="overflow-y-auto px-4 pb-4 pt-2 space-y-2.5" style={{ overscrollBehavior: 'contain' }}>
              {[...bars].reverse().map((d) => (
                <div key={d.key}>
                  <div className="flex items-center gap-3">
                    <div className={`w-24 shrink-0 text-xs ${d.isToday ? 'text-white font-bold' : 'text-white/70'}`}>{d.full}{d.isToday && range !== 'year' ? ' (today)' : ''}</div>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.active ? Math.round(d.frac * 100) : 0}%`, background: barColor(d.frac) }} />
                    </div>
                    <div className="w-12 shrink-0 text-right text-xs font-mono font-bold" style={{ color: d.active ? barColor(d.frac) : 'rgba(255,255,255,0.3)' }}>{d.active ? `${Math.round(d.frac * 100)}%` : '—'}</div>
                  </div>
                  {range === 'year' ? (
                    <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">{d.active ? `${d.fullDays} full days · ${d.logged} of ${d.n} days logged` : 'No data yet'}</div>
                  ) : (
                    <div className="ml-24 pl-3 text-[10px] text-white/40 mt-0.5">
                      {!d.active ? 'Before you started' : `${d.ticked.length} of ${meals.length} meals`}
                      {range === 'week' && d.active && (
                        <span className="flex flex-wrap gap-1 mt-1">
                          {meals.map((m) => (
                            <span key={m.id} className={`px-1.5 py-0.5 rounded-full text-[9px] ${d.ticked.includes(m.id) ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.05] text-white/30'}`}>{d.ticked.includes(m.id) ? '✓ ' : ''}{m.mealTime}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {savedMsg && (
        <div className="fixed left-0 right-0 bottom-28 z-40 flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-bold shadow-lg">Update saved</span>
        </div>
      )}

      {confirmOpen && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5">
          <div data-no-pull className="anim-card w-full max-w-sm max-h-[80vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/[0.08]">
              <div className="font-subheader text-[17px] text-white">Confirm today's supplements</div>
              <div className="text-[11px] text-white/40">{niceDate(today)} · check it and confirm to save</div>
            </div>
            <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
              {(plan.supplements || []).length > 0 && (
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-semibold mb-2">Supplements taken · {(plan.supplements || []).filter((x) => shownSupps.has(x.id)).length} of {(plan.supplements || []).length}</div>
                  <div className="space-y-1.5">
                    {(plan.supplements || []).map((x) => (
                      <div key={x.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className={shownSupps.has(x.id) ? 'text-white' : 'text-white/40'}>{x.name}</span>
                        <span className={`text-[10px] font-bold ${shownSupps.has(x.id) ? 'text-emerald-400' : 'text-white/30'}`}>{shownSupps.has(x.id) ? '✓ Taken' : 'Not taken'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {saveError && <p className="text-xs text-[#ec2226]">{saveError}</p>}
            </div>
            <div className="p-3 border-t border-white/[0.08] flex items-center gap-2">
              <button type="button" disabled={saving} onClick={undoChanges} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Cancel</button>
              <button type="button" disabled={saving} onClick={confirmSave} className="flex-[2] py-2.5 rounded-xl bg-[#ec2226] disabled:opacity-60 text-white text-xs font-bold">{saving ? 'Saving...' : 'Confirm & save'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Targets-only plan: the client adds their own meals */}
      {selfOn && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">Today's meals</div>
            <div className="text-[10px] text-white/40">Add each meal with its calories and macros</div>
          </div>
          {ownMeals.map(({ id, e }) => (
            <div key={id} className="rounded-2xl border border-emerald-500/40 overflow-hidden"
              style={{ background: mealCardBackground(e.mealTime || ''), backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#252525' }}>
              <button type="button" onClick={() => { setOwnError(''); setOwnSheet(id); }} className="w-full text-left p-4 block">
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs bg-emerald-500 border-emerald-500 text-black" aria-hidden>✓</span>
                  <span className="font-subheader text-[17px] text-white flex-1">{MEAL_TIME_ICONS[e.mealTime || ''] || '🍴'} {e.mealTime || 'Meal'}</span>
                </span>
                <span className="block mt-1.5 pl-9 text-[11px] leading-snug">
                  <span className="block text-emerald-400 font-semibold">Logged · tap to edit</span>
                </span>
                {e.note ? <span className="block mt-2 pl-9 text-xs font-light leading-relaxed text-white/50">{e.note}</span> : null}
                <span className="grid grid-cols-4 divide-x divide-white/[0.08] text-center mt-3 pt-3 border-t border-white/[0.06]">
                  {([['kcal', e.macros!.kcal, '', '#ffffff'], ['Protein', e.macros!.p, 'g', '#6ccbde'], ['Carbs', e.macros!.c, 'g', '#ffffff'], ['Fats', e.macros!.f, 'g', '#ec2226']] as const).map(([label, val, unit, color]) => (
                    <span key={label} className="px-1">
                      <span className="block text-sm font-bold font-mono leading-none" style={{ color }}>{val || 0}<span className="text-[9px] font-normal text-white/40">{unit}</span></span>
                      <span className="block text-[9px] text-white/40 uppercase mt-1">{label}</span>
                    </span>
                  ))}
                </span>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => { setOwnError(''); setOwnSheet('new'); }}
            className="w-full py-4 rounded-2xl border border-dashed border-[#6ccbde]/50 text-[#6ccbde] text-sm font-bold bg-[#6ccbde]/[0.05] active:scale-[0.99] transition-transform">
            + Add a meal
          </button>
          {ownMeals.length === 0 && <p className="text-[11px] text-white/40 text-center">No meals added yet today. Tap "Add a meal" after you eat.</p>}
          {saveError && <p className="text-xs text-[#ec2226]">{saveError}</p>}
        </div>
      )}

      {/* Meals checklist */}
      {meals.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">Today's meals</div>
            <div className="text-[10px] text-white/40">Tap a meal to log it with a photo</div>
          </div>
          {meals.map((meal) => {
            const entry = todayLog?.entries?.[meal.id];
            const st = entry?.status === 'none' ? undefined : entry?.status;
            const done = st === 'eaten' || st === 'else' || (!st && eatenToday.has(meal.id));
            const skipped = st === 'skipped';
            const rv = reviews[today]?.[meal.id];
            const rvOk = reviewApplies(rv, entry) ? rv : undefined;
            const options = meal.variants || [];
            const multi = options.length > 1;
            const vi = multi ? Math.min(pickedVar[meal.id] || 0, options.length - 1) : 0;
            const shown = options.length > 0 ? options[vi] : undefined;
            const kcal = shown?.calories || meal.calories;
            const prot = shown?.proteinGrams ?? meal.proteinGrams;
            const carb = shown?.carbsGrams ?? meal.carbsGrams;
            const fat = shown?.fatGrams ?? meal.fatGrams;
            return (
              <div key={meal.id} className={`rounded-2xl border transition overflow-hidden ${done ? 'border-emerald-500/40' : skipped ? 'border-[#ec2226]/40' : 'border-white/[0.08]'}`}
                style={{ background: mealCardBackground(meal.mealTime), backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#252525' }}>
                {multi && (
                  <div className="px-4 pt-3 text-[10px] text-white/40">Choose one option</div>
                )}
                {multi && (
                  <div className="flex gap-1.5 overflow-x-auto px-4 pt-1.5" style={{ scrollbarWidth: 'none' }}>
                    {options.map((v, i) => (
                      <button key={v.id} type="button" onClick={() => setPickedVar((p) => ({ ...p, [meal.id]: i }))}
                        className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition ${i === vi ? 'bg-[#6ccbde]/15 text-[#6ccbde] border-[#6ccbde]/50' : 'border-white/[0.1] text-white/50'}`}>
                        {v.label?.trim() || `Option ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => { setSheetError(''); setSheetMeal(meal.id); }} className="w-full text-left p-4 block">
                  <span className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs ${done ? 'bg-emerald-500 border-emerald-500 text-black' : skipped ? 'border-[#ec2226] text-[#ec2226]' : 'border-white/25 text-transparent ik-nudge'}`} aria-hidden>{skipped ? '✕' : '✓'}</span>
                    <span className="font-subheader text-[17px] text-white flex-1">{MEAL_TIME_ICONS[meal.mealTime] || '🍴'} {meal.mealTime}</span>
                  </span>
                  <span className="block mt-1.5 pl-9 text-[11px] leading-snug">
                    {st === 'eaten' && <span className="block text-emerald-400 font-semibold">Eaten{entry?.variantLabel && options.length > 1 ? ` · ${entry.variantLabel}` : ''} · {portionLabel(entry?.portion)}{rvOk && reviewHasMacros(rvOk) ? ` · ${rvOk.kcal} kcal (set by your nutritionist)` : entry?.macros ? ` · ${entry.macros.kcal} kcal` : ''}</span>}
                    {st === 'else' && (rvOk && reviewHasMacros(rvOk)
                      ? <span className="block text-emerald-400 font-semibold">Something else · {rvOk.kcal} kcal · {rvOk.p}g protein added by your nutritionist</span>
                      : <span className="block text-amber-300 font-semibold">Something else · waiting for your nutritionist</span>)}
                    {st === 'skipped' && <span className="block text-[#ec2226] font-semibold">Skipped · counts as 0</span>}
                    {!st && !done && <span className="block text-[#6ccbde]/80">📷 Tap to log this meal</span>}
                    {rv && rv.verdict === 'mismatch' && <span className="block text-amber-300 mt-0.5">Your nutritionist says the photo does not match the plan{rv.note ? `: ${rv.note}` : '.'}</span>}
                    {rv && rv.verdict === 'ok' && !rv.note && <span className="block text-white/40 mt-0.5">Photo checked by your nutritionist ✓</span>}
                  </span>
                  <span className="block mt-2 pl-9">
                    {shown ? (
                      <>
                        {shown.items.map((it) => (
                          <span key={it.id} className={`flex items-baseline justify-between gap-3 text-xs font-light leading-relaxed ${done ? 'text-white/50' : 'text-white/85'}`}>
                            <span>{it.name}</span>
                            {it.portion ? <span className="text-white/45 font-mono text-[11px] shrink-0">{it.portion}</span> : null}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className={`block text-xs font-light leading-relaxed ${done ? 'text-white/50' : 'text-white/85'}`}>{meal.description}</span>
                    )}
                  </span>
                  {(kcal || prot || carb || fat) ? (
                    <span className="grid grid-cols-4 divide-x divide-white/[0.08] text-center mt-3 pt-3 border-t border-white/[0.06]">
                      {([['kcal', kcal, '', '#ffffff'], ['Protein', prot, 'g', '#6ccbde'], ['Carbs', carb, 'g', '#ffffff'], ['Fats', fat, 'g', '#ec2226']] as const).map(([label, val, unit, color]) => (
                        <span key={label} className="px-1">
                          <span className="block text-sm font-bold font-mono leading-none" style={{ color }}>{val || 0}<span className="text-[9px] font-normal text-white/40">{unit}</span></span>
                          <span className="block text-[9px] text-white/40 uppercase mt-1">{label}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
          {saveError && <p className="text-xs text-[#ec2226]">{saveError}</p>}
        </div>
      )}

      <SupplementsCard items={plan.supplements || []} taken={shownSupps} onToggle={toggleSupplement} />

      {(meals.length > 0 || selfOn) && (
        <button type="button" onClick={() => setMacroPage(true)} className="w-full text-left rounded-2xl p-4 border border-white/[0.08] bg-[#252525] flex items-center justify-between gap-3">
          <span>
            <span className="block font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde]">Macro progress</span>
            <span className="block text-[11px] text-white/50 mt-1">Calories, protein, carbs and fats against your targets</span>
          </span>
          <span className="text-[11px] font-semibold text-[#6ccbde] shrink-0">Open ›</span>
        </button>
      )}

      {meals.length > 0 && (
        <ConsistencyChart title="Meal consistency" bars={bars} range={range} onRange={setRange} avgPct={avgPct} fullDays={totalFull} periodLabel={rangeTitle} onOpen={() => setDetail(true)} />
      )}
    </div>
  );
};
