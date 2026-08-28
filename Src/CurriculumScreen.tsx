import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
} from './firebase';

type ProgramCategory = 'ZAKI' | 'KATBA';

interface CurriculumScreenProps {
  programCategory: ProgramCategory;
}

interface ExerciseSet {
  targetWeightKg: number;
  targetReps: number;
}

interface CurriculumExercise {
  name: string;
  sets: ExerciseSet[];
}

interface CurriculumSession {
  id: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  targetFocus?: string;
  structuredExercises: CurriculumExercise[];
}

export const CurriculumScreen: React.FC<CurriculumScreenProps> = ({ programCategory }) => {
  const [sessions, setSessions] = useState<CurriculumSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
      return;
    }

    // This query's shape must match the Firestore security rule
    // exactly - filtering by programCategory here is what the rule
    // checks against, not an optional convenience.
    const curriculumQuery = query(
      collection(db, 'intokine_master_curriculum'),
      where('programCategory', '==', programCategory)
    );

    const unsubscribe = onSnapshot(
      curriculumQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as CurriculumSession);
        results.sort((a, b) => a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber);
        setSessions(results);
        setLoading(false);
      },
      (err) => {
        console.warn('Could not load curriculum:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [programCategory]);

  const accent = programCategory === 'ZAKI' ? '#6ccbde' : '#ec2226';

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      <div className="px-5 pt-8 pb-6">
        <p className="text-[11px] text-white/50 font-light tracking-wide">YOUR PROGRAM</p>
        <h1 className="font-header text-3xl text-white tracking-wide">{programCategory}</h1>
      </div>

      <div className="px-5 pb-8 space-y-3 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-white/40 text-sm font-light">Loading your program...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
            <p className="text-sm text-white/50 font-light leading-relaxed">
              Your {programCategory} curriculum is being finalized and will appear here soon.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const isOpen = openSessionId === session.id;
            return (
              <div key={session.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenSessionId(isOpen ? null : session.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-2"
                >
                  <div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                      style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}15` }}
                    >
                      WEEK {session.weekNumber} · DAY {session.dayNumber}
                    </span>
                    <div className="text-sm font-semibold text-white mt-1.5">{session.title}</div>
                    {session.targetFocus && (
                      <div className="text-xs text-white/50 font-light mt-0.5">{session.targetFocus}</div>
                    )}
                  </div>
                  <span className="text-white/40 text-lg">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/[0.08] pt-3">
                    {(session.structuredExercises || []).map((ex, i) => (
                      <div key={i} className="text-xs text-white/70 font-light flex items-center justify-between">
                        <span className="text-white/90">{ex.name}</span>
                        <span className="font-mono text-white/50">
                          {ex.sets?.length || 0} × {ex.sets?.[0]?.targetReps || 0}
                          {ex.sets?.[0]?.targetWeightKg ? ` @ ${ex.sets[0].targetWeightKg}kg` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
