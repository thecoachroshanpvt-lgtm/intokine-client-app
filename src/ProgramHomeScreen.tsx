import React, { useState } from 'react';

type ProgramCategory = 'ZAKI' | 'KATBA' | 'Personal Training' | 'Online Personal Training';

interface ProgramHomeScreenProps {
  clientName: string;
  programCategory: ProgramCategory;
  onEnter: () => void;
}

const PROGRAM_ACCENT: Record<ProgramCategory, string> = {
  ZAKI: '#6ccbde',
  KATBA: '#ec2226',
  'Personal Training': '#ec2226',
  'Online Personal Training': '#6ccbde',
};

const PROGRAM_TAGLINE: Record<ProgramCategory, string> = {
  ZAKI: 'Your structured training program',
  KATBA: 'Your structured training program',
  'Personal Training': 'Your dedicated coaching program',
  'Online Personal Training': 'Your dedicated coaching program',
};

export const ProgramHomeScreen: React.FC<ProgramHomeScreenProps> = ({ clientName, programCategory, onEnter }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = PROGRAM_ACCENT[programCategory];

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1c1c1c] flex flex-col justify-between">
      {!imageFailed ? (
        <img
          src="/program-home-photo.jpg"
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, #1c1c1c 0%, #1c1c1c 50%, ${accent} 140%)` }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0.8) 100%)' }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center">
        <span className="text-xs font-semibold tracking-[0.25em] text-[#6ccbde] mb-4">
          WELCOME BACK, {clientName.toUpperCase()}
        </span>
        <h1 className="font-header text-5xl sm:text-7xl text-white leading-[0.95] mb-3">
          {programCategory.toUpperCase()}
        </h1>
        <p className="text-base sm:text-lg text-white/80 font-light max-w-xs sm:max-w-md leading-relaxed">
          {PROGRAM_TAGLINE[programCategory]}
        </p>
      </div>

      <div className="relative z-10 px-8 pb-10 sm:pb-14">
        <button
          onClick={onEnter}
          className="w-full sm:w-auto sm:mx-auto sm:block sm:px-16 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-[0.98] transition"
          style={{ background: `linear-gradient(90deg, #ec2226, #6ccbde)` }}
        >
          ENTER
        </button>
      </div>
    </div>
  );
};
