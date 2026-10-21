import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_NAME } from './variant';

// The "share your consistency" card: a Strava-style 9:16 picture for an Instagram story.
// Opened by tapping "Your consistency" on the home page. It is drawn on a canvas (so it is a real picture, with no screenshot needed),
// shown as a preview, and handed to the phone's share sheet (Instagram, WhatsApp, Save image...).
// Two looks: "Card" (full dark brand background) and "Sticker" (transparent, to lay over your own photo in the story).

export interface SharePart { key: string; label: string; frac: number | null }

const W = 1080;
const H = 1920;
const BRAND = '#ec2226';
const ACCENT = '#6ccbde';
const BODY = '"Raleway", "Barlow", -apple-system, "Helvetica Neue", Arial, sans-serif';

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const headline = (overall: number | null) =>
  overall === null ? 'Your movement journey starts here' : overall >= 90 ? 'Moving beautifully' : overall >= 80 ? 'Moving with purpose' : overall >= 60 ? 'Finding your flow' : overall >= 40 ? 'Keep moving' : 'Every movement counts';

export type ShareMode = 'card' | 'photo' | 'sticker';

async function draw(canvas: HTMLCanvasElement, o: { name: string; overall: number | null; parts: SharePart[]; days: number; mode: ShareMode; photo: HTMLImageElement | null; dim: number }) {
  try {
    await Promise.all([document.fonts.load(`300 100px Raleway`), document.fonts.load(`600 40px Raleway`), document.fonts.load(`400 40px Raleway`)]);
  } catch { /* the fallback fonts are used */ }
  const logo = await loadImage('/brand-icon.png');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  const ls = (px: number) => { try { (c as any).letterSpacing = `${px}px`; } catch { /* older browsers */ } };
  c.clearRect(0, 0, W, H);
  const see = o.mode !== 'card'; // photo or sticker: no solid background, so the writing gets a soft shadow

  if (o.mode === 'photo') {
    c.fillStyle = '#15171d';
    c.fillRect(0, 0, W, H);
    if (o.photo) {
      // cover the whole story picture, centred
      const k = Math.max(W / o.photo.width, H / o.photo.height);
      const pw = o.photo.width * k, ph = o.photo.height * k;
      c.drawImage(o.photo, (W - pw) / 2, (H - ph) / 2, pw, ph);
    }
    // a dark layer over the whole photo (the client can change how dark), so the writing is readable on bright photos
    c.fillStyle = `rgba(0,0,0,${o.dim})`;
    c.fillRect(0, 0, W, H);
    // a little extra shade at the top and bottom where the logo and the scores sit
    const sc = c.createLinearGradient(0, 0, 0, H);
    sc.addColorStop(0, 'rgba(0,0,0,0.3)');
    sc.addColorStop(0.3, 'rgba(0,0,0,0)');
    sc.addColorStop(0.65, 'rgba(0,0,0,0)');
    sc.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = sc;
    c.fillRect(0, 0, W, H);
    // the logo, writing and rings are see-through, so the photo shows behind them
    c.globalAlpha = 0.82;
  }

  if (o.mode === 'card') {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#15171d');
    bg.addColorStop(1, '#0b0c10');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    // two soft colour clouds, nothing sharp
    const g1 = c.createRadialGradient(W * 0.85, 330, 0, W * 0.85, 330, 760);
    g1.addColorStop(0, rgba(ACCENT, 0.2));
    g1.addColorStop(1, rgba(ACCENT, 0));
    c.fillStyle = g1;
    c.fillRect(0, 0, W, H);
    const g2 = c.createRadialGradient(W * 0.1, 1600, 0, W * 0.1, 1600, 820);
    g2.addColorStop(0, rgba(BRAND, 0.24));
    g2.addColorStop(1, rgba(BRAND, 0));
    c.fillStyle = g2;
    c.fillRect(0, 0, W, H);
  }

  const shadow = () => { if (see) { c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 20; c.shadowOffsetY = 3; } };
  const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };
  const track = see ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.09)';
  const cx = W / 2;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  // ---- logo, centred (inside Instagram's safe area)
  if (logo) {
    const lh = 58;
    const lw = (logo.width / logo.height) * lh;
    shadow();
    c.drawImage(logo, cx - lw / 2, 290, lw, lh);
    noShadow();
  } else {
    c.fillStyle = '#fff';
    c.font = `600 48px ${BODY}`;
    c.fillText(APP_NAME, cx, 336);
  }

  // ---- title
  shadow();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.font = `600 36px ${BODY}`;
  ls(10);
  c.fillText('MY CONSISTENCY', cx, 452);
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.font = `400 28px ${BODY}`;
  ls(6);
  c.fillText(`LAST ${o.days} DAYS`, cx, 500);
  noShadow();

  // ---- the number: big and light, no circle
  const pct = o.overall === null ? 0 : o.overall / 100;
  shadow();
  c.fillStyle = '#fff';
  c.font = `300 330px ${BODY}`;
  ls(-8);
  const num = o.overall === null ? '--' : String(o.overall);
  c.fillText(num, cx - 24, 930);
  const nw = c.measureText(num).width;
  c.font = `300 96px ${BODY}`;
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.textAlign = 'left';
  ls(0);
  c.fillText('%', cx - 24 + nw / 2 + 8, 930 - 150);
  c.textAlign = 'center';
  noShadow();

  // ---- a flowing line, like a movement trail: the more consistent, the further it travels
  const X0 = 110, X1 = W - 110, MID = 1070, AMP = 52;
  const at = (t: number) => ({ x: X0 + (X1 - X0) * t, y: MID - AMP * Math.sin(t * Math.PI * 2.5) });
  const trace = (to: number) => {
    c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (to * i) / 120;
      const p = at(t);
      if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    }
  };
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = 5;
  c.strokeStyle = track;
  trace(1); c.stroke();
  if (pct > 0) {
    const tEnd = Math.max(pct, 0.02);
    const grad = c.createLinearGradient(X0, 0, X1, 0);
    grad.addColorStop(0, BRAND);
    grad.addColorStop(1, ACCENT);
    c.save();
    c.shadowColor = rgba(ACCENT, see ? 0.3 : 0.5);
    c.shadowBlur = 26;
    c.lineWidth = 12;
    c.strokeStyle = grad;
    trace(tEnd); c.stroke();
    const e = at(tEnd);
    c.shadowColor = 'rgba(255,255,255,0.8)';
    c.shadowBlur = 24;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(e.x, e.y, 17, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // ---- one warm line, about movement
  shadow();
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.font = `400 56px ${BODY}`;
  ls(1);
  c.fillText(headline(o.overall), cx, 1262);
  noShadow();

  // ---- three quiet numbers with a hairline under each
  const rows = o.parts;
  const n = Math.max(rows.length, 1);
  const col = (W - 2 * 100) / n;
  const my = 1500;
  rows.forEach((p, i) => {
    const x = 100 + col * i + col / 2;
    shadow();
    c.fillStyle = '#fff';
    c.font = `300 86px ${BODY}`;
    ls(-2);
    c.fillText(p.frac === null ? '–' : `${Math.round(p.frac * 100)}`, x, my);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.font = `600 24px ${BODY}`;
    ls(6);
    c.fillText(p.label.toUpperCase(), x, my + 54);
    noShadow();
    // hairline: grey track, brand colour for the share done
    const bw = 130, by = my + 86;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.strokeStyle = track;
    c.beginPath(); c.moveTo(x - bw / 2, by); c.lineTo(x + bw / 2, by); c.stroke();
    if (p.frac !== null && p.frac > 0) {
      c.strokeStyle = ACCENT;
      c.beginPath(); c.moveTo(x - bw / 2, by); c.lineTo(x - bw / 2 + bw * Math.max(p.frac, 0.04), by); c.stroke();
    }
  });

  // ---- footer
  shadow();
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.font = `600 24px ${BODY}`;
  ls(8);
  c.fillText(APP_NAME, cx, 1730);
  noShadow();
}

export const ConsistencyShare: React.FC<{ name: string; overall: number | null; parts: SharePart[]; days: number; onClose: () => void }> = ({ name, overall, parts, days, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<ShareMode>('card');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [dim, setDim] = useState(0.5); // how dark the layer over the photo is
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    const cv = document.createElement('canvas');
    canvasRef.current = cv;
    setPreview('');
    draw(cv, { name, overall, parts, days, mode, photo, dim }).then(() => { if (live) setPreview(cv.toDataURL('image/png')); });
    return () => { live = false; };
  }, [name, overall, parts, days, mode, photo, dim]);

  const toFile = () =>
    new Promise<File | null>((resolve) => {
      const cv = canvasRef.current;
      if (!cv) return resolve(null);
      cv.toBlob((b) => resolve(b ? new File([b], `${APP_NAME.toLowerCase()}-consistency.png`, { type: 'image/png' }) : null), 'image/png');
    });

  const save = async () => {
    const f = await toFile();
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMsg('Saved. Open Instagram, add a story, and pick the picture from your photos.');
  };

  const share = async () => {
    setBusy(true);
    setMsg('');
    try {
      const f = await toFile();
      if (!f) throw new Error('no file');
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [f] })) {
        await nav.share({ files: [f], title: `${APP_NAME} consistency` });
      } else {
        await save();
      }
    } catch (e: any) {
      // closing the share sheet is not an error
      if (e?.name !== 'AbortError') setMsg('Could not open the share sheet. Use "Save image" and add it to your story.');
    }
    setBusy(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm max-h-full overflow-y-auto bg-[#1c1c1c] border border-white/[0.08] rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-header text-[20px] text-white leading-none">Share your consistency</span>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.08] text-white/80 text-lg leading-none" aria-label="Close">×</button>
        </div>

        <div className="flex bg-black/30 rounded-full p-0.5">
          {([['Card', 'card'], ['Photo', 'photo'], ['Sticker', 'sticker']] as const).map(([l, v]) => (
            <button key={l} type="button" onClick={() => { setMode(v); if (v === 'photo' && !photo) fileRef.current?.click(); }}
              className={`flex-1 py-1.5 rounded-full text-[11px] font-bold ${mode === v ? 'bg-[#6ccbde]/20 text-[#6ccbde]' : 'text-white/50'}`}>{l}</button>
          ))}
        </div>

        <div className="mx-auto rounded-2xl overflow-hidden border border-white/[0.08]" style={{ aspectRatio: '9 / 16', maxHeight: '58vh', background: mode === 'sticker' ? 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 24px 24px' : '#0b0c10' }}>
          {preview ? <img src={preview} alt="Your consistency card" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-[11px] text-white/40">Making your card...</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { setPhoto(img); setMode('photo'); };
            img.onerror = () => setMsg('Could not open that photo. Try another one.');
            img.src = url;
          }} />
        {mode === 'photo' && (
          <div className="space-y-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-2 rounded-2xl border border-white/[0.12] text-white/80 text-xs font-bold">{photo ? 'Change photo' : 'Choose a photo'}</button>
            <label className="flex items-center gap-3 text-[11px] text-white/60">
              <span className="shrink-0">Darker layer</span>
              <input type="range" min={0} max={75} step={5} value={Math.round(dim * 100)} onChange={(e) => setDim(Number(e.target.value) / 100)} className="flex-1" />
              <span className="w-8 text-right font-mono">{Math.round(dim * 100)}%</span>
            </label>
          </div>
        )}
        {mode === 'sticker' && <p className="text-[10px] text-white/45 text-center">Sticker has a see-through background. Save it, then place it over your own photo in the story.</p>}

        <button type="button" disabled={!preview || busy} onClick={share}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: `linear-gradient(90deg, ${BRAND} 0%, ${ACCENT} 100%)` }}>
          {busy ? 'Opening...' : 'Share to Instagram story'}
        </button>
        <button type="button" disabled={!preview} onClick={save} className="w-full py-2.5 rounded-2xl border border-white/[0.12] text-white/80 text-xs font-bold disabled:opacity-40">Save image</button>
        {msg && <p className="text-[11px] text-white/55 text-center">{msg}</p>}
      </div>
    </div>,
    document.body
  );
};
