import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
} from './firebase';

type ProgramType = 'ZAKI' | 'KATBA' | 'Calisthenics';

interface CurriculumScreenProps {
  clientId: string;
  programType: ProgramType;
}

interface ExerciseSet {
  targetWeightKg: number;
  targetReps: number;
}

interface EpisodeExercise {
  name: string;
  sets: ExerciseSet[];
}

interface Episode {
  id: string;
  episodeNumber: number;
  episodeTitle: string;
  episodeTarget: string;
  goal?: string;
  skillGoal?: string;
  structuredExercises: EpisodeExercise[];
}

export const CurriculumScreen: React.FC<CurriculumScreenProps> = ({ clientId, programType }) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEpisodeId, setOpenEpisodeId] = useState<string | null>(null);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setLoading(false);
      return;
    }

    // This query's shape must match the Firestore security rule
    // exactly - filtering by clientId here is what the rule checks
    // against, not an optional convenience. This is individualized,
    // per-client content built specifically for this one client.
    const episodesQuery = query(
      collection(db, 'intokine_recorded_session_episodes'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      episodesQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as Episode);
        results.sort((a, b) => a.episodeNumber - b.episodeNumber);
        setEpisodes(results);
        setLoading(false);
      },
      (err) => {
        console.warn('Could not load episodes:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  const accent = programType === 'ZAKI' ? '#6ccbde' : '#ec2226';

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      <div className="px-5 pt-8 pb-6">
        <p className="text-[11px] text-white/50 font-light tracking-wide">YOUR PROGRAM</p>
        <h1 className="font-header text-3xl text-white tracking-wide">{programType}</h1>
      </div>

      <div className="px-5 pb-8 space-y-3 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-white/40 text-sm font-light">Loading your episodes...</div>
        ) : episodes.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
            <p className="text-sm text-white/50 font-light leading-relaxed">
              Your coach is building your {programType} episodes - they'll appear here once ready.
            </p>
          </div>
        ) : (
          episodes.map((ep) => {
            const isOpen = openEpisodeId === ep.id;
            return (
              <div key={ep.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenEpisodeId(isOpen ? null : ep.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-2"
                >
                  <div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                      style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}15` }}
                    >
                      EPISODE {ep.episodeNumber}
                    </span>
                    <div className="text-sm font-semibold text-white mt-1.5">{ep.episodeTitle}</div>
                    <div className="text-xs text-white/50 font-light mt-0.5">
                      {ep.goal && <span>{ep.goal} · </span>}
                      {ep.skillGoal && <span>{ep.skillGoal} · </span>}
                      {ep.episodeTarget}
                    </div>
                  </div>
                  <span className="text-white/40 text-lg">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/[0.08] pt-3">
                    {(ep.structuredExercises || []).map((ex, i) => (
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
