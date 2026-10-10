import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MiniBarChart } from './MiniBarChart';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc } from './firebase';

type ExType = 'Weighted' | 'Bodyweight' | 'Isometric' | 'Cardio';

interface Entry {
  id: string;
  date: string;
  weightKg?: number;
  reps?: number;
  rpe?: number;
  durationSec?: number;
  distanceKm?: number;
}

interface PerfExercise {
  id: string;
  name: string;
  type: ExType;
  entries: Entry[];
}

interface PerfRecord {
  id: string;
  clientId: string;
  workoutName: string;
  exercises: PerfExercise[];
}

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m && s) return `${m}m ${s}s`;
  if (m) return `${m} min`;
  return `${s} sec`;
};

const TYPE_COLOR: Record<ExType, string> = {
  Weighted: '#ec2226',
  Bodyweight: '#6ccbde',
  Isometric: '#a78bfa',
  Cardio: '#34d399',
};

// The best result for an exercise, worked out from every entry the coach has logged.
const bestOf = (ex: PerfExercise): { big: string; unit: string; sub?: string } | null => {
  const entries = ex.entries || [];
  if (entries.length === 0) return null;
  if (ex.type === 'Weighted') {
    const withWeight = entries.filter((e) => (e.weightKg ?? 0) > 0);
    if (withWeight.length === 0) return null;
    const maxW = Math.max(...withWeight.map((e) => e.weightKg as number));
    const atMax = withWeight.filter((e) => e.weightKg === maxW);
    const reps = Math.max(...atMax.map((e) => e.reps ?? 0));
    return { big: `${maxW}`, unit: 'kg', sub: `${reps} reps at your heaviest` };
  }
  if (ex.type === 'Bodyweight') {
    const maxReps = Math.max(...entries.map((e) => e.reps ?? 0));
    return maxReps > 0 ? { big: `${maxReps}`, unit: 'reps', sub: 'Most reps in one set' } : null;
  }
  if (ex.type === 'Isometric') {
    const maxSec = Math.max(...entries.map((e) => e.durationSec ?? 0));
    return maxSec > 0 ? { big: fmtTime(maxSec), unit: '', sub: 'Longest hold' } : null;
  }
  const maxDist = Math.max(0, ...entries.map((e) => e.distanceKm ?? 0));
  const maxDur = Math.max(0, ...entries.map((e) => e.durationSec ?? 0));
  if (maxDist > 0) return { big: `${maxDist}`, unit: 'km', sub: maxDur > 0 ? `Longest time ${fmtTime(maxDur)}` : 'Best distance' };
  if (maxDur > 0) return { big: fmtTime(maxDur), unit: '', sub: 'Longest time' };
  return null;
};

// The main number for this kind of exercise from every logged result, oldest to newest.
const progressSeries = (ex: PerfExercise): { points: { date: string; value: number }[]; unit: string; label: string } => {
  const pick = (e: Entry): number => {
    if (ex.type === 'Weighted') return e.weightKg ?? 0;
    if (ex.type === 'Bodyweight') return e.reps ?? 0;
    if (ex.type === 'Isometric') return e.durationSec ?? 0;
    return (e.distanceKm ?? 0) > 0 ? (e.distanceKm as number) : (e.durationSec ?? 0);
  };
  const useKm = ex.type === 'Cardio' && (ex.entries || []).some((e) => (e.distanceKm ?? 0) > 0);
  const unit = ex.type === 'Weighted' ? 'kg' : ex.type === 'Bodyweight' ? '' : useKm ? 'km' : 's';
  const label = ex.type === 'Weighted' ? 'Weight' : ex.type === 'Bodyweight' ? 'Reps' : useKm ? 'Distance' : 'Time';
  // One bar per logged result, oldest to newest (several results on the same day each get their own bar).
  const points = (ex.entries || [])
    .map((e, idx) => ({ date: e.date, value: pick(e), idx }))
    .filter((x) => x.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx)
    .map(({ date, value }) => ({ date, value }));
  return { points, unit, label };
};

