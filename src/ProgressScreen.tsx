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

interface CircuitRound {
  round: number;
  timeSeconds: string;
}

interface GoalEntry {
  id: string;
  activityName: string;
  status: 'Pending' | 'Pass' | 'AlreadyFit';
  dateAdded: string;
  dateAchieved?: string;
  observation?: string;
  value?: string;
  valueType?: 'time_seconds' | 'score_10' | 'distance_km' | 'duration_minutes' | 'steps' | 'ratio' | 'reps' | 'unilateral_time' | 'bilateral_time' | 'circuits';
  valueLeft?: string;
  valueRight?: string;
  circuitRounds?: CircuitRound[];
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
  id?: string;
  skillName: string;
}

interface AssessmentSnapshot {
  id: string;
  date: string;
  clientVisible?: boolean;

  // BCA
  weightKg?: number;
  bodyFatPercentage?: number;
  muscleMassKg?: number;
  visceralFatLevel?: number;
  restingHeartRateBpm?: number;

  // Posture
  postureScore?: number;

  // Flexibility & Mobility
  thomasTestPass?: boolean;
  thomasTestScore?: number;
  passiveStraightLegRaisePass?: boolean;
  passiveStraightLegRaiseScore?: number;
  shoulderFlexionTestPass?: boolean;
  shoulderFlexionScore?: number;
  shoulderExtensionTestPass?: boolean;
  shoulderExtensionScore?: number;

  // Balance
  unipedalStanceLeftSeconds?: number;
  unipedalStanceRightSeconds?: number;

  // Core Endurance & Stability
  mcgillFlexorSeconds?: number;
  mcgillExtensorSeconds?: number;
  mcgillRightSideBridgeSeconds?: number;
  mcgillLeftSideBridgeSeconds?: number;
  mcgillFlexorExtensorRatio?: string;
  mcgillRightLeftSideRatio?: string;
  mcgillRightToExtensorRatio?: string;
  mcgillLeftToExtensorRatio?: string;

  // Movement
  bendAndLiftSquatPatternPass?: boolean;
  bendAndLiftSquatPatternScore?: number;
  singleLegStepUpPass?: boolean;
  singleLegStepUpScore?: number;
  shoulderPushStabilizationPass?: boolean;
  shoulderPushStabilizationScore?: number;
  pullStabilityStandingRowPass?: boolean;
  pullStabilityStandingRowScore?: number;
  thoracicSpineMobilityPass?: boolean;
  thoracicSpineMobilityScore?: number;
  overheadSquatTestPass?: boolean;
  overheadSquatTestScore?: number;

  // Cardio
  vo2Max?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  aerobicCapacityScore?: number;

  // Muscular Endurance
  pushUpsReps?: number;
  pullUpMaxReps?: number;
  bodyweightSquatsReps?: number;

  // Muscular Strength
  benchPress1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
  overheadPress1RM?: number;

  // SAQ
  tTestSeconds?: number;

  // Power
  verticalJumpCm?: number;

  // Shared
  targetMilestone?: string;
  movementPostureIssues?: MovementPostureIssue[];
  skillProgressions?: SkillProgressItem[];
}

// The "Performance" tab covers every category except BCA and Skills.
type PerformanceCategory =
  | 'hub'
  | 'posture'
  | 'flexibility'
  | 'balance'
  | 'core_endurance'
  | 'movement'
  | 'cardio'
  | 'muscular_endurance'
  | 'muscular_strength'
  | 'saq'
  | 'power'
  | 'achievements'
  | 'already_fit';

