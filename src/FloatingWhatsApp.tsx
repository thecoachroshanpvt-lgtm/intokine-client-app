import React, { useEffect, useRef, useState } from 'react';

// A round WhatsApp coin that behaves like the iPhone AssistiveTouch button:
// drag it anywhere, and when you let go it glides to the nearest corner of the screen and stays there.
// A tap (without dragging) opens the chat. The chosen corner is remembered on this device.
const SIZE = 56;
const SIDE = 12;     // gap from the left and right edges
const TOP = 76;      // keeps the top corners below the app header
const BOTTOM = 96;   // keeps the bottom corners above the bottom navigation
const KEY = 'intokine-whatsapp-corner';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const cornerXY = (c: Corner, vw: number, vh: number) => ({
  x: c[1] === 'l' ? SIDE : vw - SIZE - SIDE,
  y: c[0] === 't' ? TOP : vh - SIZE - BOTTOM,
});

export const FloatingWhatsApp: React.FC<{ href: string }> = ({ href }) => {
  const [corner, setCorner] = useState<Corner>(() => {
    try {
      const c = localStorage.getItem(KEY);
      if (c === 'tl' || c === 'tr' || c === 'bl' || c === 'br') return c;
    } catch { /* storage may be blocked; use the default corner */ }
    return 'br';
  });
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Stop the browser from treating a downward drag on the coin as pull-to-refresh or page scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, []);

  // While the coin is held, the page behind must not scroll or refresh.
  useEffect(() => {
    if (!dragPos) return;
    const html = document.documentElement;
    const prevHtml = html.style.overscrollBehavior;
    const prevBody = document.body.style.overscrollBehavior;
    html.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overscrollBehavior = prevHtml;
      document.body.style.overscrollBehavior = prevBody;
    };
  }, [dragPos !== null]);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const here = dragPos || cornerXY(corner, view.w, view.h);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - here.x, dy: e.clientY - here.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) {
      setDragPos({
        x: Math.min(Math.max(0, e.clientX - d.dx), view.w - SIZE),
        y: Math.min(Math.max(0, e.clientY - d.dy), view.h - SIZE),
      });
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    // glide to the nearest corner
    const p = dragPos || cornerXY(corner, view.w, view.h);
    const next: Corner = ((p.y + SIZE / 2 < view.h / 2 ? 't' : 'b') + (p.x + SIZE / 2 < view.w / 2 ? 'l' : 'r')) as Corner;
    setCorner(next);
    setDragPos(null);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };

  const pos = dragPos || cornerXY(corner, view.w, view.h);
  return (
    <div
      ref={ref}
      role="button"
      data-no-pull
      aria-label="Chat with your nutritionist on WhatsApp. Drag to move."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; setDragPos(null); }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-40 rounded-full flex items-center justify-center select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: SIZE,
        height: SIZE,
        background: '#2b2b2b',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: dragPos ? '0 10px 24px rgba(0,0,0,0.55)' : '0 6px 18px rgba(0,0,0,0.45)',
        transform: dragPos ? 'scale(1.08)' : 'scale(1)',
        transition: dragPos ? 'none' : 'left 0.32s cubic-bezier(0.2,0.9,0.3,1), top 0.32s cubic-bezier(0.2,0.9,0.3,1), transform 0.2s, box-shadow 0.2s',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        cursor: dragPos ? 'grabbing' : 'grab',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ pointerEvents: 'none' }}>
        <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
        <path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.3-1.2-1.8-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.8L9 9.5z" fill="rgba(255,255,255,0.7)" stroke="none" />
      </svg>
    </div>
  );
};
