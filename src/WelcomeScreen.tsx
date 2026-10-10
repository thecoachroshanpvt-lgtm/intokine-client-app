import React, { useState } from 'react';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [wordmarkFailed, setWordmarkFailed] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1c1c1c] flex flex-col justify-between">
      {/* Background photo - falls back to the brand gradient if the
          file isn't present yet, so the app never breaks waiting on it. */}
      {!imageFailed ? (
        <img
          src="/welcome-photo.JPEG"
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #1c1c1c 0%, #1c1c1c 50%, #ec2226 140%)' }}
        />
      )}

      {/* Dark overlay so text stays readable over any photo */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0.75) 100%)' }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center">
        <img
          src="/brand-icon.png"
          alt=""
          className="h-6 sm:h-8 w-auto object-contain mb-11 sm:mb-14 opacity-95"
        />
        {!wordmarkFailed ? (
          <img
            src="/brand-wordmark.png"
            alt="INTOKINE"
            onError={() => setWordmarkFailed(true)}
            className="h-[4.5rem] sm:h-24 w-auto max-w-[88%] object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
          />
        ) : (
          <h1 className="font-header text-5xl sm:text-7xl text-white leading-[0.95]">
            INTOKINE
          </h1>
        )}
        <div
          className="mt-7 sm:mt-9 h-[2px] w-14 rounded-full"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
        />
        <p className="mt-6 sm:mt-7 text-[10px] sm:text-xs text-white/70 font-semibold uppercase tracking-[0.22em] leading-[2.2] whitespace-nowrap">
          Your program. Your progress.
          <br />
          Built by your coach.
        </p>
      </div>

      <div className="relative z-10 px-8 pb-10 sm:pb-14">
        <button
          onClick={onContinue}
          className="w-full sm:w-auto sm:mx-auto sm:block sm:px-16 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-[0.98] transition"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
};