export const ExerciseScores: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [records, setRecords] = useState<PerfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openEx, setOpenEx] = useState<PerfExercise | null>(null);

  // Keep the bottom navigation bar bright while the pop-up is open.
  useEffect(() => {
    if (!openEx) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, [openEx]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
      return;
    }
    let fromDoc: PerfRecord[] = [];
    let fromCollection: PerfRecord[] = [];
    const publish = () => {
      setRecords(fromCollection.length > 0 ? fromCollection : fromDoc);
      setLoading(false);
    };

    // The coach's scores are copied onto the client's own record - this always works.
    const unsubDoc = onSnapshot(
      doc(db, 'intokine_clients', clientId),
      (snap) => {
        const data = snap.exists() ? (snap.data() as { performanceScores?: PerfRecord[] }) : {};
        fromDoc = Array.isArray(data.performanceScores) ? data.performanceScores : [];
        publish();
      },
      (err) => {
        console.warn('Could not load exercise scores:', err);
        setLoading(false);
      }
    );

    // The full performance collection is used too when this account is allowed to read it.
    const unsubCol = onSnapshot(
      query(collection(db, 'intokine_performance_records'), where('clientId', '==', clientId)),
      (snap) => {
        fromCollection = snap.docs.map((d) => d.data() as PerfRecord);
        publish();
      },
      () => {
        /* no permission for this collection - the client record copy above is used instead */
      }
    );

    return () => {
      unsubDoc();
      unsubCol();
    };
  }, [clientId]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records
      .map((r) => ({
        workout: r.workoutName,
        items: (r.exercises || [])
          .filter((ex) => !term || ex.name.toLowerCase().includes(term))
          .map((ex) => ({ ex, best: bestOf(ex) }))
          .filter((x) => x.best),
      }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => a.workout.localeCompare(b.workout));
  }, [records, search]);

  if (loading) {
    return <div className="text-center py-12 text-white/40 text-sm font-light">Loading your exercise scores...</div>;
  }

  const totalExercises = records.reduce((n, r) => n + (r.exercises || []).length, 0);

  if (totalExercises === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
        <p className="text-sm text-white/50 font-light leading-relaxed">
          No exercise scores yet — your coach will add your best lifts, reps and times here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises..."
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6ccbde]"
      />

      {groups.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm font-light">No exercises match your search.</div>
      ) : (
        groups.map((g) => (
          <div key={g.workout} className="space-y-2">
            <span className="text-[11px] text-white/40 uppercase font-semibold block">{g.workout}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {g.items.map(({ ex, best }) => {
                const color = TYPE_COLOR[ex.type];
                const last = [...ex.entries].sort((a, b) => b.date.localeCompare(a.date))[0];
                return (
                  <button type="button" onClick={() => setOpenEx(ex)} key={ex.id} className="text-left w-full bg-[#242426] border border-white/[0.06] hover:border-white/20 rounded-2xl p-4 space-y-2 transition active:scale-[0.99]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-white leading-snug">{ex.name}</span>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                      >
                        {ex.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold font-mono text-white leading-none">{best!.big}</span>
                      {best!.unit && <span className="text-sm font-semibold text-white/50">{best!.unit}</span>}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/40 font-light">
                      <span>{best!.sub}</span>
                      {last && <span className="font-mono">{last.date}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
      {openEx && (() => {
        const { points, unit, label } = progressSeries(openEx);
        const color = TYPE_COLOR[openEx.type];
        const first = points[0];
        const latest = points[points.length - 1];
        const diff = first && latest ? Math.round((latest.value - first.value) * 100) / 100 : 0;
        const short = (v: number) => {
          const m = Math.floor(v / 60);
          const sec = Math.round(v % 60);
          return m && sec ? `${m}m ${sec}s` : m ? `${m}m` : `${sec}s`;
        };
        const isTime = openEx.type === 'Isometric' || (openEx.type === 'Cardio' && unit === 's');
        const fmt = (v: number) => (isTime ? short(v) : openEx.type === 'Bodyweight' ? `${v} reps` : `${v} ${unit}`);
        return createPortal(
          <div className="anim-overlay fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 pb-24" onClick={() => setOpenEx(null)}>
            <div className="anim-card bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#1c1c1e]">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">{openEx.name}</h3>
                  <span className="text-[10px] text-white/40">{label} progress - previous to current</span>
                </div>
                <button type="button" onClick={() => setOpenEx(null)} className="text-white/40 text-lg leading-none px-1">×</button>
              </div>
              <div className="p-4 space-y-4">
                {points.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-6">Not enough data yet</p>
                ) : (
                  <>
                    <MiniBarChart data={points} color={color} formatValue={fmt} />
                    {points.length > 1 && first && latest && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#242426] border border-white/[0.06] rounded-xl p-2.5">
                          <span className="text-[9px] text-white/40 uppercase font-bold block">First</span>
                          <span className="text-xs font-bold text-white font-mono">{fmt(first.value)}</span>
                        </div>
                        <div className="bg-[#242426] border border-white/[0.06] rounded-xl p-2.5">
                          <span className="text-[9px] text-white/40 uppercase font-bold block">Now</span>
                          <span className="text-xs font-bold text-white font-mono">{fmt(latest.value)}</span>
                        </div>
                        <div className="bg-[#242426] border border-white/[0.06] rounded-xl p-2.5">
                          <span className="text-[9px] text-white/40 uppercase font-bold block">Change</span>
                          <span className={`text-xs font-bold font-mono ${diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-rose-300' : 'text-white/60'}`}>
                            {diff > 0 ? '+' : diff < 0 ? '-' : ''}{fmt(Math.abs(diff))}
                          </span>
                        </div>
                      </div>
                    )}
                    {points.length === 1 && <p className="text-[11px] text-white/40 text-center">Only one result so far - the bars appear as more are added.</p>}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
