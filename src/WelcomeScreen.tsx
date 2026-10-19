import React, { useState } from 'react';
import { IS_RECORDED } from './variant';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [wordmarkFailed, setWordmarkFailed] = useState(false);
  // Zaki app only: the first tap on CONTINUE swaps the INTOKINE logo for the ZAKI logo on the same screen; the second tap enters the app.
  const [zakiStage, setZakiStage] = useState(false);
  const [zakiLogoFailed, setZakiLogoFailed] = useState(false);
  // Katba second screen: an optional looping background video (public-recorded/katba-welcome.mp4). If the file is missing, the photo stays.
  const [videoFailed, setVideoFailed] = useState(false);
  const handleContinue = () => {
    if (IS_RECORDED && !zakiStage && !zakiLogoFailed) setZakiStage(true);
    else onContinue();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1c1c1c] flex flex-col justify-between" onClick={zakiStage ? onContinue : undefined}>
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
        .ik-swap-out { transition: opacity 0.55s ease, transform 0.55s ease; }
        .ik-swap-out.gone { opacity: 0; transform: scale(0.94); }
        .ik-fade { transition: opacity 0.5s ease; }
        .ik-fade.gone { opacity: 0; pointer-events: none; }
        .ik-swap-in { transition: opacity 0.7s ease 0.35s, transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.35s; opacity: 0; transform: scale(1.06); }
        .ik-swap-in.shown { opacity: 1; transform: scale(1); }
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

      {/* Katba second screen: looping background video, fades in with the logo. Muted + playsInline so phones start it automatically. */}
      {IS_RECORDED && !videoFailed && (
        <video
          src="/katba-welcome.mp4"
          poster="/welcome-photo.JPEG"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: zakiStage ? 1 : 0, transition: 'opacity 0.8s ease 0.2s' }}
        />
      )}

      {/* Katba second screen: darker video with a soft vignette (dark edges, lighter centre behind the logo). */}
      {IS_RECORDED && !videoFailed && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 85% 65% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0.68) 100%), linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.1))',
            opacity: zakiStage ? 1 : 0,
            transition: 'opacity 0.8s ease 0.2s',
          }}
        />
      )}

      {/* Dark overlay so text stays readable over any photo */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0.75) 100%)' }}
      />

      {/* Zaki app, second screen: only the ZAKI logo, centred on the screen. A tap anywhere opens the app. */}
      {IS_RECORDED && !zakiLogoFailed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <img
            src="/zaki-logo.png"
            alt="KATBA"
            onError={() => setZakiLogoFailed(true)}
            className={`ik-swap-in ${zakiStage ? 'shown' : ''} w-[66%] max-w-[18rem] h-auto object-contain`}
            style={{ filter: 'drop-shadow(0 3px 14px rgba(0,0,0,0.6))' }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center">
        <div className="relative flex flex-col items-center w-full">
          <div className={`ik-swap-out flex flex-col items-center w-full ${zakiStage ? 'gone' : ''}`} aria-hidden={zakiStage}>
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
          </div>
        </div>
        <div className={`ik-fade flex flex-col items-center ${zakiStage ? 'gone' : ''}`}>
        <div
          className="ik-line mt-7 sm:mt-9 h-[2px] w-14 rounded-full"
          style={{ background: 'linear-gradient(90deg, #ec2226 0%, #6ccbde 100%)' }}
        />
        <p className="ik-tag mt-6 sm:mt-7 text-[10px] sm:text-xs text-white/70 font-semibold uppercase tracking-[0.22em] leading-[2.2] whitespace-nowrap">
          Your program. Your progress.
          <br />
          Built by your coach.
        </p>
        </div>
      </div>

      <div className={`ik-fade relative z-10 ${zakiStage ? 'gone' : ''}`}>
      <div className="ik-btn relative z-10 px-8 pb-10 sm:pb-14">
        <button
          onClick={handleContinue}
          className="w-full sm:w-auto sm:mx-auto sm:block sm:px-16 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-[0.98] transition"
          style={{ background: 'linear-gradient(90deg, #ec2226 0%, #6ccbde 100%)' }}
        >
          CONTINUE
        </button>
      </div>
      </div>
    </div>
  );
};
