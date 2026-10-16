import React, { useState } from 'react';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [wordmarkFailed, setWordmarkFailed] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1c1c1c] flex flex-col justify-between">
      {/* Intro animation: the icon appears large, then glides up and the wordmark reveals beneath it. */}
      <style>{`
        @keyframes ikIcon {
          0%   { opacity: 0; transform: translateY(96px) scale(0.92); }
          22%  { opacity: 1; transform: translateY(96px) scale(1); }
          55%  { opacity: 1; transform: translateY(96px) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(var(--ik-end)); }
        }
        @keyframes ikWord {
          0%   { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateY(10px); }
          100% { opacity: 1; clip-path: inset(0 0 0 0); transform: translateY(0); }
        }
        @keyframes ikLine { 0% { transform: scaleX(0); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        @keyframes ikUp { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        .ik-icon { --ik-end: 0.375; height: 4rem; will-change: transform; backface-visibility: hidden; animation: ikIcon 2s cubic-bezier(0.65, 0, 0.2, 1) both; }
        @media (min-width: 640px) { .ik-icon { --ik-end: 0.5; } }
        .ik-word { animation: ikWord 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 1.45s both; }
        .ik-line { animation: ikLine 0.6s ease-out 2.2s both; transform-origin: center; }
        .ik-tag  { animation: ikUp 0.7s ease-out 2.4s both; }
        .ik-btn  { animation: ikUp 0.7s ease-out 2.7s both; }
        @media (prefers-reduced-motion: reduce) {
          .ik-icon, .ik-word, .ik-line, .ik-tag, .ik-btn { animation: none; }
        }
      `}</style>
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
        {/* Slot keeps the final (small) size; the image is drawn large and scaled down so it stays sharp. */}
        <div className="relative h-6 sm:h-8 w-full mb-11 sm:mb-14">
          <img
            src="/brand-icon.png"
            alt=""
            className="ik-icon absolute left-0 right-0 mx-auto w-auto object-contain top-1/2 -mt-8"
          />
        </div>
        {!wordmarkFailed ? (
          <img
            src="/brand-wordmark.png"
            alt="INTOKINE"
            onError={() => setWordmarkFailed(true)}
            className="ik-word h-[4.5rem] sm:h-24 w-auto max-w-[88%] object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
          />
        ) : (
          <h1 className="font-header text-5xl sm:text-7xl text-white leading-[0.95]">
            INTOKINE
          </h1>
        )}
        <div
          className="ik-line mt-7 sm:mt-9 h-[2px] w-14 rounded-full"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
        />
        <p className="ik-tag mt-6 sm:mt-7 text-[10px] sm:text-xs text-white/70 font-semibold uppercase tracking-[0.22em] leading-[2.2] whitespace-nowrap">
          Your program. Your progress.
          <br />
          Built by your coach.
        </p>
      </div>

      <div className="ik-btn relative z-10 px-8 pb-10 sm:pb-14">
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
