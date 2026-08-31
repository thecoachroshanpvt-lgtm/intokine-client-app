import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from './firebase';
import { MiniLineChart } from './MiniLineChart';
import { MiniBarChart } from './MiniBarChart';

interface GoalEntry {
  id: string;
  activityName: string;
  status: 'Pending' | 'Pass' | 'AlreadyFit';
  dateAdded: string;
  dateAchieved?: string;
}

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
  pullUpMaxReps?: number;
  postureScore?: number;
  mobilityScore?: number;
  targetMilestone?: string;
  movementPostureIssues?: MovementPostureIssue[];
  skillProgressions?: SkillProgressItem[];

  unipedalStanceLeftSeconds?: number;
  unipedalStanceRightSeconds?: number;

  mcgillFlexorSeconds?: number;
  mcgillExtensorSeconds?: number;
  mcgillRightSideBridgeSeconds?: number;
  mcgillLeftSideBridgeSeconds?: number;

  thomasTestPass?: boolean;
  passiveStraightLegRaisePass?: boolean;
  shoulderFlexionTestPass?: boolean;
  shoulderExtensionTestPass?: boolean;

  bendAndLiftSquatPatternPass?: boolean;
  singleLegStepUpPass?: boolean;
  shoulderPushStabilizationPass?: boolean;
  pullStabilityStandingRowPass?: boolean;
  thoracicSpineMobilityPass?: boolean;
  overheadSquatTestPass?: boolean;

  pushUpsReps?: number;
  bodyweightSquatsReps?: number;

  yBalanceScore?: number;

  tTestSeconds?: number;
}

