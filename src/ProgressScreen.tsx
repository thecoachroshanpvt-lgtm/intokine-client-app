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
  chestCircumferenceIn?: number;
  waistCircumferenceIn?: number;
  hipsCircumferenceIn?: number;
  rightArmCircumferenceIn?: number;
  leftArmCircumferenceIn?: number;
  rightThighCircumferenceIn?: number;
  leftThighCircumferenceIn?: number;
  calfCircumferenceIn?: number;
  waistToHipRatio?: number;

  // Posture
  postureScore?: number;
  customActivityScores?: Record<string, number>;
  postureBeforeImages?: Record<string, string>;
  postureAfterImages?: Record<string, string>;

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

type XRayType =
  | 'posture'
  | 'flexibility'
  | 'balance'
  | 'core_endurance'
  | 'movement'
  | 'cardio'
  | 'muscular_endurance'
  | 'muscular_strength'
  | 'saq'
  | 'power';

// Subtle, glowing line-art X-ray illustrations, one per category, matched
// to the body part or system that category actually assesses.
const XRayBackground: React.FC<{ type: XRayType }> = ({ type }) => {
  const common = {
    fill: 'none',
    stroke: '#6ccbde',
    strokeWidth: 1.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const paths: Record<XRayType, React.ReactNode> = {
    posture: (
      <g {...common}>
        <path d="M50 4 C 44 20, 56 30, 50 46 C 44 62, 56 72, 50 88 C 46 98, 54 108, 50 116" />
        {[8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108].map((y, i) => (
          <ellipse key={i} cx={50 + Math.sin(i) * 4} cy={y} rx="7" ry="3.2" />
        ))}
      </g>
    ),
    flexibility: (
      <g {...common}>
        <circle cx="50" cy="30" r="10" />
        <path d="M50 40 L50 70" />
        <path d="M50 45 L20 60" />
        <path d="M50 45 L80 30" strokeDasharray="2 3" />
        <path d="M35 52 A 20 20 0 0 0 65 37" strokeDasharray="1 3" strokeWidth="0.8" />
        <path d="M50 70 L30 105" />
        <path d="M50 70 L70 105" />
      </g>
    ),
    balance: (
      <g {...common}>
        <ellipse cx="50" cy="18" rx="9" ry="10" />
        <path d="M50 28 L50 55" />
        <path d="M35 40 L65 40" />
        <path d="M50 55 L50 82" />
        <path d="M50 82 L38 118" />
        <path d="M50 82 L58 100" strokeDasharray="2 4" opacity="0.4" />
        <ellipse cx="35" cy="122" rx="10" ry="4" />
      </g>
    ),
    core_endurance: (
      <g {...common}>
        <path d="M30 10 C 25 30, 25 55, 32 78" />
        <path d="M70 10 C 75 30, 75 55, 68 78" />
        {[18, 28, 38, 48, 58].map((y, i) => (
          <path key={i} d={`M${32 - i * 0.5} ${y} C 50 ${y - 6}, 50 ${y + 6}, ${68 + i * 0.5} ${y}`} />
        ))}
        <path d="M50 78 L50 116" strokeDasharray="2 3" />
      </g>
    ),
    movement: (
      <g {...common}>
        <circle cx="46" cy="14" r="8" />
        <path d="M46 22 L52 50" />
        <path d="M52 50 L30 46" />
        <path d="M52 50 L74 60" />
        <path d="M52 50 L44 82" />
        <path d="M44 82 L26 110" />
        <path d="M52 50 L68 88" />
        <path d="M68 88 L80 112" strokeDasharray="2 3" />
      </g>
    ),
    cardio: (
      <g {...common}>
        <path d="M30 14 C 20 14, 12 24, 12 36 C 12 55, 30 68, 50 88 C 70 68, 88 55, 88 36 C 88 24, 80 14, 70 14 C 60 14, 52 22, 50 30 C 48 22, 40 14, 30 14 Z" />
        <path d="M20 40 L36 40 L42 26 L50 56 L58 34 L64 46 L80 46" strokeWidth="0.9" opacity="0.6" />
      </g>
    ),
    muscular_endurance: (
      <g {...common}>
        <ellipse cx="30" cy="16" rx="9" ry="10" />
        <path d="M30 26 L34 54" />
        <path d="M34 54 C 44 60, 56 60, 66 50" />
        <path d="M66 50 L82 40" />
        <ellipse cx="86" cy="37" rx="5" ry="7" transform="rotate(-30 86 37)" />
        <path d="M34 54 L28 90" strokeDasharray="2 3" opacity="0.4" />
      </g>
    ),
    muscular_strength: (
      <g {...common}>
        <path d="M20 50 L80 50" strokeWidth="2" />
        <rect x="12" y="42" width="10" height="16" rx="2" />
        <rect x="78" y="42" width="10" height="16" rx="2" />
        <path d="M50 50 L50 78" strokeDasharray="2 3" opacity="0.5" />
        <ellipse cx="50" cy="18" rx="9" ry="10" />
        <path d="M50 28 L50 44" />
      </g>
    ),
    saq: (
      <g {...common}>
        <circle cx="34" cy="12" r="7" />
        <path d="M34 19 L44 40" />
        <path d="M44 40 L30 58" />
        <path d="M30 58 L44 78" strokeDasharray="2 3" />
        <path d="M44 40 L68 46" />
        <path d="M68 46 L80 66" />
        <path d="M44 40 L58 24" strokeWidth="0.8" opacity="0.5" />
      </g>
    ),
    power: (
      <g {...common}>
        <circle cx="46" cy="16" r="8" />
        <path d="M46 24 L50 46" />
        <path d="M50 46 L30 58" />
        <path d="M50 46 L70 58" />
        <path d="M30 58 L26 40" strokeDasharray="2 3" opacity="0.4" />
        <path d="M70 58 L76 40" strokeDasharray="2 3" opacity="0.4" />
        <path d="M40 82 L36 100" />
        <path d="M60 82 L64 100" />
        <path d="M40 82 L60 82" strokeWidth="0.8" opacity="0.6" />
      </g>
    ),
  };

  return (
    <svg viewBox="0 0 100 130" className="absolute -right-3 -bottom-2 w-20 h-24 opacity-[0.18] pointer-events-none">
      {paths[type]}
    </svg>
  );
};

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ clientId }) => {
  const [topTab, setTopTab] = useState<TopTab>('bca');
  const [perfCategory, setPerfCategory] = useState<PerformanceCategory>('hub');
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSnapshot[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [openBodyPartPopup, setOpenBodyPartPopup] = useState<string | null>(null);
  const [showWhereYouStandPopup, setShowWhereYouStandPopup] = useState(false);

  useEffect(() => {
    const anyPopupOpen = !!openBodyPartPopup || showWhereYouStandPopup;
    if (anyPopupOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previousOverflow; };
    }
  }, [openBodyPartPopup, showWhereYouStandPopup]);
  const [prqData, setPrqData] = useState<{ heightCm?: number; sex?: string; weightGoalDirection?: string } | null>(null);

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

    const fetchPrq = async () => {
      try {
        const prqDoc = await getDoc(doc(db, 'intokine_prq_records', `PRQ-${clientId}`));
        if (prqDoc.exists()) {
          const data = prqDoc.data();
          setPrqData({ heightCm: data.heightCm, sex: data.sex, weightGoalDirection: data.weightGoalDirection });
        }
      } catch (err) {
        console.warn('Could not load health screening data:', err);
      }
    };

    fetchPrq();
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

        // Current / Normal / Goal table - same calculation approach as
        // the coach's BCA calculator, read-only here since goals and
        // reference ranges are the coach's call, not something a
        // client edits themselves.
        // Each coach "Save" creates a separate record per category, so
        // the single most recent record can easily belong to a
        // different category and not have this field at all - this
        // searches backward for the most recent record that actually
        // has a value for the specific field being displayed.
        const getLatestFieldValue = <K extends keyof AssessmentSnapshot>(fieldKey: K): AssessmentSnapshot[K] | undefined => {
          for (let i = chronological.length - 1; i >= 0; i--) {
            const value = chronological[i][fieldKey];
            if (value !== undefined && value !== null) return value;
          }
          return undefined;
        };
        const heightM = prqData?.heightCm ? prqData.heightCm / 100 : undefined;
        const currentWeight = getLatestFieldValue('weightKg');
        const currentBodyFat = getLatestFieldValue('bodyFatPercentage');
        const currentMuscleMass = getLatestFieldValue('muscleMassKg');
        const currentVisceralFat = getLatestFieldValue('visceralFatLevel');
        const currentBmi = heightM && currentWeight ? currentWeight / (heightM * heightM) : undefined;
        const direction = prqData?.weightGoalDirection || 'Maintain weight';

        const normalWeightRange = heightM ? { min: Math.round(18.5 * heightM * heightM), max: Math.round(24.9 * heightM * heightM) } : null;
        const normalBmiRange = { min: 18.5, max: 24.9 };
        const normalBodyFatRange = prqData?.sex === 'Female' ? { min: 21, max: 33 } : { min: 8, max: 20 };
        const normalVisceralFatRange = { min: 1, max: 9 };

        const suggestGoal = (current: number | undefined, min: number, max: number): number | undefined => {
          if (current === undefined) return undefined;
          if (direction === 'Lose weight') return current > max ? Math.round(max) : current;
          if (direction === 'Gain weight') return current < min ? Math.round(min) : current;
          if (current > max) return Math.round(max);
          if (current < min) return Math.round(min);
          return current;
        };

        const bcaRows = [
          { label: 'Weight', unit: 'kg', current: currentWeight, normal: normalWeightRange ? `${normalWeightRange.min}-${normalWeightRange.max}` : '—', goal: normalWeightRange ? suggestGoal(currentWeight, normalWeightRange.min, normalWeightRange.max) : undefined },
          { label: 'Body Fat', unit: '%', current: currentBodyFat, normal: `${normalBodyFatRange.min}-${normalBodyFatRange.max}`, goal: suggestGoal(currentBodyFat, normalBodyFatRange.min, normalBodyFatRange.max) },
          { label: 'Muscle Mass', unit: 'kg', current: currentMuscleMass, normal: 'Varies', goal: currentMuscleMass },
          { label: 'BMI', unit: '', current: currentBmi ? Number(currentBmi.toFixed(1)) : undefined, normal: `${normalBmiRange.min}-${normalBmiRange.max}`, goal: suggestGoal(currentBmi, normalBmiRange.min, normalBmiRange.max) },
          { label: 'Visceral Fat', unit: '', current: currentVisceralFat, normal: `${normalVisceralFatRange.min}-${normalVisceralFatRange.max}`, goal: suggestGoal(currentVisceralFat, normalVisceralFatRange.min, normalVisceralFatRange.max) },
        ];
        const hasAnyBcaData = bcaRows.some((r) => r.current !== undefined);

        if (weightData.length === 0 && bodyFatData.length === 0 && muscleData.length === 0 && visceralData.length === 0) {
          return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
              <p className="text-sm text-white/50 font-light leading-relaxed">No BCA data shared yet.</p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {hasAnyBcaData && (
              <button
                type="button"
                onClick={() => setShowWhereYouStandPopup(true)}
                className="w-full text-left rounded-2xl overflow-hidden border active:scale-[0.98] transition-transform"
                style={{
                  background: 'linear-gradient(160deg, #242426, #1c1c1e)',
                  animation: 'cardBorderPulse 2.4s ease-in-out infinite',
                }}
              >
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Where you stand</h3>
                    <p className="text-[11px] text-white/40 mt-0.5">Your current numbers against a healthy range and your goal.</p>
                  </div>
                  <span className="text-white/30 text-lg leading-none pl-3">›</span>
                </div>
              </button>
            )}

            {showWhereYouStandPopup && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5" onClick={() => setShowWhereYouStandPopup(false)}>
                <div className="bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#1c1c1e]">
                    <h3 className="text-sm font-bold text-white">Where you stand</h3>
                    <button type="button" onClick={() => setShowWhereYouStandPopup(false)} className="text-white/40 text-lg leading-none px-1">×</button>
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {bcaRows.map((row) => (
                      <div key={row.label} className="px-4 py-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{row.label}</span>
                          <span className="text-base font-black text-white font-mono">
                            {row.current !== undefined ? `${row.current}${row.unit}` : '—'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(52, 211, 153, 0.08)' }}>
                            <span className="text-[9px] text-emerald-400/70 uppercase font-bold tracking-wide block">Normal</span>
                            <span className="text-xs font-bold text-emerald-300 font-mono">{row.normal}</span>
                          </div>
                          <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(108, 203, 222, 0.08)' }}>
                            <span className="text-[9px] text-[#6ccbde]/70 uppercase font-bold tracking-wide block">Goal</span>
                            <span className="text-xs font-bold text-[#6ccbde] font-mono">{row.goal !== undefined ? `${row.goal}${row.unit}` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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

          {(() => {
            const bodyParts: { key: keyof AssessmentSnapshot; label: string; anchorX: number; anchorY: number; labelY: number; side: 'left' | 'right' }[] = [
              { key: 'chestCircumferenceIn', label: 'Chest', anchorX: 65, anchorY: 26, labelY: 12, side: 'right' },
              { key: 'rightArmCircumferenceIn', label: 'Right arm', anchorX: 75, anchorY: 29, labelY: 30, side: 'right' },
              { key: 'hipsCircumferenceIn', label: 'Hips', anchorX: 71, anchorY: 46, labelY: 46, side: 'right' },
              { key: 'rightThighCircumferenceIn', label: 'Right thigh', anchorX: 63, anchorY: 68, labelY: 66, side: 'right' },
              { key: 'calfCircumferenceIn', label: 'Calf', anchorX: 66, anchorY: 80, labelY: 84, side: 'right' },
              { key: 'leftArmCircumferenceIn', label: 'Left arm', anchorX: 25, anchorY: 29, labelY: 22, side: 'left' },
              { key: 'waistCircumferenceIn', label: 'Waist', anchorX: 39, anchorY: 39, labelY: 39, side: 'left' },
              { key: 'leftThighCircumferenceIn', label: 'Left thigh', anchorX: 37, anchorY: 68, labelY: 62, side: 'left' },
            ];

            const historyFor = (key: keyof AssessmentSnapshot) =>
              chronological.filter((a) => a[key] != null).map((a) => ({ date: a.date, value: a[key] as number }));

            const latestValueFor = (key: keyof AssessmentSnapshot) => {
              const h = historyFor(key);
              return h.length > 0 ? h[h.length - 1].value : undefined;
            };

            const ratioHistory = historyFor('waistToHipRatio');
            const latestRatio = ratioHistory.length > 0 ? ratioHistory[ratioHistory.length - 1].value : undefined;

            const hasAnyCircData = bodyParts.some((p) => historyFor(p.key).length > 0) || ratioHistory.length > 0;
            if (!hasAnyCircData) return null;

            return (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">Circumferences</h3>
                <div className="relative bg-[#242426] border border-white/[0.06] rounded-2xl overflow-hidden" style={{ aspectRatio: '1027 / 1531' }}>
                  <img
                    src="/bca-body-outline.png"
                    alt="Body diagram"
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {bodyParts.map((part) => {
                    const value = latestValueFor(part.key);
                    if (value === undefined) return null;
                    const lineStartX = part.side === 'left' ? part.anchorX + 6 : part.anchorX - 6;
                    const lineEndX = part.side === 'left' ? 12 : 88;
                    return (
                      <svg key={`line-${part.key}`} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                        <line
                          x1={`${lineStartX}%`} y1={`${part.anchorY}%`}
                          x2={`${lineEndX}%`} y2={`${part.labelY}%`}
                          stroke="#6ccbde" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"
                        />
                      </svg>
                    );
                  })}
                  {bodyParts.map((part) => {
                    const value = latestValueFor(part.key);
                    if (value === undefined) return null;
                    const labelXPct = part.side === 'left' ? 4 : 96;
                    return (
                      <button
                        key={part.key}
                        type="button"
                        onClick={() => setOpenBodyPartPopup(part.key)}
                        className="absolute flex flex-col items-center active:scale-95 transition-transform"
                        style={{
                          left: `${labelXPct}%`,
                          top: `${part.labelY}%`,
                          transform: part.side === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)',
                          zIndex: 2,
                        }}
                      >
                        <div className="relative flex items-center justify-center w-3 h-3 mb-0.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#ec2226] opacity-60" style={{ animation: 'bcaPulse 1.8s ease-out infinite' }} />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ec2226]" />
                        </div>
                        <span className="text-[11px] font-bold text-[#6ccbde] font-mono bg-[#1c1c1e]/80 rounded px-1">{value}in</span>
                        <span className="text-[9px] text-white/50">{part.label}</span>
                      </button>
                    );
                  })}
                </div>

                {latestRatio !== undefined && (
                  <button
                    type="button"
                    onClick={() => setOpenBodyPartPopup('waistToHipRatio')}
                    className="w-full bg-[#242426] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
                  >
                    <span className="text-xs font-bold text-white">Waist : Hip Ratio</span>
                    <span className="text-base font-black text-emerald-400 font-mono">{latestRatio}</span>
                  </button>
                )}

                {openBodyPartPopup && (
                  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5" onClick={() => setOpenBodyPartPopup(null)}>
                    <div className="bg-[#242426] border border-white/[0.1] rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white">
                          {openBodyPartPopup === 'waistToHipRatio' ? 'Waist : Hip Ratio' : bodyParts.find((p) => p.key === openBodyPartPopup)?.label}
                        </h4>
                        <button type="button" onClick={() => setOpenBodyPartPopup(null)} className="text-white/40 text-lg leading-none px-1">×</button>
                      </div>
                      <MiniLineChart
                        data={openBodyPartPopup === 'waistToHipRatio' ? ratioHistory : historyFor(openBodyPartPopup as keyof AssessmentSnapshot)}
                        color={openBodyPartPopup === 'waistToHipRatio' ? '#10b981' : '#6ccbde'}
                        unit={openBodyPartPopup === 'waistToHipRatio' ? '' : 'in'}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
        // Groups each step under its parent skill (split on " > ") so
        // a chain like Muscle Up -> Straight Bar Dips -> Negative
        // Straight Bar Dips renders as one connected roadmap, in the
        // order steps were added.
        type Step = { name: string; goal: GoalEntry };
        const roadmaps = new Map<string, Step[]>();
        skillGoals.forEach((g) => {
          const fullName = g.activityName.replace('Skills: ', '');
          const [parent, ...rest] = fullName.split(' > ');
          const stepName = rest.length > 0 ? rest.join(' > ') : fullName;
          if (!roadmaps.has(parent)) roadmaps.set(parent, []);
          roadmaps.get(parent)!.push({ name: stepName, goal: g });
        });

        return (
          <div className="space-y-3">
            {Array.from(roadmaps.entries()).reverse().map(([skillName, steps]) => (
              <div key={skillName} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <span className="text-sm font-bold text-white">{skillName}</span>
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const isDone = step.goal.status === 'Pass' || step.goal.status === 'AlreadyFit';
                    return (
                      <div key={step.goal.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isDone ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}>
                            {isDone ? '✓' : i + 1}
                          </div>
                          {i < steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[18px] ${isDone ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold ${isDone ? 'text-emerald-300' : 'text-white'}`}>{step.name === skillName ? skillName : step.name}</span>
                            {step.goal.value && <span className="text-[11px] text-white/40 font-light">{step.goal.value} reps</span>}
                          </div>
                          {step.goal.observation && <p className="text-[11px] text-white/40 font-light mt-0.5">{step.goal.observation}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                <button onClick={() => setPerfCategory('posture')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="posture" />
                  <h3 className="text-sm font-bold text-white">Posture</h3>
                  <p className="text-[11px] text-white/40 font-light">Postural alignment.</p>
                </button>
                <button onClick={() => setPerfCategory('flexibility')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="flexibility" />
                  <h3 className="text-sm font-bold text-white">Flexibility & Mobility</h3>
                  <p className="text-[11px] text-white/40 font-light">Thomas, SLR, shoulder tests.</p>
                </button>
                <button onClick={() => setPerfCategory('balance')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="balance" />
                  <h3 className="text-sm font-bold text-white">Balance</h3>
                  <p className="text-[11px] text-white/40 font-light">Unipedal Stance Test.</p>
                </button>
                <button onClick={() => setPerfCategory('core_endurance')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="core_endurance" />
                  <h3 className="text-sm font-bold text-white">Core Endurance & Stability</h3>
                  <p className="text-[11px] text-white/40 font-light">McGill's Core Endurance Test.</p>
                </button>
                <button onClick={() => setPerfCategory('movement')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="movement" />
                  <h3 className="text-sm font-bold text-white">Movement</h3>
                  <p className="text-[11px] text-white/40 font-light">Movement pattern screens.</p>
                </button>
                <button onClick={() => setPerfCategory('cardio')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="cardio" />
                  <h3 className="text-sm font-bold text-white">Cardio</h3>
                  <p className="text-[11px] text-white/40 font-light">VO2 Max & aerobic tests.</p>
                </button>
                <button onClick={() => setPerfCategory('muscular_endurance')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="muscular_endurance" />
                  <h3 className="text-sm font-bold text-white">Muscular Endurance</h3>
                  <p className="text-[11px] text-white/40 font-light">Push-ups, pull-ups, squats.</p>
                </button>
                <button onClick={() => setPerfCategory('muscular_strength')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-red-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="muscular_strength" />
                  <h3 className="text-sm font-bold text-white">Muscular Strength</h3>
                  <p className="text-[11px] text-white/40 font-light">1RM bench, squat, deadlift, OHP.</p>
                </button>
                <button onClick={() => setPerfCategory('saq')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="saq" />
                  <h3 className="text-sm font-bold text-white">SAQ</h3>
                  <p className="text-[11px] text-white/40 font-light">Speed, Agility & Quickness.</p>
                </button>
                <button onClick={() => setPerfCategory('power')} className="relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-purple-400/40 rounded-2xl p-4 text-left transition space-y-1">
                  <XRayBackground type="power" />
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
                const customGoals = [...goals.filter((g) => g.activityName.startsWith('Posture:'))].reverse();
                const colorPalette = ['#6ccbde', '#ec2226', '#f59e0b', '#a78bfa', '#ec4899', '#14b8a6', '#10b981'];
                const historyFor = (activityName: string) =>
                  chronological
                    .filter((a) => a.customActivityScores?.[activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![activityName] }));
                const imageFor = (activityName: string, slot: 'before' | 'after') => {
                  const key = slot === 'before' ? 'postureBeforeImages' : 'postureAfterImages';
                  const record = [...chronological].reverse().find((a) => a[key]?.[activityName]);
                  return record ? record[key]![activityName] : undefined;
                };

                if (customGoals.length === 0) {
                  return <p className="text-xs text-white/40 text-center py-6">No posture activities logged yet.</p>;
                }

                return (
                  <div className="space-y-4">
                    {customGoals.map((g, idx) => {
                      const color = colorPalette[idx % colorPalette.length];
                      const beforeImg = imageFor(g.activityName, 'before');
                      const afterImg = imageFor(g.activityName, 'after');
                      return (
                        <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                          <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{g.activityName.replace('Posture: ', '')}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              g.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                              g.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-white/10 text-white/50'
                            }`}>
                              {g.status === 'Pass' ? 'Pass' : g.status === 'AlreadyFit' ? 'Already Fit' : 'In Progress'}
                            </span>
                          </div>
                          <MiniLineChart data={historyFor(g.activityName)} color={color} unit="/10" />

                          {(beforeImg || afterImg) && (
                            <div className="mt-4 pt-4 border-t border-white/[0.06]">
                              <span className="text-[9px] text-white/30 uppercase font-bold tracking-wide block mb-2">Before & After</span>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="relative aspect-[3/4] bg-[#1c1c1e] border border-white/[0.06] rounded-xl overflow-hidden">
                                  {beforeImg ? (
                                    <img src={beforeImg} alt="Before" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-white/25">No photo</div>
                                  )}
                                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">Before</span>
                                </div>
                                <div className="relative aspect-[3/4] bg-[#1c1c1e] border border-white/[0.06] rounded-xl overflow-hidden">
                                  {afterImg ? (
                                    <img src={afterImg} alt="After" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-white/25">No photo</div>
                                  )}
                                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">After</span>
                                </div>
                              </div>
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
                        {g.value && <span className="text-[11px] text-white/40 font-light">Score: <span className="font-mono">{g.value}/10</span></span>}
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
                              g.value && <span className="text-[11px] text-white/40 font-light">Time: <span className="font-mono">{g.value}s</span></span>
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
                            {g.value && <span className="text-[11px] text-white/40 font-light">Time: <span className="font-mono">{g.value}s</span></span>}
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
                              g.value && <span className="text-[11px] text-white/40 font-light"><span className="font-mono">{g.value} {unitFor(g.valueType)}</span></span>
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
                            {g.value && <span className="text-[11px] text-white/40 font-light"><span className="font-mono">{g.value} reps</span></span>}
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
                            {g.value && <span className="text-[11px] text-white/40 font-light"><span className="font-mono">{g.value} kg</span></span>}
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
