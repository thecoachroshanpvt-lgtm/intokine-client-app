import React from 'react';

// Both cards (suggested workout and session with coach) carry a faint line sketch on the right.
// The sketches are image files in the public folder: sketch-workout.jpg and sketch-session.jpg (.jpeg also works).
// They are line art on a pure BLACK background; "screen" blending makes the black disappear into the card,
// so only the lines show. If a file is missing the card simply shows without a sketch.
const BRAND = 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))';

// The session-with-coach card background (used on Home and Schedule).
export const SESSION_CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#252525',
  backgroundImage: 'url(/sketch-session.jpg), url(/sketch-session.jpeg)',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'auto 92%',
  backgroundPosition: 'right 12px center',
  backgroundBlendMode: 'screen',
};

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
        backgroundColor: '#252525',
        backgroundImage: `url(/sketch-workout.jpg), url(/sketch-workout.jpeg), ${BRAND}`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 92%, auto 92%, cover',
        backgroundPosition: 'right 12px center, right 12px center, center',
        backgroundBlendMode: 'screen, screen, normal',
      }}
    >
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
