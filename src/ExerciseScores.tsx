import React, { useEffect, useMemo, useState } from 'react';
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

export const ExerciseScores: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [records, setRecords] = useState<PerfRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
                  <div key={ex.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-2">
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
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
