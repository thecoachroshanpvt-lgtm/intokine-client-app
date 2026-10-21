import { initializeClientFirebaseApp } from './firebase';

// The free calorie helper (a small Cloudflare Worker named "intokine-ai"). Change this only if you give the Worker another name.
export const AI_URL = 'https://intokine-ai.thecoachroshan.workers.dev';

export const FOOD_UNITS = ['g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece'] as const;
export interface FoodRow { name: string; qty: string; unit: string }
export interface FoodSaved { name: string; qty: number; unit: string }
export interface EstimateResult { kcal: number; p: number; c: number; f: number }

/** "Milk 200 ml, Oats 50 g" - the short text shown to the nutritionist. */
export const foodsText = (foods: FoodSaved[]) => foods.map((x) => `${x.name} ${x.qty} ${x.unit}`).join(', ');

export async function estimateFoods(meal: string, foods: FoodSaved[]): Promise<EstimateResult> {
  const { auth } = initializeClientFirebaseApp();
  const user = auth && auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ meal, foods }),
      signal: ctrl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.total) throw new Error(d.error || 'The estimate did not work. Please try again.');
    return { kcal: d.total.kcal, p: d.total.p, c: d.total.c, f: d.total.f };
  } catch (e: any) {
    if (e && e.name === 'AbortError') throw new Error('This took too long. Please try again.');
    if (e instanceof TypeError) throw new Error('No internet connection. Please try again.');
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}
