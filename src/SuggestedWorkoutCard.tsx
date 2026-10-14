import React from 'react';

// The "suggested workout" card shown on Home / Plans / Schedule. It has one motivating calisthenics photo on the right
// (public/suggested-workout.jpg - no people, no weights). If the file is missing, the brand gradient shows instead.
const IMAGE = '/suggested-workout.jpg';
const BRAND = 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))';

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
      className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition active:scale-[0.99]"
      style={{
        background: `linear-gradient(90deg, rgba(28,28,28,0.94) 32%, rgba(28,28,28,0.3) 100%), url(${IMAGE}), ${BRAND}, #252525`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-12 h-12 shrink-0 rounded-full bg-black/40 flex items-center justify-center text-[24px] leading-none">🏋️</div>
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
