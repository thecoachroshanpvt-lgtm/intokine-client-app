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
          className="h-9 w-auto object-contain mb-4"
        />
        {!wordmarkFailed ? (
          <img
            src="/brand-wordmark.png"
            alt="INTOKINE"
            onError={() => setWordmarkFailed(true)}
            className="h-14 sm:h-20 w-auto max-w-[80%] object-contain mb-4"
          />
        ) : (
          <h1 className="font-header text-5xl sm:text-7xl text-white leading-[0.95] mb-4">
            INTOKINE
          </h1>
        )}
        <p className="text-base sm:text-lg text-white/80 font-light max-w-xs sm:max-w-md leading-relaxed">
          Your program, your progress, built by your coach and always within reach.
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
