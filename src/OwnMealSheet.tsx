import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Macro, MealEntry } from './dietMacros';
import { estimateFoods, foodsText, FOOD_UNITS } from './aiFoods';
import type { FoodRow, FoodSaved } from './aiFoods';

// The popup for adding (or editing) a meal on a "targets only" diet plan: the client lists each food with its quantity, then the AI fills the calories and macros (still editable). No photo.
export interface OwnMealResult {
  mealTime: string;
  note: string;
  foods: FoodSaved[];
  macros: Macro;
}

// Keeps only digits and one dot, so a number box never holds letters.
const cleanNumber = (v: string) => {
  const x = v.replace(/[^0-9.]/g, '');
  const i = x.indexOf('.');
  return i === -1 ? x : x.slice(0, i + 1) + x.slice(i + 1).replace(/\./g, '');
};

export const OwnMealSheet: React.FC<{
  mealTimes: string[];
  icons: Record<string, string>;
  existing?: MealEntry;
  saving: boolean;
  error: string;
  onSave: (r: OwnMealResult) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ mealTimes, icons, existing, saving, error, onSave, onDelete, onClose }) => {
  const [mealTime, setMealTime] = useState(existing?.mealTime && mealTimes.includes(existing.mealTime) ? existing.mealTime : 'Breakfast');
  const [foods, setFoods] = useState<FoodRow[]>(() => {
    const saved = (existing as any)?.foods as FoodSaved[] | undefined;
    return saved && saved.length ? saved.map((x) => ({ name: x.name, qty: String(x.qty), unit: x.unit })) : [{ name: '', qty: '', unit: 'g' }];
  });
  const [oldNote] = useState(existing?.note || '');
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const [kcal, setKcal] = useState(existing?.macros ? String(existing.macros.kcal) : '');
  const [p, setP] = useState(existing?.macros ? String(existing.macros.p) : '');
  const [c, setC] = useState(existing?.macros ? String(existing.macros.c) : '');
  const [f, setF] = useState(existing?.macros ? String(existing.macros.f) : '');

  const validFoods: FoodSaved[] = foods
    .map((x) => ({ name: x.name.trim(), qty: Number(x.qty) || 0, unit: x.unit }))
    .filter((x) => x.name && x.qty > 0);
  const changeFoods = (next: FoodRow[]) => { setFoods(next); setAiDone(false); setAiErr(''); };
  const setRow = (i: number, part: Partial<FoodRow>) => changeFoods(foods.map((x, k) => (k === i ? { ...x, ...part } : x)));
  const removeRow = (i: number) => changeFoods(foods.length === 1 ? [{ name: '', qty: '', unit: 'g' }] : foods.filter((_, k) => k !== i));
  const estimate = async () => {
    if (busy || validFoods.length === 0) return;
    setBusy(true);
    setAiErr('');
    try {
      const r = await estimateFoods(mealTime, validFoods);
      setKcal(String(r.kcal)); setP(String(r.p)); setC(String(r.c)); setF(String(r.f));
      setAiDone(true);
    } catch (e: any) {
      setAiErr(e && e.message ? e.message : 'The estimate did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const kcalNum = Number(kcal) || 0;
  const canSave = !saving && kcalNum > 0;
  const save = () => {
    if (!canSave) return;
    onSave({
      mealTime,
      note: validFoods.length ? foodsText(validFoods).slice(0, 300) : oldNote,
      foods: validFoods,
      macros: { kcal: Math.round(kcalNum), p: Math.round((Number(p) || 0) * 10) / 10, c: Math.round((Number(c) || 0) * 10) / 10, f: Math.round((Number(f) || 0) * 10) / 10 },
    });
  };

  const boxes: { label: string; unit: string; value: string; set: (v: string) => void; color: string }[] = [
    { label: 'Calories', unit: 'kcal', value: kcal, set: setKcal, color: '#ffffff' },
    { label: 'Protein', unit: 'g', value: p, set: setP, color: '#6ccbde' },
    { label: 'Carbs', unit: 'g', value: c, set: setC, color: '#ffffff' },
    { label: 'Fats', unit: 'g', value: f, set: setF, color: '#ec2226' },
  ];

  return createPortal(
    <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div data-no-pull className="anim-card w-full max-w-sm max-h-[88vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
          <div>
            <div className="font-subheader text-[17px] text-white">{existing ? 'Edit meal' : 'Add a meal'}</div>
            <div className="text-[11px] text-white/40">List your foods, then let AI fill the calories and macros</div>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
          <div>
            <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">Which meal?</div>
            <div className="flex gap-1.5 flex-wrap">
              {mealTimes.map((t) => (
                <button key={t} type="button" onClick={() => setMealTime(t)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${t === mealTime ? 'bg-[#6ccbde]/15 text-[#6ccbde] border-[#6ccbde]/50' : 'border-white/[0.1] text-white/55'}`}>
                  {icons[t] || '🍴'} {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">What did you eat?</div>
            <div className="space-y-2">
              {foods.map((x, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={x.name} onChange={(e) => setRow(i, { name: e.target.value.slice(0, 60) })} placeholder="Food, e.g. Milk"
                    className="min-w-0 flex-1 bg-black/30 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-[#6ccbde]" />
                  <input value={x.qty} onChange={(e) => setRow(i, { qty: cleanNumber(e.target.value).slice(0, 6) })} inputMode="decimal" placeholder="Qty"
                    className="w-14 bg-black/30 border border-white/[0.1] rounded-xl px-1 py-2.5 text-xs font-mono text-center text-white placeholder-white/25 focus:outline-none focus:border-[#6ccbde]" />
                  <select value={x.unit} onChange={(e) => setRow(i, { unit: e.target.value })}
                    className="w-[62px] bg-black/30 border border-white/[0.1] rounded-xl px-1 py-2.5 text-xs text-white focus:outline-none focus:border-[#6ccbde]">
                    {FOOD_UNITS.map((u) => <option key={u} value={u} className="bg-[#1c1c1c]">{u}</option>)}
                  </select>
                  <button type="button" onClick={() => removeRow(i)} className="text-white/35 text-lg leading-none px-1" aria-label="Remove food">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              {foods.length < 15 ? (
                <button type="button" onClick={() => changeFoods([...foods, { name: '', qty: '', unit: 'g' }])} className="text-[11px] font-bold text-[#6ccbde] py-1">+ Add food</button>
              ) : <span />}
              <button type="button" disabled={busy || validFoods.length === 0} onClick={estimate}
                className="px-3.5 py-2 rounded-xl border border-[#6ccbde]/50 bg-[#6ccbde]/10 text-[#6ccbde] text-[11px] font-bold disabled:opacity-40">
                {busy ? 'Estimating...' : aiDone ? '✨ Estimate again' : '✨ Estimate with AI'}
              </button>
            </div>
            {aiErr && <p className="text-[10px] text-amber-300 mt-1.5">{aiErr}</p>}
            {oldNote && validFoods.length === 0 && <p className="text-[10px] text-white/35 mt-1.5">Earlier note: {oldNote}</p>}
          </div>

          <div>
            <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">Calories and macros {aiDone && <span className="normal-case font-normal text-white/35">(AI estimate - you can change it)</span>}</div>
            <div className="grid grid-cols-4 gap-2">
              {boxes.map((b) => (
                <label key={b.label} className="block text-center">
                  <input value={b.value} onChange={(e) => b.set(cleanNumber(e.target.value))} inputMode="decimal" placeholder="0"
                    className="w-full bg-black/30 border border-white/[0.1] rounded-xl px-1 py-2.5 text-sm font-bold font-mono text-center placeholder-white/20 focus:outline-none focus:border-[#6ccbde]" style={{ color: b.color }} />
                  <span className="block text-[9px] text-white/40 uppercase mt-1">{b.label}<span className="normal-case"> ({b.unit})</span></span>
                </label>
              ))}
            </div>
            {kcal !== '' && kcalNum <= 0 && <p className="text-[10px] text-amber-300 mt-1.5">Enter the calories of this meal.</p>}
          </div>
          {error && <p className="text-xs text-[#ec2226]">{error}</p>}
        </div>

        <div className="p-3 border-t border-white/[0.08] flex items-center gap-2">
          {existing ? (
            <button type="button" disabled={saving} onClick={onDelete} className="flex-1 py-2.5 rounded-xl border border-[#ec2226]/40 text-xs font-bold text-[#ec2226]">Delete</button>
          ) : (
            <button type="button" disabled={saving} onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Cancel</button>
          )}
          <button type="button" disabled={!canSave} onClick={save} className="flex-[2] py-2.5 rounded-xl bg-[#ec2226] disabled:opacity-40 text-white text-xs font-bold">
            {saving ? 'Saving...' : 'Save meal'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
