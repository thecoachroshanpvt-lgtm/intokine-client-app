import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
} from './firebase';
import { MiniLineChart } from './MiniLineChart';
import { MiniBarChart } from './MiniBarChart';

interface ProgressScreenProps {
  clientId: string;
}

interface MovementPostureIssue {
  id: string;
  issueName: string;
  issueType: 'Posture' | 'Movement';
  progressPercentage: number;
  beforePhotoBase64?: string;
  afterPhotoBase64?: string;
  beforeVideoUrl?: string;
  afterVideoUrl?: string;
  notes?: string;
}

interface SkillProgressItem {
  skillName: string;
  category: string;
  level: string;
  progressPercentage: number;
  benchmarkMetric?: string;
}

interface AssessmentSnapshot {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercentage: number;
  vo2Max: number;
  muscleMassKg?: number;
  visceralFatLevel?: number;
  benchPress1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
  targetMilestone?: string;
  movementPostureIssues?: MovementPostureIssue[];
  skillProgressions?: SkillProgressItem[];
}

type ProgressCategory = 'hub' | 'bca' | 'movement_posture' | 'performance';

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ clientId }) => {
  const [category, setCategory] = useState<ProgressCategory>('hub');
  const [assessments, setAssessments] = useState<AssessmentSnapshot[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setAssessmentsLoading(false);
      return;
    }

    const assessmentsQuery = query(
      collection(db, 'intokine_assessments'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );

    const unsubscribe = onSnapshot(
      assessmentsQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as AssessmentSnapshot);
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAssessments(results);
        setAssessmentsLoading(false);
      },
      (err) => {
        console.warn('Could not load progress:', err);
        setAssessmentsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  const chronological = [...assessments].reverse();

  if (assessmentsLoading) {
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
        <div className="text-center py-12 text-white/40 text-sm font-light">Loading your progress...</div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            No progress reports shared yet — your coach will share your assessment results here.
          </p>
        </div>
      </div>
    );
  }

  const BackButton = () => (
    <button
      onClick={() => setCategory('hub')}
      className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1 mb-3"
    >
      ← Back to Progress Categories
    </button>
  );

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
      {category === 'hub' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setCategory('bca')}
            className="bg-[#242426] border border-white/[0.06] hover:border-purple-400/40 rounded-2xl p-5 text-left transition space-y-2"
          >
            <span className="text-2xl">📊</span>
            <h3 className="text-sm font-bold text-white">BCA</h3>
            <p className="text-xs text-white/40 font-light">Body weight, body fat, muscle mass, visceral fat.</p>
          </button>

          <button
            onClick={() => setCategory('movement_posture')}
            className="bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-5 text-left transition space-y-2"
          >
            <span className="text-2xl">🧍</span>
            <h3 className="text-sm font-bold text-white">Movement & Posture Progress</h3>
            <p className="text-xs text-white/40 font-light">Tracked issues, with before/after photos and videos.</p>
          </button>

          <button
            onClick={() => setCategory('performance')}
            className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-5 text-left transition space-y-2 sm:col-span-2"
          >
            <span className="text-2xl">🏆</span>
            <h3 className="text-sm font-bold text-white">Performance</h3>
            <p className="text-xs text-white/40 font-light">Strength 1RM, cardio, and skill progressions.</p>
          </button>
        </div>
      )}

      {category === 'bca' && (
        <div>
          <BackButton />
          {(() => {
            const weightData = chronological.map((a) => ({ date: a.date, value: a.weightKg }));
            const bodyFatData = chronological.map((a) => ({ date: a.date, value: a.bodyFatPercentage }));
            const muscleData = chronological
              .filter((a) => a.muscleMassKg != null)
              .map((a) => ({ date: a.date, value: a.muscleMassKg as number }));
            const visceralData = chronological
              .filter((a) => a.visceralFatLevel != null)
              .map((a) => ({ date: a.date, value: a.visceralFatLevel as number }));

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Body Weight</span>
                  <MiniLineChart data={weightData} color="#ec2226" unit="kg" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Body Fat</span>
                  <MiniLineChart data={bodyFatData} color="#f59e0b" unit="%" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Skeletal Muscle Mass</span>
                  <MiniLineChart data={muscleData} color="#6ccbde" unit="kg" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Visceral Fat</span>
                  <MiniLineChart data={visceralData} color="#a78bfa" unit="" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {category === 'movement_posture' && (
        <div>
          <BackButton />
          {(() => {
            const issueNames = Array.from(
              new Set(chronological.flatMap((a) => (a.movementPostureIssues || []).map((i) => i.issueName)))
            );

            if (issueNames.length === 0) {
              return (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">
                    No movement or posture issues tracked yet.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 uppercase font-semibold">
                  Found Issues ({issueNames.length})
                </div>
                {issueNames.map((issueName) => {
                  const points = chronological
                    .map((a) => {
                      const match = (a.movementPostureIssues || []).find((i) => i.issueName === issueName);
                      return match ? { date: a.date, value: match.progressPercentage } : null;
                    })
                    .filter((p): p is { date: string; value: number } => p !== null);

                  const latest = chronological
                    .slice()
                    .reverse()
                    .find((a) => (a.movementPostureIssues || []).some((i) => i.issueName === issueName))
                    ?.movementPostureIssues?.find((i) => i.issueName === issueName);

                  if (!latest) return null;

                  return (
                    <div key={issueName} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{issueName}</span>
                        <span className="text-[9px] text-white/40 uppercase font-semibold">{latest.issueType}</span>
                      </div>
                      <MiniLineChart data={points} color="#ec2226" unit="%" />

                      {latest.issueType === 'Posture' && (latest.beforePhotoBase64 || latest.afterPhotoBase64) && (
                        <div className="grid grid-cols-2 gap-2">
                          {latest.beforePhotoBase64 && (
                            <div>
                              <div className="text-[9px] text-white/40 uppercase mb-1">Before</div>
                              <img src={latest.beforePhotoBase64} alt="Before" className="w-full rounded-lg" />
                            </div>
                          )}
                          {latest.afterPhotoBase64 && (
                            <div>
                              <div className="text-[9px] text-white/40 uppercase mb-1">After</div>
                              <img src={latest.afterPhotoBase64} alt="After" className="w-full rounded-lg" />
                            </div>
                          )}
                        </div>
                      )}

                      {latest.issueType === 'Movement' && (latest.beforeVideoUrl || latest.afterVideoUrl) && (
                        <div className="flex gap-3 text-xs">
                          {latest.beforeVideoUrl && (
                            <a href={latest.beforeVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#6ccbde] underline">Before video</a>
                          )}
                          {latest.afterVideoUrl && (
                            <a href={latest.afterVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#6ccbde] underline">After video</a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'performance' && (
        <div className="space-y-4">
          <BackButton />

          {(() => {
            const benchData = chronological.filter((a) => a.benchPress1RM != null).map((a) => ({ date: a.date, value: a.benchPress1RM as number }));
            const squatData = chronological.filter((a) => a.squat1RM != null).map((a) => ({ date: a.date, value: a.squat1RM as number }));
            const deadliftData = chronological.filter((a) => a.deadlift1RM != null).map((a) => ({ date: a.date, value: a.deadlift1RM as number }));
            const vo2Data = chronological.map((a) => ({ date: a.date, value: a.vo2Max }));

            return (
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 uppercase font-semibold">Strength (1RM)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                    <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Bench Press</span>
                    <MiniBarChart data={benchData} color="#ec2226" unit="kg" />
                  </div>
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                    <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Squat</span>
                    <MiniBarChart data={squatData} color="#f59e0b" unit="kg" />
                  </div>
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                    <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Deadlift</span>
                    <MiniBarChart data={deadliftData} color="#6ccbde" unit="kg" />
                  </div>
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                    <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Cardio (VO2 Max)</span>
                    <MiniBarChart data={vo2Data} color="#a78bfa" unit="" />
                  </div>
                </div>
              </div>
            );
          })()}

          {(() => {
            const skillNames = Array.from(
              new Set(chronological.flatMap((a) => (a.skillProgressions || []).map((s) => s.skillName)))
            );
            if (skillNames.length === 0) return null;

            return (
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 uppercase font-semibold">Skill Progress</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {skillNames.map((skillName) => {
                    const points = chronological
                      .map((a) => {
                        const match = (a.skillProgressions || []).find((s) => s.skillName === skillName);
                        return match ? { date: a.date, value: match.progressPercentage } : null;
                      })
                      .filter((p): p is { date: string; value: number } => p !== null);

                    const latest = chronological
                      .slice()
                      .reverse()
                      .find((a) => (a.skillProgressions || []).some((s) => s.skillName === skillName))
                      ?.skillProgressions?.find((s) => s.skillName === skillName);

                    return (
                      <div key={skillName} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-white font-bold">{skillName}</span>
                          {latest && (
                            <span className="text-[9px] text-[#6ccbde] font-semibold uppercase">{latest.level}</span>
                          )}
                        </div>
                        {latest?.benchmarkMetric && (
                          <div className="text-[10px] text-white/40 font-light mb-2">{latest.benchmarkMetric}</div>
                        )}
                        <MiniLineChart data={points} color="#ec2226" unit="%" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
