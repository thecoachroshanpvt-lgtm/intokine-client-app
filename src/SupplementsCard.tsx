import React from 'react';

// Supplements the nutritionist put in the diet plan. The client taps each one when taken (saved with today's meal ticks).
export const SupplementsCard: React.FC<{
  items: { id: string; name: string; detail?: string }[];
  taken: Set<string>;
  onToggle: (id: string) => void;
}> = ({ items, taken, onToggle }) => {
  if (items.length === 0) return null;
  const done = items.filter((x) => taken.has(x.id)).length;
  return (
    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Supplements</div>
          <div className="text-[11px] text-white/40 font-light">Tap each one when you have taken it today</div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${done === items.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#ec2226]/15 text-[#ec2226]'}`}>
          {done === items.length ? 'All taken' : `${done}/${items.length}`}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((x) => {
          const on = taken.has(x.id);
          return (
            <button key={x.id} type="button" onClick={() => onToggle(x.id)} aria-pressed={on}
              className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition ${on ? 'bg-emerald-500/10 border-emerald-500/30' : 'border-white/15'}`}>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent'}`}>✓</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-white truncate">{x.name}</span>
                {x.detail && <span className="block text-[11px] text-white/50 font-light truncate">{x.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
