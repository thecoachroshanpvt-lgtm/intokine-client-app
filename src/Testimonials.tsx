import React, { useEffect, useRef, useState } from 'react';
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
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

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
        setIndex(0);
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

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count, paused]);

  const go = (i: number) => setIndex(((i % count) + count) % count);

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
      {count > 0 && (
        <>
          <span className="text-[11px] text-white/40 uppercase font-semibold block">What our clients say</span>
          <div
            className="overflow-hidden rounded-2xl bg-white/[0.04] border border-white/[0.08]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={(e) => {
              setPaused(true);
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const start = touchStartX.current;
              touchStartX.current = null;
              if (start !== null) {
                const dx = e.changedTouches[0].clientX - start;
                if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
              }
              setPaused(false);
            }}
          >
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
              {items.map((t) => (
                <div key={t.id} className="w-full shrink-0 p-4">
                  <Stars value={t.rating} />
                  <p className="text-sm text-white/80 font-light leading-relaxed mt-2">&ldquo;{t.quote}&rdquo;</p>
                  <p className="text-xs font-semibold text-white mt-3">{t.name}</p>
                  {t.detail && <p className="text-[11px] text-[#6ccbde] font-light">{t.detail}</p>}
                </div>
              ))}
            </div>
          </div>
          {count > 1 && (
            <div className="flex justify-center gap-1.5">
              {items.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Testimonial ${i + 1}`}
                  onClick={() => go(i)}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === index ? 16 : 6, background: i === index ? '#6ccbde' : 'rgba(255,255,255,0.2)' }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Share your own feedback */}
      {!formOpen && (
        <button
          type="button"
          onClick={openForm}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3 text-left flex items-center justify-between gap-3"
        >
          <span>
            <span className="text-sm font-semibold text-white block">
              {mine ? 'Your feedback' : 'Enjoying your training?'}
            </span>
            <span className="text-[11px] text-white/50 font-light block">
              {mine
                ? mine.approved
                  ? 'Thank you - your feedback is showing to other clients. Tap to edit.'
                  : 'Thank you - waiting for approval. Tap to edit.'
                : 'Tell us how it is going - it helps other clients too.'}
            </span>
          </span>
          {mine ? <Stars value={mine.rating} size={12} /> : <span className="text-xs font-bold text-[#6ccbde] shrink-0">Share</span>}
        </button>
      )}

      {formOpen && (
        <div className="bg-white/[0.05] border border-white/[0.1] rounded-2xl p-4 space-y-3">
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
                style={{ fontSize: 28, lineHeight: 1, color: n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={400}
            rows={4}
            placeholder="Write a few lines about your experience..."
            className="w-full bg-black/30 border border-white/[0.1] rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6ccbde] resize-none"
          />
          <label className="flex items-start gap-2 text-[11px] text-white/60 font-light leading-relaxed">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              I allow Intokine to show this to other clients with my first name and last initial ({publicName(clientName)}). I know it is only shown after the team approves it.
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
