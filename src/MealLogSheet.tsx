import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compressMealPhoto } from './mealPhoto';
import { PORTIONS, scaleMacro } from './dietMacros';
import type { Macro, MealEntry } from './dietMacros';

// The popup for one meal: what did you eat (plan / something else / skipped), which option, how much, and the photo.
export interface SheetMeal {
  id: string;
  mealTime: string;
  description: string;
  base: Macro; // the meal's own macros, when it has no options
  variants: { id: string; label: string; lines: string[]; macros: Macro }[];
}

export interface SheetResult {
  status: 'eaten' | 'else' | 'skipped' | 'none';
  variantId?: string;
  variantLabel?: string;
  portion?: number;
  note?: string;
  photoDataUrl?: string; // only when a new photo was taken
  macros?: Macro;
}

export const MealLogSheet: React.FC<{
  meal: SheetMeal;
  existing?: MealEntry;
  saving: boolean;
  error: string;
  onSave: (r: SheetResult) => void;
  onClose: () => void;
}> = ({ meal, existing, saving, error, onSave, onClose }) => {
  const startMode: 'plan' | 'else' | 'skip' = existing?.status === 'else' ? 'else' : existing?.status === 'skipped' ? 'skip' : 'plan';
  const [mode, setMode] = useState<'plan' | 'else' | 'skip'>(startMode);
  const firstVar = Math.max(0, meal.variants.findIndex((v) => v.id === existing?.variantId));
  const [vi, setVi] = useState(firstVar);
  const [portion, setPortion] = useState(existing?.status === 'eaten' && existing.portion ? existing.portion : 1);
  const [note, setNote] = useState(existing?.note || '');
  const [photo, setPhoto] = useState<string>('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null); // camera
  const galleryRef = useRef<HTMLInputElement>(null); // photos already on the phone

  const hadPhoto = !!existing?.photo && (existing.status === 'eaten' || existing.status === 'else');
  const hasPhoto = !!photo || hadPhoto;
  const v = meal.variants[vi];
  const base = v ? v.macros : meal.base;
  const shownMacro = scaleMacro(base, portion);

  const pick = async (f?: File | null) => {
    if (!f) return;
    setPhotoBusy(true);
    setPhotoErr('');
    try {
      setPhoto(await compressMealPhoto(f));
    } catch {
      setPhotoErr('Could not use this photo. Please try again.');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const canSave = !saving && !photoBusy && (mode === 'skip' || (hasPhoto && (mode === 'plan' || note.trim().length >= 2)));
  const save = () => {
    if (!canSave) return;
    if (mode === 'skip') return onSave({ status: 'skipped' });
    if (mode === 'plan') {
      return onSave({ status: 'eaten', variantId: v?.id, variantLabel: v?.label, portion, photoDataUrl: photo || undefined, macros: scaleMacro(base, portion) });
    }
    onSave({ status: 'else', note: note.trim(), photoDataUrl: photo || undefined });
  };

  return createPortal(
    <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div data-no-pull className="anim-card w-full max-w-sm max-h-[88vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
          <div>
            <div className="font-subheader text-[17px] text-white">{meal.mealTime}</div>
            <div className="text-[11px] text-white/40">Add a photo of your meal to log it</div>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/30">
            {([['plan', 'My plan'], ['else', 'Something else'], ['skip', 'Skipped']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`py-2 rounded-lg text-[11px] font-bold ${mode === k ? (k === 'skip' ? 'bg-[#ec2226] text-white' : 'bg-[#6ccbde] text-[#0d0e12]') : 'text-white/55'}`}>{l}</button>
            ))}
          </div>

          {mode === 'plan' && (
            <>
              {meal.variants.length > 1 && (
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">Which option did you eat?</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {meal.variants.map((x, i) => (
                      <button key={x.id} type="button" onClick={() => setVi(i)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${i === vi ? 'bg-[#6ccbde]/15 text-[#6ccbde] border-[#6ccbde]/50' : 'border-white/[0.1] text-white/55'}`}>{x.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-white/60 font-light leading-relaxed">
                {(v ? v.lines : [meal.description]).map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <div>
                <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">How much did you eat?</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PORTIONS.map((p) => (
                    <button key={p.value} type="button" onClick={() => setPortion(p.value)}
                      className={`py-2 rounded-xl text-xs font-bold border ${portion === p.value ? 'bg-[#6ccbde]/15 text-[#6ccbde] border-[#6ccbde]/50' : 'border-white/[0.1] text-white/55'}`}>
                      {p.label}
                      <span className="block text-[9px] font-normal text-white/40">{p.value === 1 ? 'as planned' : p.value < 1 ? 'half portion' : '1½ portions'}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 divide-x divide-white/[0.08] text-center mt-3 pt-3 border-t border-white/[0.06]">
                  {([['kcal', shownMacro.kcal, '', '#ffffff'], ['Protein', shownMacro.p, 'g', '#6ccbde'], ['Carbs', shownMacro.c, 'g', '#ffffff'], ['Fats', shownMacro.f, 'g', '#ec2226']] as const).map(([l, val, u, c]) => (
                    <div key={l} className="px-1">
                      <div className="text-sm font-bold font-mono leading-none" style={{ color: c }}>{val}<span className="text-[9px] font-normal text-white/40">{u}</span></div>
                      <div className="text-[9px] text-white/40 uppercase mt-1">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'else' && (
            <div>
              <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">What did you eat?</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} placeholder="e.g. 2 rotis with dal and a small salad"
                className="w-full bg-black/30 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-[#6ccbde]" />
              <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">Your nutritionist will check the photo and add the calories and macros for you. It shows as waiting until then.</p>
            </div>
          )}

          {mode !== 'skip' && (
            <div>
              <div className="text-[10px] text-white/40 uppercase font-semibold mb-1.5">Photo of your meal <span className="text-[#ec2226]">(required)</span> <span className="normal-case font-normal text-white/30">· take one now or pick one you took earlier</span></div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {photo ? (
                <div className="flex items-center gap-3">
                  <img src={photo} alt="Your meal" className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]" />
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => fileRef.current?.click()} className="text-left text-[11px] font-bold text-[#6ccbde]">Retake photo</button>
                    <button type="button" onClick={() => galleryRef.current?.click()} className="text-left text-[11px] font-bold text-[#6ccbde]">Choose from gallery</button>
                  </div>
                </div>
              ) : hadPhoto ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-emerald-400 font-semibold">✓ Photo saved</span>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-bold text-[#6ccbde]">Take a new one</button>
                  <button type="button" onClick={() => galleryRef.current?.click()} className="text-[11px] font-bold text-[#6ccbde]">Choose from gallery</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
                    className="py-5 rounded-xl border border-dashed border-[#6ccbde]/50 text-[#6ccbde] text-xs font-bold bg-[#6ccbde]/[0.05] disabled:opacity-60">
                    {photoBusy ? 'Preparing photo...' : '📷  Take a photo'}
                  </button>
                  <button type="button" onClick={() => galleryRef.current?.click()} disabled={photoBusy}
                    className="py-5 rounded-xl border border-dashed border-[#6ccbde]/50 text-[#6ccbde] text-xs font-bold bg-[#6ccbde]/[0.05] disabled:opacity-60">
                    {photoBusy ? 'Preparing photo...' : '🖼️  From gallery'}
                  </button>
                </div>
              )}
              {photoErr && <p className="text-[11px] text-[#ec2226] mt-1.5">{photoErr}</p>}
            </div>
          )}

          {mode === 'skip' && <p className="text-xs text-white/50 leading-relaxed">No photo needed. This meal counts as 0 for today.</p>}
          {error && <p className="text-xs text-[#ec2226]">{error}</p>}
        </div>

        <div className="p-3 border-t border-white/[0.08] flex items-center gap-2">
          {existing && existing.status !== 'none' ? (
            <button type="button" disabled={saving} onClick={() => onSave({ status: 'none' })} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Clear</button>
          ) : (
            <button type="button" disabled={saving} onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-xs font-bold text-white/70">Cancel</button>
          )}
          <button type="button" disabled={!canSave} onClick={save} className="flex-[2] py-2.5 rounded-xl bg-[#ec2226] disabled:opacity-40 text-white text-xs font-bold">
            {saving ? 'Saving...' : mode === 'skip' ? 'Mark as skipped' : mode === 'else' ? 'Save meal' : 'Save meal eaten'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
