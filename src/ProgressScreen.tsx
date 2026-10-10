import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { ExerciseScores } from './ExerciseScores';

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
  coachReview?: string;
  value?: string;
  valueType?: 'time_seconds' | 'score_10' | 'distance_km' | 'duration_minutes' | 'steps' | 'ratio' | 'reps' | 'unilateral_time' | 'bilateral_time' | 'circuits';
  valueLeft?: string;
  valueRight?: string;
  circuitRounds?: CircuitRound[];
  targetValue?: number;
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
  bmi?: number;
  weightNormalMin?: number;
  weightNormalMax?: number;
  weightGoal?: number;
  bodyFatNormalMin?: number;
  bodyFatNormalMax?: number;
  bodyFatGoal?: number;
  muscleMassNormalMin?: number;
  muscleMassNormalMax?: number;
  muscleMassGoal?: number;
  bmiNormalMin?: number;
  bmiNormalMax?: number;
  bmiGoal?: number;
  visceralFatNormalMin?: number;
  visceralFatNormalMax?: number;
  visceralFatGoal?: number;
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
  activityObservations?: Record<string, string>;
  activitySides?: Record<string, { left?: number; right?: number }>;

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

type TopTab = 'bca' | 'performance' | 'skills' | 'scores';

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

/** The coach's note saved with one result (custom activities: activityObservations; standard tests: their own observation field). */
const resultNote = (a: AssessmentSnapshot, activityName: string, scoreKey?: keyof AssessmentSnapshot): string | undefined => {
  const fromMap = a.activityObservations?.[activityName];
  if (fromMap && fromMap.trim()) return fromMap.trim();
  if (scoreKey) {
    const v = (a as unknown as Record<string, unknown>)[String(scoreKey).replace(/Score$/, 'Observation')];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
};

/** Latest score out of 10 as a segment meter, with previous scores and the change since last time. */
const ScoreMeter: React.FC<{ data: { date: string; value: number }[]; color: string }> = ({ data, color }) => {
  if (data.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[11px] text-white/30 font-light">Not enough data yet</div>;
  }
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const diff = prev ? Math.round((last.value - prev.value) * 10) / 10 : null;
  const filled = Math.max(0, Math.min(10, Math.round(last.value)));
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-lg font-black text-white font-mono">{last.value}<span className="text-[11px] text-white/40 font-light"> / 10</span></span>
        <span className="text-[10px] text-white/40">{last.date}</span>
      </div>
      <div className="grid grid-cols-10 gap-1 mb-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="h-2.5 rounded-[3px]" style={{ background: i < filled ? color : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      {data.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/40 font-mono truncate">{data.slice(-5).map((d) => d.value).join(' → ')}</span>
          {diff !== null && diff !== 0 && (
            <span className={`text-[10px] font-bold font-mono ${diff > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{diff > 0 ? '+' : ''}{diff}</span>
          )}
        </div>
      )}
    </div>
  );
};

interface RoadmapItem {
  id: string;
  name: string;
  score?: string | number;
  date?: string;
  note?: string;
  status?: string;
  history?: { date: string; value: number; note?: string }[];
  /** Unit shown after values; defaults to '/10' for scored activities. */
  unit?: string;
  /** Text shown instead of `score` (e.g. 'L 30s · R 25s'). */
  scoreText?: string;
  /** For left/right activities: results per date, drawn as a side comparison. */
  sides?: SidePoint[];
  /** Several lines to graph for one activity (e.g. McGill's four tests). */
  series?: { label: string; color: string; data: { date: string; value: number }[] }[];
  /** One row per result for activities with several measurements. */
  rows?: { date: string; text: string; note?: string }[];
  rowsTitle?: string;
}

/** Athletic milestone roadmap: numbered medal nodes on a red-to-cyan track, each with a score card. */
const AchievementsTimeline: React.FC<{ items: RoadmapItem[]; compact?: boolean; route?: boolean; passedLabel?: string }> = ({ items, compact, route, passedLabel = 'Achieved' }) => {
  const labelFor = (it: RoadmapItem) => (it.status === 'AlreadyFit' ? 'Already fit' : passedLabel);
  const routeBadge = items.length > 0 && items.every((x) => x.status === 'AlreadyFit') ? 'Already fit' : passedLabel;
  const [openId, setOpenId] = React.useState<string | null>(null);
  const openItem = items.find((x) => x.id === openId) || null;
  React.useEffect(() => {
    if (!openItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, [openItem]);
  const unit = openItem?.unit ?? '/10';
  const hist = openItem?.history || [];
  const firstScore = hist.length > 0 ? hist[0].value : null;
  const lastScore = hist.length > 0 ? hist[hist.length - 1].value : null;
  const totalGain = firstScore !== null && lastScore !== null ? Math.round((lastScore - firstScore) * 10) / 10 : null;
  return (
  <div>
    {route && <SkillRouteMap items={items} badge={routeBadge} onSelect={setOpenId} />}
    {!route && items.map((it, i) => {
      const last = i === items.length - 1;
      return (
        <div key={it.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`${compact ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs'} rounded-full flex items-center justify-center font-bold shrink-0`}
              style={{ background: 'rgba(108,203,222,0.15)', color: '#6ccbde', border: '1px solid rgba(108,203,222,0.5)' }}
            >
              {i + 1}
            </div>
            {!last && <div className="w-px flex-1 mt-1 bg-[#6ccbde]/25" />}
          </div>
          <div className={`flex-1 ${compact ? 'pb-3' : 'pb-4'}`}>
            <button
              type="button"
              onClick={() => setOpenId(it.id)}
              className="w-full text-left bg-[#242426] border border-white/[0.06] hover:border-[#6ccbde]/40 rounded-xl p-3 transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wide">{it.name}<span className="block h-[2px] w-6 mt-1 rounded-full bg-[#ec2226]" /></span>
                <span className="shrink-0 text-[#6ccbde] font-mono font-bold text-sm">
                  {it.scoreText ?? it.score ?? '—'}
                  {!it.scoreText && <span className="text-[10px] text-white/40 font-normal">{it.unit ?? '/10'}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${it.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{labelFor(it)}</span>
                {it.date && <span className="text-[10px] text-white/40 font-mono">{it.date}</span>}
              </div>
              {it.note && <p className="text-[11px] text-white/70 leading-relaxed mt-2 whitespace-pre-line">“{it.note}”</p>}
            </button>
          </div>
        </div>
      );
    })}
    {openItem && (
      <div className="anim-overlay fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-5" onClick={(e) => { e.stopPropagation(); setOpenId(null); }}>
        <div className="anim-card bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#1c1c1e]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">{openItem.name}</h3>
            <button type="button" onClick={() => setOpenId(null)} className="text-white/40 text-lg leading-none px-1">×</button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${openItem.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {labelFor(openItem)}
              </span>
              {openItem.date && <span className="text-[10px] text-white/40 font-mono">{openItem.date}</span>}
            </div>
            {openItem.sides ? (
              <SideComparison data={openItem.sides} unit="s" />
            ) : openItem.rows && !openItem.series && hist.length === 0 ? null : openItem.series ? (
              <div className="grid grid-cols-1 gap-3">
                {openItem.series.map((sr) => (
                  <div key={sr.label}>
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-1">{sr.label}</span>
                    <MiniLineChart data={sr.data} color={sr.color} unit="s" />
                  </div>
                ))}
              </div>
            ) : unit === '/10' ? (
              <MiniLineChart data={hist} color="#6ccbde" unit="/10" fixedMin={0} fixedMax={10} />
            ) : (
              <MiniLineChart data={hist} color="#6ccbde" unit={unit} />
            )}
            {openItem.rows && openItem.rows.length > 0 && (
              <div>
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{openItem.rowsTitle || 'Result journey'}</span>
                <div className="space-y-1.5">
                  {openItem.rows.map((d, k) => (
                    <div key={`${d.date}-${k}`} className="flex flex-col items-start bg-[#242426] border border-white/[0.06] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-[11px] text-white/50 font-mono">{d.date}</span>
                        <span className="text-[11px] font-black text-white font-mono text-right">{d.text}</span>
                      </div>
                      {d.note && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] w-full">
                          <span className="text-[9px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-0.5">Coach review</span>
                          <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{d.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {openItem.sides && openItem.sides.length > 0 && (
              <div>
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Result journey</span>
                <div className="space-y-1.5">
                  {openItem.sides.map((d, k) => (
                    <div key={`${d.date}-${k}`} className="flex flex-col items-start bg-[#242426] border border-white/[0.06] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] text-white/50 font-mono">{d.date}</span>
                        <span className="text-xs font-black text-white font-mono">L {d.left ?? '—'}{unit} · R {d.right ?? '—'}{unit}</span>
                      </div>
                      {d.note && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] w-full">
                          <span className="text-[9px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-0.5">Coach review</span>
                          <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{d.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!openItem.sides && !openItem.rows && hist.length > 0 && (
              <div>
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">
                  {unit === '/10' ? 'Score journey' : 'Result journey'}{totalGain !== null && hist.length > 1 && totalGain !== 0 ? ` (${totalGain > 0 ? '+' : ''}${totalGain} overall)` : ''}
                </span>
                <div className="space-y-1.5">
                  {hist.map((h, k) => {
                    const prevV = k > 0 ? hist[k - 1].value : null;
                    const d = prevV !== null ? Math.round((h.value - prevV) * 10) / 10 : null;
                    return (
                      <div key={`${h.date}-${k}`} className="flex flex-col items-start bg-[#242426] border border-white/[0.06] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-white/50 font-mono">{h.date}</span>
                          <span className="flex items-center gap-2">
                            {d !== null && d !== 0 && <span className={`text-[10px] font-bold font-mono ${d > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{d > 0 ? '+' : ''}{d}</span>}
                            <span className="text-xs font-black text-white font-mono">{h.value}<span className="text-[10px] text-white/40 font-normal">{unit}</span></span>
                          </span>
                        </div>
                        {h.note && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06] w-full">
                            <span className="text-[9px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-0.5">Coach review</span>
                            <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{h.note}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {openItem.note && !(openItem.rows || []).some((d) => (d.note || '').trim() === openItem.note!.trim()) && !(openItem.sides || []).some((d) => (d.note || '').trim() === openItem.note!.trim()) && !hist.some((h) => (h.note || '').trim() === openItem.note!.trim()) && (
              <div className="pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{openItem.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

/** Full-page celebration shown when every activity in a category has been passed. */
/** Straight route-style roadmap: start at the bottom, climb stop by stop to the summit. */
const SkillRouteMap: React.FC<{ items: RoadmapItem[]; onSelect?: (id: string) => void; badge?: string }> = ({ items, onSelect, badge = 'Achieved' }) => {
  const [ownId, setOwnId] = React.useState<string | null>(null);
  const setOpenId = (id: string | null) => { if (id !== null && onSelect) onSelect(id); else setOwnId(id); };
  const openItem = items.find((x) => x.id === ownId) || null;
  const STEP = 132;
  const TOP = 110;
  const H = TOP + items.length * STEP + 80;
  const pts = items.map((_, i) => ({ x: 50, y: H - 90 - (i + 1) * STEP + 40 }));
  const start = { x: 50, y: H - 30 };
  const summit = { x: 50, y: 40 };
  const all = [start, ...pts, summit];
  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 1; i < all.length; i++) {
    const b = all[i];
    d += ` L ${b.x} ${b.y}`;
  }
  return (
    <div className="relative" style={{ height: H }}>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        <path d={d} fill="none" stroke="rgba(108,203,222,0.14)" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#6ccbde" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${summit.x}%`, top: summit.y }}>
        <div className="w-12 h-12 rounded-full bg-[#242426] border-2 border-[#6ccbde] flex items-center justify-center text-xl shadow-[0_0_24px_rgba(108,203,222,0.45)]">🏆</div>
        <span className="block mx-auto mt-1.5 h-[2px] w-6 rounded-full bg-[#ec2226]" />
      </div>
      <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${start.x}%`, top: start.y }}>
        <div className="w-4 h-4 rounded-full bg-white border-4 border-[#6ccbde] mx-auto" />
      </div>
      {items.map((it, i) => {
        const pt = pts[i];
        const left = i % 2 === 0;
        return (
          <React.Fragment key={it.id}>
            <button
              type="button"
              onClick={() => setOpenId(it.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#6ccbde] text-[#0a0a0b] text-sm font-bold flex items-center justify-center border-4 border-[#1c1c1e] shadow-[0_0_16px_rgba(108,203,222,0.5)] active:scale-95 transition-transform"
              style={{ left: `${pt.x}%`, top: pt.y }}
            >
              {i + 1}
            </button>
            <button
              type="button"
              onClick={() => setOpenId(it.id)}
              className="absolute -translate-y-1/2 bg-[#242426] border border-white/[0.08] hover:border-[#6ccbde]/40 rounded-xl px-3 py-2 text-left transition active:scale-[0.98]"
              style={left ? { left: `calc(${pt.x}% + 28px)`, top: pt.y, maxWidth: 'calc(50% - 36px)' } : { right: `calc(${100 - pt.x}% + 28px)`, top: pt.y, maxWidth: 'calc(50% - 36px)' }}
            >
              <span className="text-[11px] font-bold text-white uppercase tracking-wide block leading-tight">{it.name}</span>
              <span className="flex items-center gap-1.5 mt-1">
                <span className={`text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${it.status === 'AlreadyFit' || badge === 'Already fit' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{it.status === 'AlreadyFit' ? 'Already fit' : badge}</span>
                <span className="text-[10px] text-[#6ccbde] font-mono font-bold">{it.scoreText ?? (it.score !== undefined ? `${it.score}${it.unit ?? '/10'}` : '')}</span>
              </span>
            </button>
          </React.Fragment>
        );
      })}
      {openItem && createPortal(
        <div className="anim-overlay fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-5" onClick={() => setOpenId(null)}>
          <div className="anim-card bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#1c1c1e]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">{openItem.name}</h3>
                <span className="text-[10px] text-white/40 font-mono">{openItem.date}{openItem.scoreText ? ` · ${openItem.scoreText}` : ''}</span>
              </div>
              <button type="button" onClick={() => setOpenId(null)} className="text-white/40 text-lg leading-none px-1">×</button>
            </div>
            <div className="p-4 space-y-3">
              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${openItem.status === 'AlreadyFit' || badge === 'Already fit' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{openItem.status === 'AlreadyFit' ? 'Already fit' : badge}</span>
              {openItem.note && <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">“{openItem.note}”</p>}
              {openItem.rows && openItem.rows.length > 0 && (
                <div>
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{openItem.rowsTitle || 'Roadmap'}</span>
                  <div className="space-y-2">
                    {openItem.rows.map((r, k) => (
                      <div key={k} className="bg-[#242426] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-white font-semibold">{r.text}</span>
                          {r.date && <span className="text-[10px] text-white/40 font-mono shrink-0">{r.date}</span>}
                        </div>
                        {r.note && <p className="text-[11px] text-[#6ccbde] leading-relaxed mt-1 whitespace-pre-line">{r.note}</p>}
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
    </div>
  );
};

/** Categories that are just tracked (no Achievements / Already fit). */
/** Pre-defined tests: when only left "Pending" with nothing recorded, they do not count as added. */
const STANDARD_TEST_NAMES = new Set([
  'Posture: Posture',
  'Balance: Unipedal Stance Test',
  "Core Endurance & Stability: McGill's Test",
  'Flexibility & Mobility: Thomas Test',
  'Flexibility & Mobility: Passive Straight Leg Raise',
  'Flexibility & Mobility: Shoulder Flexion Test',
  'Flexibility & Mobility: Shoulder Extension Test',
  'Movement: Bend & Lift Squat Pattern',
  'Movement: Single Leg Step Up',
  'Movement: Shoulder Push Stabilization',
  'Movement: Pull Stability Standing Row',
  'Movement: Thoracic Spine Mobility',
  'Movement: Overhead Squat Test',
  'Cardio: VO2 Max',
  'SAQ: T Test',
]);

const NO_ACHIEVEMENT_PREFIXES = ['Core Endurance & Stability:', 'Muscular Endurance:', 'Muscular Strength:', 'SAQ:', 'Power:'];

/** Already fit activities as simple tiles (shown inside the Achievements card, below the achieved road map). */
const AlreadyFitTiles: React.FC<{ items: RoadmapItem[] }> = ({ items }) => (
  <div className="space-y-2.5">
    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">🎓 Already fit</p>
    {items.map((it) => (
      <div key={it.id} className="flex items-center gap-3 bg-[#242426] border border-white/[0.06] rounded-2xl px-4 py-3">
        <span className="w-9 h-9 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 text-base font-bold shrink-0">✓</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{it.name}</p>
          {(it.note || it.date) && <p className="text-[11px] text-white/40 truncate">{it.note || it.date}</p>}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 shrink-0">Fit</span>
      </div>
    ))}
  </div>
);

/** One Achievements card per category. Already fit activities sit inside it, tagged "Already fit". */
const AchievementFitRow: React.FC<{ title: string; items: RoadmapItem[]; route?: boolean; singleCard?: boolean }> = ({ title, items: rawItems, route }) => {
  const [open, setOpen] = React.useState(false);
  const items = /^Posture/.test(title) ? rawItems.map((x) => ({ ...x, status: 'Pass' })) : rawItems;
  const fitItems = items.filter((x) => x.status === 'AlreadyFit');
  const passedItems = items.filter((x) => x.status !== 'AlreadyFit');
  const fitCount = fitItems.length;
  const passedLabel = /^Posture/.test(title) ? 'Solved' : 'Achieved';
  // Keep the bottom navigation bar bright and on top while the pop-up is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, [open]);
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          disabled={items.length === 0}
          onClick={() => setOpen(true)}
          className={`text-left bg-[#242426] border border-white/[0.06] rounded-2xl p-4 transition active:scale-[0.98] ${items.length === 0 ? 'opacity-40' : 'hover:border-[#6ccbde]/40'}`}
        >
          <span className="text-xl block mb-1">🏆</span>
          <span className="text-sm font-bold text-white block">{title} achievements</span>
          <span className="text-[11px] text-white/40">
            {items.length} activit{items.length === 1 ? 'y' : 'ies'}{fitCount > 0 ? ` · ${fitCount} already fit` : ''}
          </span>
        </button>
      </div>
      {open && createPortal(
        <div className="anim-page fixed top-0 left-0 right-0 bottom-0 z-[60] bg-[#0f0f10] overflow-y-auto" style={{ minHeight: '100dvh' }}>
          <div className="sticky top-0 z-10 bg-[#0f0f10] border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-[#6ccbde] text-xl font-bold leading-none px-1">‹</button>
            <div>
              <h3 className="text-sm font-bold text-white">{title} achievements</h3>
              <span className="text-[10px] text-white/40">{items.length} done - your road to the top</span>
            </div>
          </div>
          <div className="max-w-md mx-auto px-4 pt-6 pb-28">
            <div className="space-y-6">
              {passedItems.length > 0 && (route ? <SkillRouteMap items={passedItems} badge={passedLabel} /> : <AchievementsTimeline route passedLabel={passedLabel} items={passedItems} />)}
              {fitItems.length > 0 && <AlreadyFitTiles items={fitItems} />}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const AchievementsPage: React.FC<{ title: string; items: RoadmapItem[]; route?: boolean }> = ({ title, items: rawItems, route }) => {
  // Posture has no separate Already fit group - everything counts as solved.
  const items = /^Posture/.test(title) ? rawItems.map((x) => ({ ...x, status: 'Pass' })) : rawItems;
  const passedLabel = /^Posture/.test(title) ? 'Solved' : 'Achieved';
  const fitItems = items.filter((x) => x.status === 'AlreadyFit');
  const passedItems = items.filter((x) => x.status !== 'AlreadyFit');
  const allFit = items.length > 0 && passedItems.length === 0;
  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden bg-[#242426] border rounded-2xl p-5 text-center ${allFit ? 'border-amber-400/30' : 'border-[#ec2226]/25'}`} style={{ background: allFit ? 'linear-gradient(180deg, rgba(245,158,11,0.18), #242426 70%)' : 'linear-gradient(180deg, rgba(236,34,38,0.16), #242426 70%)' }}>
        {allFit
          ? <div className="mx-auto w-14 h-14 mb-2 rounded-full flex items-center justify-center text-3xl border-2 border-amber-400/60" style={{ background: 'rgba(245,158,11,0.12)', boxShadow: '0 0 28px rgba(245,158,11,0.25)' }}>🎓</div>
          : <img src="/posture-achievement-icon.PNG" alt="Achievement" className="w-14 h-14 mx-auto mb-2 object-contain" />}
        <p className={`text-[10px] font-bold uppercase tracking-widest ${allFit ? 'text-amber-300' : 'text-[#6ccbde]'}`}>{allFit ? 'Already fit' : 'Level complete'}</p>
        <h2 className="text-lg font-bold text-white mt-1">{allFit ? `You are already fit in ${title.replace(/\s+complete$/i, '')}` : title}</h2>
        <p className="text-xs text-white/50 mt-1">{allFit ? `${items.length} ${items.length === 1 ? 'activity' : 'activities'} already fit` : `${items.length} of ${items.length} activities done`}</p>
        <div className="mt-3 h-[2px] bg-white/10 rounded-full overflow-hidden"><div className={`h-full w-full rounded-full ${allFit ? 'bg-amber-400' : 'bg-[#6ccbde]'}`} /></div>
      </div>
      {allFit && <AlreadyFitTiles items={fitItems} />}
      {items.length > 0 && !allFit && (
        <div className="bg-[#1c1c1e] border border-white/[0.06] rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6ccbde]">🏆 Achievements</p>
          {passedItems.length > 0 && (route ? <SkillRouteMap items={passedItems} badge={passedLabel} /> : <AchievementsTimeline route passedLabel={passedLabel} items={passedItems} />)}
          {fitItems.length > 0 && <AlreadyFitTiles items={fitItems} />}
        </div>
      )}
    </div>
  );
};

/** McGill's ratios and their normal ranges; `out` is true when a value is outside the normal range. */
const MCGILL_RATIOS: { key: 'mcgillFlexorExtensorRatio' | 'mcgillRightLeftSideRatio' | 'mcgillRightToExtensorRatio' | 'mcgillLeftToExtensorRatio'; label: string; normal: string; out: (n: number) => boolean }[] = [
  { key: 'mcgillFlexorExtensorRatio', label: 'Flexor-Extensor Ratio', normal: '< 1.0', out: (n) => n >= 1.0 },
  { key: 'mcgillRightLeftSideRatio', label: 'Right-Left Side Ratio', normal: '0.95 - 1.05', out: (n) => n < 0.95 || n > 1.05 },
  { key: 'mcgillRightToExtensorRatio', label: 'Right to Extensor Ratio', normal: '< 0.75', out: (n) => n >= 0.75 },
  { key: 'mcgillLeftToExtensorRatio', label: 'Left to Extensor Ratio', normal: '< 0.75', out: (n) => n >= 0.75 },
];

/** Waist-to-hip ratio risk bands (depend on gender, which comes from the health questionnaire). */
type WhrLevel = 'low' | 'increased' | 'high';
const whrRisk = (ratio: number, sex: 'male' | 'female'): WhrLevel => {
  if (sex === 'male') return ratio < 0.9 ? 'low' : ratio < 1.0 ? 'increased' : 'high';
  return ratio < 0.8 ? 'low' : ratio < 0.85 ? 'increased' : 'high';
};
const WHR_RANGES: Record<'male' | 'female', Record<WhrLevel, string>> = {
  male: { low: 'Below 0.90', increased: '0.90 - 0.99', high: '1.00 and above' },
  female: { low: 'Below 0.80', increased: '0.80 - 0.84', high: '0.85 and above' },
};
const WHR_TONE: Record<WhrLevel, { label: string; hex: string; text: string; box: string; chip: string }> = {
  low: { label: 'Lower risk', hex: '#10b981', text: 'text-emerald-400', box: 'bg-emerald-500/10 border-emerald-500/40', chip: 'bg-emerald-500/20 text-emerald-300' },
  increased: { label: 'Increased risk', hex: '#facc15', text: 'text-yellow-300', box: 'bg-yellow-400/10 border-yellow-400/40', chip: 'bg-yellow-400/20 text-yellow-200' },
  high: { label: 'High risk', hex: '#ef4444', text: 'text-red-400', box: 'bg-red-500/10 border-red-500/50', chip: 'bg-red-500/20 text-red-300' },
};

interface SidePoint {
  date: string;
  left?: number;
  right?: number;
  note?: string;
}

/** Left vs right comparison: paired bars per assessment, plus the latest gap between the two sides. */
const SideComparison: React.FC<{ data: SidePoint[]; unit?: string }> = ({ data, unit = 's' }) => {
  const pts = data.filter((d) => d.left != null || d.right != null).slice(-6);
  if (pts.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[11px] text-white/30 font-light">Not enough data yet</div>;
  }
  const LEFT = '#ec2226';
  const RIGHT = '#6ccbde';
  const width = 300;
  const height = 130;
  const padX = 10;
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  const maxVal = Math.max(1, ...pts.map((d) => Math.max(d.left ?? 0, d.right ?? 0)));
  const groupW = (width - padX * 2) / pts.length;
  const barW = Math.min(22, groupW / 2 - 4);
  const latest = pts[pts.length - 1];
  const l = latest.left;
  const r = latest.right;
  let summary: { text: string; tone: string } | null = null;
  if (l != null && r != null) {
    const gap = Math.abs(l - r);
    const stronger = Math.max(l, r);
    const pct = stronger > 0 ? Math.round((gap / stronger) * 100) : 0;
    summary = gap === 0 || pct <= 5
      ? { text: 'Balanced - both sides are even', tone: 'text-emerald-300' }
      : { text: `${l > r ? 'Left' : 'Right'} side is stronger by ${Math.round(gap * 10) / 10}${unit} (${pct}%)`, tone: 'text-amber-300' };
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="flex items-center gap-1 text-[10px] text-white/50"><span className="w-2 h-2 rounded-sm" style={{ background: LEFT }} />Left</span>
        <span className="flex items-center gap-1 text-[10px] text-white/50"><span className="w-2 h-2 rounded-sm" style={{ background: RIGHT }} />Right</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        <line x1={padX} x2={width - padX} y1={top + plotH} y2={top + plotH} stroke="white" strokeOpacity="0.1" />
        {pts.map((d, i) => {
          const cx = padX + groupW * i + groupW / 2;
          const bars: { v?: number; x: number; c: string }[] = [
            { v: d.left, x: cx - barW - 1, c: LEFT },
            { v: d.right, x: cx + 1, c: RIGHT },
          ];
          return (
            <g key={i}>
              {bars.map((b, k) => {
                if (b.v == null) return null;
                const h = Math.max(2, (b.v / maxVal) * plotH);
                return (
                  <g key={k}>
                    <rect x={b.x} y={top + plotH - h} width={barW} height={h} rx="2" fill={b.c} fillOpacity="0.9" />
                    <text x={b.x + barW / 2} y={top + plotH - h - 3} fontSize="8" fill="white" fillOpacity="0.85" textAnchor="middle" fontFamily="monospace">{b.v}</text>
                  </g>
                );
              })}
              <text x={cx} y={height - 6} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">{d.date.slice(5)}</text>
            </g>
          );
        })}
      </svg>
      {summary && <div className={`text-[11px] font-semibold mt-1 ${summary.tone}`}>{summary.text}</div>}
    </div>
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
  const [showPostureAchievementsPopup, setShowPostureAchievementsPopup] = useState(false);
  const [showMovementAchievementsPopup, setShowMovementAchievementsPopup] = useState(false);
  const [showFlexAchievementsPopup, setShowFlexAchievementsPopup] = useState(false);
  const [mcgillOpen, setMcgillOpen] = useState(false);
  const [showSkillAchievementsPopup, setShowSkillAchievementsPopup] = useState(false);
  const [clientSex, setClientSex] = useState<'male' | 'female' | undefined>(undefined);
  const [showCoreAchievementsPopup, setShowCoreAchievementsPopup] = useState(false);
  const [showMuscEndAchievementsPopup, setShowMuscEndAchievementsPopup] = useState(false);
  const [showBalanceAchievementsPopup, setShowBalanceAchievementsPopup] = useState(false);

  // While a popup is open the bottom navigation stays above its dimmed layer
  // (see index.css), so it blends with the phone's home-indicator strip.
  useEffect(() => {
    const open = !!openBodyPartPopup || showWhereYouStandPopup || showPostureAchievementsPopup || showMovementAchievementsPopup || showFlexAchievementsPopup || showBalanceAchievementsPopup || showCoreAchievementsPopup || showMuscEndAchievementsPopup;
    if (!open) return;
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.removeAttribute('data-popup-open'); };
  }, [openBodyPartPopup, showWhereYouStandPopup, showPostureAchievementsPopup, showMovementAchievementsPopup, showFlexAchievementsPopup, showBalanceAchievementsPopup, showCoreAchievementsPopup, showMuscEndAchievementsPopup]);

  useEffect(() => {
    const anyPopupOpen = !!openBodyPartPopup || showWhereYouStandPopup || showPostureAchievementsPopup || showMovementAchievementsPopup || showFlexAchievementsPopup || showBalanceAchievementsPopup || showCoreAchievementsPopup || showMuscEndAchievementsPopup || showSkillAchievementsPopup;
    if (anyPopupOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previousOverflow; };
    }
  }, [openBodyPartPopup, showWhereYouStandPopup, showPostureAchievementsPopup, showMovementAchievementsPopup, showFlexAchievementsPopup, showBalanceAchievementsPopup, showCoreAchievementsPopup, showMuscEndAchievementsPopup, showSkillAchievementsPopup]);

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
        // Newest first; saves on the same day are ordered by when they were
        // created (read from the record id) so the latest save is the latest value.
        const createdAt = (r: AssessmentSnapshot) => {
          const m = /^ASS-(\d{12,})/.exec(String((r as { id?: string }).id ?? ''));
          return m ? Number(m[1]) : 0;
        };
        results.sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          return d !== 0 ? d : createdAt(b) - createdAt(a);
        });
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

  // Gender comes from the client's health questionnaire; it decides which
  // waist-to-hip risk bands apply.
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'intokine_prq_records', `PRQ-${clientId}`));
        const sex = String((snap.exists() ? (snap.data() as { sex?: string }).sex : '') || '').trim().toLowerCase();
        if (!cancelled) setClientSex(sex.startsWith('m') ? 'male' : sex.startsWith('f') || sex.startsWith('w') ? 'female' : undefined);
      } catch (e) {
        console.warn('Could not read gender for waist-to-hip risk:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    // Live listener: when the coach marks an activity Passed / Already fit (or removes it),
    // the cards update straight away instead of waiting for the app to be reopened.
    const unsubscribeGoals = onSnapshot(
      doc(db, 'intokine_clients', clientId),
      (snap) => {
        if (snap.exists()) {
          setGoals(((snap.data() as { goals?: GoalEntry[] }).goals) || []);
        }
      },
      (e) => console.warn('Could not load goals:', e)
    );
    return () => unsubscribeGoals();
  }, [clientId]);

  const chronological = [...assessments].reverse();

  // Which performance categories have anything added (an activity or a score). Empty ones are faded and locked.
  const catHasData = (() => {
    const specs: Record<string, { prefix: string; fields: (keyof AssessmentSnapshot)[] }> = {
      posture: { prefix: 'Posture:', fields: ['postureScore'] },
      flexibility: { prefix: 'Flexibility & Mobility:', fields: ['thomasTestScore', 'thomasTestPass', 'passiveStraightLegRaiseScore', 'passiveStraightLegRaisePass', 'shoulderFlexionScore', 'shoulderFlexionTestPass', 'shoulderExtensionScore', 'shoulderExtensionTestPass'] },
      balance: { prefix: 'Balance:', fields: ['unipedalStanceLeftSeconds', 'unipedalStanceRightSeconds'] },
      core_endurance: { prefix: 'Core Endurance & Stability:', fields: ['mcgillFlexorSeconds', 'mcgillExtensorSeconds', 'mcgillRightSideBridgeSeconds', 'mcgillLeftSideBridgeSeconds'] },
      movement: { prefix: 'Movement:', fields: ['bendAndLiftSquatPatternScore', 'singleLegStepUpScore', 'shoulderPushStabilizationScore', 'pullStabilityStandingRowScore', 'thoracicSpineMobilityScore', 'overheadSquatTestScore'] },
      cardio: { prefix: 'Cardio:', fields: ['vo2Max', 'bloodPressureSystolic', 'aerobicCapacityScore'] },
      muscular_endurance: { prefix: 'Muscular Endurance:', fields: ['pushUpsReps', 'pullUpMaxReps', 'bodyweightSquatsReps'] },
      muscular_strength: { prefix: 'Muscular Strength:', fields: ['benchPress1RM', 'squat1RM', 'deadlift1RM', 'overheadPress1RM'] },
      saq: { prefix: 'SAQ:', fields: ['tTestSeconds'] },
      power: { prefix: 'Power:', fields: ['verticalJumpCm'] },
    };
    const out: Record<string, boolean> = {};
    Object.entries(specs).forEach(([key, { prefix, fields }]) => {
      // A pre-defined test that is only left "Pending" with nothing recorded does not count as added.
      const hasGoal = goals.some((g) => g.activityName.startsWith(prefix) && (g.status !== 'Pending' || !!g.value || !!g.valueLeft || !!g.valueRight || !!g.circuitRounds?.length || !STANDARD_TEST_NAMES.has(g.activityName)));
      const hasScore = assessments.some((a) =>
        fields.some((f) => a[f] != null && a[f] !== false) || Object.keys(a.customActivityScores || {}).some((n) => n.startsWith(prefix))
      );
      out[key] = hasGoal || hasScore;
    });
    return out;
  })();

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

  const TabButton: React.FC<{ tab: TopTab; label: string }> = ({ tab, label }) => (
    <button
      onClick={() => setTopTab(tab)}
      className={`flex-1 whitespace-nowrap px-3.5 py-2.5 text-xs font-bold rounded-xl transition ${
        topTab === tab ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/[0.04] text-white/50'
      }`}
    >
      {label}
    </button>
  );

  const BackButton = () => (
    <button
      onClick={() => { setMcgillOpen(false); setPerfCategory('hub'); }}
      className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1 mb-3"
    >
      ← Back to Performance Categories
    </button>
  );

  const tabRow = (
    <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
      <TabButton tab="bca" label="BCA Statistics" />
      <TabButton tab="performance" label="Performance" />
      <TabButton tab="skills" label="Skill Roadmap" />
      <TabButton tab="scores" label="Exercise Scores" />
    </div>
  );

  // BCA, Performance and Skills need assessments or goals; Exercise Scores has its own data.
  if (!hasAnyData && topTab !== 'scores') {
    return (
      <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
        {tabRow}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            No progress reports shared yet — your coach will share your assessment results here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8 pt-4 max-w-4xl mx-auto">
      {tabRow}

      {topTab === 'scores' && <ExerciseScores clientId={clientId} />}

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
        // Current / Normal / Goal are exactly what the coach entered - nothing is calculated here.
        const bmiData = chronological.filter((a) => a.bmi != null).map((a) => ({ date: a.date, value: a.bmi as number }));
        const num = (k: keyof AssessmentSnapshot) => {
          const v = getLatestFieldValue(k);
          return typeof v === 'number' ? v : undefined;
        };
        const bcaRow = (label: string, unit: string, valueKey: keyof AssessmentSnapshot, prefix: string) => {
          const from = num(`${prefix}NormalMin` as keyof AssessmentSnapshot);
          const to = num(`${prefix}NormalMax` as keyof AssessmentSnapshot);
          return {
            label,
            unit,
            current: num(valueKey),
            normal: from !== undefined && to !== undefined ? `${from}-${to}` : String(from ?? to ?? '—'),
            nMin: from,
            nMax: to,
            goal: num(`${prefix}Goal` as keyof AssessmentSnapshot),
          };
        };
        const bcaRows = [
          bcaRow('Weight', 'kg', 'weightKg', 'weight'),
          bcaRow('Body Fat', '%', 'bodyFatPercentage', 'bodyFat'),
          bcaRow('Muscle Mass', 'kg', 'muscleMassKg', 'muscleMass'),
          bcaRow('BMI', '', 'bmi', 'bmi'),
          bcaRow('Visceral Fat', '', 'visceralFatLevel', 'visceralFat'),
        ];
        const hasAnyBcaData = bcaRows.some((r) => r.current !== undefined);

        if (weightData.length === 0 && bodyFatData.length === 0 && muscleData.length === 0 && visceralData.length === 0 && bmiData.length === 0) {
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
              <div className="anim-overlay fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setShowWhereYouStandPopup(false)}>
                <div className="anim-card bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-xs max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#1c1c1e]">
                    <h3 className="text-sm font-bold text-white">Where you stand</h3>
                    <button type="button" onClick={() => setShowWhereYouStandPopup(false)} className="text-white/40 text-lg leading-none px-1">×</button>
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {bcaRows.map((row) => {
                      const cur = row.current;
                      const inRange = cur !== undefined && row.nMin !== undefined && row.nMax !== undefined ? cur >= row.nMin && cur <= row.nMax : null;
                      const valueTone = inRange === false ? 'text-[#ec2226]' : 'text-white';
                      return (
                        <div key={row.label} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white/70">{row.label}</span>
                            <span className={`text-lg font-black font-mono ${valueTone}`}>{cur !== undefined ? `${cur}${row.unit}` : '—'}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                            <span className="text-white/50">Normal {row.normal}</span>
                            <span className="text-[#6ccbde]">Goal {row.goal !== undefined ? `${row.goal}${row.unit}` : '—'}</span>
                          </div>
                        </div>
                      );
                    })}
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
              <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #10b981, transparent)' }} />
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">BMI</span>
              <MiniLineChart data={bmiData} color="#10b981" unit="" />
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

            // Worked out from the Waist and Hips values themselves (using the
            // latest value of the other at each point), so it always agrees with
            // what is currently saved; older records fall back to their stored ratio.
            const ratioHistory = (() => {
              const out: { date: string; value: number }[] = [];
              let waist: number | undefined;
              let hips: number | undefined;
              chronological.forEach((a) => {
                if (a.waistCircumferenceIn != null) waist = a.waistCircumferenceIn;
                if (a.hipsCircumferenceIn != null) hips = a.hipsCircumferenceIn;
                if (a.waistCircumferenceIn != null || a.hipsCircumferenceIn != null) {
                  if (waist && hips) out.push({ date: a.date, value: Number((waist / hips).toFixed(2)) });
                } else if (a.waistToHipRatio != null) {
                  out.push({ date: a.date, value: a.waistToHipRatio });
                }
              });
              return out;
            })();
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

                {latestRatio !== undefined && (() => {
                  const level = clientSex ? whrRisk(latestRatio, clientSex) : undefined;
                  const tone = level ? WHR_TONE[level] : undefined;
                  return (
                    <button
                      type="button"
                      onClick={() => setOpenBodyPartPopup('waistToHipRatio')}
                      className={`w-full rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform border ${tone ? tone.box : 'bg-[#242426] border-white/[0.08]'}`}
                      style={tone ? { animation: 'whrBlink 1.4s ease-in-out infinite' } : undefined}
                    >
                      <span className="text-left">
                        <span className="text-xs font-bold text-white block">Waist : Hip Ratio</span>
                        {tone && <span className={`text-[10px] font-bold ${tone.text}`}>{tone.label} · tap for details</span>}
                      </span>
                      <span className={`text-base font-black font-mono ${tone ? tone.text : 'text-white'}`}>{latestRatio}</span>
                    </button>
                  );
                })()}
                <style>{`@keyframes whrBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>

                {openBodyPartPopup && (
                  <div className="anim-overlay fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5" onClick={() => setOpenBodyPartPopup(null)}>
                    <div className="bg-[#242426] border border-white/[0.1] rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white">
                          {openBodyPartPopup === 'waistToHipRatio' ? 'Waist : Hip Ratio' : bodyParts.find((p) => p.key === openBodyPartPopup)?.label}
                        </h4>
                        <button type="button" onClick={() => setOpenBodyPartPopup(null)} className="text-white/40 text-lg leading-none px-1">×</button>
                      </div>
                      {openBodyPartPopup === 'waistToHipRatio' && latestRatio !== undefined && (() => {
                        const level = clientSex ? whrRisk(latestRatio, clientSex) : undefined;
                        const tone = level ? WHR_TONE[level] : undefined;
                        const sexes: ('male' | 'female')[] = clientSex ? [clientSex] : ['male', 'female'];
                        return (
                          <div className="mb-3 space-y-2">
                            {tone && (
                              <div className={`rounded-xl border px-3 py-2 flex items-center justify-between ${tone.box}`}>
                                <span className={`text-xs font-bold ${tone.text}`}>{tone.label}</span>
                                <span className={`text-base font-black font-mono ${tone.text}`}>{latestRatio}</span>
                              </div>
                            )}
                            {sexes.map((sx) => (
                              <div key={sx}>
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-1">{sx === 'male' ? 'Men' : 'Women'}</span>
                                <div className="space-y-1">
                                  {(['low', 'increased', 'high'] as WhrLevel[]).map((lv) => {
                                    const active = clientSex === sx && level === lv;
                                    return (
                                      <div key={lv} className={`flex items-center justify-between rounded-lg px-3 py-1.5 border ${active ? WHR_TONE[lv].box : 'bg-[#1c1c1e] border-white/[0.06]'}`}>
                                        <span className={`text-[11px] font-bold ${WHR_TONE[lv].text}`}>{WHR_TONE[lv].label}</span>
                                        <span className="text-[11px] text-white/70 font-mono">{WHR_RANGES[sx][lv]}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {!clientSex && <p className="text-[10px] text-white/40">Complete the gender question in your health questionnaire to see your own risk level.</p>}
                          </div>
                        );
                      })()}
                      <MiniLineChart
                        data={openBodyPartPopup === 'waistToHipRatio' ? ratioHistory : historyFor(openBodyPartPopup as keyof AssessmentSnapshot)}
                        color={openBodyPartPopup === 'waistToHipRatio' ? (clientSex && latestRatio !== undefined ? WHR_TONE[whrRisk(latestRatio, clientSex)].hex : '#10b981') : '#6ccbde'}
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
        // Oldest first: the id carries the time the step was added, so the order stays the same
        // however many times a step's status was updated (saving can move it in the stored list).
        const addedAt = (g: GoalEntry, idx: number) => {
          const m = /(\d{10,})/.exec(g.id || '');
          return m ? Number(m[1]) : idx;
        };
        const skillGoals = goals
          .filter((g) => g.activityName.startsWith('Skills:'))
          .map((g, idx) => ({ g, idx, t: addedAt(g, idx) }))
          .sort((a, b) => (a.t - b.t) || (a.idx - b.idx))
          .map((x) => x.g);
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
        type Step = { name: string; goal: GoalEntry; isFinal: boolean };
        const roadmaps = new Map<string, Step[]>();
        skillGoals.forEach((g) => {
          const fullName = g.activityName.replace('Skills: ', '');
          const [parent, ...rest] = fullName.split(' > ');
          const isFinal = rest.length === 0;
          const stepName = isFinal ? fullName : rest.join(' > ');
          if (!roadmaps.has(parent)) roadmaps.set(parent, []);
          roadmaps.get(parent)!.push({ name: stepName, goal: g, isFinal });
        });
        // Progression steps in the order they were added, then the skill
        // itself (the final goal) last.
        const orderedRoadmaps = Array.from(roadmaps.entries()).map(([parent, steps]) => [
          parent,
          [...steps.filter((x) => !x.isFinal), ...steps.filter((x) => x.isFinal)],
        ] as [string, Step[]]);

        // A skill is achieved once its final goal is passed.
        const isPassed = (g: GoalEntry) => g.status === 'Pass' || g.status === 'AlreadyFit';
        const achievedSkills = orderedRoadmaps.filter(([, steps]) => steps.some((x) => x.isFinal && isPassed(x.goal))).reverse();
        const activeRoadmaps = orderedRoadmaps.filter(([, steps]) => !steps.some((x) => x.isFinal && isPassed(x.goal)));
        const skillItems: RoadmapItem[] = [...achievedSkills].reverse().map(([skillName, steps]) => {
          const fin = steps.find((x) => x.isFinal)!.goal;
          return {
            id: fin.id,
            name: skillName,
            date: fin.dateAchieved,
            note: fin.coachReview || fin.observation,
            status: fin.status,
            scoreText: `${steps.length} step${steps.length === 1 ? '' : 's'}`,
            rowsTitle: 'Skill roadmap',
            rows: steps.map((x) => {
              const unit = x.goal.valueType === 'time_seconds' ? 'sec' : 'reps';
              const val = x.goal.value ? ` · ${x.goal.value}${x.goal.targetValue ? ` / ${x.goal.targetValue}` : ''} ${unit}` : '';
              return {
                date: x.goal.dateAchieved || '',
                text: `${isPassed(x.goal) ? '✓ ' : ''}${x.isFinal ? `${skillName} (final skill)` : x.name}${val}`,
                note: x.goal.coachReview || x.goal.observation,
              };
            }),
          };
        });

        if (activeRoadmaps.length === 0 && achievedSkills.length > 0) {
          return <AchievementsPage route title="Skills complete" items={skillItems} />;
        }

        return (
          <div className="space-y-3">
            <AchievementFitRow route title="Skill" items={skillItems} />
            {[...activeRoadmaps].reverse().map(([skillName, steps]) => (
              <div key={skillName} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <span className="text-sm font-bold text-white">{skillName}</span>
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const isDone = step.goal.status === 'Pass' || step.goal.status === 'AlreadyFit';
                    const unit = step.goal.valueType === 'time_seconds' ? 'sec' : 'reps';
                    const current = Number(step.goal.value) || 0;
                    const target = step.goal.targetValue;
                    const pct = isDone ? 100 : target ? Math.min(100, (current / target) * 100) : 0;
                    return (
                      <div key={step.goal.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isDone ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}>
                            {isDone ? '✓' : step.isFinal ? '★' : i + 1}
                          </div>
                          {i < steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[18px] ${isDone ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${isDone ? 'text-emerald-300' : 'text-white'}`}>
                              {step.isFinal ? `${skillName} (final skill)` : step.name}
                            </span>
                            {(step.goal.value || target) && (
                              <span className="text-[11px] text-white/40 font-light shrink-0">
                                {step.goal.value ?? 0}{target ? ` / ${target}` : ''} {unit}
                              </span>
                            )}
                          </div>
                          {target ? (
                            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }} />
                            </div>
                          ) : null}
                          {step.goal.observation && <p className="text-[11px] text-white/40 font-light mt-1">{step.goal.observation}</p>}
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
                <button onClick={() => setPerfCategory('posture')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1`}>
                  <XRayBackground type="posture" />
                  <h3 className="text-sm font-bold text-white">Posture</h3>
                  <p className="text-[11px] text-white/40 font-light">Postural alignment.</p>
                </button>
                <button disabled={!catHasData.flexibility} onClick={() => setPerfCategory('flexibility')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.flexibility ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="flexibility" />
                  <h3 className="text-sm font-bold text-white">Flexibility & Mobility</h3>
                  <p className="text-[11px] text-white/40 font-light">Thomas, SLR, shoulder tests.</p>
                </button>
                <button disabled={!catHasData.balance} onClick={() => setPerfCategory('balance')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.balance ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="balance" />
                  <h3 className="text-sm font-bold text-white">Balance</h3>
                  <p className="text-[11px] text-white/40 font-light">Unipedal Stance Test.</p>
                </button>
                <button disabled={!catHasData.core_endurance} onClick={() => setPerfCategory('core_endurance')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.core_endurance ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="core_endurance" />
                  <h3 className="text-sm font-bold text-white">Core Endurance & Stability</h3>
                  <p className="text-[11px] text-white/40 font-light">McGill's Core Endurance Test.</p>
                </button>
                <button disabled={!catHasData.movement} onClick={() => setPerfCategory('movement')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-blue-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.movement ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="movement" />
                  <h3 className="text-sm font-bold text-white">Movement</h3>
                  <p className="text-[11px] text-white/40 font-light">Movement pattern screens.</p>
                </button>
                <button disabled={!catHasData.cardio} onClick={() => setPerfCategory('cardio')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-cyan-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.cardio ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="cardio" />
                  <h3 className="text-sm font-bold text-white">Cardio</h3>
                  <p className="text-[11px] text-white/40 font-light">VO2 Max & aerobic tests.</p>
                </button>
                <button disabled={!catHasData.muscular_endurance} onClick={() => setPerfCategory('muscular_endurance')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-amber-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.muscular_endurance ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="muscular_endurance" />
                  <h3 className="text-sm font-bold text-white">Muscular Endurance</h3>
                  <p className="text-[11px] text-white/40 font-light">Push-ups, pull-ups, squats.</p>
                </button>
                <button disabled={!catHasData.muscular_strength} onClick={() => setPerfCategory('muscular_strength')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-red-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.muscular_strength ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="muscular_strength" />
                  <h3 className="text-sm font-bold text-white">Muscular Strength</h3>
                  <p className="text-[11px] text-white/40 font-light">1RM bench, squat, deadlift, OHP.</p>
                </button>
                <button disabled={!catHasData.saq} onClick={() => setPerfCategory('saq')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-emerald-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.saq ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="saq" />
                  <h3 className="text-sm font-bold text-white">SAQ</h3>
                  <p className="text-[11px] text-white/40 font-light">Speed, Agility & Quickness.</p>
                </button>
                <button disabled={!catHasData.power} onClick={() => setPerfCategory('power')} className={`relative overflow-hidden bg-[#242426] border border-white/[0.06] hover:border-purple-400/40 rounded-2xl p-4 text-left transition space-y-1 ${catHasData.power ? '' : 'opacity-35 grayscale cursor-not-allowed'}`}>
                  <XRayBackground type="power" />
                  <h3 className="text-sm font-bold text-white">Power</h3>
                  <p className="text-[11px] text-white/40 font-light">Vertical Jump.</p>
                </button>
              </div>

            </div>
          )}

          {perfCategory === 'posture' && (
            <div>
              <BackButton />
              {(() => {
                const customGoals = [...goals.filter((g) => g.activityName.startsWith('Posture:'))].reverse();
                const historyFor = (activityName: string) =>
                  chronological
                    .filter((a) => a.customActivityScores?.[activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![activityName], note: resultNote(a, activityName) }));
                const latestScoreFor = (activityName: string) => {
                  const h = historyFor(activityName);
                  return h.length > 0 ? h[h.length - 1].value : undefined;
                };

                if (customGoals.length === 0) {
                  return (
                    <div className="relative overflow-hidden bg-[#242426] border border-[#6ccbde]/25 rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(180deg, rgba(108,203,222,0.16), #242426 75%)' }}>
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde, transparent)' }} />
                      <img src="/posture-achievement-icon.PNG" alt="" className="w-16 h-16 mx-auto mb-3 object-contain" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6ccbde]">Posture</p>
                      <h2 className="text-xl font-black text-white mt-1 leading-tight">You are already fit in posture</h2>
                      <p className="text-xs text-white/60 mt-2 leading-relaxed">Your coach found nothing to correct. Stand tall, keep moving well, and keep this strong foundation going.</p>
                      <div className="mt-4 h-[2px] bg-white/10 rounded-full overflow-hidden"><div className="h-full w-full bg-gradient-to-r from-[#ec2226] to-[#6ccbde] rounded-full" /></div>
                    </div>
                  );
                }

                const achieved = [...customGoals.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit')].reverse();
                const inProgress = customGoals.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit');

                if (inProgress.length === 0 && achieved.length > 0) {
                  return (
                    <AchievementsPage title="Posture complete" items={achieved.map((g) => ({ id: g.id, name: g.activityName.replace('Posture: ', ''), score: latestScoreFor(g.activityName), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: historyFor(g.activityName) }))} />
                  );
                }

                return (
                  <div className="space-y-4">
                    <AchievementFitRow singleCard title="Posture" items={achieved.map((g) => ({ id: g.id, name: g.activityName.replace('Posture: ', ''), score: latestScoreFor(g.activityName), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: historyFor(g.activityName) }))} />

                    {inProgress.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inProgress.map((g, idx) => {
                          const cardColor = ['#ec2226', '#f59e0b', '#6ccbde', '#a78bfa'][idx % 4];
                          const reviewText = g.coachReview || g.observation;
                          return (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                            <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${cardColor}, transparent)` }} />
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{g.activityName.replace('Posture: ', '')}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                g.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                                g.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-rose-500/20 text-rose-300'
                              }`}>
                                {g.status === 'Pass' ? 'Pass' : g.status === 'AlreadyFit' ? 'Already Fit' : 'In Progress'}
                              </span>
                            </div>
                            <ScoreMeter data={historyFor(g.activityName)} color={cardColor} />
                            {reviewText && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                                <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{reviewText}</p>
                              </div>
                            )}
                          </div>
                          );
                        })}
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
                const FLEX = 'Flexibility & Mobility: ';
                const achieved = goals.filter((g) => g.activityName.startsWith(FLEX) && (g.status === 'Pass' || g.status === 'AlreadyFit')).reverse();
                const flexHistoryFor = (g: GoalEntry): { date: string; value: number; note?: string }[] => {
                  const t = tests.find((x) => `${FLEX}${x.label}` === g.activityName);
                  if (t) return chronological.filter((a) => a[t.scoreKey] != null).map((a) => ({ date: a.date, value: a[t.scoreKey] as number, note: resultNote(a, g.activityName, t.scoreKey) }));
                  return chronological.filter((a) => a.customActivityScores?.[g.activityName] != null).map((a) => ({ date: a.date, value: a.customActivityScores![g.activityName], note: resultNote(a, g.activityName) }));
                };
                const flexScoreFor = (g: GoalEntry) => {
                  if (g.value) return g.value;
                  const t = tests.find((x) => `${FLEX}${x.label}` === g.activityName);
                  const h = t ? chronological.filter((a) => a[t.scoreKey] != null) : [];
                  return h.length > 0 ? String(h[h.length - 1][t!.scoreKey]) : undefined;
                };
                const isPassedGoal = (g?: GoalEntry) => !!g && (g.status === 'Pass' || g.status === 'AlreadyFit');
                const visibleTests = tests.filter((t) => !isPassedGoal(goals.find((g) => g.activityName === `${FLEX}${t.label}`)));
                const visibleCustom = customGoals.filter((g) => !isPassedGoal(g));

                if (visibleTests.length === 0 && visibleCustom.length === 0 && achieved.length > 0) {
                  const ordered = [...achieved].reverse();
                  return (
                    <AchievementsPage title="Flexibility & Mobility complete" items={ordered.map((g) => ({ id: g.id, name: g.activityName.replace(FLEX, ''), score: flexScoreFor(g), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: flexHistoryFor(g) }))} />
                  );
                }

                return (
                  <div className="space-y-4">
                    <AchievementFitRow title="Flexibility & Mobility" items={[...achieved].reverse().map((g) => ({ id: g.id, name: g.activityName.replace(FLEX, ''), score: flexScoreFor(g), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: flexHistoryFor(g) }))} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleTests.map((t) => {
                      const scoreData = chronological.filter((a) => a[t.scoreKey] != null).map((a) => ({ date: a.date, value: a[t.scoreKey] as number }));
                      const latest = [...chronological].reverse().find((a) => a[t.key] != null);
                      return (
                        <div key={t.key} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                          <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{t.label}</span>
                            {latest && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${latest[t.key] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {latest[t.key] ? 'Pass' : 'In Progress'}
                              </span>
                            )}
                          </div>
                          <ScoreMeter data={scoreData} color={t.color} />
                          {goals.find((g) => g.activityName === `Flexibility & Mobility: ${t.label}`)?.coachReview && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06]">
                              <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                              <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{goals.find((g) => g.activityName === `Flexibility & Mobility: ${t.label}`)?.coachReview}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {visibleCustom.map((g) => (
                      <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                        <span className="text-sm text-white font-semibold block mb-1">{g.activityName.replace('Flexibility & Mobility: ', '')}</span>
                        {g.value && <span className="text-[11px] text-white/40 font-light">Score: <span className="font-mono">{g.value}/10</span></span>}
                        {g.coachReview && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                            <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{g.coachReview}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                );
              })()}
            </div>
          )}

          {perfCategory === 'balance' && (
            <div>
              <BackButton />
              {(() => {
                const BAL = 'Balance: ';
                const STD = 'Balance: Unipedal Stance Test';
                const sideData: SidePoint[] = chronological
                  .filter((a) => a.unipedalStanceLeftSeconds != null || a.unipedalStanceRightSeconds != null)
                  .map((a) => ({ date: a.date, left: a.unipedalStanceLeftSeconds as number | undefined, right: a.unipedalStanceRightSeconds as number | undefined, note: resultNote(a, STD) }));
                const customGoals = goals.filter((g) => g.activityName.startsWith(BAL) && g.activityName !== STD);
                const palette = ['#ec2226', '#f59e0b', '#6ccbde', '#a78bfa'];
                const isPassedGoal = (g?: GoalEntry) => !!g && (g.status === 'Pass' || g.status === 'AlreadyFit');
                const stdGoal = goals.find((g) => g.activityName === STD);
                const customSides = (g: GoalEntry): SidePoint[] =>
                  chronological
                    .filter((a) => a.activitySides?.[g.activityName] != null)
                    .map((a) => ({ date: a.date, left: a.activitySides![g.activityName].left, right: a.activitySides![g.activityName].right, note: resultNote(a, g.activityName) }));
                const customHistory = (g: GoalEntry) =>
                  chronological
                    .filter((a) => a.customActivityScores?.[g.activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![g.activityName], note: resultNote(a, g.activityName) }));
                const isSided = (g: GoalEntry) => g.activityName === STD || g.valueType === 'unilateral_time';
                const sidesFor = (g: GoalEntry) => (g.activityName === STD ? sideData : customSides(g));
                const toItem = (g: GoalEntry): RoadmapItem => {
                  const base = { id: g.id, name: g.activityName.replace(BAL, ''), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, unit: 's' };
                  if (isSided(g)) {
                    const sd = sidesFor(g);
                    const lastS = sd[sd.length - 1];
                    return { ...base, sides: sd, scoreText: lastS ? `L ${lastS.left ?? '—'}s · R ${lastS.right ?? '—'}s` : undefined };
                  }
                  const h = customHistory(g);
                  return { ...base, history: h, score: h.length > 0 ? h[h.length - 1].value : undefined };
                };
                const allGoals = [...(stdGoal ? [stdGoal] : []), ...customGoals];
                const achieved = allGoals.filter(isPassedGoal).reverse();
                const showStd = !isPassedGoal(stdGoal) && (sideData.length > 0 || (customGoals.length === 0 && achieved.length === 0));
                const visibleCustom = customGoals.filter((g) => !isPassedGoal(g));

                if (!showStd && visibleCustom.length === 0 && achieved.length > 0) {
                  return <AchievementsPage title="Balance complete" items={[...achieved].reverse().map(toItem)} />;
                }

                return (
                  <div className="space-y-3">
                    <AchievementFitRow title="Balance" items={[...achieved].reverse().map(toItem)} />
                    {showStd && (
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Unipedal Stance Test <span className="normal-case text-white/30">(in seconds)</span></span>
                        <SideComparison data={sideData} unit="s" />
                        {(stdGoal?.coachReview || stdGoal?.observation) && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                            <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{(stdGoal?.coachReview || stdGoal?.observation)}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {visibleCustom.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {visibleCustom.map((g, idx) => {
                          const color = palette[idx % palette.length];
                          const label = g.activityName.replace(BAL, '');
                          if (g.valueType === 'unilateral_time') {
                            return (
                              <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden sm:col-span-2">
                                <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{label} <span className="normal-case text-white/30">(in seconds)</span></span>
                                <SideComparison data={customSides(g)} unit="s" />
                                {(g.coachReview || g.observation) && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                            <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{(g.coachReview || g.observation)}</p>
                          </div>
                        )}
                              </div>
                            );
                          }
                          return (
                            <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                              <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{label} <span className="normal-case text-white/30">(in seconds)</span></span>
                              <MiniLineChart data={customHistory(g)} color={color} unit="s" />
                              {(g.coachReview || g.observation) && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                            <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{(g.coachReview || g.observation)}</p>
                          </div>
                        )}
                            </div>
                          );
                        })}
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
                const lastOf = (d: { date: string; value: number }[]) => (d.length > 0 ? d[d.length - 1].value : undefined);
                const outCount = latest ? MCGILL_RATIOS.filter((r) => { const v = latest[r.key]; const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) && r.out(n); }).length : 0;
                const hasRatios = latest ? MCGILL_RATIOS.some((r) => !!latest[r.key]) : false;
                const lastDate = [flexorData, extensorData, rightData, leftData].map((d) => (d.length > 0 ? d[d.length - 1].date : '')).sort().pop() || '';
                const hasMcgill = flexorData.length + extensorData.length + rightData.length + leftData.length > 0;
                const CORE = 'Core Endurance & Stability: ';
                const MCG = "Core Endurance & Stability: McGill's Test";
                const mcgillGoal = goals.find((g) => g.activityName === MCG);
                const isPassedGoal = (g?: GoalEntry) => !!g && (g.status === 'Pass' || g.status === 'AlreadyFit');
                const mcgillPassed = false; // McGill's test is tracked continuously (like BCA) - it is never marked passed
                const palette = ['#ec2226', '#f59e0b', '#6ccbde', '#a78bfa'];
                const customHistory = (g: GoalEntry) =>
                  chronological
                    .filter((a) => a.customActivityScores?.[g.activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![g.activityName], note: resultNote(a, g.activityName) }));
                const mcgillRows = chronological
                  .filter((a) => a.mcgillFlexorSeconds != null || a.mcgillExtensorSeconds != null || a.mcgillRightSideBridgeSeconds != null || a.mcgillLeftSideBridgeSeconds != null)
                  .map((a) => ({
                    date: a.date,
                    text: `F ${a.mcgillFlexorSeconds ?? '—'} · E ${a.mcgillExtensorSeconds ?? '—'} · R ${a.mcgillRightSideBridgeSeconds ?? '—'} · L ${a.mcgillLeftSideBridgeSeconds ?? '—'}s`,
                    note: resultNote(a, MCG),
                  }));
                const toItem = (g: GoalEntry): RoadmapItem => {
                  const base = { id: g.id, name: g.activityName.replace(CORE, '').replace("McGill's Test", "McGill's Core Endurance Test"), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, unit: 's' };
                  if (g.activityName === MCG) {
                    const lr = mcgillRows[mcgillRows.length - 1];
                    return {
                      ...base,
                      scoreText: lr ? lr.text : undefined,
                      rows: mcgillRows,
                      series: [
                        { label: 'Flexor Endurance', color: '#ec2226', data: flexorData },
                        { label: 'Extensor Endurance', color: '#f59e0b', data: extensorData },
                        { label: 'Right Side Bridge', color: '#6ccbde', data: rightData },
                        { label: 'Left Side Bridge', color: '#a78bfa', data: leftData },
                      ],
                    };
                  }
                  const h = customHistory(g);
                  return { ...base, history: h, score: h.length > 0 ? h[h.length - 1].value : undefined };
                };
                // No Achievements / Already fit cards here: every activity just stays in the list.
                const achieved: GoalEntry[] = [];
                const visibleCustom = customGoals;
                const showMcgill = !mcgillPassed && (hasMcgill || (visibleCustom.length === 0 && achieved.length === 0));
                const mcgillReview = mcgillGoal?.coachReview || mcgillGoal?.observation;

                if (!showMcgill && visibleCustom.length === 0 && achieved.length > 0) {
                  return <AchievementsPage title="Core Endurance complete" items={[...achieved].reverse().map(toItem)} />;
                }

                if (mcgillOpen && showMcgill) {
                  return (
                    <div className="space-y-3">
                      <button onClick={() => setMcgillOpen(false)} className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1">
                        ← Back to Core Endurance &amp; Stability
                      </button>
                      <div className="text-sm font-bold text-white">McGill's Core Endurance Test</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec2226, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Flexor Endurance <span className="normal-case text-white/30">(in seconds)</span></span>
                        <MiniLineChart data={flexorData} color="#ec2226" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Extensor Endurance <span className="normal-case text-white/30">(in seconds)</span></span>
                        <MiniLineChart data={extensorData} color="#f59e0b" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Right Side Bridge <span className="normal-case text-white/30">(in seconds)</span></span>
                        <MiniLineChart data={rightData} color="#6ccbde" unit="s" />
                      </div>
                      <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #a78bfa, transparent)' }} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">Left Side Bridge <span className="normal-case text-white/30">(in seconds)</span></span>
                        <MiniLineChart data={leftData} color="#a78bfa" unit="s" />
                      </div>
                    </div>
                    {latest && (
                      <div className="grid grid-cols-2 gap-3">
                        {MCGILL_RATIOS.map((r) => {
                          const val = latest[r.key];
                          if (!val) return null;
                          const num = parseFloat(val);
                          const alert = Number.isFinite(num) && r.out(num);
                          return (
                            <div key={r.key} className={`rounded-2xl p-3 border ${alert ? 'bg-rose-500/10 border-rose-500/50' : 'bg-[#242426] border-white/[0.06]'}`}>
                              <span className={`text-[9px] uppercase font-bold block ${alert ? 'text-rose-300' : 'text-white/40'}`}>{r.label}</span>
                              <span className={`text-sm font-mono ${alert ? 'text-rose-300 font-bold' : 'text-white'}`}>{val}</span>
                              {alert && <span className="text-[9px] text-rose-300/80 block mt-1">⚠ Not in normal range ({r.normal})</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                      {mcgillReview && (
                        <div className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4">
                          <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                          <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{mcgillReview}</p>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {showMcgill && (
                    <button
                      type="button"
                      onClick={() => setMcgillOpen(true)}
                      className="w-full text-left bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden active:scale-[0.98] transition-transform"
                    >
                      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6ccbde, transparent)' }} />
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-sm font-bold text-white block">McGill's Core Endurance Test</span>
                          <span className="text-[10px] text-white/40 font-mono">{hasMcgill ? `Last tested ${lastDate}` : 'No results yet'}</span>
                        </div>
                        <span className="text-[#6ccbde] text-lg leading-none">›</span>
                      </div>
                      {hasMcgill && (
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {([['Flexor', lastOf(flexorData)], ['Extensor', lastOf(extensorData)], ['Right', lastOf(rightData)], ['Left', lastOf(leftData)]] as [string, number | undefined][]).map(([lbl, v]) => (
                            <div key={lbl} className="bg-[#1c1c1e] border border-white/[0.06] rounded-xl px-2 py-2 text-center">
                              <span className="text-[9px] text-white/40 uppercase font-bold block">{lbl}</span>
                              <span className="text-sm font-black text-white font-mono">{v ?? '—'}{v != null && <span className="text-[9px] text-white/40 font-normal">s</span>}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasRatios && (
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${outCount > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {outCount > 0 ? `⚠ ${outCount} ratio${outCount === 1 ? '' : 's'} outside normal range` : 'All ratios in normal range'}
                        </span>
                      )}
                      {mcgillReview && <p className="text-[11px] text-white/60 font-normal leading-relaxed mt-3 line-clamp-2">“{mcgillReview}”</p>}
                      <span className="text-[10px] text-white/30 block mt-3">Tap to see graphs and details</span>
                    </button>
                    )}
                    {visibleCustom.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {visibleCustom.map((g, idx) => {
                          const color = palette[idx % palette.length];
                          const review = g.coachReview || g.observation;
                          return (
                            <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                              <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{g.activityName.replace(CORE, '')} <span className="normal-case text-white/30">(in seconds)</span></span>
                              <MiniLineChart data={customHistory(g)} color={color} unit="s" />
                              {review && (
                                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                  <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                                  <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{review}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                const standardTests: { name: string; scoreKey: keyof AssessmentSnapshot; label: string }[] = [
                  { name: 'Movement: Bend & Lift Squat Pattern', scoreKey: 'bendAndLiftSquatPatternScore', label: 'Bend & Lift Squat Pattern' },
                  { name: 'Movement: Single Leg Step Up', scoreKey: 'singleLegStepUpScore', label: 'Single Leg Step Up' },
                  { name: 'Movement: Shoulder Push Stabilization', scoreKey: 'shoulderPushStabilizationScore', label: 'Shoulder Push Stabilization' },
                  { name: 'Movement: Pull Stability Standing Row', scoreKey: 'pullStabilityStandingRowScore', label: 'Pull Stability Standing Row' },
                  { name: 'Movement: Thoracic Spine Mobility', scoreKey: 'thoracicSpineMobilityScore', label: 'Thoracic Spine Mobility' },
                  { name: 'Movement: Overhead Squat Test', scoreKey: 'overheadSquatTestScore', label: 'Overhead Squat Test' },
                ];
                const standardNames = standardTests.map((t) => t.name);
                const customGoals = goals.filter((g) => g.activityName.startsWith('Movement:') && !standardNames.includes(g.activityName));

                const historyFor = (activityName: string) => {
                  const standard = standardTests.find((t) => t.name === activityName);
                  if (standard) {
                    return chronological.filter((a) => a[standard.scoreKey] != null).map((a) => ({ date: a.date, value: a[standard.scoreKey] as number, note: resultNote(a, activityName, standard.scoreKey) }));
                  }
                  return chronological
                    .filter((a) => a.customActivityScores?.[activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![activityName], note: resultNote(a, activityName) }));
                };
                const latestScoreFor = (activityName: string) => {
                  const h = historyFor(activityName);
                  return h.length > 0 ? h[h.length - 1].value : undefined;
                };

                // Every pre-defined test always has its card and graph (like Muscular Strength),
                // even before it has a score or after its scores were removed.
                const standardGoals: GoalEntry[] = standardTests.map((t) => (
                  goals.find((g) => g.activityName === t.name)
                  || ({ id: `std-${t.name}`, activityName: t.name, status: 'Pending', dateAdded: '' } as GoalEntry)
                ));
                const allActivities = [...standardGoals, ...customGoals].reverse();

                if (allActivities.length === 0) {
                  return <p className="text-xs text-white/40 text-center py-6">No movement activities logged yet.</p>;
                }

                const achieved = allActivities.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                const inProgress = allActivities.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit');

                if (inProgress.length === 0 && achieved.length > 0) {
                  return (
                    <AchievementsPage title="Movement complete" items={achieved.map((g) => ({ id: g.id, name: g.activityName.replace('Movement: ', ''), score: latestScoreFor(g.activityName), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: historyFor(g.activityName) }))} />
                  );
                }

                return (
                  <div className="space-y-4">
                    <AchievementFitRow title="Movement" items={achieved.map((g) => ({ id: g.id, name: g.activityName.replace('Movement: ', ''), score: latestScoreFor(g.activityName), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, history: historyFor(g.activityName) }))} />

                    {inProgress.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inProgress.map((g, idx) => {
                          const cardColor = ['#ec2226', '#f59e0b', '#6ccbde', '#a78bfa'][idx % 4];
                          // A review belongs to a result: once every score is deleted, it is not shown any more.
                          const reviewText = historyFor(g.activityName).length > 0 ? (g.coachReview || g.observation) : undefined;
                          return (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                            <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${cardColor}, transparent)` }} />
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{g.activityName.replace('Movement: ', '')}</span>
                              {historyFor(g.activityName).length > 0 && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                g.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                                g.status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-rose-500/20 text-rose-300'
                              }`}>
                                {g.status === 'Pass' ? 'Pass' : g.status === 'AlreadyFit' ? 'Already Fit' : 'In Progress'}
                              </span>
                              )}
                            </div>
                            <ScoreMeter data={historyFor(g.activityName)} color={cardColor} />
                            {reviewText && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                                <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{reviewText}</p>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}

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
                const ME = 'Muscular Endurance: ';
                const standards: { key: keyof AssessmentSnapshot; label: string; color: string }[] = [
                  { key: 'pushUpsReps', label: 'Push-Ups', color: '#ec2226' },
                  { key: 'pullUpMaxReps', label: 'Pull-Ups', color: '#f59e0b' },
                  { key: 'bodyweightSquatsReps', label: 'Bodyweight Squats', color: '#6ccbde' },
                ];
                const standardNames = standards.map((x) => `${ME}${x.label}`);
                const customGoals = goals.filter((g) => g.activityName.startsWith(ME) && !standardNames.includes(g.activityName));
                const palette = ['#a78bfa', '#ec2226', '#f59e0b', '#6ccbde'];
                const isPassedGoal = (g?: GoalEntry) => !!g && (g.status === 'Pass' || g.status === 'AlreadyFit');
                const standardHistory = (x: { key: keyof AssessmentSnapshot; label: string }) =>
                  chronological
                    .filter((a) => a[x.key] != null)
                    .map((a) => ({ date: a.date, value: a[x.key] as number, note: resultNote(a, `${ME}${x.label}`) }));
                const customHistory = (g: GoalEntry) =>
                  chronological
                    .filter((a) => a.customActivityScores?.[g.activityName] != null)
                    .map((a) => ({ date: a.date, value: a.customActivityScores![g.activityName], note: resultNote(a, g.activityName) }));
                const reviewFor = (name: string) => {
                  const g = goals.find((x) => x.activityName === name);
                  return g?.coachReview || g?.observation;
                };
                const ReviewBlock: React.FC<{ text?: string }> = ({ text }) =>
                  text ? (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                      <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{text}</p>
                    </div>
                  ) : null;
                const toItem = (g: GoalEntry): RoadmapItem => {
                  const h = customHistory(g);
                  return { id: g.id, name: g.activityName.replace(ME, ''), date: g.dateAchieved, note: g.coachReview || g.observation, status: g.status, unit: ' reps', history: h, score: h.length > 0 ? h[h.length - 1].value : undefined };
                };
                // No Achievements / Already fit cards here: every activity just stays in the list.
                const achieved: GoalEntry[] = [];
                const visibleCustom = customGoals;
                const visibleStandards = standards.filter((x) => standardHistory(x).length > 0);
                const nothingElse = visibleCustom.length === 0 && achieved.length === 0;

                if (visibleStandards.length === 0 && visibleCustom.length === 0 && achieved.length > 0) {
                  return <AchievementsPage title="Muscular Endurance complete" items={[...achieved].reverse().map(toItem)} />;
                }

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(visibleStandards.length > 0 ? visibleStandards : nothingElse ? standards : []).map((x) => (
                        <div key={String(x.key)} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                          <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${x.color}, transparent)` }} />
                          <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{x.label} <span className="normal-case text-white/30">(in reps)</span></span>
                          <MiniLineChart data={standardHistory(x)} color={x.color} unit="reps" />
                          <ReviewBlock text={reviewFor(`${ME}${x.label}`)} />
                        </div>
                      ))}
                      {visibleCustom.map((g, idx) => {
                        const color = palette[idx % palette.length];
                        return (
                          <div key={g.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                            <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{g.activityName.replace(ME, '')} <span className="normal-case text-white/30">(in reps)</span></span>
                            <MiniLineChart data={customHistory(g)} color={color} unit="reps" />
                            <ReviewBlock text={g.coachReview || g.observation} />
                          </div>
                        );
                      })}
                    </div>
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
                const customGoals = goals.filter((g) => g.activityName.startsWith('Muscular Strength:') && !lifts.some((l) => `Muscular Strength: ${l.label}` === g.activityName));
                const reviewFor = (name: string) => {
                  const g = goals.find((x) => x.activityName === name);
                  return g?.coachReview || g?.observation;
                };
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lifts.map((l) => {
                        const data = chronological.filter((a) => a[l.key] != null).map((a) => ({ date: a.date, value: a[l.key] as number }));
                        return (
                          <div key={l.key} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                            <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${l.color}, transparent)` }} />
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide block mb-2">{l.label} <span className="normal-case text-white/30">(in kg)</span></span>
                            <MiniLineChart data={data} color={l.color} unit="kg" />
                            {reviewFor(`Muscular Strength: ${l.label}`) && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                                <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{reviewFor(`Muscular Strength: ${l.label}`)}</p>
                              </div>
                            )}
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
                            {(g.coachReview || g.observation) && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                <span className="text-[10px] text-[#6ccbde] uppercase font-bold tracking-wide block mb-1">Coach review</span>
                                <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line">{g.coachReview || g.observation}</p>
                              </div>
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
                const passedGoals = goals.filter((g) => g.status === 'Pass' && !g.activityName.startsWith('Skills:') && !NO_ACHIEVEMENT_PREFIXES.some((p) => g.activityName.startsWith(p)));
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
                const alreadyFitGoals = goals.filter((g) => g.status === 'AlreadyFit' && !g.activityName.startsWith('Skills:') && !NO_ACHIEVEMENT_PREFIXES.some((p) => g.activityName.startsWith(p)));
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
