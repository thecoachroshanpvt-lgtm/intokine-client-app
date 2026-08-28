import React from 'react';

type ProgramCategory = 'ZAKI' | 'KATBA' | 'Personal Training' | 'Online Personal Training';

interface ProgramHomeScreenProps {
  clientName: string;
  programCategory: ProgramCategory;
  onEnter: () => void;
}

const PROGRAM_STYLES: Record<ProgramCategory, { gradient: string; tagline: string }> = {
  ZAKI: {
    gradient: 'linear-gradient(135deg, #6ccbde, #1c1c1c)',
    tagline: 'Your structured training program',
  },
  KATBA: {
    gradient: 'linear-gradient(135deg, #ec2226, #1c1c1c)',
    tagline: 'Your structured training program',
  },
  'Personal Training': {
    gradient: 'linear-gradient(135deg, #ec2226, #6ccbde)',
    tagline: 'Your dedicated coaching program',
  },
  'Online Personal Training': {
    gradient: 'linear-gradient(135deg, #6ccbde, #ec2226)',
    tagline: 'Your dedicated coaching program',
  },
};

export const ProgramHomeScreen: React.FC<ProgramHomeScreenProps> = ({ clientName, programCategory, onEnter }) => {
  const style = PROGRAM_STYLES[programCategory];

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-[11px] text-white/50 font-light tracking-wide">WELCOME, {clientName.toUpperCase()}</p>
        </div>

        <button
          onClick={onEnter}
          className="w-full rounded-3xl p-8 text-left shadow-2xl active:scale-[0.98] transition"
          style={{ background: style.gradient }}
        >
          <span className="font-header text-4xl text-white block leading-none mb-2">
            {programCategory.toUpperCase()}
          </span>
          <span className="text-sm text-white/80 font-light block">{style.tagline}</span>
          <span className="text-xs text-white/70 font-semibold mt-4 inline-block">ENTER →</span>
        </button>
      </div>
    </div>
  );
};
