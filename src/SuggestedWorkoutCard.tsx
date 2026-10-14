import React from 'react';

// Both cards (suggested workout and session with coach) carry a faint line sketch on the right instead of a photo,
// so the pages keep one clean look. The sketches are drawn in code - no image files needed.
const svgUrl = (inner: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  )}")`;

const LINE = 'rgba(255,255,255,0.13)';
const CYAN = 'rgba(108,203,222,0.34)';

// Calisthenics: a pull-up bar with hanging rings.
const BAR_SKETCH = svgUrl(
  `<g stroke="${LINE}" stroke-width="2"><path d="M30 74V14M130 74V14M30 14H130M16 74H144"/></g>` +
  `<g stroke="${CYAN}" stroke-width="2"><path d="M70 14V32M90 14V32"/><circle cx="70" cy="40" r="8"/><circle cx="90" cy="40" r="8"/></g>`
);

// Coach session: a stopwatch.
const WATCH_SKETCH = svgUrl(
  `<g stroke="${LINE}" stroke-width="2"><circle cx="100" cy="46" r="24"/><path d="M92 14h16M100 14v8M118 28l6-6"/><path d="M100 26v3M124 46h-3M100 70v-3M76 46h3"/></g>` +
  `<g stroke="${CYAN}" stroke-width="2"><path d="M100 46V33M100 46l10 6"/></g>`
);

const BRAND = 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))';

// The session-with-coach card background (used on Home and Schedule).
export const SESSION_CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#252525',
  backgroundImage: WATCH_SKETCH,
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'auto 92%',
  backgroundPosition: 'right 44px center',
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
        backgroundImage: `${BAR_SKETCH}, ${BRAND}`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 92%, cover',
        backgroundPosition: 'right 56px center, center',
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