type TopTab = 'bca' | 'performance' | 'skills';

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ clientId }) => {
  const [topTab, setTopTab] = useState<TopTab>('bca');
  const [perfCategory, setPerfCategory] = useState<PerformanceCategory>('hub');
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

  // Skills lives on the client's goals, not on assessment records, so it
  // can have real content even before any assessment has been shared.
  const hasAnyData = assessments.length > 0 || goals.length > 0;

  if (!hasAnyData) {
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

  const TabButton: React.FC<{ tab: TopTab; label: string }> = ({ tab, label }) => (
    <button
      onClick={() => setTopTab(tab)}
      className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
        topTab === tab ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/[0.04] text-white/50'
      }`}
    >
      {label}
    </button>
  );

  const BackButton = () => (
    <button
      onClick={() => setPerfCategory('hub')}
      className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1 mb-3"
    >
      ← Back to Performance Categories
    </button>
  );

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
      <div className="flex gap-2 mb-5">
        <TabButton tab="bca" label="BCA Statistics" />
        <TabButton tab="performance" label="Performance" />
        <TabButton tab="skills" label="Skill Roadmap" />
      </div>

      {topTab === 'bca' && (() => {
        const weightData = chronological.filter((a) => a.weightKg != null).map((a) => ({ date: a.date, value: a.weightKg as number }));
        const bodyFatData = chronological.filter((a) => a.bodyFatPercentage != null).map((a) => ({ date: a.date, value: a.bodyFatPercentage as number }));
        const muscleData = chronological.filter((a) => a.muscleMassKg != null).map((a) => ({ date: a.date, value: a.muscleMassKg as number }));
        const visceralData = chronological.filter((a) => a.visceralFatLevel != null).map((a) => ({ date: a.date, value: a.visceralFatLevel as number }));

        if (weightData.length === 0 && bodyFatData.length === 0 && muscleData.length === 0 && visceralData.length === 0) {
          return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">No BCA data shared yet.</p>
            </div>
          );
        }

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

      {topTab === 'skills' && (() => {
        const skillGoals = goals.filter((g) => g.activityName.startsWith('Skills:'));
        if (skillGoals.length === 0) {
          return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">No skills tracked yet.</p>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {skillGoals.map((g) => (
              <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-semibold">{g.activityName.replace('Skills: ', '')}</span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                    g.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                    g.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-white/10 text-white/50'
                  }`}>
                    {g.status === 'Pass' ? '✓ Pass' : g.status === 'AlreadyFit' ? '🎓 Already Fit' : 'In Progress'}
                    {g.dateAchieved && <span className="text-white/40 font-normal">{g.dateAchieved}</span>}
                  </span>
                </div>
                {g.observation && <p className="text-[11px] text-white/40 font-light mt-1">{g.observation}</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {topTab === 'performance' && (
        <div>
          {perfCategory === 'hub' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPerfCategory('posture')} className="bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🧍</span>
                  <h3 className="text-sm font-bold text-white">Posture</h3>
                  <p className="text-[11px] text-white/40 font-light">Postural alignment.</p>
                </button>
                <button onClick={() => setPerfCategory('flexibility')} className="bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🤸</span>
                  <h3 className="text-sm font-bold text-white">Flexibility & Mobility</h3>
                  <p className="text-[11px] text-white/40 font-light">Thomas, SLR, shoulder tests.</p>
                </button>
                <button onClick={() => setPerfCategory('balance')} className="bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🦵</span>
                  <h3 className="text-sm font-bold text-white">Balance</h3>
                  <p className="text-[11px] text-white/40 font-light">Unipedal Stance Test.</p>
                </button>
                <button onClick={() => setPerfCategory('core_endurance')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">💪</span>
                  <h3 className="text-sm font-bold text-white">Core Endurance & Stability</h3>
                  <p className="text-[11px] text-white/40 font-light">McGill's Core Endurance Test.</p>
                </button>
                <button onClick={() => setPerfCategory('movement')} className="bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🏃</span>
                  <h3 className="text-sm font-bold text-white">Movement</h3>
                  <p className="text-[11px] text-white/40 font-light">Movement pattern screens.</p>
                </button>
                <button onClick={() => setPerfCategory('cardio')} className="bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">❤️</span>
                  <h3 className="text-sm font-bold text-white">Cardio</h3>
                  <p className="text-[11px] text-white/40 font-light">VO2 Max & aerobic tests.</p>
                </button>
                <button onClick={() => setPerfCategory('muscular_endurance')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🏋️</span>
                  <h3 className="text-sm font-bold text-white">Muscular Endurance</h3>
                  <p className="text-[11px] text-white/40 font-light">Push-ups, pull-ups, squats.</p>
                </button>
                <button onClick={() => setPerfCategory('muscular_strength')} className="bg-[#242426] border border-white/[0.06] hover:border-red-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🏆</span>
                  <h3 className="text-sm font-bold text-white">Muscular Strength</h3>
                  <p className="text-[11px] text-white/40 font-light">1RM bench, squat, deadlift, OHP.</p>
                </button>
                <button onClick={() => setPerfCategory('saq')} className="bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-sm font-bold text-white">SAQ</h3>
                  <p className="text-[11px] text-white/40 font-light">Speed, Agility & Quickness.</p>
                </button>
                <button onClick={() => setPerfCategory('power')} className="bg-[#242426] border border-white/[0.06] hover:border-purple-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🚀</span>
                  <h3 className="text-sm font-bold text-white">Power</h3>
                  <p className="text-[11px] text-white/40 font-light">Vertical Jump.</p>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => setPerfCategory('achievements')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🏅</span>
                  <h3 className="text-sm font-bold text-white">Achievements</h3>
                  <p className="text-[11px] text-white/40 font-light">Milestones reached in your journey.</p>
                </button>
                <button onClick={() => setPerfCategory('already_fit')} className="bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <span className="text-xl">🎓</span>
                  <h3 className="text-sm font-bold text-white">Already Fit</h3>
                  <p className="text-[11px] text-white/40 font-light">Areas you were already proficient in.</p>
                </button>
              </div>
            </div>
          )}

          {perfCategory === 'posture' && (
            <div>
              <BackButton />
              {(() => {
                const scoreData = chronological.filter((a) => a.postureScore != null).map((a) => ({ date: a.date, value: a.postureScore as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('Posture:') && g.activityName !== 'Posture: Postural Alignment Score');

                return (
                  <div className="space-y-3">
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Postural Alignment Score</span>
                      <MiniLineChart data={scoreData} color="#6ccbde" unit="/10" />
                    </div>

                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between">
                            <div>
                              <span className="text-sm text-white font-semibold block">{g.activityName.replace('Posture: ', '')}</span>
                              {g.value && <span className="text-[11px] text-white/40 font-light">Score: {g.value}/10</span>}
                            </div>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              g.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                              g.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-white/10 text-white/50'
                            }`}>
                              {g.status === 'Pass' ? '✓ Pass' : g.status === 'AlreadyFit' ? '🎓 Already Fit' : 'In Progress'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'flexibility' && (
            <div>
              <BackButton />
              {(() => {
                const tests: { key: keyof AssessmentSnapshot; scoreKey: keyof AssessmentSnapshot; label: string; color: string }[] = [
                  { key: 'thomasTestPass', scoreKey: 'thomasTestScore', label: 'Thomas Test', color: '#ec2226' },
                  { key: 'passiveStraightLegRaisePass', scoreKey: 'passiveStraightLegRaiseScore', label: 'Passive Straight Leg Raise', color: '#f59e0b' },
                  { key: 'shoulderFlexionTestPass', scoreKey: 'shoulderFlexionScore', label: 'Shoulder Flexion Test', color: '#6ccbde' },
                  { key: 'shoulderExtensionTestPass', scoreKey: 'shoulderExtensionScore', label: 'Shoulder Extension Test', color: '#a78bfa' },
                ];
                const customGoals = goals.filter((g) => g.activityName.startsWith('Flexibility & Mobility:') && !tests.some((t) => `Flexibility & Mobility: ${t.label}` === g.activityName));
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tests.map((t) => {
                      const scoreData = chronological.filter((a) => a[t.scoreKey] != null).map((a) => ({ date: a.date, value: a[t.scoreKey] as number }));
                      const latest = [...chronological].reverse().find((a) => a[t.key] != null);
                      return (
                        <div key={t.key} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                          <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{t.label}</span>
                            {latest && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${latest[t.key] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {latest[t.key] ? 'Pass' : 'Needs Work'}
                              </span>
                            )}
                          </div>
                          <MiniLineChart data={scoreData} color={t.color} unit="/10" />
                        </div>
                      );
                    })}
                    {customGoals.map((g) => (
                      <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                        <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Flexibility & Mobility: ', '')}</span>
                        {g.value && <span className="text-[11px] text-white/40 font-light">Score: {g.value}/10</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'balance' && (
            <div>
              <BackButton />
              {(() => {
                const leftData = chronological.filter((a) => a.unipedalStanceLeftSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceLeftSeconds as number }));
                const rightData = chronological.filter((a) => a.unipedalStanceRightSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceRightSeconds as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('Balance:') && g.activityName !== 'Balance: Unipedal Stance Test');
                return (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-white/60">Unipedal Stance Test</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Left Leg</span>
                        <MiniLineChart data={leftData} color="#ec2226" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Right Leg</span>
                        <MiniLineChart data={rightData} color="#6ccbde" unit="s" />
                      </div>
                    </div>
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Balance: ', '')}</span>
                            {g.valueType === 'unilateral_time' ? (
                              <span className="text-[11px] text-white/40 font-light">Left: {g.valueLeft || '—'}s · Right: {g.valueRight || '—'}s</span>
                            ) : (
                              g.value && <span className="text-[11px] text-white/40 font-light">Time: {g.value}s</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'core_endurance' && (
            <div>
              <BackButton />
              {(() => {
                const flexorData = chronological.filter((a) => a.mcgillFlexorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillFlexorSeconds as number }));
                const extensorData = chronological.filter((a) => a.mcgillExtensorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillExtensorSeconds as number }));
                const rightData = chronological.filter((a) => a.mcgillRightSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillRightSideBridgeSeconds as number }));
                const leftData = chronological.filter((a) => a.mcgillLeftSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillLeftSideBridgeSeconds as number }));
                const latest = [...chronological].reverse().find((a) => a.mcgillFlexorExtensorRatio || a.mcgillRightLeftSideRatio || a.mcgillRightToExtensorRatio || a.mcgillLeftToExtensorRatio);
                const customGoals = goals.filter((g) => g.activityName.startsWith('Core Endurance & Stability:') && g.activityName !== "Core Endurance & Stability: McGill's Test");
                return (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-white/60">McGill's Core Endurance Test</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Flexor Endurance</span>
                        <MiniLineChart data={flexorData} color="#ec2226" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Extensor Endurance</span>
                        <MiniLineChart data={extensorData} color="#f59e0b" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Right Side Bridge</span>
                        <MiniLineChart data={rightData} color="#6ccbde" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Left Side Bridge</span>
                        <MiniLineChart data={leftData} color="#a78bfa" unit="s" />
                      </div>
                    </div>
                    {latest && (
                      <div className="grid grid-cols-2 gap-3">
                        {latest.mcgillFlexorExtensorRatio && (
                          <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3">
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Flexor-Extensor Ratio</span>
                            <span className="text-sm text-white font-mono">{latest.mcgillFlexorExtensorRatio}</span>
                          </div>
                        )}
                        {latest.mcgillRightLeftSideRatio && (
                          <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3">
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Right-Left Side Ratio</span>
                            <span className="text-sm text-white font-mono">{latest.mcgillRightLeftSideRatio}</span>
                          </div>
                        )}
                        {latest.mcgillRightToExtensorRatio && (
                          <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3">
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Right to Extensor Ratio</span>
                            <span className="text-sm text-white font-mono">{latest.mcgillRightToExtensorRatio}</span>
                          </div>
                        )}
                        {latest.mcgillLeftToExtensorRatio && (
                          <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3">
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Left to Extensor Ratio</span>
                            <span className="text-sm text-white font-mono">{latest.mcgillLeftToExtensorRatio}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Core Endurance & Stability: ', '')}</span>
                            {g.value && <span className="text-[11px] text-white/40 font-light">Time: {g.value}s</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'movement' && (
            <div>
              <BackButton />
              {(() => {
                const tests: { key: keyof AssessmentSnapshot; scoreKey: keyof AssessmentSnapshot; label: string; color: string }[] = [
                  { key: 'bendAndLiftSquatPatternPass', scoreKey: 'bendAndLiftSquatPatternScore', label: 'Bend & Lift Squat Pattern', color: '#ec2226' },
                  { key: 'singleLegStepUpPass', scoreKey: 'singleLegStepUpScore', label: 'Single Leg Step Up', color: '#f59e0b' },
                  { key: 'shoulderPushStabilizationPass', scoreKey: 'shoulderPushStabilizationScore', label: 'Shoulder Push Stabilization', color: '#6ccbde' },
                  { key: 'pullStabilityStandingRowPass', scoreKey: 'pullStabilityStandingRowScore', label: 'Pull Stability Standing Row', color: '#a78bfa' },
                  { key: 'thoracicSpineMobilityPass', scoreKey: 'thoracicSpineMobilityScore', label: 'Thoracic Spine Mobility', color: '#34d399' },
                  { key: 'overheadSquatTestPass', scoreKey: 'overheadSquatTestScore', label: 'Overhead Squat Test', color: '#fb923c' },
                ];
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tests.map((t) => {
                      const scoreData = chronological.filter((a) => a[t.scoreKey] != null).map((a) => ({ date: a.date, value: a[t.scoreKey] as number }));
                      const latest = [...chronological].reverse().find((a) => a[t.key] != null);
                      return (
                        <div key={t.key} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                          <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{t.label}</span>
                            {latest && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${latest[t.key] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {latest[t.key] ? 'Pass' : 'Needs Work'}
                              </span>
                            )}
                          </div>
                          <MiniLineChart data={scoreData} color={t.color} unit="/10" />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'cardio' && (
            <div>
              <BackButton />
              {(() => {
                const vo2Data = chronological.filter((a) => a.vo2Max != null).map((a) => ({ date: a.date, value: a.vo2Max as number }));
                const bpData = chronological.filter((a) => a.bloodPressureSystolic != null).map((a) => ({ date: a.date, value: a.bloodPressureSystolic as number }));
                const conditioningData = chronological.filter((a) => a.aerobicCapacityScore != null).map((a) => ({ date: a.date, value: a.aerobicCapacityScore as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('Cardio:') && g.activityName !== 'Cardio: VO2 Max');
                const unitFor = (vt?: string) => vt === 'distance_km' ? 'km' : vt === 'duration_minutes' ? 'min' : vt === 'steps' ? 'steps' : '';
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">VO2 Max</span>
                        <MiniLineChart data={vo2Data} color="#ec2226" unit="ml/kg/min" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Systolic BP</span>
                        <MiniLineChart data={bpData} color="#f59e0b" unit="mmHg" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden sm:col-span-2">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Conditioning Score</span>
                        <MiniLineChart data={conditioningData} color="#6ccbde" unit="/100" />
                      </div>
                    </div>

                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Cardio: ', '')}</span>
                            {g.valueType === 'circuits' && g.circuitRounds && g.circuitRounds.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {g.circuitRounds.map((r, i) => (
                                  <span key={i} className="text-[10px] text-white/50 bg-white/[0.06] rounded-lg px-2 py-1">
                                    Round {r.round}: {r.timeSeconds}s
                                  </span>
                                ))}
                              </div>
                            ) : (
                              g.value && <span className="text-[11px] text-white/40 font-light">{g.value} {unitFor(g.valueType)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'muscular_endurance' && (
            <div>
              <BackButton />
              {(() => {
                const pushUpsData = chronological.filter((a) => a.pushUpsReps != null).map((a) => ({ date: a.date, value: a.pushUpsReps as number }));
                const pullUpsData = chronological.filter((a) => a.pullUpMaxReps != null).map((a) => ({ date: a.date, value: a.pullUpMaxReps as number }));
                const squatsData = chronological.filter((a) => a.bodyweightSquatsReps != null).map((a) => ({ date: a.date, value: a.bodyweightSquatsReps as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('Muscular Endurance:'));
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Push-Ups</span>
                        <MiniLineChart data={pushUpsData} color="#ec2226" unit="reps" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Pull-Ups</span>
                        <MiniLineChart data={pullUpsData} color="#f59e0b" unit="reps" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden sm:col-span-2">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Bodyweight Squats</span>
                        <MiniLineChart data={squatsData} color="#6ccbde" unit="reps" />
                      </div>
                    </div>
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Muscular Endurance: ', '')}</span>
                            {g.value && <span className="text-[11px] text-white/40 font-light">{g.value} reps</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'muscular_strength' && (
            <div>
              <BackButton />
              {(() => {
                const lifts: { key: keyof AssessmentSnapshot; label: string; color: string }[] = [
                  { key: 'benchPress1RM', label: 'Bench Press 1RM', color: '#ec2226' },
                  { key: 'squat1RM', label: 'Squat 1RM', color: '#f59e0b' },
                  { key: 'deadlift1RM', label: 'Deadlift 1RM', color: '#6ccbde' },
                  { key: 'overheadPress1RM', label: 'Overhead Press 1RM', color: '#a78bfa' },
                ];
                const customGoals = goals.filter((g) => g.activityName.startsWith('Muscular Strength:'));
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lifts.map((l) => {
                        const data = chronological.filter((a) => a[l.key] != null).map((a) => ({ date: a.date, value: a[l.key] as number }));
                        return (
                          <div key={l.key} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                            <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${l.color}, transparent)` }} />
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{l.label}</span>
                            <MiniLineChart data={data} color={l.color} unit="kg" />
                          </div>
                        );
                      })}
                    </div>
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Muscular Strength: ', '')}</span>
                            {g.value && <span className="text-[11px] text-white/40 font-light">{g.value} kg</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'saq' && (
            <div>
              <BackButton />
              {(() => {
                const tTestData = chronological.filter((a) => a.tTestSeconds != null).map((a) => ({ date: a.date, value: a.tTestSeconds as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('SAQ:') && g.activityName !== 'SAQ: T Test');
                return (
                  <div className="space-y-3">
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">T Test</span>
                      <MiniLineChart data={tTestData} color="#ec2226" unit="s" />
                    </div>
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('SAQ: ', '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'power' && (
            <div>
              <BackButton />
              {(() => {
                const jumpData = chronological.filter((a) => a.verticalJumpCm != null).map((a) => ({ date: a.date, value: a.verticalJumpCm as number }));
                const customGoals = goals.filter((g) => g.activityName.startsWith('Power:'));
                return (
                  <div className="space-y-3">
                    <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                      <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Vertical Jump</span>
                      <MiniLineChart data={jumpData} color="#a78bfa" unit="cm" />
                    </div>
                    {customGoals.length > 0 && (
                      <div className="space-y-2">
                        {customGoals.map((g) => (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                            <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Power: ', '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'achievements' && (
            <div>
              <BackButton />
              {(() => {
                const passedGoals = goals.filter((g) => g.status === 'Pass' && !g.activityName.startsWith('Skills:'));
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

          {perfCategory === 'already_fit' && (
            <div>
              <BackButton />
              {(() => {
                const alreadyFitGoals = goals.filter((g) => g.status === 'AlreadyFit' && !g.activityName.startsWith('Skills:'));
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
      )}
    </div>
  );
};
