import React from 'react';

// The suggested workout card shown on Home / Plans / Schedule: a dark card with a coloured accent bar on its left edge
// (cyan while to do, green once done). No gradient and no picture.
interface Props {
  title: string;
  label: string;          // small line above the title, e.g. "Do it yourself"
  hint?: string;          // line under the title
  done: boolean;
  onClick: () => void;
}

export const SuggestedWorkoutCard: React.FC<Props> = ({ title, label, hint, done, onClick }) => {
  const color = done ? '#34d399' : '#ec2226';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden w-full text-left rounded-2xl py-4 pl-5 pr-4 flex items-center gap-3 bg-[#252525] border border-white/[0.06] transition active:scale-[0.99] ${done ? '' : 'ik-nudge-box'}`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: done ? '#34d399' : '#6ccbde' }} />
      <div className="flex-1 min-w-0">
        <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">{label}</div>
        <div className="font-subheader text-[19px] text-white mt-1.5 truncate">{title}</div>
        {hint ? <div className="text-[11px] text-white/60 truncate">{hint}</div> : null}
      </div>
      <span
        className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}26` }}
      >
        {done ? 'DONE' : 'ASSIGNED'}
      </span>
    </button>
  );
};
