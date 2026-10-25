import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from './firebase';

// Home: the client adds any other physical activity (football, cricket, badminton ...) above the consistency card.
// Saved in intokine_other_activities, id = <clientId>_<time>. The monthly variety (how many different activities
// this month) is shown on the shared consistency card.

const pad = (n: number) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const SUGGESTIONS = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Tennis', 'Padel', 'Volleyball', 'Table tennis', 'Swimming', 'Running', 'Cycling', 'Hiking', 'Yoga', 'Dancing'];

interface Entry { id: string; name: string; date: string; minutes?: number }

export const OtherActivityCard: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayKey());
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'intokine_other_activities'), where('clientId', '==', clientId)),
      (s) => setEntries(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Entry)),
      () => {}
    );
    return () => unsub();
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, [open]);

  const monthPrefix = todayKey().slice(0, 7);
  const thisMonth = useMemo(() => entries.filter((e) => (e.date || '').startsWith(monthPrefix)), [entries, monthPrefix]);
  const variety = useMemo(() => new Set(thisMonth.map((e) => e.name.trim().toLowerCase())).size, [thisMonth]);
  const counts = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    thisMonth.forEach((e) => {
      const k = e.name.trim().toLowerCase();
      const cur = m.get(k);
      if (cur) cur.n += 1; else m.set(k, { label: e.name.trim(), n: 1 });
    });
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  }, [thisMonth]);
  const recent = useMemo(() => [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id)).slice(0, 12), [entries]);

  const save = async () => {
    const n = name.trim();
    if (!n) { setError('Choose or type an activity.'); return; }
    if (!date) { setError('Choose the date.'); return; }
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    setSaving(true);
    setError('');
    try {
      const id = `${clientId}_${Date.now()}`;
      const mins = Number(minutes);
      await setDoc(doc(db, 'intokine_other_activities', id), {
        clientId,
        name: n,
        date,
        ...(mins > 0 ? { minutes: Math.round(mins) } : {}),
        createdAt: new Date().toISOString(),
      });
      setName('');
      setMinutes('');
      setDate(todayKey());
    } catch {
      setError('Could not save. Please check your connection and try again.');
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    try { await deleteDoc(doc(db, 'intokine_other_activities', id)); } catch { /* ignore */ }
  };

  return (
    <>
      <div role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
        className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/40 uppercase font-semibold">Other activities</span>
          <span className="text-[11px] font-semibold text-[#6ccbde]">+ Add</span>
        </div>
        {counts.length === 0 ? (
          <p className="text-[12px] text-white/50 font-light mt-1.5">Played football, cricket, badminton or anything else? Add it here.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {counts.map((c) => (
              <span key={c.label} className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[11px] font-semibold text-white/85">
                {c.label} <span className="font-mono text-[#6ccbde]">×{c.n}</span>
              </span>
            ))}
          </div>
        )}
        {counts.length > 0 && <p className="text-[10px] text-white/35 mt-2">This month · {variety} different {variety === 1 ? 'activity' : 'activities'}</p>}
      </div>

      {open && createPortal(
        <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="anim-card w-full max-w-md max-h-[88vh] bg-[#1c1c1c] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
              <span className="font-subheader text-[17px] text-white">Add an activity</span>
              <button type="button" onClick={() => setOpen(false)} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setName(s)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${name === s ? 'bg-[#6ccbde] text-[#0b0c10] border-[#6ccbde]' : 'bg-white/[0.05] text-white/70 border-white/[0.08]'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Or type another activity"
                className="w-full bg-[#252525] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6ccbde]" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wide text-white/40 block mb-1">Date</label>
                  <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)}
                    className="block w-full min-w-0 appearance-none bg-[#252525] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6ccbde] [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wide text-white/40 block mb-1">Minutes (optional)</label>
                  <input type="number" inputMode="numeric" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="60"
                    className="w-full bg-[#252525] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#6ccbde]" />
                </div>
              </div>
              {error && <p className="text-[11px] text-[#ec2226]">{error}</p>}
              <button type="button" onClick={save} disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold bg-[#6ccbde] text-[#0b0c10] disabled:opacity-50">
                {saving ? 'Saving…' : 'Add activity'}
              </button>

              {recent.length > 0 && (
                <div>
                  <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] mb-2">Recent</div>
                  <div className="space-y-1.5">
                    {recent.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{e.name}</div>
                          <div className="text-[10px] text-white/40 font-mono">{e.date}{e.minutes ? ` · ${e.minutes} min` : ''}</div>
                        </div>
                        <button type="button" onClick={() => remove(e.id)} className="text-white/40 hover:text-[#ec2226] text-xs font-semibold px-1">Delete</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
