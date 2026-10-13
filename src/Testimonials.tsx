import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, getDoc, setDoc } from './firebase';

interface Testimonial {
  id: string;
  name: string;
  rating: number;
  quote: string;
  detail?: string;
}

interface TestimonialsProps {
  clientId: string;
  clientName: string;
}

// "Aisha Khan" -> "Aisha K." so other clients never see a full name.
function publicName(full: string): string {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => (
  <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} style={{ fontSize: size, lineHeight: 1, color: n <= value ? '#fbbf24' : 'rgba(255,255,255,0.18)' }}>★</span>
    ))}
  </span>
);

// Auto-scrolling approved testimonials + a way for the client to share their own feedback.
// Feedback is saved as "waiting"; the owner approves it before other clients can see it.
export const Testimonials: React.FC<TestimonialsProps> = ({ clientId, clientName }) => {
  const [items, setItems] = useState<Testimonial[]>([]);

  const [mine, setMine] = useState<{ rating: number; quote: string; approved: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [quote, setQuote] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const count = items.length;

  // Approved testimonials from everyone
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'intokine_testimonials'), where('approved', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Testimonial[];
        // Stable order so the strip doesn't jump around
        list.sort((a, b) => a.id.localeCompare(b.id));
        setItems(list);
      },
      (e) => console.warn('Could not load testimonials:', e)
    );
    return () => unsub();
  }, []);

  // This client's own feedback (to show its status / allow editing)
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    getDoc(doc(db, 'intokine_testimonials', clientId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setMine({ rating: d.rating || 0, quote: d.quote || '', approved: !!d.approved });
        }
      })
      .catch((e) => console.warn('Could not load own testimonial:', e));
  }, [clientId]);

  const openForm = () => {
    setRating(mine?.rating || 0);
    setQuote(mine?.quote || '');
    setConsent(!!mine);
    setError('');
    setFormOpen(true);
  };

  const submit = async () => {
    const text = quote.trim();
    if (rating < 1) return setError('Please choose a star rating.');
    if (text.length < 10) return setError('Please write a little more (at least 10 characters).');
    if (!consent) return setError('Please tick the box to allow us to share it.');
    setSaving(true);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');
      await setDoc(doc(db, 'intokine_testimonials', clientId), {
        clientId,
        name: publicName(clientName),
        rating,
        quote: text.slice(0, 400),
        consent: true,
        approved: false, // the owner approves it before anyone else sees it
        updatedAt: new Date().toISOString(),
      });
      setMine({ rating, quote: text.slice(0, 400), approved: false });
      setFormOpen(false);
    } catch (e: any) {
      console.warn('Testimonial save error:', e);
      setError('Could not send your feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {count > 0 && (() => {
        // One "set" of cards, repeated until it is wider than a phone screen, then the set is doubled
        // so the belt can loop seamlessly. Cards slowly glide to the right.
        const reps = Math.max(1, Math.ceil(8 / count));
        const set = Array.from({ length: reps }).flatMap((_, r) => items.map((t) => ({ ...t, k: `${r}-${t.id}` })));
        const seconds = set.length * 7; // ~7 seconds per card = slow
        return (
          <>
            <span className="text-[11px] text-white/40 uppercase font-semibold block">What our clients say</span>
            <style>{`
              @keyframes intokineBeltRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
              .intokine-belt { animation: intokineBeltRight ${seconds}s linear infinite; will-change: transform; }
              .intokine-belt-wrap:hover .intokine-belt, .intokine-belt-wrap:active .intokine-belt { animation-play-state: paused; }
              @media (prefers-reduced-motion: reduce) { .intokine-belt { animation: none; } }
            `}</style>
            <div className="intokine-belt-wrap overflow-hidden rounded-2xl">
              <div className="intokine-belt flex gap-2 w-max items-start">
                {[...set, ...set].map((t, i) => (
                  <div key={`${t.k}-${i}`} className="w-[220px] shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5">
                    <Stars value={t.rating} size={11} />
                    <p className="text-[11px] text-white/75 font-light leading-snug mt-1.5">&ldquo;{t.quote}&rdquo;</p>
                    {t.detail && <p className="text-[10px] text-[#6ccbde] font-light mt-1.5 truncate">{t.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Share your own feedback */}
      {!formOpen && (
        <button
          type="button"
          onClick={openForm}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-left flex items-center justify-between gap-3"
        >
          <span className="text-xs font-semibold text-white/80 truncate">
            {mine ? (mine.approved ? 'Your feedback is showing - edit' : 'Feedback sent, awaiting approval - edit') : 'Enjoying your training? Share feedback'}
          </span>
          {mine ? <Stars value={mine.rating} size={11} /> : <span className="text-[11px] font-bold text-[#6ccbde] shrink-0">Share</span>}
        </button>
      )}

      {formOpen && (
        <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-3 space-y-2.5">
          <p className="text-sm font-semibold text-white">How is your training with Intokine?</p>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setRating(n)}
                style={{ fontSize: 24, lineHeight: 1, color: n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Write a few lines about your experience..."
            className="w-full bg-black/30 border border-white/[0.1] rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6ccbde] resize-none"
          />
          <label className="flex items-start gap-2 text-[11px] text-white/60 font-light leading-relaxed">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              I allow Intokine to show this to other clients without my name. I know it is only shown after the team approves it.
            </span>
          </label>
          {error && <p className="text-xs text-[#ec2226]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#ec2226] text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? 'Sending...' : 'Send feedback'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] text-white/70 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