type ProgressCategory =
  | 'hub'
  | 'bca'
  | 'static_posture'
  | 'static_balance'
  | 'torso_endurance'
  | 'flexibility'
  | 'movement_test'
  | 'cardio'
  | 'muscular_endurance'
  | 'dynamic_balance'
  | 'muscular_strength'
  | 'saq'
  | 'skills'
  | 'achievements'
  | 'already_fit';

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ clientId }) => {
  const [category, setCategory] = useState<ProgressCategory>('hub');
  const [goals, setGoals] = useState<GoalEntry[]>([]);
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

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    const fetchGoals = async () => {
      try {
        const clientDoc = await getDoc(doc(db, 'intokine_clients', clientId));
        if (clientDoc.exists()) {
          setGoals(clientDoc.data().goals || []);
        }
      } catch (e) {
        console.warn('Could not load goals:', e);
      }
    };

    fetchGoals();
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
        <div className="space-y-5">
          <div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Phase 1</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setCategory('bca')} className="bg-[#242426] border border-white/[0.06] hover:border-purple-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">📊</span>
                <h3 className="text-sm font-bold text-white">1. BCA</h3>
                <p className="text-[11px] text-white/40 font-light">Body composition analysis.</p>
              </button>
              <button onClick={() => setCategory('static_posture')} className="bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🧍</span>
                <h3 className="text-sm font-bold text-white">2. Static Posture Test</h3>
                <p className="text-[11px] text-white/40 font-light">Postural alignment & tracked issues.</p>
              </button>
              <button onClick={() => setCategory('static_balance')} className="bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🦵</span>
                <h3 className="text-sm font-bold text-white">3. Static Balance Test</h3>
                <p className="text-[11px] text-white/40 font-light">Unipedal Stance Test.</p>
              </button>
              <button onClick={() => setCategory('torso_endurance')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">💪</span>
                <h3 className="text-sm font-bold text-white">4. Torso Muscular Endurance</h3>
                <p className="text-[11px] text-white/40 font-light">McGill's Torso Test.</p>
              </button>
              <button onClick={() => setCategory('flexibility')} className="bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🤸</span>
                <h3 className="text-sm font-bold text-white">5. Flexibility Test</h3>
                <p className="text-[11px] text-white/40 font-light">Thomas, SLR, shoulder tests.</p>
              </button>
              <button onClick={() => setCategory('movement_test')} className="bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🏃</span>
                <h3 className="text-sm font-bold text-white">6. Movement Test</h3>
                <p className="text-[11px] text-white/40 font-light">Movement pattern screens.</p>
              </button>
              <button onClick={() => setCategory('cardio')} className="bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1 sm:col-span-2">
                <span className="text-xl">❤️</span>
                <h3 className="text-sm font-bold text-white">7. Cardiovascular Fitness</h3>
                <p className="text-[11px] text-white/40 font-light">VO2 Max & aerobic tests.</p>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Phase 2</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setCategory('muscular_endurance')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🏋️</span>
                <h3 className="text-sm font-bold text-white">8. Muscular Endurance Test</h3>
                <p className="text-[11px] text-white/40 font-light">Push-ups, pull-ups, squats.</p>
              </button>
              <button onClick={() => setCategory('dynamic_balance')} className="bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">⚖️</span>
                <h3 className="text-sm font-bold text-white">9. Dynamic Balance Test</h3>
                <p className="text-[11px] text-white/40 font-light">Y Balance Test.</p>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">Phase 3</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setCategory('muscular_strength')} className="bg-[#242426] border border-white/[0.06] hover:border-red-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">🏆</span>
                <h3 className="text-sm font-bold text-white">10. Muscular Strength Test</h3>
                <p className="text-[11px] text-white/40 font-light">1RM bench, squat & deadlift.</p>
              </button>
              <button onClick={() => setCategory('saq')} className="bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                <span className="text-xl">⚡</span>
                <h3 className="text-sm font-bold text-white">11. Speed, Agility & Quickness</h3>
                <p className="text-[11px] text-white/40 font-light">T Test.</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => setCategory('skills')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
              <span className="text-xl">🎯</span>
              <h3 className="text-sm font-bold text-white">Skill Progress</h3>
              <p className="text-[11px] text-white/40 font-light">New movements being learned.</p>
            </button>
            <button onClick={() => setCategory('achievements')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
              <span className="text-xl">🏅</span>
              <h3 className="text-sm font-bold text-white">Achievements</h3>
              <p className="text-[11px] text-white/40 font-light">Milestones reached in your journey.</p>
            </button>
            <button onClick={() => setCategory('already_fit')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
              <span className="text-xl">🎓</span>
              <h3 className="text-sm font-bold text-white">Already Fit</h3>
              <p className="text-[11px] text-white/40 font-light">Areas you were already proficient in.</p>
            </button>
          </div>
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

      {category === 'static_posture' && (
        <div>
          <BackButton />
          {(() => {
            const issueNames = Array.from(
              new Set(chronological.flatMap((a) => (a.movementPostureIssues || []).filter((i) => i.issueType === 'Posture').map((i) => i.issueName)))
            );

            const latestAssessment = chronological[chronological.length - 1];

            return (
              <div className="space-y-3">
                {latestAssessment?.postureScore != null && (
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Postural Alignment Score</div>
                    <div className="text-2xl font-bold text-white font-mono">{latestAssessment.postureScore}<span className="text-xs text-white/40">/10</span></div>
                  </div>
                )}

                {issueNames.length === 0 ? (
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                    <p className="text-sm text-white/50 font-light leading-relaxed">No posture issues tracked yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Found Issues ({issueNames.length})</div>
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
                          <span className="text-sm font-bold text-white">{issueName}</span>
                          <MiniLineChart data={points} color="#ec2226" unit="%" />
                          {(latest.beforePhotoBase64 || latest.afterPhotoBase64) && (
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
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'movement_test' && (
        <div>
          <BackButton />
          {(() => {
            const issueNames = Array.from(
              new Set(chronological.flatMap((a) => (a.movementPostureIssues || []).filter((i) => i.issueType === 'Movement').map((i) => i.issueName)))
            );

            const latestAssessment = chronological[chronological.length - 1];
            const passFailTests: { label: string; value?: boolean }[] = [
              { label: 'Bend & Lift Squat Pattern', value: latestAssessment?.bendAndLiftSquatPatternPass },
              { label: 'Single Leg Step Up', value: latestAssessment?.singleLegStepUpPass },
              { label: 'Shoulder Push Stabilization', value: latestAssessment?.shoulderPushStabilizationPass },
              { label: 'Pull Stability Standing Row', value: latestAssessment?.pullStabilityStandingRowPass },
              { label: 'Thoracic Spine Mobility', value: latestAssessment?.thoracicSpineMobilityPass },
              { label: 'Overhead Squat Test', value: latestAssessment?.overheadSquatTestPass },
            ].filter((t) => t.value !== undefined);

            return (
              <div className="space-y-3">
                {latestAssessment?.mobilityScore != null && (
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Mobility & Flexibility Score</div>
                    <div className="text-2xl font-bold text-white font-mono">{latestAssessment.mobilityScore}<span className="text-xs text-white/40">/10</span></div>
                  </div>
                )}

                {passFailTests.length > 0 && (
                  <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Movement Screens</div>
                    {passFailTests.map((t) => (
                      <div key={t.label} className="flex items-center justify-between">
                        <span className="text-xs text-white/80">{t.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.value ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                          {t.value ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {issueNames.length === 0 ? (
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                    <p className="text-sm text-white/50 font-light leading-relaxed">No movement issues tracked yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Found Issues ({issueNames.length})</div>
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
                          <span className="text-sm font-bold text-white">{issueName}</span>
                          <MiniLineChart data={points} color="#ec2226" unit="%" />
                          {(latest.beforeVideoUrl || latest.afterVideoUrl) && (
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
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'static_balance' && (
        <div>
          <BackButton />
          {(() => {
            const leftData = chronological.filter((a) => a.unipedalStanceLeftSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceLeftSeconds as number }));
            const rightData = chronological.filter((a) => a.unipedalStanceRightSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceRightSeconds as number }));
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Left Leg Hold</span>
                  <MiniLineChart data={leftData} color="#ec2226" unit="s" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Right Leg Hold</span>
                  <MiniLineChart data={rightData} color="#6ccbde" unit="s" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {category === 'torso_endurance' && (
        <div>
          <BackButton />
          {(() => {
            const flexorData = chronological.filter((a) => a.mcgillFlexorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillFlexorSeconds as number }));
            const extensorData = chronological.filter((a) => a.mcgillExtensorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillExtensorSeconds as number }));
            const rightBridgeData = chronological.filter((a) => a.mcgillRightSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillRightSideBridgeSeconds as number }));
            const leftBridgeData = chronological.filter((a) => a.mcgillLeftSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillLeftSideBridgeSeconds as number }));
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Flexor Hold</span>
                  <MiniLineChart data={flexorData} color="#ec2226" unit="s" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Extensor Hold</span>
                  <MiniLineChart data={extensorData} color="#f59e0b" unit="s" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Right Side Bridge</span>
                  <MiniLineChart data={rightBridgeData} color="#6ccbde" unit="s" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Left Side Bridge</span>
                  <MiniLineChart data={leftBridgeData} color="#a78bfa" unit="s" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {category === 'flexibility' && (
        <div>
          <BackButton />
          {(() => {
            const latest = chronological[chronological.length - 1];
            const tests: { label: string; value?: boolean }[] = [
              { label: 'Thomas Test', value: latest?.thomasTestPass },
              { label: 'Passive Straight Leg Raise', value: latest?.passiveStraightLegRaisePass },
              { label: 'Shoulder Flexion Test', value: latest?.shoulderFlexionTestPass },
              { label: 'Shoulder Extension Test', value: latest?.shoulderExtensionTestPass },
            ].filter((t) => t.value !== undefined);

            if (tests.length === 0) {
              return (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">No flexibility test results yet.</p>
                </div>
              );
            }

            return (
              <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-2">
                {tests.map((t) => (
                  <div key={t.label} className="flex items-center justify-between">
                    <span className="text-xs text-white/80">{t.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.value ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {t.value ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'cardio' && (
        <div>
          <BackButton />
          {(() => {
            const vo2Data = chronological.map((a) => ({ date: a.date, value: a.vo2Max }));
            return (
              <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">VO2 Max</span>
                <MiniBarChart data={vo2Data} color="#a78bfa" unit="" />
              </div>
            );
          })()}
        </div>
      )}

      {category === 'muscular_endurance' && (
        <div>
          <BackButton />
          {(() => {
            const pushUpsData = chronological.filter((a) => a.pushUpsReps != null).map((a) => ({ date: a.date, value: a.pushUpsReps as number }));
            const pullUpsData = chronological.filter((a) => a.pullUpMaxReps != null).map((a) => ({ date: a.date, value: a.pullUpMaxReps as number }));
            const squatsData = chronological.filter((a) => a.bodyweightSquatsReps != null).map((a) => ({ date: a.date, value: a.bodyweightSquatsReps as number }));
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Push-Ups</span>
                  <MiniLineChart data={pushUpsData} color="#ec2226" unit="" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Pull-Ups</span>
                  <MiniLineChart data={pullUpsData} color="#f59e0b" unit="" />
                </div>
                <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                  <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Bodyweight Squats</span>
                  <MiniLineChart data={squatsData} color="#6ccbde" unit="" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {category === 'dynamic_balance' && (
        <div>
          <BackButton />
          {(() => {
            const yBalanceData = chronological.filter((a) => a.yBalanceScore != null).map((a) => ({ date: a.date, value: a.yBalanceScore as number }));
            return (
              <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Y Balance Composite Score</span>
                <MiniLineChart data={yBalanceData} color="#ec2226" unit="%" />
              </div>
            );
          })()}
        </div>
      )}

      {category === 'muscular_strength' && (
        <div>
          <BackButton />
          {(() => {
            const benchData = chronological.filter((a) => a.benchPress1RM != null).map((a) => ({ date: a.date, value: a.benchPress1RM as number }));
            const squatData = chronological.filter((a) => a.squat1RM != null).map((a) => ({ date: a.date, value: a.squat1RM as number }));
            const deadliftData = chronological.filter((a) => a.deadlift1RM != null).map((a) => ({ date: a.date, value: a.deadlift1RM as number }));
            return (
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
              </div>
            );
          })()}
        </div>
      )}

      {category === 'saq' && (
        <div>
          <BackButton />
          {(() => {
            const tTestData = chronological.filter((a) => a.tTestSeconds != null).map((a) => ({ date: a.date, value: a.tTestSeconds as number }));
            return (
              <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #10b981, transparent)' }} />
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">T Test Time</span>
                <MiniLineChart data={tTestData} color="#10b981" unit="s" />
              </div>
            );
          })()}
        </div>
      )}

      {category === 'skills' && (
        <div>
          <BackButton />
          {(() => {
            const skillNames = Array.from(
              new Set(chronological.flatMap((a) => (a.skillProgressions || []).map((s) => s.skillName)))
            );
            if (skillNames.length === 0) {
              return (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">No skills tracked yet.</p>
                </div>
              );
            }

            return (
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
                        {latest && <span className="text-[9px] text-[#6ccbde] font-semibold uppercase">{latest.level}</span>}
                      </div>
                      {latest?.benchmarkMetric && (
                        <div className="text-[10px] text-white/40 font-light mb-2">{latest.benchmarkMetric}</div>
                      )}
                      <MiniLineChart data={points} color="#ec2226" unit="%" />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'achievements' && (
        <div>
          <BackButton />
          {(() => {
            const passedGoals = goals.filter((g) => g.status === 'Pass');
            if (passedGoals.length === 0) {
              return (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">No achievements passed yet.</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {passedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                    <span className="text-sm text-white font-semibold">{goal.activityName}</span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300">
                      ✓ Pass
                      <span className="text-white/40 font-normal">{goal.dateAchieved}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {category === 'already_fit' && (
        <div>
          <BackButton />
          {(() => {
            const alreadyFitGoals = goals.filter((g) => g.status === 'AlreadyFit');
            if (alreadyFitGoals.length === 0) {
              return (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/50 font-light leading-relaxed">Nothing marked Already Fit yet.</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {alreadyFitGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                    <span className="text-sm text-white font-semibold">{goal.activityName}</span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-amber-500/20 text-amber-300">
                      🎓 Already Fit
                      <span className="text-white/40 font-normal">{goal.dateAchieved}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
