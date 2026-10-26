import React, { useState } from 'react';

// Zaki: what the client really did on one exercise when they could not do the coach's numbers.
// Saved on the workout (intokine_given_session_plans) as clientExerciseResults[exerciseId] = { edited: true, sets: [...] }.
export interface SetResult {
  weightKg?: number;
  reps?: number;
  rpe?: number;
  holdSeconds?: number;
  durationMinutes?: number;
  distanceKm?: number;
}
export interface ExerciseResult { edited: boolean; sets: SetResult[]; rpe?: number } // rpe: how hard the exercise felt (1-10), entered by the client
export type ResultMap = Record<string, ExerciseResult>;

type Kind = 'Weighted' | 'Bodyweight' | 'Isometric' | 'DistanceCardio' | 'DurationCardio';
interface Field { key: keyof SetResult; label: string; unit?: string; step: string }

const FIELDS: Record<Kind, Field[]> = {
  Weighted: [
    { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.5' },
    { key: 'reps', label: 'Reps', step: '1' },
    { key: 'rpe', label: 'RPE', step: '0.5' },
  ],
  Bodyweight: [
    { key: 'reps', label: 'Reps', step: '1' },
    { key: 'rpe', label: 'RPE', step: '0.5' },
  ],
  Isometric: [
    { key: 'holdSeconds', label: 'Hold', unit: 'sec', step: '1' },
    { key: 'rpe', label: 'RPE', step: '0.5' },
  ],
  DistanceCardio: [
    { key: 'distanceKm', label: 'Distance', unit: 'km', step: '0.1' },
    { key: 'durationMinutes', label: 'Time', unit: 'min', step: '1' },
  ],
  DurationCardio: [
    { key: 'durationMinutes', label: 'Time', unit: 'min', step: '1' },
    { key: 'distanceKm', label: 'Distance', unit: 'km', step: '0.1' },
  ],
};

const kindOf = (t?: string): Kind => (t === 'TimeDistanceCardio' ? 'DistanceCardio' : t === 'Drill' ? 'DurationCardio' : t === 'Bodyweight' || t === 'Isometric' || t === 'DistanceCardio' || t === 'DurationCardio' ? t : 'Weighted');

/** The coach's planned numbers for one set, in the same fields the client edits. RPE is left empty: the client enters it after training. */
export const targetOf = (kind: string | undefined, s: any): SetResult => {
  const k = kindOf(kind);
  if (k === 'Weighted') return { weightKg: s.targetWeightKg || 0, reps: s.targetReps || 0 };
  if (k === 'Bodyweight') return { reps: s.targetReps || 0 };
  if (k === 'Isometric') return { holdSeconds: s.holdSeconds || 0 };
  if (k === 'DistanceCardio') return { distanceKm: s.distanceKm || 0, durationMinutes: s.durationMinutes };
  return { durationMinutes: s.durationMinutes || 0, distanceKm: s.distanceKm };
};

/** "40 kg × 8 · RPE 8" style text for one set. */
export const setText = (kind: string | undefined, r: SetResult): string => {
  const k = kindOf(kind);
  const rpe = r.rpe ? ` · RPE ${r.rpe}` : '';
  if (k === 'Weighted') return `${r.weightKg ?? 0} kg × ${r.reps ?? 0}${rpe}`;
  if (k === 'Bodyweight') return `${r.reps ?? 0} reps${rpe}`;
  if (k === 'Isometric') return `${r.holdSeconds ?? 0} sec hold${rpe}`;
  if (k === 'DistanceCardio') return `${r.distanceKm ?? 0} km${r.durationMinutes ? ` in ${r.durationMinutes} min` : ''}`;
  return `${r.durationMinutes ?? 0} min${r.distanceKm ? ` · ${r.distanceKm} km` : ''}`;
};

export const ExerciseResultEditor: React.FC<{
  kind?: string;
  sets: any[];
  initial?: ExerciseResult;
  onSave: (r: ExerciseResult) => void;
  onCancel: () => void;
  onReset?: () => void;
}> = ({ kind, sets, initial, onSave, onCancel, onReset }) => {
  const fields = FIELDS[kindOf(kind)];
  const rows = sets.length > 0 ? sets : [{}];
  const [draft, setDraft] = useState<Record<string, string>[]>(() =>
    rows.map((s, i) => {
      const base = initial?.sets?.[i] || targetOf(kind, s);
      const d: Record<string, string> = {};
      fields.forEach((f) => { const v = base[f.key]; d[f.key] = v === undefined || v === null || v === 0 ? '' : String(v); });
      return d;
    })
  );
  const setVal = (i: number, key: string, v: string) => setDraft((prev) => prev.map((d, j) => (j === i ? { ...d, [key]: v } : d)));
  const save = () => {
    const out: SetResult[] = draft.map((d) => {
      const r: SetResult = {};
      fields.forEach((f) => { const n = parseFloat(d[f.key]); if (!isNaN(n) && n >= 0) (r as any)[f.key] = n; });
      return r;
    });
    onSave({ edited: true, sets: out });
  };
  return (
    <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">What I did</div>
      <p className="text-[11px] text-white/50 mt-0.5">Change the numbers to what you actually did.</p>
      <div className="mt-2.5 space-y-2">
        {draft.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            {draft.length > 1 && <span className="w-5 pb-2 text-center font-mono text-[11px] text-white/40">{i + 1}</span>}
            {fields.map((f) => (
              <label key={f.key} className="flex-1 min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={f.step}
                  value={d[f.key]}
                  onChange={(e) => setVal(i, f.key, e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/[0.1] rounded-lg px-2 py-2 text-center font-mono text-[15px] text-white focus:outline-none focus:border-amber-300"
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} className="flex-1 py-2.5 rounded-xl bg-amber-300 text-[#1c1c1c] font-subheader text-[13px] uppercase tracking-wide">Save what I did</button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/[0.06] text-white/70 text-[12px] font-semibold">Cancel</button>
      </div>
      {onReset && <button type="button" onClick={onReset} className="mt-2 w-full text-center text-[11px] text-white/45 underline">I did the planned numbers after all</button>}
    </div>
  );
};
