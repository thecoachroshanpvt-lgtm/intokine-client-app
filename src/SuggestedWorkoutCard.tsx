import React from 'react';

// Both cards (suggested workout and session with coach) carry a faint line sketch on the right, faded the same way as the
// illustrations on the Progress > Performance category cards. The sketches are image files in the public folder:
// sketch-workout.jpg and sketch-session.jpg (.jpeg also works). They are line art on a pure BLACK background;
// "screen" blending makes the black disappear into the card, so only the lines show. A missing file shows nothing.
const BRAND = 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))';
const SKETCH_OPACITY = 0.3; // raise to make the sketch stronger, lower to make it fainter

export const CardSketch: React.FC<{ kind: 'workout' | 'session' }> = ({ kind }) => (
  <img
    src={`/sketch-${kind}.jpg`}
    alt=""
    aria-hidden="true"
    draggable={false}
    onError={(e) => {
      const el = e.currentTarget;
      if (el.src.endsWith('.jpg')) el.src = el.src.replace(/\.jpg$/, '.jpeg');
      else el.style.display = 'none';
    }}
    className="absolute right-2 top-1/2 -translate-y-1/2 h-[92%] w-auto max-w-[70%] object-contain mix-blend-screen pointer-events-none select-none"
    style={{ opacity: SKETCH_OPACITY }}
  />
);

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
      className="relative overflow-hidden w-full text-left rounded-2xl p-4 flex items-center gap-3 transition active:scale-[0.99]"
      style={{ backgroundColor: '#252525', backgroundImage: BRAND }}
    >
      <CardSketch kind="workout" />
      <div className="relative flex-1 min-w-0">
        <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">{label}</div>
        <div className="font-subheader text-[19px] text-white mt-1.5 truncate">{title}</div>
        {hint ? <div className="text-[11px] text-white/60 truncate">{hint}</div> : null}
      </div>
      <span
        className="relative text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}26` }}
      >
        {done ? 'DONE' : 'ASSIGNED'}
      </span>
    </button>
  );
};
