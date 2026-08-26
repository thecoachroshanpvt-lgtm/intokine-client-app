import React, { useState } from 'react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    eyebrow: 'INTOKINE',
    headline: 'TRAIN WITH PURPOSE',
    body: 'Every session, every rep, planned by your coach and built around you.',
    angle: '135deg',
  },
  {
    eyebrow: 'YOUR PROGRESS',
    headline: 'ALWAYS IN VIEW',
    body: 'See your training plan the moment your coach shares it — no waiting, no guessing.',
    angle: '225deg',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div
      className="min-h-screen flex flex-col justify-between overflow-hidden relative"
      style={{
        background: `linear-gradient(${slide.angle}, #1c1c1c 0%, #1c1c1c 45%, #ec2226 100%)`,
      }}
    >
      {/* Signature diagonal energy line */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-10%',
          right: '-15%',
          width: '140%',
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #6ccbde, transparent)',
          transform: 'rotate(28deg)',
          opacity: 0.7,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '18%',
          left: '-20%',
          width: '140%',
          height: '1.5px',
          background: 'linear-gradient(90deg, transparent, #6ccbde, transparent)',
          transform: 'rotate(28deg)',
          opacity: 0.35,
        }}
      />

      {/* Skip */}
      <div className="flex justify-end p-5 sm:p-8 relative z-10">
        {!isLast && (
          <button
            onClick={onComplete}
            className="text-xs text-white/60 hover:text-white font-semibold tracking-wide"
          >
            SKIP
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-0 relative z-10">
        <div className="w-full sm:max-w-md sm:mx-auto">
          <span className="text-xs font-semibold tracking-[0.25em] text-[#6ccbde] mb-3 block">
            {slide.eyebrow}
          </span>
          <h1 className="font-header text-5xl sm:text-7xl text-white leading-[0.95] mb-5">
            {slide.headline}
          </h1>
          <p className="text-base sm:text-lg text-white/70 font-light max-w-xs sm:max-w-sm leading-relaxed">
            {slide.body}
          </p>
        </div>
      </div>

      {/* Footer: dots + action */}
      <div className="px-8 sm:px-0 pb-10 sm:pb-14 space-y-6 relative z-10">
        <div className="w-full sm:max-w-md sm:mx-auto space-y-6">
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === step ? 'w-8 bg-[#ec2226]' : 'w-1.5 bg-white/25'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => (isLast ? onComplete() : setStep(step + 1))}
            className="w-full sm:w-auto sm:px-14 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-[0.98] transition"
            style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
          >
            {isLast ? 'GET STARTED' : 'NEXT'}
          </button>
        </div>
      </div>
    </div>
  );
};
