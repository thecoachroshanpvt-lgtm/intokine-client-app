import React, { useState } from 'react';

type ProgramType = 'Weight Training' | 'Calisthenics' | 'CrossFit' | 'Hyrox Training' | 'Boxing Training' | 'Kickboxing Training' | 'Karate Training';
type ServiceType = 'Offline Personal Training' | 'Online Personal Training' | 'Couple Training' | 'Online Batch Training' | 'Offline Batch Training';

interface ProgramHomeScreenProps {
  clientName: string;
  programType: ProgramType;
  service: ServiceType;
  onEnter: () => void;
}

// A simple accent rule rather than a lookup sized for every
// combination - all program types currently use the standard
// crimson accent.
function getAccent(programType: ProgramType): string {
  return '#ec2226';
}

export const ProgramHomeScreen: React.FC<ProgramHomeScreenProps> = ({ clientName, programType, service, onEnter }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = getAccent(programType);

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
        <h1 className="font-header text-4xl sm:text-6xl text-white leading-[0.95] mb-3">
          {programType.toUpperCase()}
        </h1>
        <p className="text-base sm:text-lg text-white/80 font-light max-w-xs sm:max-w-md leading-relaxed">
          {service}
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
