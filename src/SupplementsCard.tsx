import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc } from './firebase';

// Supplements the dietitian suggested, shown in the Diet tab. The client taps each one when taken.
// It uses the same follow-up and answer records as the Routine tab, so the dietitian's Tracker keeps working.
//   intokine_followups/{id}                                          written by the dietitian
//   intokine_routine_logs/{clientId}_{followUpId}_{freq}_{period}    written by the client

type Freq = 'daily' | 'weekly' | 'monthly';
interface Item { id: string; category: string; type: string; label: string; freq: Freq; detail?: string }
interface FollowUp { id: string; date: string; active: boolean; items: Item[] }
interface Log { followUpId: string; freq: Freq; period: string; values: Record<string, any> }

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayKey = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dateKey(x);
};
const periodFor = (freq: Freq, d: Date) => (freq === 'daily' ? dateKey(d) : freq === 'weekly' ? mondayKey(d) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`);

export const SupplementsCard: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const u1 = onSnapshot(
      query(collection(db, 'intokine_followups'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => setFollowUps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FollowUp[]),
      (e) => console.warn('Could not load supplements:', e)
    );
    const u2 = onSnapshot(
      query(collection(db, 'intokine_routine_logs'), where('clientId', '==', clientId)),
      (snap) => setLogs(snap.docs.map((d) => d.data() as Log)),
      (e) => console.warn('Could not load supplement ticks:', e)
    );
    return () => { u1(); u2(); };
  }, [clientId]);

  const items = followUps
    .filter((f) => f.active)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .flatMap((fu) => (fu.items || []).filter((i) => i.category === 'Supplements').map((it) => ({ fu, it })));
  if (items.length === 0) return null;

  const now = new Date();
  const logFor = (fuId: string, freq: Freq, period: string) => logs.find((l) => l.followUpId === fuId && l.freq === freq && l.period === period);
  const taken = (fu: FollowUp, it: Item) => logFor(fu.id, it.freq, periodFor(it.freq, now))?.values?.[it.id] === true;

  const toggle = async (fu: FollowUp, it: Item) => {
    const period = periodFor(it.freq, new Date());
    const values: Record<string, any> = { ...(logFor(fu.id, it.freq, period)?.values || {}), [it.id]: !taken(fu, it) };
    setLogs((all) => [...all.filter((l) => !(l.followUpId === fu.id && l.freq === it.freq && l.period === period)), { followUpId: fu.id, freq: it.freq, period, values }]);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      await setDoc(doc(db, 'intokine_routine_logs', `${clientId}_${fu.id}_${it.freq}_${period}`), {
        clientId, followUpId: fu.id, freq: it.freq, period, date: dateKey(new Date()), values, updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not save supplement:', e);
      setError('Could not save. Please check your connection and try again.');
    }
  };

  const done = items.filter(({ fu, it }) => taken(fu, it)).length;
  return (
    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Supplements</div>
          <div className="text-[11px] text-white/40 font-light">Suggested by your dietitian</div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${done === items.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#ec2226]/15 text-[#ec2226]'}`}>
          {done === items.length ? 'All taken' : `${done}/${items.length}`}
        </span>
      </div>
      <div className="space-y-2">
        {items.map(({ fu, it }) => {
          const on = taken(fu, it);
          return (
            <button key={fu.id + it.id} type="button" onClick={() => toggle(fu, it)} aria-pressed={on}
              className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition ${on ? 'bg-emerald-500/10 border-emerald-500/30' : 'border-white/15'}`}>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/25 text-transparent'}`}>✓</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-white truncate">{it.label}</span>
                {it.detail && <span className="block text-[11px] text-white/50 font-light truncate">{it.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
