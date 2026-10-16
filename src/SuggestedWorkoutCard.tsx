import React from 'react';
import { AskPostponeButton } from './CoachContact';

// The suggested workout card shown on Home / Plans / Schedule / Workouts: a plain dark card. No gradient, picture or side bar.
// A workout that is still to do also has an "Ask coach to postpone" button, which opens WhatsApp to the assigned coach.
interface Props {
  title: string;
  label: string;          // small line above the title, e.g. "Do it yourself"
  hint?: string;          // line under the title
  done: boolean;
  /** True when the assigned day has passed and the workout was not done (and not moved to another day). */
  missed?: boolean;
  onClick: () => void;
  /** Passed for workouts that can still be postponed (not done, today or later). */
  postpone?: { clientId: string; coachName?: string; date: string };
  /** Set when the coach already moved the workout: where it was moved from and why. */
  postponedFrom?: string;
  postponeReason?: string;
}

const prettyDate = (k: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : k;
};

export const SuggestedWorkoutCard: React.FC<Props> = ({ title, label, hint, done, missed, onClick, postpone, postponedFrom, postponeReason }) => {
  const isMissed = !!missed && !done;
  const color = done ? '#34d399' : isMissed ? '#a1a1aa' : '#ec2226';
  const canAsk = !!postpone && !done;
  return (
    <div className={`w-full rounded-2xl bg-[#252525] border border-white/[0.06] ${done || isMissed ? '' : 'ik-nudge-box'}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-4 flex items-center gap-3 transition active:scale-[0.99]"
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
          {done ? 'DONE' : isMissed ? 'NOT DONE' : 'ASSIGNED'}
        </span>
      </button>
      {!done && postponeReason ? (
        <p className="px-4 pb-3 text-[11px] text-amber-300/90 font-light">
          Postponed{postponedFrom ? ` from ${prettyDate(postponedFrom)}` : ''} · {postponeReason}
        </p>
      ) : null}
      {canAsk && (
        <div className="px-4 pb-3">
          <AskPostponeButton clientId={postpone!.clientId} coachName={postpone!.coachName} what={`my workout "${title}" scheduled for ${prettyDate(postpone!.date)}`} />
        </div>
      )}
    </div>
  );
};
