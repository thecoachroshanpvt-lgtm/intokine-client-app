import React, { useState } from 'react';

interface PostLoginWelcomeScreenProps {
  clientName: string;
  onContinue: () => void;
}

export const PostLoginWelcomeScreen: React.FC<PostLoginWelcomeScreenProps> = ({ clientName, onContinue }) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#1c1c1c] flex flex-col justify-between">
      {!imageFailed ? (
        <img
          src="/home-photo.jpg"
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #1c1c1c 0%, #1c1c1c 50%, #6ccbde 140%)' }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 35%, rgba(0,0,0,0.75) 100%)' }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center">
        <span className="text-xs font-semibold tracking-[0.25em] text-[#6ccbde] mb-4">
          WELCOME BACK
        </span>
        <h1 className="font-header text-4xl sm:text-6xl text-white leading-[0.95] mb-4">
          {clientName.toUpperCase()}
        </h1>
        <p className="text-base sm:text-lg text-white/80 font-light max-w-xs sm:max-w-md leading-relaxed">
          Let's see what your coach has planned.
        </p>
      </div>

      <div className="relative z-10 px-8 pb-10 sm:pb-14">
        <button
          onClick={onContinue}
          className="w-full sm:w-auto sm:mx-auto sm:block sm:px-16 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-[0.98] transition"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
        >
          GO TO MY PLAN
        </button>
      </div>
    </div>
  );
};
