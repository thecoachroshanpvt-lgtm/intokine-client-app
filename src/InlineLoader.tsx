import React from 'react';

/**
 * Small blinking brand icon, centered on the screen, used while a screen's data loads.
 * It only becomes visible after a short delay, so quick loads never flash anything on screen.
 */
export const InlineLoader: React.FC = () => (
  <div className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none">
    <style>{`
      @keyframes ikLoaderBlink {
        0%, 100% { opacity: 0.15; transform: scale(0.94); }
        50% { opacity: 1; transform: scale(1); }
      }
      @keyframes ikLoaderShow { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
    <div style={{ animation: 'ikLoaderShow 0.2s ease 0.45s both' }}>
      <img
        src="/brand-icon.png"
        alt="Loading"
        className="h-5 w-auto object-contain"
        style={{ animation: 'ikLoaderBlink 1.3s ease-in-out infinite' }}
      />
    </div>
  </div>
);
