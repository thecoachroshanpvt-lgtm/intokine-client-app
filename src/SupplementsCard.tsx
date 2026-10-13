import React from 'react';

// Supplements the nutritionist put in the diet plan. The client taps the ones taken today; a popup then asks to confirm.
export const SupplementsCard: React.FC<{
  items: { id: string; name: string; detail?: string }[];
  taken: Set<string>;
  onToggle: (id: string) => void;
}> = ({ items, taken, onToggle }) => {
  if (items.length === 0) return null;
  const done = items.filter((x) => taken.has(x.id)).length;
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde]">Supplements</div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${done === items.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-white/50'}`}>
          {done === items.length ? 'All taken' : `${done}/${items.length}`}
        </span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.map((x) => {
          const on = taken.has(x.id);
          return (
            <button key={x.id} type="button" onClick={() => onToggle(x.id)} aria-pressed={on} className="w-full flex items-center gap-3 text-left py-3">
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent ik-nudge'}`}>✓</span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold truncate ${on ? 'text-white/50' : 'text-white'}`}>{x.name}</span>
                {x.detail && <span className="block text-[11px] text-white/45 font-light truncate">{x.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
