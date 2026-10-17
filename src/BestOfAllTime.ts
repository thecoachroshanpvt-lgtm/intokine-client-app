// Zaki: the best of all time on one exercise.
// It counts what was really done: the planned numbers of workouts the client finished, and the coach's own Performance entries.
// Workouts that are planned but not finished never count.
export interface BestPlan { clientCompletedAt?: string; structuredExercises?: any[]; clientExerciseResults?: Record<string, { edited?: boolean; sets?: any[] }> }
export interface BestPerf { exercises?: { name: string; entries?: any[] }[] }

interface Cand { w: number; reps: number; hold: number; dist: number; dur: number } // hold = seconds, dur = minutes

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const bestOfAllTime = (name: string, kind: string | undefined, plans: BestPlan[], perf: BestPerf[]): string | null => {
  const c: Cand[] = [];
  plans.forEach((p) => {
    if (!p.clientCompletedAt) return;
    (p.structuredExercises || []).forEach((ex) => {
      if (ex.isStretchReminder || !same(ex.name || '', name)) return;
      // If the client changed the numbers, what they did counts instead of the plan.
      const edit = p.clientExerciseResults?.[ex.id];
      if (edit?.edited && Array.isArray(edit.sets) && edit.sets.length > 0) {
        edit.sets.forEach((s: any) => c.push({ w: s.weightKg || 0, reps: s.reps || 0, hold: s.holdSeconds || 0, dist: s.distanceKm || 0, dur: s.durationMinutes || 0 }));
        return;
      }
      (ex.sets || []).forEach((s: any) => c.push({ w: s.targetWeightKg || 0, reps: s.targetReps || 0, hold: s.holdSeconds || 0, dist: s.distanceKm || 0, dur: s.durationMinutes || 0 }));
    });
  });
  perf.forEach((r) => (r.exercises || []).forEach((ex) => {
    if (!same(ex.name || '', name)) return;
    (ex.entries || []).forEach((e: any) => c.push({
      w: e.weightKg || 0,
      reps: e.reps || 0,
      hold: kind === 'Isometric' ? e.durationSec || 0 : 0,
      dist: e.distanceKm || 0,
      dur: kind === 'Isometric' ? 0 : (e.durationSec || 0) / 60,
    }));
  }));
  if (c.length === 0) return null;
  const k = kind || 'Weighted';
  if (k === 'Weighted') {
    let b: Cand | null = null;
    c.forEach((x) => { if (x.w > 0 && (!b || x.w > b.w || (x.w === b.w && x.reps > b.reps))) b = x; });
    const w: Cand | null = b;
    return w ? `${w.w} kg × ${w.reps} reps` : null;
  }
  if (k === 'Bodyweight') {
    const m = Math.max(0, ...c.map((x) => x.reps));
    return m > 0 ? `${m} reps` : null;
  }
  if (k === 'Isometric') {
    const m = Math.max(0, ...c.map((x) => x.hold));
    return m > 0 ? `${m} sec hold` : null;
  }
  if (k === 'DistanceCardio') {
    const m = Math.max(0, ...c.map((x) => x.dist));
    return m > 0 ? `${m} km` : null;
  }
  const m = Math.max(0, ...c.map((x) => x.dur));
  return m > 0 ? `${Math.round(m * 10) / 10} min` : null;
};
