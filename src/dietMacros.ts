// Shared by the Client App (Diet tab) and Nutrition OS: works out what a client really ate on a day.
// Planned meal: the macros of the option they picked x the amount (Half 0.5 / Full 1 / More 1.5), saved with the meal when it was logged.
// "Something else": counts only after the nutritionist adds the macros (until then the day shows as waiting).
// Skipped: counts zero. Older ticks without details count the whole planned meal, as before.

export type Macro = { kcal: number; p: number; c: number; f: number };

export interface MealEntry {
  status: 'eaten' | 'else' | 'skipped' | 'none';
  variantId?: string;
  variantLabel?: string;
  portion?: number;
  note?: string;
  photo?: boolean;
  macros?: Macro;
  at?: string;
  own?: boolean; // a meal the client added themselves (targets-only plans): the macros are what the client typed
  mealTime?: string; // own meals: Breakfast, Lunch ...
}

export interface MealReview {
  verdict?: 'ok' | 'mismatch';
  kcal?: number;
  p?: number;
  c?: number;
  f?: number;
  note?: string;
  entryAt?: string; // which version of the client's entry this review belongs to
  by?: string;
  at?: string;
}

export interface PlanMealLite {
  id: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}

export interface DayLogLite {
  date: string;
  eaten?: string[];
  entries?: Record<string, MealEntry>;
}

export const PORTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: 'Half' },
  { value: 1, label: 'Full' },
  { value: 1.5, label: 'More' },
];

export const ZERO: Macro = { kcal: 0, p: 0, c: 0, f: 0 };
const r1 = (n: number) => Math.round(n * 10) / 10;

export const scaleMacro = (m: Macro, k: number): Macro => ({ kcal: Math.round(m.kcal * k), p: r1(m.p * k), c: r1(m.c * k), f: r1(m.f * k) });

export const reviewHasMacros = (r?: MealReview): boolean => !!r && typeof r.kcal === 'number';
// A review only counts for the entry it was written for (if the client changed the entry afterwards it needs checking again).
export const reviewApplies = (r: MealReview | undefined, e: MealEntry | undefined): boolean => !!r && (!r.entryAt || !e || r.entryAt === e.at);

export function mealMacros(m: PlanMealLite, e: MealEntry | undefined, inEaten: boolean, r?: MealReview): { macro: Macro; pending: boolean; counted: boolean } {
  const planned: Macro = { kcal: m.calories || 0, p: m.proteinGrams || 0, c: m.carbsGrams || 0, f: m.fatGrams || 0 };
  if (e && (e.status === 'skipped' || e.status === 'none')) return { macro: ZERO, pending: false, counted: false };
  const rv = reviewApplies(r, e) && reviewHasMacros(r) ? r : undefined;
  if (e && e.status === 'else') {
    if (rv) return { macro: { kcal: rv.kcal || 0, p: rv.p || 0, c: rv.c || 0, f: rv.f || 0 }, pending: false, counted: true };
    return { macro: ZERO, pending: true, counted: false };
  }
  if (e && e.status === 'eaten') {
    if (rv) return { macro: { kcal: rv.kcal || 0, p: rv.p || 0, c: rv.c || 0, f: rv.f || 0 }, pending: false, counted: true };
    return { macro: e.macros || scaleMacro(planned, e.portion || 1), pending: false, counted: true };
  }
  if (inEaten) return { macro: planned, pending: false, counted: true };
  return { macro: ZERO, pending: false, counted: false };
}

export function dayMacros(meals: PlanMealLite[], log: DayLogLite | undefined, reviews: Record<string, MealReview> | undefined): { total: Macro; pending: number; logged: boolean } {
  const total = { ...ZERO };
  let pending = 0;
  const eaten = new Set(log?.eaten || []);
  meals.forEach((m) => {
    const r = mealMacros(m, log?.entries?.[m.id], eaten.has(m.id), reviews?.[m.id]);
    total.kcal += r.macro.kcal;
    total.p += r.macro.p;
    total.c += r.macro.c;
    total.f += r.macro.f;
    if (r.pending) pending += 1;
  });
  // Targets-only plans: meals the client added themselves count with the macros they typed.
  const planIds = new Set(meals.map((m) => m.id));
  Object.entries(log?.entries || {}).forEach(([id, e]) => {
    if (planIds.has(id) || !e || !e.own || e.status !== 'eaten' || !e.macros) return;
    total.kcal += e.macros.kcal || 0;
    total.p += e.macros.p || 0;
    total.c += e.macros.c || 0;
    total.f += e.macros.f || 0;
  });
  const anything = !!log && (eaten.size > 0 || Object.values(log.entries || {}).some((e) => e && e.status !== 'none'));
  return { total: { kcal: Math.round(total.kcal), p: r1(total.p), c: r1(total.c), f: r1(total.f) }, pending, logged: anything };
}

// Photos are kept 14 days, one document per client per day (id <clientId>_<date>), so old ones can be removed by id.
export const PHOTO_DAYS = 14;
export const addDaysKey = (key: string, n: number): string => {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
