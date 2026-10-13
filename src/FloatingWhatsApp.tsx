import React, { useEffect, useRef, useState } from 'react';

// A round WhatsApp coin the client can drag anywhere on the screen. A tap (without dragging) opens the chat.
// Its position is remembered on this device.
const SIZE = 56;
const KEY = 'intokine-whatsapp-coin';

const clamp = (x: number, y: number) => ({
  x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - SIZE - 8)),
  y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - SIZE - 8)),
});

export const FloatingWhatsApp: React.FC<{ href: string }> = ({ href }) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return clamp(saved.x, saved.y);
    } catch { /* storage may be blocked; use the default spot */ }
    return clamp(window.innerWidth - SIZE - 16, window.innerHeight - SIZE - 110);
  });
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* ignore */ }
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="button"
      aria-label="Chat with your nutritionist on WhatsApp. Drag to move."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; }}
      className="fixed z-40 rounded-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, background: '#25D366', boxShadow: '0 6px 18px rgba(0,0,0,0.45)', touchAction: 'none' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
        <path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.3-1.2-1.8-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.8L9 9.5z" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
};
