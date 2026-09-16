import React, { useState, useMemo, useEffect } from 'react';
import { usePrimeStore } from '../../lib/store';
import { AssessmentRecord, SkillProgressItem, MovementPostureIssue, GoalEntry, CircuitRound } from '../../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Activity,
  TrendingDown,
  TrendingUp,
  Scale,
  Percent,
  HeartPulse,
  Award,
  Plus,
  CheckCircle2,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Dumbbell,
  Shield,
  Target,
  Ruler,
  FileText,
  Clock,
  Flame,
  ArrowRight,
  Filter,
  X,
  Trash2,
  ClipboardList,
} from 'lucide-react';

interface CoachAssessmentWorkspaceProps {
  currentCoachName: string;
  preSelectedClientId?: string;
}

// Resizes and compresses an uploaded posture photo before storing it
// as base64 directly in Firestore - there's no file storage service
// set up in this project, and a compressed photo comfortably fits
// within Firestore's document size limits.
function compressPostureImage(file: File, maxWidth = 500, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// A three-state Pass/Fail/Not-yet-tested toggle, reused across the
// Flexibility and Movement test cards.
const PassFailToggle: React.FC<{ label: string; value: boolean | null; onChange: (v: boolean | null) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">{label}</label>
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`py-1.5 rounded-lg text-xs font-bold border transition ${
          value === true ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A]'
        }`}
      >
        Pass
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`py-1.5 rounded-lg text-xs font-bold border transition ${
          value === false ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A]'
        }`}
      >
        Fail
      </button>
    </div>
  </div>
);

// Redesigned, lightweight stat chart - a clean SVG line chart with
// each point's value labeled directly, avoiding the overhead of
// configuring recharts repeatedly for two dozen different metrics.
const StatMiniChart: React.FC<{ data: { date: string; value: number }[]; color: string; unit?: string }> = ({ data, color, unit = '' }) => {
  if (data.length === 0) {
    return <div className="h-20 flex items-center justify-center text-[10px] text-neutral-500">No data yet</div>;
  }
  if (data.length === 1) {
    return (
      <div className="h-20 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white font-mono">{data[0].value}{unit}</span>
        <span className="text-[9px] text-neutral-500">{data[0].date}</span>
      </div>
    );
  }
  const width = 280;
  const height = 100;
  const padX = 10;
  const padTop = 22;
  const padBottom = 18;
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (width - padX * 2),
    y: padTop + (height - padTop - padBottom) - ((d.value - minVal) / range) * (height - padTop - padBottom),
    value: d.value,
    date: d.date,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const maxLabels = 4;
  const step = Math.max(1, Math.ceil(points.length / maxLabels));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
          <text x={p.x} y={p.y - 7} fontSize="8" fill="white" fillOpacity="0.85" textAnchor="middle" fontFamily="monospace">{p.value}</text>
          {i % step === 0 && (
            <text x={p.x} y={height - 4} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">{p.date.slice(5)}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

// Shows two related series (like left leg vs right leg) together on
// one shared chart, since a side-to-side comparison is the whole
// point - two separate charts with their own scales make it hard to
// see at a glance which side is ahead.
const StatDualLineChart: React.FC<{
  dataA: { date: string; value: number }[];
  dataB: { date: string; value: number }[];
  labelA: string;
  labelB: string;
  colorA: string;
  colorB: string;
  unit?: string;
}> = ({ dataA, dataB, labelA, labelB, colorA, colorB, unit = '' }) => {
  const allDates = Array.from(new Set([...dataA.map((d) => d.date), ...dataB.map((d) => d.date)])).sort();
  if (allDates.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[10px] text-neutral-500">No data yet</div>;
  }
  const width = 280;
  const height = 110;
  const padX = 10;
  const padTop = 26;
  const padBottom = 18;
  const mapA = new Map<string, number>(dataA.map((d) => [d.date, d.value]));
  const mapB = new Map<string, number>(dataB.map((d) => [d.date, d.value]));
  const allValues = [...dataA.map((d) => d.value), ...dataB.map((d) => d.value)];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const xFor = (i: number) => padX + (allDates.length === 1 ? 0 : (i / (allDates.length - 1)) * (width - padX * 2));
  const yFor = (v: number) => padTop + (height - padTop - padBottom) - ((v - minVal) / range) * (height - padTop - padBottom);
  const buildPath = (map: Map<string, number>) => {
    const pts = allDates.map((d, i) => (map.has(d) ? { x: xFor(i), y: yFor(map.get(d) as number) } : null)).filter(Boolean) as { x: number; y: number }[];
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };
  const maxLabels = 4;
  const step = Math.max(1, Math.ceil(allDates.length / maxLabels));

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="flex items-center gap-1 text-[9px] text-white/70"><span className="w-2 h-2 rounded-full" style={{ background: colorA }} /> {labelA}</span>
        <span className="flex items-center gap-1 text-[9px] text-white/70"><span className="w-2 h-2 rounded-full" style={{ background: colorB }} /> {labelB}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        <path d={buildPath(mapA)} fill="none" stroke={colorA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={buildPath(mapB)} fill="none" stroke={colorB} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {allDates.map((d, i) => (
          <g key={d}>
            {mapA.has(d) && (
              <>
                <circle cx={xFor(i)} cy={yFor(mapA.get(d) as number)} r="2.5" fill={colorA} />
                <text x={xFor(i)} y={yFor(mapA.get(d) as number) - 7} fontSize="8" fill={colorA} textAnchor="middle" fontFamily="monospace">{mapA.get(d)}{unit}</text>
              </>
            )}
            {mapB.has(d) && (
              <>
                <circle cx={xFor(i)} cy={yFor(mapB.get(d) as number)} r="2.5" fill={colorB} />
                <text x={xFor(i)} y={yFor(mapB.get(d) as number) + 14} fontSize="8" fill={colorB} textAnchor="middle" fontFamily="monospace">{mapB.get(d)}{unit}</text>
              </>
            )}
            {i % step === 0 && (
              <text x={xFor(i)} y={height - 4} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">{d.slice(5)}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

const StatPassFailBadge: React.FC<{ label: string; value?: boolean }> = ({ label, value }) => (
  <div className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2">
    <span className="text-xs text-white/80">{label}</span>
    {value === undefined ? (
      <span className="text-[10px] text-neutral-500">Not tested</span>
    ) : (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${value ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
        {value ? 'PASS' : 'FAIL'}
      </span>
    )}
  </div>
);

// A single row within the Goals list - shows the goal's name (with a
// tick once it's been passed or marked Already Fit) plus its own
// Pass/Fail/Already Fit buttons. Tapping Pass or Already Fit saves
// immediately to the client's own record, since a goal's status is a
// standing fact, not something that should wait for the rest of the
// assessment form to be submitted. Marking Fail keeps the goal in
// the Pending list so it naturally reappears at the next assessment,
// rather than needing to be re-added.
// One individual activity within a category's log form - its own
// value input, Pass/Fail/Fit buttons, and coach observation field.
// Tapping a button only stages the choice locally (highlighted here)
// until the coach saves the whole assessment - protects against an
// accidental tap immediately removing something. Once actually
// saved as Pass or Already Fit, the parent moves this row into a
// "tap to reveal" completed section instead of showing it here.
const ActivityGoalRow: React.FC<{
  label: string;
  status: 'Pending' | 'Pass' | 'AlreadyFit';
  observation: string;
  onObservationChange: (text: string) => void;
  onRecord: (status: 'Pending' | 'Pass' | 'AlreadyFit') => void;
  valueInput?: React.ReactNode;
}> = ({ label, status, observation, onObservationChange, onRecord, valueInput }) => {
  return (
    <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
      <span className="text-xs font-semibold text-white block">{label}</span>
      {valueInput}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onRecord('Pass')}
          className={`py-2 rounded-lg text-xs font-bold border transition ${
            status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A] hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/40'
          }`}
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => onRecord('Pending')}
          className={`py-2 rounded-lg text-xs font-bold border transition ${
            status === 'Pending' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40'
          }`}
        >
          Fail
        </button>
        <button
          type="button"
          onClick={() => onRecord('AlreadyFit')}
          className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
            status === 'AlreadyFit' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A] hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/40'
          }`}
        >
          🎓 Fit
        </button>
      </div>
      {(status === 'Pass' || status === 'AlreadyFit') && (
        <p className="text-[10px] text-amber-300/80">Marked - will move to Statistics once the assessment is saved.</p>
      )}
      <input
        type="text"
        value={observation}
        onChange={(e) => onObservationChange(e.target.value)}
        placeholder="Coach observation (optional)"
        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
      />
    </div>
  );
};

// Collapsible "tap to reveal" section for activities already saved as
// Pass or Already Fit in a previous assessment. Kept accessible (and
// still editable) within the same category, rather than disappearing
// without a trace once saved.
// Combines the "Show to Client" toggle with a category's own save
// button - toggle above, save button below, always at the very
// bottom of that category's template.
const SaveBar: React.FC<{
  label: string;
  notes: string;
  onNotesChange: (text: string) => void;
  milestone: string;
  onMilestoneChange: (text: string) => void;
  clientVisible: boolean;
  onToggleClientVisible: () => void;
  onSave: () => void;
  hideNotes?: boolean;
}> = ({ label, notes, onNotesChange, milestone, onMilestoneChange, clientVisible, onToggleClientVisible, onSave, hideNotes }) => (
  <div className="space-y-3">
    {!hideNotes && (
    <div>
      <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
        Coach Observations & Athletic Summary
      </label>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2.5 text-xs text-white focus:outline-none"
      />
    </div>
    )}

    <div>
      <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
        Next Milestone / Evaluation Goal
      </label>
      <input
        type="text"
        value={milestone}
        onChange={(e) => onMilestoneChange(e.target.value)}
        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2.5 text-xs text-white focus:outline-none"
        placeholder="e.g. Target: Sub-10% Body Fat & 200kg Deadlift"
      />
    </div>

    <div className="flex items-center justify-between bg-[#0A0A0B] rounded-xl p-3 border border-white/[0.08]">
      <div>
        <span className="text-xs font-bold text-white block">Show to Client</span>
        <span className="text-[10px] text-neutral-500">Makes this assessment visible in their app</span>
      </div>
      <button
        type="button"
        onClick={onToggleClientVisible}
        className={`relative w-11 h-6 rounded-full transition ${
          clientVisible ? 'bg-emerald-500' : 'bg-white/[0.1]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${
            clientVisible ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
    <button
      type="button"
      onClick={onSave}
      className="w-full py-3 bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white font-bold text-sm rounded-xl hover:opacity-95 transition"
    >
      {label}
    </button>
  </div>
);

const CompletedActivitiesSection: React.FC<{
  sectionKey: string;
  items: { key: string; label: string; status: 'Pass' | 'AlreadyFit'; observation: string }[];
  expanded: boolean;
  onToggle: () => void;
  onObservationChange: (activityKey: string, text: string) => void;
  onRecord: (activityKey: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => void;
}> = ({ items, expanded, onToggle, onObservationChange, onRecord }) => {
  if (items.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="text-[10px] font-bold text-neutral-400 hover:text-white flex items-center gap-1"
      >
        {expanded ? '▾' : '▸'} Tap to reveal {items.length} completed {items.length === 1 ? 'activity' : 'activities'}
      </button>
      {expanded && (
        <div className="space-y-2 mt-2">
          {items.map((item) => (
            <ActivityGoalRow
              key={item.key}
              label={item.label}
              status={item.status}
              observation={item.observation}
              onObservationChange={(text) => onObservationChange(item.key, text)}
              onRecord={(status) => onRecord(item.key, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
};


export const CoachAssessmentWorkspace: React.FC<CoachAssessmentWorkspaceProps> = ({
  currentCoachName,
  preSelectedClientId,
}) => {
  const {
    assessmentRecords,
    addAssessmentRecord,
    deleteAssessmentRecord,
    clientMasterRecords,
    upsertClientGoal,
    upsertMultipleClientGoals,
    addCustomClientGoal,
    clearClientCategoryData,
    getClientPrq,
  } = usePrimeStore();

  // Helper for coach assignment
  const isClientAssignedToCoach = (coachNameOrRole?: string, filterCoach?: string) => {
    if (!coachNameOrRole || !filterCoach) return true;
    const c1 = coachNameOrRole.toLowerCase();
    const c2 = filterCoach.toLowerCase();
    return c1.includes(c2) || c2.includes(c1);
  };

  const myAssignedClients = useMemo(() => {
    return clientMasterRecords.filter((c) =>
      isClientAssignedToCoach(c.assignedCoach, currentCoachName)
    );
  }, [clientMasterRecords, currentCoachName]);

  const [showPrqReport, setShowPrqReport] = useState(false);

  // Selected client for graphs & assessment
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return preSelectedClientId || myAssignedClients[0]?.id || clientMasterRecords[0]?.id || 'CLI-101';
  });

  // Keep selectedClientId valid if coach changes
  const activeClient = useMemo(() => {
    return (
      clientMasterRecords.find((c) => c.id === selectedClientId) ||
      myAssignedClients[0] ||
      clientMasterRecords[0]
    );
  }, [clientMasterRecords, myAssignedClients, selectedClientId]);

  // Assessments for active client (sorted chronologically for graphs)
  const clientAssessments = useMemo(() => {
    if (!activeClient) return [];
    return assessmentRecords
      .filter(
        (a) =>
          a.clientId === activeClient.id ||
          a.clientName.toLowerCase() === activeClient.name.toLowerCase()
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [assessmentRecords, activeClient]);

  // Latest assessment record
  const latestAssessment: AssessmentRecord | undefined = clientAssessments[clientAssessments.length - 1];
  const baselineAssessment: AssessmentRecord | undefined = clientAssessments[0];

  // Each "Save" button creates a brand new AssessmentRecord containing
  // only that category's fields - so `latestAssessment` (the single
  // most recent record overall) can easily belong to a *different*
  // category and simply not have this field at all, even though it
  // was genuinely saved correctly in an earlier record. This searches
  // backward for the most recent record that actually has a value for
  // the specific field being displayed, rather than assuming the
  // single latest record covers every category.
  const getLatestFieldValue = <K extends keyof AssessmentRecord>(fieldKey: K): AssessmentRecord[K] | undefined => {
    for (let i = clientAssessments.length - 1; i >= 0; i--) {
      const value = clientAssessments[i][fieldKey];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  };

  // Builds a chronological { date, value } series for a custom
  // activity's score history, so any coach-added activity (not just
  // the fixed standard tests) can be graphed the same way.
  const getCustomActivityHistory = (activityName: string): { date: string; value: number }[] =>
    clientAssessments
      .filter((a) => a.customActivityScores?.[activityName] != null)
      .map((a) => ({ date: a.date, value: a.customActivityScores![activityName] }));

  // BCA Calculator - current/normal/goal for weight, body fat, muscle
  // mass, BMI, and visceral fat. "Current" prefers a real logged BCA
  // scan over the client's self-reported PRQ numbers, since a scan is
  // the more accurate source once one exists. "Normal" uses standard
  // medical reference ranges based on the client's height and sex.
  // "Goal" auto-suggests toward the healthy range in the direction the
  // client actually said they want to move, but stays fully editable.
  const [bcaCurrentOverrides, setBcaCurrentOverrides] = useState<Record<string, number>>({});
  const [bcaNormalOverrides, setBcaNormalOverrides] = useState<Record<string, string>>({});
  const [bcaGoalOverrides, setBcaGoalOverrides] = useState<Record<string, number>>({});
  const bcaTable = useMemo(() => {
    const prq = getClientPrq(selectedClientId);
    const heightCm = prq?.heightCm || undefined;
    const heightM = heightCm ? heightCm / 100 : undefined;
    const sex = prq?.sex;
    const direction = prq?.weightGoalDirection || 'Maintain weight';

    const currentWeight = getLatestFieldValue('weightKg') ?? prq?.weightKg;
    const currentBodyFatPercent = getLatestFieldValue('bodyFatPercentage') ?? prq?.fatMassKg;
    const currentMuscleMass = getLatestFieldValue('muscleMassKg') ?? prq?.skeletalMuscleMassKg;
    const currentVisceralFat = getLatestFieldValue('visceralFatLevel');
    const currentBmi = heightM && currentWeight ? currentWeight / (heightM * heightM) : prq?.bmi;

    const normalWeightRange = heightM ? { min: Math.round(18.5 * heightM * heightM), max: Math.round(24.9 * heightM * heightM) } : null;
    const normalBmiRange = { min: 18.5, max: 24.9 };
    const normalBodyFatRange = sex === 'Female' ? { min: 21, max: 33 } : { min: 8, max: 20 };
    const normalVisceralFatRange = { min: 1, max: 9 };

    const suggestGoal = (current: number | undefined, min: number, max: number): number | undefined => {
      if (current === undefined) return undefined;
      if (direction === 'Lose weight') return current > max ? Math.round(max) : current;
      if (direction === 'Gain weight') return current < min ? Math.round(min) : current;
      if (current > max) return Math.round(max);
      if (current < min) return Math.round(min);
      return current;
    };

    const rows = [
      {
        key: 'weight',
        label: 'Body Weight',
        unit: 'kg',
        current: currentWeight,
        normal: normalWeightRange ? `${normalWeightRange.min}-${normalWeightRange.max}` : 'Needs height',
        suggestedGoal: normalWeightRange ? suggestGoal(currentWeight, normalWeightRange.min, normalWeightRange.max) : undefined,
      },
      {
        key: 'bodyFat',
        label: 'Body Fat',
        unit: '%',
        current: currentBodyFatPercent,
        normal: `${normalBodyFatRange.min}-${normalBodyFatRange.max}`,
        suggestedGoal: suggestGoal(currentBodyFatPercent, normalBodyFatRange.min, normalBodyFatRange.max),
      },
      {
        key: 'muscleMass',
        label: 'Muscle Mass',
        unit: 'kg',
        current: currentMuscleMass,
        normal: 'Varies by build',
        suggestedGoal: currentMuscleMass,
      },
      {
        key: 'bmi',
        label: 'BMI',
        unit: '',
        current: currentBmi ? Number(currentBmi.toFixed(1)) : undefined,
        normal: `${normalBmiRange.min}-${normalBmiRange.max}`,
        suggestedGoal: suggestGoal(currentBmi, normalBmiRange.min, normalBmiRange.max),
      },
      {
        key: 'visceralFat',
        label: 'Visceral Fat',
        unit: '',
        current: currentVisceralFat,
        normal: `${normalVisceralFatRange.min}-${normalVisceralFatRange.max}`,
        suggestedGoal: suggestGoal(currentVisceralFat, normalVisceralFatRange.min, normalVisceralFatRange.max),
      },
    ];

    return rows.map((r) => ({
      ...r,
      current: bcaCurrentOverrides[r.key] ?? r.current,
      normal: bcaNormalOverrides[r.key] ?? r.normal,
      goal: bcaGoalOverrides[r.key] ?? r.suggestedGoal,
    }));
  }, [selectedClientId, latestAssessment, getClientPrq, bcaCurrentOverrides, bcaNormalOverrides, bcaGoalOverrides]);

  // Assessment Entry Mode / Modal Tabs
  const [assessmentAreaView, setAssessmentAreaView] = useState<'hub' | 'statistics' | 'log'>('hub');
  const [statsSubCard, setStatsSubCard] = useState<string | null>(null);
  const [logSubCard, setLogSubCard] = useState<string | null>(null);

  // Form States
  const [assDate, setAssDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [assVo2, setAssVo2] = useState<string>('59.5');

  // Card 3: Static Balance Test - Unipedal Stance Test
  const [assUnipedalLeft, setAssUnipedalLeft] = useState<string>('');
  const [assUnipedalRight, setAssUnipedalRight] = useState<string>('');

  // Card 4: Torso Muscular Endurance - McGill's Torso Test
  const [assMcgillFlexor, setAssMcgillFlexor] = useState<string>('');
  const [assMcgillExtensor, setAssMcgillExtensor] = useState<string>('');
  const [assMcgillRightBridge, setAssMcgillRightBridge] = useState<string>('');
  const [assMcgillLeftBridge, setAssMcgillLeftBridge] = useState<string>('');
  const [assMcgillFlexorExtensorRatio, setAssMcgillFlexorExtensorRatio] = useState<string>('');
  const [assMcgillRightLeftSideRatio, setAssMcgillRightLeftSideRatio] = useState<string>('');
  const [assMcgillRightToExtensorRatio, setAssMcgillRightToExtensorRatio] = useState<string>('');
  const [assMcgillLeftToExtensorRatio, setAssMcgillLeftToExtensorRatio] = useState<string>('');

  // Card 5: Flexibility Test (pass/fail)
  const [assThomasPass, setAssThomasPass] = useState<boolean | null>(null);
  const [assSlrPass, setAssSlrPass] = useState<boolean | null>(null);
  const [assShoulderFlexionPass, setAssShoulderFlexionPass] = useState<boolean | null>(null);
  const [assShoulderExtensionPass, setAssShoulderExtensionPass] = useState<boolean | null>(null);

  // Card 6 additions: Movement Test (pass/fail activities)
  const [assBendLiftPass, setAssBendLiftPass] = useState<boolean | null>(null);
  const [assSingleLegStepUpPass, setAssSingleLegStepUpPass] = useState<boolean | null>(null);
  const [assShoulderPushPass, setAssShoulderPushPass] = useState<boolean | null>(null);
  const [assPullStabilityPass, setAssPullStabilityPass] = useState<boolean | null>(null);
  const [assThoracicMobilityPass, setAssThoracicMobilityPass] = useState<boolean | null>(null);
  const [assOverheadSquatPass, setAssOverheadSquatPass] = useState<boolean | null>(null);
  const [newGoalNameInput, setNewGoalNameInput] = useState('');
  const [newGoalValueType, setNewGoalValueType] = useState<'distance_km' | 'duration_minutes' | 'steps'>('distance_km');
  const [newGoalIsUnilateral, setNewGoalIsUnilateral] = useState<boolean>(true);
  const [customValueDrafts, setCustomValueDrafts] = useState<Record<string, string>>({});
  const [customCircuitDrafts, setCustomCircuitDrafts] = useState<Record<string, CircuitRound[]>>({});
  const [assThomasScore, setAssThomasScore] = useState('');
  const [assSlrScore, setAssSlrScore] = useState('');
  const [assShoulderFlexionScore, setAssShoulderFlexionScore] = useState('');
  const [assShoulderExtensionScore, setAssShoulderExtensionScore] = useState('');
  const [assBendLiftScore, setAssBendLiftScore] = useState('');
  const [assSingleLegStepUpScore, setAssSingleLegStepUpScore] = useState('');
  const [assShoulderPushScore, setAssShoulderPushScore] = useState('');
  const [assPullStabilityScore, setAssPullStabilityScore] = useState('');
  const [assThoracicMobilityScore, setAssThoracicMobilityScore] = useState('');
  const [assOverheadSquatScore, setAssOverheadSquatScore] = useState('');
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});
  const [pendingGoalStatuses, setPendingGoalStatuses] = useState<Record<string, 'Pending' | 'Pass' | 'AlreadyFit'>>({});
  const [expandedCompletedSections, setExpandedCompletedSections] = useState<Record<string, boolean>>({});

  // Card 8: Muscular Endurance Test
  const [assPushUpsReps, setAssPushUpsReps] = useState<string>('');
  const [assBodyweightSquatsReps, setAssBodyweightSquatsReps] = useState<string>('');

  // Card 11: Speed, Agility & Quickness - T Test
  const [assTTestSeconds, setAssTTestSeconds] = useState<string>('');

  const [assRestingHr, setAssRestingHr] = useState<string>('50');
  const [assBpSystolic, setAssBpSystolic] = useState<string>('120');
  const [assBpDiastolic, setAssBpDiastolic] = useState<string>('78');

  // Girths (cm)
  const [girthChest, setGirthChest] = useState<string>('108');
  const [girthWaist, setGirthWaist] = useState<string>('82');
  const [girthHips, setGirthHips] = useState<string>('100');
  const [girthLeftArm, setGirthLeftArm] = useState<string>('38');
  const [girthRightArm, setGirthRightArm] = useState<string>('38.5');
  const [girthLeftThigh, setGirthLeftThigh] = useState<string>('59');
  const [girthRightThigh, setGirthRightThigh] = useState<string>('59');
  const [girthLeftCalf, setGirthLeftCalf] = useState<string>('38');
  const [girthRightCalf, setGirthRightCalf] = useState<string>('38');

  // Strength & 1RMs
  const [bench1RM, setBench1RM] = useState<string>('120');
  const [squat1RM, setSquat1RM] = useState<string>('155');
  const [deadlift1RM, setDeadlift1RM] = useState<string>('190');
  const [ohp1RM, setOhp1RM] = useState<string>('77.5');
  const [pullUpsMax, setPullUpsMax] = useState<string>('22');
  const [powerWatts, setPowerWatts] = useState<string>('700');
  const [vertJumpCm, setVertJumpCm] = useState<string>('67');

  // Posture & Mobility
  const [aerobicScore, setAerobicScore] = useState<number>(92);
  const [deficiencyInput, setDeficiencyInput] = useState<string>('');

  // Skill Assessment State (Within full assessment form)
  const [skillsList, setSkillsList] = useState<SkillProgressItem[]>([]);

  // Sync skillsList from the newly-selected client's real, existing
  // skill data whenever the coach switches clients - without this,
  // the form state never resets and a coach could easily save one
  // client's in-progress skill edits onto a completely different
  // client's assessment.
  useEffect(() => {
    setSkillsList(getLatestFieldValue('skillProgressions') || []);
  }, [selectedClientId]);

  // Observation drafts for per-activity goal rows - synced from the
  // selected client's real, existing goal observations, same
  // protective pattern as above, so drafts never leak between clients.
  useEffect(() => {
    const drafts: Record<string, string> = {};
    (activeClient?.goals || []).forEach((g) => {
      drafts[g.activityName] = g.observation || '';
    });
    setObservationDrafts(drafts);
  }, [selectedClientId]);

  // Custom activity value drafts - same protective pattern, so a
  // value typed for one client's custom activity never leaks into
  // another client's.
  useEffect(() => {
    const drafts: Record<string, string> = {};
    (activeClient?.goals || []).forEach((g) => {
      if (g.value) drafts[g.activityName] = g.value;
    });
    setCustomValueDrafts(drafts);
  }, [selectedClientId]);

  // Circuit round drafts - same protective pattern.
  useEffect(() => {
    const drafts: Record<string, CircuitRound[]> = {};
    (activeClient?.goals || []).forEach((g) => {
      if (g.circuitRounds && g.circuitRounds.length > 0) drafts[g.activityName] = g.circuitRounds;
    });
    setCustomCircuitDrafts(drafts);
  }, [selectedClientId]);

  // Pending (unsaved) Pass/Fail/Fit selections - reset whenever the
  // client changes or a fresh assessment is saved, so a coach's
  // in-progress taps never leak between clients or across saves.
  useEffect(() => {
    setPendingGoalStatuses({});
  }, [selectedClientId]);

  // Movement & Posture Issues State (Within full assessment form) -
  // synced from the selected client's real data, same as skillsList.
  const [movementIssuesList, setMovementIssuesList] = useState<MovementPostureIssue[]>([]);
  useEffect(() => {
    setMovementIssuesList(getLatestFieldValue('movementPostureIssues') || []);
  }, [selectedClientId]);

  const [newIssueName, setNewIssueName] = useState('');
  const [newIssueProgress, setNewIssueProgress] = useState('0');
  const [newIssueBeforePhoto, setNewIssueBeforePhoto] = useState('');
  const [newIssueAfterPhoto, setNewIssueAfterPhoto] = useState('');
  const [newIssueBeforeVideo, setNewIssueBeforeVideo] = useState('');
  const [newIssueAfterVideo, setNewIssueAfterVideo] = useState('');
  const [newIssueNotes, setNewIssueNotes] = useState('');
  const [uploadingIssuePhoto, setUploadingIssuePhoto] = useState<'before' | 'after' | null>(null);

  const handleAddMovementIssue = (forcedType: 'Posture' | 'Movement') => {
    if (!newIssueName.trim()) return;
    const item: MovementPostureIssue = {
      id: `mpi-${Date.now()}`,
      issueName: newIssueName.trim(),
      issueType: forcedType,
      progressPercentage: Number(newIssueProgress) || 0,
      beforePhotoBase64: forcedType === 'Posture' ? (newIssueBeforePhoto || undefined) : undefined,
      afterPhotoBase64: forcedType === 'Posture' ? (newIssueAfterPhoto || undefined) : undefined,
      beforeVideoUrl: forcedType === 'Movement' ? (newIssueBeforeVideo.trim() || undefined) : undefined,
      afterVideoUrl: forcedType === 'Movement' ? (newIssueAfterVideo.trim() || undefined) : undefined,
      notes: newIssueNotes.trim() || undefined,
    };
    setMovementIssuesList((prev) => [...prev, item]);
    setNewIssueName('');
    setNewIssueProgress('0');
    setNewIssueBeforePhoto('');
    setNewIssueAfterPhoto('');
    setNewIssueBeforeVideo('');
    setNewIssueAfterVideo('');
    setNewIssueNotes('');
  };

  const handleRemoveMovementIssue = (id: string) => {
    setMovementIssuesList((prev) => prev.filter((i) => i.id !== id));
  };

  const [newSkillName, setNewSkillName] = useState<string>('');
  // Empty string means this is a new top-level skill. Any other value
  // is the name of an existing skill this becomes a progression step
  // under - e.g. adding "Negative Straight Bar Dips" under "Muscle Up".
  const [newSkillParent, setNewSkillParent] = useState<string>('');

  const [assNotesByCategory, setAssNotesByCategory] = useState<Record<string, string>>({});
  const [assMilestoneByCategory, setAssMilestoneByCategory] = useState<Record<string, string>>({});
  const [assClientVisible, setAssClientVisible] = useState<boolean>(false);
  const [assSuccessMsg, setAssSuccessMsg] = useState(false);
  const [assErrorMsg, setAssErrorMsg] = useState<string | null>(null);

  // Expanded History Card ID
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Compute Delta Changes
  const weightDelta = useMemo(() => {
    if (!baselineAssessment || clientAssessments.length < 2) return null;
    const latestWeight = getLatestFieldValue('weightKg');
    if (latestWeight == null || baselineAssessment.weightKg == null) return null;
    const diff = latestWeight - baselineAssessment.weightKg;
    return diff;
  }, [baselineAssessment, clientAssessments]);

  const bodyFatDelta = useMemo(() => {
    if (!baselineAssessment || clientAssessments.length < 2) return null;
    const latestBodyFat = getLatestFieldValue('bodyFatPercentage');
    if (latestBodyFat == null || baselineAssessment.bodyFatPercentage == null) return null;
    const diff = latestBodyFat - baselineAssessment.bodyFatPercentage;
    return diff;
  }, [baselineAssessment, clientAssessments]);

  const vo2Delta = useMemo(() => {
    if (!baselineAssessment || clientAssessments.length < 2) return null;
    const latestVo2 = getLatestFieldValue('vo2Max');
    if (latestVo2 == null || baselineAssessment.vo2Max == null) return null;
    const diff = latestVo2 - baselineAssessment.vo2Max;
    return diff;
  }, [baselineAssessment, clientAssessments]);

  // Prepare Data for Recharts
  const chartData = useMemo(() => {
    return clientAssessments.map((a, idx) => ({
      date: a.date.slice(5), // MM-DD
      fullDate: a.date,
      index: idx + 1,
      weight: a.weightKg,
      bodyFat: a.bodyFatPercentage,
      vo2Max: a.vo2Max,
      muscleMass: a.muscleMassKg || (a.weightKg != null && a.bodyFatPercentage != null ? (a.weightKg * (1 - a.bodyFatPercentage / 100)).toFixed(1) : undefined),
      benchPress: a.benchPress1RM || 0,
      squat: a.squat1RM || 0,
      deadlift: a.deadlift1RM || 0,
      restingHr: a.restingHeartRateBpm || 55,
      coach: a.coachName || a.assessedBy || 'Staff',
    }));
  }, [clientAssessments]);

  // Aggregate active client's skill progression deck

  // Add Skill to in-progress list
  const handleAddSkillToForm = () => {
    if (!newSkillName.trim()) return;
    const fullName = newSkillParent.trim() ? `${newSkillParent.trim()} > ${newSkillName.trim()}` : newSkillName.trim();
    const item: SkillProgressItem = {
      id: `sk-${Date.now()}`,
      skillName: fullName,
    };
    setSkillsList((prev) => [...prev, item]);
    setNewSkillName('');
    setNewSkillParent('');
  };


  // Submit complete Trainerize Assessment Record

  // Saves just one category's data as its own assessment record, so a
  // coach can log "only BCA and Posture today" without needing every
  // other category filled in. Only flushes pending goal statuses that
  // belong to this specific category, leaving other categories'
  // in-progress (unsaved) selections untouched.
  const handleSaveCategory = async (fields: Partial<AssessmentRecord>, goalPrefixes: string[]) => {
    if (!activeClient) return;
    const newId = `ASS-${Math.floor(100 + Math.random() * 900)}`;

    const relevantGoalEntries = Object.entries(pendingGoalStatuses).filter(
      ([activityName]) => goalPrefixes.some((prefix) => activityName === prefix || activityName.startsWith(`${prefix}:`))
    );
    // Preserves a numeric value from any activity being saved right
    // now - even one that isn't part of the fixed standard fields -
    // as a proper historical data point, so custom/added activities
    // can be graphed over time the same way the standard tests are.
    // Scans every customValueDrafts key matching this category, not
    // just ones with a pending status change - a coach can type a
    // score for an activity without tapping Pass/Fail/Already Fit,
    // and that score should still be saved.
    const customActivityScores: Record<string, number> = {};
    Object.keys(customValueDrafts).forEach((activityName) => {
      if (activityName.endsWith('::left') || activityName.endsWith('::right')) return;
      if (!goalPrefixes.some((prefix) => activityName === prefix || activityName.startsWith(`${prefix}:`))) return;
      const raw = customValueDrafts[activityName];
      const num = raw !== undefined ? Number(raw) : NaN;
      if (!isNaN(num)) customActivityScores[activityName] = num;
    });

    const newRecord: Omit<AssessmentRecord, 'id'> & { id: string } = {
      id: newId,
      clientId: activeClient.id,
      clientName: activeClient.name,
      date: assDate,
      coachName: currentCoachName,
      assessedBy: currentCoachName,
      clientVisible: assClientVisible,
      notes: (assNotesByCategory[goalPrefixes[0]] || '').trim() || undefined,
      targetMilestone: (assMilestoneByCategory[goalPrefixes[0]] || '').trim() || undefined,
      category: goalPrefixes[0],
      customActivityScores: Object.keys(customActivityScores).length > 0 ? customActivityScores : undefined,
      ...fields,
    };

    // Also covers activities where the coach typed a score but never
    // tapped Pass/Fail/Already Fit - without this, GoalEntry.value
    // (used for "current value" displays like Skills' reps) would
    // never update even though customActivityScores now correctly
    // saves the historical point.
    // Checks each of the client's actual goal names (not just
    // customValueDrafts keys directly) for a typed value - a
    // unilateral activity (left/right) never has its plain name as a
    // customValueDrafts key, only the ::left/::right suffixed
    // versions, so scanning keys directly would miss it entirely.
    const valueOnlyActivityNames = (activeClient.goals || [])
      .map((g) => g.activityName)
      .filter((activityName) => {
        if (activityName in pendingGoalStatuses) return false;
        if (!goalPrefixes.some((prefix) => activityName === prefix || activityName.startsWith(`${prefix}:`))) return false;
        const hasPlainValue = customValueDrafts[activityName] !== undefined;
        const hasLeftOrRight = customValueDrafts[`${activityName}::left`] !== undefined || customValueDrafts[`${activityName}::right`] !== undefined;
        return hasPlainValue || hasLeftOrRight;
      });
    // Movement's 6 standard tests keep their scores in dedicated state
    // variables (not customValueDrafts, and not necessarily tied to an
    // existing goal entry for a never-before-scored test), so they need
    // their own check here to ensure typing a score alone still creates
    // or updates their goal entry - without this, a brand-new standard
    // test would never get a GoalEntry at all until a status was tapped.
    const movementStandardTestScores: Record<string, string> = {
      'Movement: Bend & Lift Squat Pattern': assBendLiftScore,
      'Movement: Single Leg Step Up': assSingleLegStepUpScore,
      'Movement: Shoulder Push Stabilization': assShoulderPushScore,
      'Movement: Pull Stability Standing Row': assPullStabilityScore,
      'Movement: Thoracic Spine Mobility': assThoracicMobilityScore,
      'Movement: Overhead Squat Test': assOverheadSquatScore,
    };
    const movementValueOnlyNames = goalPrefixes.includes('Movement')
      ? Object.keys(movementStandardTestScores).filter((name) => {
          if (name in pendingGoalStatuses) return false;
          if (valueOnlyActivityNames.includes(name)) return false;
          return movementStandardTestScores[name].trim() !== '';
        })
      : [];
    const allRelevantEntries: [string, 'Pending' | 'Pass' | 'AlreadyFit'][] = [
      ...(relevantGoalEntries as [string, 'Pending' | 'Pass' | 'AlreadyFit'][]),
      ...valueOnlyActivityNames.map((name): [string, 'Pending' | 'Pass' | 'AlreadyFit'] => [
        name,
        (activeClient.goals?.find((g) => g.activityName === name)?.status || 'Pending'),
      ]),
      ...movementValueOnlyNames.map((name): [string, 'Pending' | 'Pass' | 'AlreadyFit'] => [
        name,
        (activeClient.goals?.find((g) => g.activityName === name)?.status || 'Pending'),
      ]),
    ];

    setAssErrorMsg(null);
    const assessmentSaved = await addAssessmentRecord(newRecord);

    // Batched into one atomic update rather than one upsertClientGoal
    // call per activity - calling it repeatedly for the same client
    // in parallel meant each call read the same stale snapshot and
    // silently overwrote whichever other activity's change landed
    // first, which was why a Pass mark could vanish on save.
    const goalUpdateSucceeded = allRelevantEntries.length === 0
      ? true
      : await upsertMultipleClientGoals(
          activeClient.id,
          allRelevantEntries.map(([activityName, status]) => ({
            activityName,
            status,
            observation: observationDrafts[activityName] || '',
            sourceAssessmentId: newId,
            value: customValueDrafts[activityName] !== undefined ? customValueDrafts[activityName] : movementStandardTestScores[activityName],
            valueLeft: customValueDrafts[`${activityName}::left`],
            valueRight: customValueDrafts[`${activityName}::right`],
            circuitRounds: customCircuitDrafts[activityName],
          }))
        );

    // Only clear the pending marks and show success once every write
    // actually reached Firestore - clearing them optimistically would
    // silently drop a coach's Pass/Fit marks if the save failed.
    const allSucceeded = assessmentSaved && goalUpdateSucceeded;

    if (allSucceeded) {
      setPendingGoalStatuses((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((name) => {
          if (goalPrefixes.some((prefix) => name === prefix || name.startsWith(`${prefix}:`))) {
            delete next[name];
          }
        });
        return next;
      });
      setAssNotesByCategory((prev) => ({ ...prev, [goalPrefixes[0]]: '' }));
      setAssMilestoneByCategory((prev) => ({ ...prev, [goalPrefixes[0]]: '' }));
      setAssSuccessMsg(true);
      setTimeout(() => setAssSuccessMsg(false), 4000);
    } else {
      setAssErrorMsg('This did not save - please check your connection and try again. Your Pass/Fit marks are still here, unsaved.');
    }
  };

  // Helper for VO2 rating
  const getVo2Rating = (vo2: number) => {
    if (vo2 >= 58) return { label: 'Superior / Elite', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    if (vo2 >= 50) return { label: 'Excellent', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (vo2 >= 42) return { label: 'Good', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { label: 'Fair / Developing', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  };

  return (
    <div className="space-y-4">
      {/* HEADER & CLIENT SELECTOR BANNER */}
      <div className="bg-[#14161f] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-[#6ccbde]/15 text-[#6ccbde] border border-[#6ccbde]/30 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 text-[#6ccbde]" /> Physical Assessments
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {assessmentRecords.length} Records
              </span>
            </div>
          </div>
        </div>

        {/* CLIENT SELECTOR CHIPS & ACTIVE CLIENT OVERVIEW */}
        {!preSelectedClientId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#6ccbde]" /> Select Client:
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">
              {clientAssessments.length} logs recorded
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {clientMasterRecords.map((c) => {
              const isSelected = c.id === selectedClientId;
              const isMyClient = isClientAssignedToCoach(c.assignedCoach, currentCoachName);
              const count = assessmentRecords.filter(
                (a) => a.clientId === c.id || a.clientName.toLowerCase() === c.name.toLowerCase()
              ).length;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-white/[0.03] text-neutral-400 hover:text-white border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                      isSelected
                        ? 'bg-[#6ccbde] text-black'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {c.name.split(' ')[0]?.[0] || 'C'}
                  </div>
                  <span>{c.name}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-cyan-500/30 text-cyan-200'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {isMyClient && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Assigned to you" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {assSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Assessment successfully logged and graphs updated!</span>
          </div>
        )}

        {assErrorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{assErrorMsg}</span>
          </div>
        )}
      </div>



      {/* ASSESSMENT AREA - Statistics & Log Assessment */}
      <div className="bg-[#14161f] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm relative">
          {/* AREA HUB - Statistics vs Log Assessment */}
          {assessmentAreaView === 'hub' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowPrqReport(true)}
                className="w-full bg-[#101012] border border-[#242428] hover:border-emerald-500/40 rounded-2xl p-6 text-left transition space-y-2"
                style={{ background: 'linear-gradient(160deg, rgba(16,185,129,0.14), #101012 60%)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Health Screening Report</h3>
                <p className="text-xs text-neutral-400">The client's completed PRQ from the Client App.</p>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setAssessmentAreaView('statistics');
                  setStatsSubCard(null);
                }}
                className="bg-[#101012] border border-[#242428] hover:border-[#6ccbde]/40 rounded-2xl p-6 text-left transition space-y-2"
                style={{ background: 'linear-gradient(160deg, rgba(108,203,222,0.14), #101012 55%, rgba(236,34,38,0.1))' }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#6ccbde]/10 border border-[#6ccbde]/20 flex items-center justify-center text-[#6ccbde]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Statistics</h3>
                <p className="text-xs text-neutral-400">Graphs and progress across all phases.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssessmentAreaView('log');
                  setLogSubCard(null);
                }}
                className="bg-[#101012] border border-[#242428] hover:border-[#ec2226]/40 rounded-2xl p-6 text-left transition space-y-2"
                style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.14), #101012 55%, rgba(108,203,222,0.1))' }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#ec2226]/10 border border-[#ec2226]/20 flex items-center justify-center text-[#ec2226]">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Log Assessment</h3>
                <p className="text-xs text-neutral-400">Record new test results for this client.</p>
              </button>
              </div>
            </div>
          )}

          {assessmentAreaView !== 'hub' && (
            <>
              <button
                type="button"
                onClick={() => setAssessmentAreaView('hub')}
                className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1"
              >
                ← Back to Assessment
              </button>

              {assessmentAreaView === 'statistics' && statsSubCard === null && (() => {
                const clientGoals = activeClient?.goals || [];
                const hasAssessmentData = (fields: (keyof AssessmentRecord)[]) =>
                  clientAssessments.some((a) => fields.some((f) => a[f] != null));
                const optionalCategories = [
                  { key: 'muscular_endurance', label: 'Muscular Endurance', prefix: 'Muscular Endurance:', fields: ['pushUpsReps', 'pullUpMaxReps', 'bodyweightSquatsReps'] as (keyof AssessmentRecord)[] },
                  { key: 'muscular_strength', label: 'Muscular Strength', prefix: 'Muscular Strength:', fields: ['benchPress1RM', 'squat1RM', 'deadlift1RM', 'overheadPress1RM'] as (keyof AssessmentRecord)[] },
                  { key: 'saq', label: 'SAQ', prefix: 'SAQ:', fields: ['tTestSeconds'] as (keyof AssessmentRecord)[] },
                  { key: 'skills', label: 'Skills', prefix: 'Skills:', fields: ['skillProgressions'] as (keyof AssessmentRecord)[] },
                  { key: 'power', label: 'Power', prefix: 'Power:', fields: ['verticalJumpCm'] as (keyof AssessmentRecord)[] },
                ];
                const isEnabled = (c: typeof optionalCategories[number]) =>
                  clientGoals.some((g) => g.activityName.startsWith(c.prefix)) || hasAssessmentData(c.fields);
                const enabledOptional = optionalCategories.filter(isEnabled);
                const notYetEnabled = optionalCategories.filter((c) => !isEnabled(c));
                const showOptionalPicker = !!expandedCompletedSections['statistics_optional_picker'];

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'bca', label: 'BCA' },
                        { key: 'posture', label: 'Posture' },
                        { key: 'flex_mobility', label: 'Flexibility & Mobility' },
                        { key: 'balance', label: 'Balance' },
                        { key: 'core_endurance', label: 'Core Endurance & Stability' },
                        { key: 'movement', label: 'Movement' },
                        { key: 'cardio', label: 'Cardio' },
                        ...enabledOptional,
                        { key: 'achievements', label: 'Achievements' },
                        { key: 'already_fit', label: 'Already Fit' },
                      ].map((card) => (
                        <button
                          key={card.key}
                          type="button"
                          onClick={() => setStatsSubCard(card.key)}
                          className="bg-[#101012] border border-[#242428] hover:border-[#6ccbde]/40 rounded-2xl p-4 text-left transition"
                        >
                          <h4 className="text-xs font-bold text-white">{card.label}</h4>
                        </button>
                      ))}
                    </div>

                    {notYetEnabled.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, statistics_optional_picker: !prev['statistics_optional_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showOptionalPicker ? '▾' : '▸'} Tap to reveal {notYetEnabled.length} more {notYetEnabled.length === 1 ? 'assessment' : 'assessments'}
                        </button>
                        {showOptionalPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {notYetEnabled.map((c) => (
                              <button
                                key={c.key}
                                type="button"
                                onClick={() => setStatsSubCard(c.key)}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {assessmentAreaView === 'statistics' && statsSubCard !== null && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setStatsSubCard(null)} className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1">
                    ← Back
                  </button>

                  {statsSubCard === 'bca' && (
                    <div className="space-y-4">
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl overflow-hidden">
                        <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-white/[0.03] text-[10px] font-bold text-neutral-500 uppercase">
                          <span>Metric</span>
                          <span className="text-center">Current</span>
                          <span className="text-center">Normal</span>
                          <span className="text-center">Goal</span>
                        </div>
                        {bcaTable.map((row) => (
                          <div key={row.key} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-t border-white/[0.04] items-center">
                            <span className="text-xs font-bold text-white">{row.label}</span>
                            <span className="text-xs text-center font-mono text-neutral-300">
                              {row.current !== undefined ? `${row.current}${row.unit}` : '—'}
                            </span>
                            <span className="text-xs text-center font-mono text-emerald-400">{row.normal}</span>
                            <span className="text-xs text-center font-mono text-[#6ccbde]">
                              {row.goal !== undefined ? `${row.goal}${row.unit}` : '—'}
                            </span>
                          </div>
                        ))}
                        <p className="text-[10px] text-neutral-500 px-4 py-2 border-t border-white/[0.04]">
                          Read-only view. To edit these values, go to Log Assessment.
                        </p>
                      </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(() => {
                        // Syncs each chart's most recent point to the
                        // table's actual Current value (including any
                        // manual override), so the graph always agrees
                        // with what the table shows rather than only
                        // reflecting raw historical assessment records.
                        const syncLatest = (history: { date: string; value: number | undefined }[], tableKey: string) => {
                          const currentValue = bcaTable.find((r) => r.key === tableKey)?.current;
                          const filtered = history.filter((h) => h.value != null) as { date: string; value: number }[];
                          if (currentValue === undefined) return filtered;
                          const today = new Date().toISOString().split('T')[0];
                          const withoutLast = filtered.length > 0 ? filtered.slice(0, -1) : [];
                          return [...withoutLast, { date: filtered[filtered.length - 1]?.date || today, value: currentValue }];
                        };

                        const weightHistory = syncLatest(clientAssessments.map((a) => ({ date: a.date, value: a.weightKg })), 'weight');
                        const bodyFatHistory = syncLatest(clientAssessments.map((a) => ({ date: a.date, value: a.bodyFatPercentage })), 'bodyFat');
                        const muscleMassHistory = syncLatest(clientAssessments.map((a) => ({ date: a.date, value: a.muscleMassKg })), 'muscleMass');
                        const visceralFatHistory = syncLatest(clientAssessments.map((a) => ({ date: a.date, value: a.visceralFatLevel })), 'visceralFat');

                        return (
                          <>
                            <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Weight</span>
                              <StatMiniChart data={weightHistory} color="#ec2226" unit="kg" />
                            </div>
                            <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Body Fat</span>
                              <StatMiniChart data={bodyFatHistory} color="#f59e0b" unit="%" />
                            </div>
                            <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Muscle Mass</span>
                              <StatMiniChart data={muscleMassHistory} color="#6ccbde" unit="kg" />
                            </div>
                            <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Visceral Fat</span>
                              <StatMiniChart data={visceralFatHistory} color="#a78bfa" unit="" />
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-bold text-white">Circumferences</div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Waist:Hip Ratio</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.waistToHipRatio != null).map((a) => ({ date: a.date, value: a.waistToHipRatio as number }))} color="#10b981" unit="" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Chest</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.chestCircumferenceIn != null).map((a) => ({ date: a.date, value: a.chestCircumferenceIn as number }))} color="#f59e0b" unit="in" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Right Arm</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.rightArmCircumferenceIn != null).map((a) => ({ date: a.date, value: a.rightArmCircumferenceIn as number }))} color="#a78bfa" unit="in" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Left Arm</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.leftArmCircumferenceIn != null).map((a) => ({ date: a.date, value: a.leftArmCircumferenceIn as number }))} color="#a78bfa" unit="in" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Right Thigh</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.rightThighCircumferenceIn != null).map((a) => ({ date: a.date, value: a.rightThighCircumferenceIn as number }))} color="#ec4899" unit="in" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Left Thigh</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.leftThighCircumferenceIn != null).map((a) => ({ date: a.date, value: a.leftThighCircumferenceIn as number }))} color="#ec4899" unit="in" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Calf</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.calfCircumferenceIn != null).map((a) => ({ date: a.date, value: a.calfCircumferenceIn as number }))} color="#14b8a6" unit="in" />
                        </div>
                      </div>
                    </div>
                    </div>
                  )}

                  {statsSubCard === 'posture' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Posture:'));
                    const customGoalsNewestFirst = [...customGoals].reverse();

                    const allActivities = customGoalsNewestFirst.map((g) => ({ name: g.activityName, label: g.activityName.replace('Posture: ', ''), history: getCustomActivityHistory(g.activityName), color: '#10b981', goal: g }));
                    const passedActivities = allActivities.filter((a) => a.goal?.status === 'Pass' || a.goal?.status === 'AlreadyFit');
                    const inProgressActivities = allActivities.filter((a) => a.goal?.status !== 'Pass' && a.goal?.status !== 'AlreadyFit' && a.history.length > 0);

                    return (
                      <div className="space-y-4">
                        {passedActivities.length > 0 && (
                          <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                            {passedActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                                {a.goal?.observation && (
                                  <p className="text-[11px] text-neutral-500 mt-1.5 pt-1.5 border-t border-white/[0.04]">{a.goal.observation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {inProgressActivities.length > 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                            {inProgressActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                                {a.goal?.observation && (
                                  <p className="text-[11px] text-neutral-500 mt-1.5 pt-1.5 border-t border-white/[0.04]">{a.goal.observation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {passedActivities.length === 0 && inProgressActivities.length === 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                            <p className="text-sm text-neutral-400">No posture activities logged yet.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {statsSubCard === 'flex_mobility' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const standardTests = [
                      { name: 'Flexibility & Mobility: Thomas Test', label: 'Thomas Test', history: clientAssessments.filter((a) => a.thomasTestScore != null).map((a) => ({ date: a.date, value: a.thomasTestScore as number })), color: '#ec2226' },
                      { name: 'Flexibility & Mobility: Passive Straight Leg Raise', label: 'Passive Straight Leg Raise', history: clientAssessments.filter((a) => a.passiveStraightLegRaiseScore != null).map((a) => ({ date: a.date, value: a.passiveStraightLegRaiseScore as number })), color: '#f59e0b' },
                      { name: 'Flexibility & Mobility: Shoulder Flexion Test', label: 'Shoulder Flexion', history: clientAssessments.filter((a) => a.shoulderFlexionScore != null).map((a) => ({ date: a.date, value: a.shoulderFlexionScore as number })), color: '#6ccbde' },
                      { name: 'Flexibility & Mobility: Shoulder Extension Test', label: 'Shoulder Extension', history: clientAssessments.filter((a) => a.shoulderExtensionScore != null).map((a) => ({ date: a.date, value: a.shoulderExtensionScore as number })), color: '#a78bfa' },
                    ];
                    const standardNames = standardTests.map((t) => t.name);
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Flexibility & Mobility:') && !standardNames.includes(g.activityName));
                    // Newest-added first, matching the request to show
                    // activities in new-to-old order throughout.
                    const customGoalsNewestFirst = [...customGoals].reverse();

                    const allActivities = [
                      ...customGoalsNewestFirst.map((g) => ({ name: g.activityName, label: g.activityName.replace('Flexibility & Mobility: ', ''), history: getCustomActivityHistory(g.activityName), color: '#10b981', goal: g })),
                      ...standardTests.map((t) => ({ name: t.name, label: t.label, history: t.history, color: t.color, goal: clientGoals.find((g) => g.activityName === t.name) })),
                    ];
                    const passedActivities = allActivities.filter((a) => a.goal?.status === 'Pass' || a.goal?.status === 'AlreadyFit');
                    const inProgressActivities = allActivities.filter((a) => a.goal?.status !== 'Pass' && a.goal?.status !== 'AlreadyFit' && a.history.length > 0);

                    return (
                      <div className="space-y-4">
                        {passedActivities.length > 0 && (
                          <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                            {passedActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                              </div>
                            ))}
                          </div>
                        )}

                        {inProgressActivities.length > 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                            {inProgressActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                              </div>
                            ))}
                          </div>
                        )}

                        {passedActivities.length === 0 && inProgressActivities.length === 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                            <p className="text-sm text-neutral-400">No flexibility activities logged yet.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {statsSubCard === 'balance' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const unipedalGoalName = 'Balance: Unipedal Stance Test';
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Balance:') && g.activityName !== unipedalGoalName);
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);

                    return (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-white">Unipedal Stance Test</div>
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Left vs Right Leg</span>
                            <StatDualLineChart
                              dataA={clientAssessments.filter((a) => a.unipedalStanceLeftSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceLeftSeconds as number }))}
                              dataB={clientAssessments.filter((a) => a.unipedalStanceRightSeconds != null).map((a) => ({ date: a.date, value: a.unipedalStanceRightSeconds as number }))}
                              labelA="Left Leg"
                              labelB="Right Leg"
                              colorA="#ec2226"
                              colorB="#6ccbde"
                              unit="s"
                            />
                          </div>
                        </div>

                        {passedActivities.length > 0 && (
                          <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                            {passedActivities.map((g) => (
                              <div key={g.id}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Balance: ', '')}</span>
                                <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                              </div>
                            ))}
                          </div>
                        )}

                        {inProgressActivities.length > 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                            {inProgressActivities.map((g) => (
                              <div key={g.id}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Balance: ', '')}</span>
                                <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {statsSubCard === 'core_endurance' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const mcgillGoalName = "Core Endurance & Stability: McGill's Test";
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Core Endurance & Stability:') && g.activityName !== mcgillGoalName);
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);
                    return (
                    <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-white">McGill's Core Endurance Test</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Flexor Endurance</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.mcgillFlexorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillFlexorSeconds as number }))} color="#ec2226" unit="s" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Extensor Endurance</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.mcgillExtensorSeconds != null).map((a) => ({ date: a.date, value: a.mcgillExtensorSeconds as number }))} color="#f59e0b" unit="s" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Right Side Bridge</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.mcgillRightSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillRightSideBridgeSeconds as number }))} color="#6ccbde" unit="s" />
                        </div>
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Left Side Bridge</span>
                          <StatMiniChart data={clientAssessments.filter((a) => a.mcgillLeftSideBridgeSeconds != null).map((a) => ({ date: a.date, value: a.mcgillLeftSideBridgeSeconds as number }))} color="#a78bfa" unit="s" />
                        </div>
                      </div>
                      {(() => {
                        const latest = [...clientAssessments].reverse().find((a) => a.mcgillFlexorExtensorRatio || a.mcgillRightLeftSideRatio || a.mcgillRightToExtensorRatio || a.mcgillLeftToExtensorRatio);
                        if (!latest) return null;
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            {latest.mcgillFlexorExtensorRatio && (
                              <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Flexor - Extensor Ratio</span>
                                <span className="text-sm text-white font-mono">{latest.mcgillFlexorExtensorRatio}</span>
                              </div>
                            )}
                            {latest.mcgillRightLeftSideRatio && (
                              <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Right - Left Side Ratio</span>
                                <span className="text-sm text-white font-mono">{latest.mcgillRightLeftSideRatio}</span>
                              </div>
                            )}
                            {latest.mcgillRightToExtensorRatio && (
                              <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Right Side to Extensor Ratio</span>
                                <span className="text-sm text-white font-mono">{latest.mcgillRightToExtensorRatio}</span>
                              </div>
                            )}
                            {latest.mcgillLeftToExtensorRatio && (
                              <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Left Side to Extensor Ratio</span>
                                <span className="text-sm text-white font-mono">{latest.mcgillLeftToExtensorRatio}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {passedActivities.length > 0 && (
                      <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                        {passedActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Core Endurance & Stability: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                          </div>
                        ))}
                      </div>
                    )}

                    {inProgressActivities.length > 0 && (
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                        {inProgressActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Core Endurance & Stability: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    );
                  })()}


                  {statsSubCard === 'movement' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const standardTests = [
                      { name: 'Movement: Bend & Lift Squat Pattern', label: 'Bend & Lift Squat Pattern', history: clientAssessments.filter((a) => a.bendAndLiftSquatPatternScore != null).map((a) => ({ date: a.date, value: a.bendAndLiftSquatPatternScore as number })), color: '#ec2226' },
                      { name: 'Movement: Single Leg Step Up', label: 'Single Leg Step Up', history: clientAssessments.filter((a) => a.singleLegStepUpScore != null).map((a) => ({ date: a.date, value: a.singleLegStepUpScore as number })), color: '#f59e0b' },
                      { name: 'Movement: Shoulder Push Stabilization', label: 'Shoulder Push Stabilization', history: clientAssessments.filter((a) => a.shoulderPushStabilizationScore != null).map((a) => ({ date: a.date, value: a.shoulderPushStabilizationScore as number })), color: '#6ccbde' },
                      { name: 'Movement: Pull Stability Standing Row', label: 'Pull Stability Standing Row', history: clientAssessments.filter((a) => a.pullStabilityStandingRowScore != null).map((a) => ({ date: a.date, value: a.pullStabilityStandingRowScore as number })), color: '#a78bfa' },
                      { name: 'Movement: Thoracic Spine Mobility', label: 'Thoracic Spine Mobility', history: clientAssessments.filter((a) => a.thoracicSpineMobilityScore != null).map((a) => ({ date: a.date, value: a.thoracicSpineMobilityScore as number })), color: '#10b981' },
                      { name: 'Movement: Overhead Squat Test', label: 'Overhead Squat Test', history: clientAssessments.filter((a) => a.overheadSquatTestScore != null).map((a) => ({ date: a.date, value: a.overheadSquatTestScore as number })), color: '#ec4899' },
                    ];
                    const standardNames = standardTests.map((t) => t.name);
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Movement:') && !standardNames.includes(g.activityName));
                    const customGoalsNewestFirst = [...customGoals].reverse();

                    const allActivities = [
                      ...customGoalsNewestFirst.map((g) => ({ name: g.activityName, label: g.activityName.replace('Movement: ', ''), history: getCustomActivityHistory(g.activityName), color: '#14b8a6', goal: g })),
                      ...standardTests.map((t) => ({ name: t.name, label: t.label, history: t.history, color: t.color, goal: clientGoals.find((g) => g.activityName === t.name) })),
                    ];
                    const passedActivities = allActivities.filter((a) => a.goal?.status === 'Pass' || a.goal?.status === 'AlreadyFit');
                    const inProgressActivities = allActivities.filter((a) => a.goal?.status !== 'Pass' && a.goal?.status !== 'AlreadyFit' && a.history.length > 0);

                    return (
                      <div className="space-y-4">
                        {passedActivities.length > 0 && (
                          <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                            {passedActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                                {a.goal?.observation && (
                                  <p className="text-[11px] text-neutral-500 mt-1.5 pt-1.5 border-t border-white/[0.04]">{a.goal.observation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {inProgressActivities.length > 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                            {inProgressActivities.map((a) => (
                              <div key={a.name}>
                                <span className="text-[10px] text-neutral-400 font-bold block mb-1">{a.label}</span>
                                <StatMiniChart data={a.history} color={a.color} unit="/10" />
                                {a.goal?.observation && (
                                  <p className="text-[11px] text-neutral-500 mt-1.5 pt-1.5 border-t border-white/[0.04]">{a.goal.observation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {passedActivities.length === 0 && inProgressActivities.length === 0 && (
                          <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                            <p className="text-sm text-neutral-400">No movement activities logged yet.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {statsSubCard === 'cardio' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">VO2 Max</span>
                        <StatMiniChart data={clientAssessments.map((a) => ({ date: a.date, value: a.vo2Max }))} color="#a78bfa" unit="" />
                      </div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Resting HR</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.restingHeartRateBpm != null).map((a) => ({ date: a.date, value: a.restingHeartRateBpm as number }))} color="#ec2226" unit="bpm" />
                      </div>
                    </div>
                  )}
                  {statsSubCard === 'muscular_endurance' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Muscular Endurance:'));
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);
                    return (
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Push-Ups</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.pushUpsReps != null).map((a) => ({ date: a.date, value: a.pushUpsReps as number }))} color="#ec2226" unit="" />
                      </div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Pull-Ups</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.pullUpMaxReps != null).map((a) => ({ date: a.date, value: a.pullUpMaxReps as number }))} color="#f59e0b" unit="" />
                      </div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Bodyweight Squats</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.bodyweightSquatsReps != null).map((a) => ({ date: a.date, value: a.bodyweightSquatsReps as number }))} color="#6ccbde" unit="" />
                      </div>
                    </div>

                    {passedActivities.length > 0 && (
                      <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                        {passedActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Muscular Endurance: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="" />
                          </div>
                        ))}
                      </div>
                    )}

                    {inProgressActivities.length > 0 && (
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                        {inProgressActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Muscular Endurance: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="" />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    );
                  })()}


                  {statsSubCard === 'muscular_strength' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Muscular Strength:'));
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);
                    return (
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Bench Press 1RM</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.benchPress1RM != null).map((a) => ({ date: a.date, value: a.benchPress1RM as number }))} color="#ec2226" unit="kg" />
                      </div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Squat 1RM</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.squat1RM != null).map((a) => ({ date: a.date, value: a.squat1RM as number }))} color="#f59e0b" unit="kg" />
                      </div>
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Deadlift 1RM</span>
                        <StatMiniChart data={clientAssessments.filter((a) => a.deadlift1RM != null).map((a) => ({ date: a.date, value: a.deadlift1RM as number }))} color="#6ccbde" unit="kg" />
                      </div>
                    </div>

                    {passedActivities.length > 0 && (
                      <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                        {passedActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Muscular Strength: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="kg" />
                          </div>
                        ))}
                      </div>
                    )}

                    {inProgressActivities.length > 0 && (
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                        {inProgressActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Muscular Strength: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="kg" />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    );
                  })()}

                  {statsSubCard === 'saq' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const standardName = 'SAQ: T Test';
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('SAQ:') && g.activityName !== standardName);
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);
                    return (
                    <div className="space-y-4">
                    <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">T Test</span>
                      <StatMiniChart data={clientAssessments.filter((a) => a.tTestSeconds != null).map((a) => ({ date: a.date, value: a.tTestSeconds as number }))} color="#10b981" unit="s" />
                    </div>

                    {passedActivities.length > 0 && (
                      <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                        {passedActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('SAQ: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                          </div>
                        ))}
                      </div>
                    )}

                    {inProgressActivities.length > 0 && (
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                        {inProgressActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('SAQ: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="s" />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    );
                  })()}

                  {statsSubCard === 'skills' && (() => {
                    const skillGoals = (activeClient?.goals || []).filter((g) => g.activityName.startsWith('Skills:'));
                    if (skillGoals.length === 0) {
                      return (
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                          <p className="text-sm text-neutral-400">No skills tracked yet.</p>
                        </div>
                      );
                    }
                    // Groups each step under its parent skill (split on
                    // " > ") so a chain like Muscle Up -> Straight Bar
                    // Dips -> Negative Straight Bar Dips renders as one
                    // connected roadmap, in the order steps were added,
                    // rather than a flat, disconnected list.
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
                      <div className="space-y-4">
                        {Array.from(roadmaps.entries()).reverse().map(([skillName, steps]) => (
                          <div key={skillName} className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                            <span className="text-xs font-black text-white">{skillName}</span>
                            <div className="space-y-2">
                              {steps.map((step, i) => {
                                const isDone = step.goal.status === 'Pass' || step.goal.status === 'AlreadyFit';
                                return (
                                  <div key={step.goal.id} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${isDone ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}>
                                        {isDone ? '✓' : i + 1}
                                      </div>
                                      {i < steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[16px] ${isDone ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                                    </div>
                                    <div className="flex-1 pb-2">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold ${isDone ? 'text-emerald-300' : 'text-white'}`}>{step.name === skillName ? skillName : step.name}</span>
                                        {step.goal.value && <span className="text-[10px] text-neutral-400 font-mono">{step.goal.value} reps</span>}
                                      </div>
                                      {step.goal.observation && <p className="text-[10px] text-neutral-500 mt-0.5">{step.goal.observation}</p>}
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

                  {statsSubCard === 'power' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Power:'));
                    const customGoalsNewestFirst = [...customGoals].reverse();
                    const passedActivities = customGoalsNewestFirst.filter((g) => g.status === 'Pass' || g.status === 'AlreadyFit');
                    const inProgressActivities = customGoalsNewestFirst.filter((g) => g.status !== 'Pass' && g.status !== 'AlreadyFit' && getCustomActivityHistory(g.activityName).length > 0);
                    return (
                    <div className="space-y-4">
                    <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Vertical Jump</span>
                      <StatMiniChart data={clientAssessments.filter((a) => a.verticalJumpCm != null).map((a) => ({ date: a.date, value: a.verticalJumpCm as number }))} color="#a78bfa" unit="cm" />
                    </div>

                    {passedActivities.length > 0 && (
                      <div className="bg-[#101012] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">✓ Passed Activities</span>
                        {passedActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Power: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="" />
                          </div>
                        ))}
                      </div>
                    )}

                    {inProgressActivities.length > 0 && (
                      <div className="bg-[#101012] border border-[#242428] rounded-2xl p-4 space-y-3">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">In Progress</span>
                        {inProgressActivities.map((g) => (
                          <div key={g.id}>
                            <span className="text-[10px] text-neutral-400 font-bold block mb-1">{g.activityName.replace('Power: ', '')}</span>
                            <StatMiniChart data={getCustomActivityHistory(g.activityName)} color="#10b981" unit="" />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                    );
                  })()}

                  {statsSubCard === 'achievements' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const passedGoals = clientGoals.filter((g) => g.status === 'Pass');
                    if (passedGoals.length === 0) {
                      return (
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                          <p className="text-sm text-neutral-400">No achievements passed yet.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {passedGoals.reverse().map((goal) => (
                          <div key={goal.id} className="flex items-center justify-between bg-[#101012] border border-[#242428] rounded-xl p-3">
                            <span className="text-xs text-white font-semibold">{goal.activityName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-500/20 text-emerald-300">
                              ✓ Pass
                              <span className="text-white/40 font-normal ml-1">{goal.dateAchieved}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {statsSubCard === 'already_fit' && (() => {
                    const clientGoals = activeClient?.goals || [];
                    const alreadyFitGoals = clientGoals.filter((g) => g.status === 'AlreadyFit');
                    if (alreadyFitGoals.length === 0) {
                      return (
                        <div className="bg-[#101012] border border-[#242428] rounded-2xl p-6 text-center">
                          <p className="text-sm text-neutral-400">Nothing marked Already Fit yet.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {alreadyFitGoals.reverse().map((goal) => (
                          <div key={goal.id} className="flex items-center justify-between bg-[#101012] border border-[#242428] rounded-xl p-3">
                            <span className="text-xs text-white font-semibold">{goal.activityName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-500/20 text-amber-300">
                              🎓 Already Fit
                              <span className="text-white/40 font-normal ml-1">{goal.dateAchieved}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}



              {assessmentAreaView === 'statistics' && statsSubCard === null && (
                <div className="bg-[#14161f] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm mt-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/[0.06]">
                    Assessment History ({clientAssessments.length})
                  </h4>
                  {clientAssessments.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-4">No assessments logged yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {[...clientAssessments].reverse().map((a) => (
                        <div key={a.id} className="flex items-center justify-between bg-white/[0.02] rounded-xl px-3 py-2">
                          <span className="text-xs text-white font-mono">{a.date}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-400">
                              {[
                                a.weightKg != null ? `${a.weightKg}kg` : null,
                                a.bodyFatPercentage != null ? `${a.bodyFatPercentage}% BF` : null,
                                a.postureScore != null ? `Posture ${a.postureScore}/10` : null,
                                a.vo2Max != null ? `VO2 ${a.vo2Max}` : null,
                              ].filter(Boolean).join(' · ') || 'Assessment logged'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete the assessment from ${a.date}? This cannot be undone.`)) {
                                  deleteAssessmentRecord(a.id);
                                }
                              }}
                              className="text-neutral-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                {/* COMMON DATE FIELD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assessmentAreaView === 'log' && (
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                    Assessment Date
                  </label>
                  <input
                    type="date"
                    value={assDate}
                    onChange={(e) => setAssDate(e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              )}

              {assessmentAreaView === 'statistics' && statsSubCard !== null && (
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                    Last Assessment Date
                  </label>
                  <input
                    type="text"
                    value={clientAssessments.length > 0 ? clientAssessments[clientAssessments.length - 1].date : '—'}
                    disabled
                    className="w-full bg-[#0A0A0B]/60 border border-[#26262A] rounded-xl p-2.5 text-xs text-neutral-400 focus:outline-none cursor-not-allowed"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                  Assessing Performance Coach
                </label>
                <input
                  type="text"
                  value={currentCoachName}
                  disabled
                  className="w-full bg-[#0A0A0B]/60 border border-[#26262A] rounded-xl p-2.5 text-xs text-neutral-400 focus:outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {assessmentAreaView === 'statistics' && statsSubCard !== null && (() => {
              const statsKeyToCategory: Record<string, string> = {
                bca: 'BCA',
                posture: 'Posture',
                flex_mobility: 'Flexibility & Mobility',
                balance: 'Balance',
                core_endurance: 'Core Endurance & Stability',
                movement: 'Movement',
                cardio: 'Cardio',
                muscular_endurance: 'Muscular Endurance',
                muscular_strength: 'Muscular Strength',
                saq: 'SAQ',
                skills: 'Skills',
                power: 'Power',
              };
              const currentCategory = statsKeyToCategory[statsSubCard];
              if (!currentCategory) return null;
              const recordsForCategory = clientAssessments.filter((a) => a.category === currentCategory);
              const latestNotes = [...recordsForCategory].reverse().find((a) => a.notes)?.notes || '—';
              const latestMilestone = [...recordsForCategory].reverse().find((a) => a.targetMilestone)?.targetMilestone || '—';
              const showNotes = currentCategory !== 'Posture' && currentCategory !== 'Movement';
              return (
                <div className={`grid grid-cols-1 ${showNotes ? 'sm:grid-cols-2' : ''} gap-3 mt-3`}>
                  {showNotes && (
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Coach Observations & Athletic Summary
                    </label>
                    <div className="w-full bg-[#0A0A0B]/60 border border-[#26262A] rounded-xl p-2.5 text-xs text-neutral-400 cursor-not-allowed min-h-[2.75rem]">
                      {latestNotes}
                    </div>
                  </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Next Milestone / Evaluation Goal
                    </label>
                    <div className="w-full bg-[#0A0A0B]/60 border border-[#26262A] rounded-xl p-2.5 text-xs text-neutral-400 cursor-not-allowed min-h-[2.75rem]">
                      {latestMilestone}
                    </div>
                  </div>
                </div>
              );
            })()}


            {assessmentAreaView === 'log' && logSubCard === null && (() => {
              const clientGoals = activeClient?.goals || [];
              const hasAssessmentData = (fields: (keyof AssessmentRecord)[]) =>
                clientAssessments.some((a) => fields.some((f) => a[f] != null));
              const optionalCategories = [
                { key: 'muscular_endurance', label: 'Muscular Endurance', prefix: 'Muscular Endurance:', fields: ['pushUpsReps', 'pullUpMaxReps', 'bodyweightSquatsReps'] as (keyof AssessmentRecord)[] },
                { key: 'muscular_strength', label: 'Muscular Strength', prefix: 'Muscular Strength:', fields: ['benchPress1RM', 'squat1RM', 'deadlift1RM', 'overheadPress1RM'] as (keyof AssessmentRecord)[] },
                { key: 'saq', label: 'SAQ', prefix: 'SAQ:', fields: ['tTestSeconds'] as (keyof AssessmentRecord)[] },
                { key: 'skills', label: 'Skills', prefix: 'Skills:', fields: ['skillProgressions'] as (keyof AssessmentRecord)[] },
                { key: 'power', label: 'Power', prefix: 'Power:', fields: ['verticalJumpCm'] as (keyof AssessmentRecord)[] },
              ];
              const isEnabled = (c: typeof optionalCategories[number]) =>
                clientGoals.some((g) => g.activityName.startsWith(c.prefix)) || hasAssessmentData(c.fields);
              const enabledOptional = optionalCategories.filter(isEnabled);
              const notYetEnabled = optionalCategories.filter((c) => !isEnabled(c));
              const showOptionalPicker = !!expandedCompletedSections['log_optional_picker'];

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: 'bca', label: 'BCA' },
                      { key: 'posture', label: 'Posture' },
                      { key: 'flex_mobility', label: 'Flexibility & Mobility' },
                      { key: 'balance', label: 'Balance' },
                      { key: 'core_endurance', label: 'Core Endurance & Stability' },
                      { key: 'movement', label: 'Movement' },
                      { key: 'cardio', label: 'Cardio' },
                      ...enabledOptional,
                    ].map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => setLogSubCard(card.key)}
                        className="bg-[#101012] border border-[#242428] hover:border-[#ec2226]/40 rounded-2xl p-4 text-left transition"
                      >
                        <h4 className="text-xs font-bold text-white">{card.label}</h4>
                      </button>
                    ))}
                  </div>

                  {notYetEnabled.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, log_optional_picker: !prev['log_optional_picker'] }))}
                        className="text-[10px] font-bold text-[#ec2226] hover:text-white"
                      >
                        {showOptionalPicker ? '▾' : '▸'} Tap to reveal {notYetEnabled.length} more {notYetEnabled.length === 1 ? 'assessment' : 'assessments'}
                      </button>
                      {showOptionalPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {notYetEnabled.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setLogSubCard(c.key)}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#ec2226]/40 hover:text-[#ec2226]"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard !== null && (
              <button type="button" onClick={() => setLogSubCard(null)} className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1">
                ← Back
              </button>
            )}

            {/* SECTION 1: BODY COMPOSITION & GIRTHS */}
            {assessmentAreaView === 'log' && logSubCard === 'bca' && (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> BCA Calculator - Current / Normal / Goal
                </div>
                <div className="bg-[#0A0A0B] border border-[#242428] rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-white/[0.03] text-[10px] font-bold text-neutral-500 uppercase">
                    <span>Metric</span>
                    <span className="text-center">Current</span>
                    <span className="text-center">Normal</span>
                    <span className="text-center">Goal</span>
                  </div>
                  {bcaTable.map((row) => (
                    <div key={row.key} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-t border-white/[0.04] items-center">
                      <span className="text-xs font-bold text-white">{row.label}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={row.current ?? ''}
                        onChange={(e) => setBcaCurrentOverrides((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                        placeholder="—"
                        className="w-full bg-[#14161f] border border-white/[0.1] rounded-lg py-1 px-1 text-xs text-center font-mono text-neutral-200 focus:outline-none focus:border-white/30"
                      />
                      <input
                        type="text"
                        value={row.normal ?? ''}
                        onChange={(e) => setBcaNormalOverrides((prev) => ({ ...prev, [row.key]: e.target.value }))}
                        placeholder="—"
                        className="w-full bg-[#14161f] border border-emerald-500/30 rounded-lg py-1 px-1 text-xs text-center font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/60"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={row.goal ?? ''}
                        onChange={(e) => setBcaGoalOverrides((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                        placeholder="—"
                        className="w-full bg-[#14161f] border border-[#6ccbde]/30 rounded-lg py-1 px-1 text-xs text-center font-mono text-[#6ccbde] focus:outline-none focus:border-[#6ccbde]"
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-neutral-500 px-4 py-2 border-t border-white/[0.04]">
                    Current, Normal, and Goal all start from a calculated suggestion, but every field can be edited directly.
                  </p>
                </div>

                {/* Girth Circumferences */}
                <div className="pt-2 border-t border-[#242428] space-y-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block font-mono">
                    Trainerize Girth Circumferences (inches):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Chest</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthChest}
                        onChange={(e) => setGirthChest(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Waist</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthWaist}
                        onChange={(e) => setGirthWaist(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Hips</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthHips}
                        onChange={(e) => setGirthHips(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Right Arm</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthRightArm}
                        onChange={(e) => setGirthRightArm(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Left Arm</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthLeftArm}
                        onChange={(e) => setGirthLeftArm(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Right Thigh</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthRightThigh}
                        onChange={(e) => setGirthRightThigh(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Left Thigh</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthLeftThigh}
                        onChange={(e) => setGirthLeftThigh(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Calf</span>
                      <input
                        type="number"
                        step="0.5"
                        value={girthRightCalf}
                        onChange={(e) => setGirthRightCalf(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase">Waist:Hip Ratio</span>
                      <div className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg p-1.5 text-xs text-emerald-400 font-mono">
                        {girthWaist && girthHips && Number(girthHips) > 0 ? (Number(girthWaist) / Number(girthHips)).toFixed(2) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <SaveBar
                  label="Save BCA"
                  notes={assNotesByCategory['BCA'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'BCA': text }))}
                  milestone={assMilestoneByCategory['BCA'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'BCA': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({
                    weightKg: bcaTable.find((r) => r.key === 'weight')?.current,
                    bodyFatPercentage: bcaTable.find((r) => r.key === 'bodyFat')?.current,
                    muscleMassKg: bcaTable.find((r) => r.key === 'muscleMass')?.current,
                    visceralFatLevel: bcaTable.find((r) => r.key === 'visceralFat')?.current,
                    chestCircumferenceIn: girthChest ? Number(girthChest) : undefined,
                    waistCircumferenceIn: girthWaist ? Number(girthWaist) : undefined,
                    hipsCircumferenceIn: girthHips ? Number(girthHips) : undefined,
                    rightArmCircumferenceIn: girthRightArm ? Number(girthRightArm) : undefined,
                    leftArmCircumferenceIn: girthLeftArm ? Number(girthLeftArm) : undefined,
                    rightThighCircumferenceIn: girthRightThigh ? Number(girthRightThigh) : undefined,
                    leftThighCircumferenceIn: girthLeftThigh ? Number(girthLeftThigh) : undefined,
                    calfCircumferenceIn: girthRightCalf ? Number(girthRightCalf) : undefined,
                    waistToHipRatio: girthWaist && girthHips && Number(girthHips) > 0 ? Number((Number(girthWaist) / Number(girthHips)).toFixed(2)) : undefined,
                  }, ['BCA'])}
                />
              </div>
            )}

            {/* SECTION 2: CARDIOVASCULAR & VITALS */}

            {/* SECTION 3: STRENGTH & 1RMS */}

            {/* SECTION 4: MOVEMENT & POSTURE */}
            {assessmentAreaView === 'log' && logSubCard === 'posture' && (() => {
              const clientGoals = activeClient?.goals || [];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Posture:'));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Posture:'))
                  .map((name) => name.replace('Posture: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['posture_picker'];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Static Postural Assessment
                </div>

                {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => (
                  <ActivityGoalRow
                    key={goal.id}
                    label={goal.activityName.replace('Posture: ', '')}
                    status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                    observation={observationDrafts[goal.activityName] || ''}
                    onObservationChange={(text) => setObs(goal.activityName, text)}
                    onRecord={(status) => recordFor(goal.activityName, status)}
                    valueInput={
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={customValueDrafts[goal.activityName] || ''}
                        onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                        placeholder="Score out of 10"
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      />
                    }
                  />
                ))}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Posture Activity</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalNameInput}
                      onChange={(e) => setNewGoalNameInput(e.target.value)}
                      placeholder="e.g. Forward Head Posture"
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGoalNameInput.trim() && activeClient) {
                          addCustomClientGoal(activeClient.id, `Posture: ${newGoalNameInput.trim()}`, undefined, 'score_10');
                          setNewGoalNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownActivityNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, posture_picker: !prev['posture_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                      </button>
                      {showActivityPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownActivityNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                if (activeClient) addCustomClientGoal(activeClient.id, `Posture: ${name}`, undefined, 'score_10');
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <SaveBar
                  label="Save Posture"
                  notes={assNotesByCategory['Posture'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Posture': text }))}
                  milestone={assMilestoneByCategory['Posture'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Posture': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({}, ['Posture'])}
                  hideNotes
                />
              </div>
              );
            })()}
            {assessmentAreaView === 'log' && logSubCard === 'balance' && (() => {
              const clientGoals = activeClient?.goals || [];
              const unipedalGoalName = 'Balance: Unipedal Stance Test';
              const unipedalGoal = clientGoals.find((g) => g.activityName === unipedalGoalName);
              const unipedalStatus = pendingGoalStatuses[unipedalGoalName] ?? (unipedalGoal?.status || 'Pending');
              const unipedalDone = unipedalGoal?.status === 'Pass' || unipedalGoal?.status === 'AlreadyFit';

              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Balance:') && g.activityName !== unipedalGoalName);

              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };

              const allKnownGoalsRaw: GoalEntry[] = clientMasterRecords
                .flatMap((c) => c.goals || [])
                .filter((g) => g.activityName.startsWith('Balance:') && g.activityName !== unipedalGoalName);
              const allKnownActivityNames = Array.from(new Set(allKnownGoalsRaw.map((g) => g.activityName.replace('Balance: ', ''))));
              const valueTypeForName = (name: string): GoalEntry['valueType'] => allKnownGoalsRaw.find((g) => g.activityName === `Balance: ${name}`)?.valueType;
              const showActivityPicker = !!expandedCompletedSections['balance_picker'];

              const completedItems: { key: string; label: string; status: 'Pass' | 'AlreadyFit'; observation: string }[] = [];
              const activeCustomGoals: typeof customGoals = [];
              customGoals.forEach((g) => {
                if (g.status === 'Pass' || g.status === 'AlreadyFit') {
                  completedItems.push({ key: g.activityName, label: g.activityName.replace('Balance: ', ''), status: g.status, observation: observationDrafts[g.activityName] || '' });
                } else {
                  activeCustomGoals.push(g);
                }
              });
              if (unipedalDone && unipedalGoal) {
                completedItems.unshift({ key: unipedalGoalName, label: 'Unipedal Stance Test', status: unipedalGoal.status as 'Pass' | 'AlreadyFit', observation: observationDrafts[unipedalGoalName] || '' });
              }

              return (
                <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                  <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Static Balance Test
                  </div>

                  {!unipedalDone && (
                    <ActivityGoalRow
                      label="Unipedal Stance Test"
                      status={unipedalStatus}
                      observation={observationDrafts[unipedalGoalName] || ''}
                      onObservationChange={(text) => setObs(unipedalGoalName, text)}
                      onRecord={(status) => recordFor(unipedalGoalName, status)}
                      valueInput={
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={assUnipedalLeft}
                            onChange={(e) => setAssUnipedalLeft(e.target.value)}
                            placeholder="Left (sec)"
                            className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                          />
                          <input
                            type="number"
                            value={assUnipedalRight}
                            onChange={(e) => setAssUnipedalRight(e.target.value)}
                            placeholder="Right (sec)"
                            className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                          />
                        </div>
                      }
                    />
                  )}

                  {activeCustomGoals.map((goal) => (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('Balance: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        goal.valueType === 'unilateral_time' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={customValueDrafts[`${goal.activityName}::left`] || ''}
                              onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [`${goal.activityName}::left`]: e.target.value }))}
                              placeholder="Left (sec)"
                              className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                            />
                            <input
                              type="number"
                              value={customValueDrafts[`${goal.activityName}::right`] || ''}
                              onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [`${goal.activityName}::right`]: e.target.value }))}
                              placeholder="Right (sec)"
                              className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                            />
                          </div>
                        ) : goal.valueType === 'bilateral_time' ? (
                          <input
                            type="number"
                            value={customValueDrafts[goal.activityName] || ''}
                            onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                            placeholder="Time (sec)"
                            className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                          />
                        ) : undefined
                      }
                    />
                  ))}

                  <CompletedActivitiesSection
                    sectionKey="balance"
                    items={completedItems}
                    expanded={!!expandedCompletedSections['balance']}
                    onToggle={() => setExpandedCompletedSections((prev) => ({ ...prev, balance: !prev['balance'] }))}
                    onObservationChange={setObs}
                    onRecord={recordFor}
                  />

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Balance Activity</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewGoalIsUnilateral(true)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          newGoalIsUnilateral ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A]'
                        }`}
                      >
                        Unilateral (Left/Right)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGoalIsUnilateral(false)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          !newGoalIsUnilateral ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A]'
                        }`}
                      >
                        Bilateral (Both Sides)
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoalNameInput}
                        onChange={(e) => setNewGoalNameInput(e.target.value)}
                        placeholder="e.g. Y Balance Test"
                        className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGoalNameInput.trim() && activeClient) {
                            addCustomClientGoal(activeClient.id, `Balance: ${newGoalNameInput.trim()}`, undefined, newGoalIsUnilateral ? 'unilateral_time' : 'bilateral_time');
                            setNewGoalNameInput('');
                          }
                        }}
                        className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                      >
                        Add
                      </button>
                    </div>

                    {allKnownActivityNames.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, balance_picker: !prev['balance_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                        </button>
                        {showActivityPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allKnownActivityNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  if (activeClient) addCustomClientGoal(activeClient.id, `Balance: ${name}`, undefined, valueTypeForName(name));
                                }}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <SaveBar
                    label="Save Balance"
                    notes={assNotesByCategory['Balance'] || ''}
                    onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Balance': text }))}
                    milestone={assMilestoneByCategory['Balance'] || ''}
                    onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Balance': text }))}
                    clientVisible={assClientVisible}
                    onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                    onSave={() => handleSaveCategory({
                      unipedalStanceLeftSeconds: assUnipedalLeft ? Number(assUnipedalLeft) : undefined,
                      unipedalStanceRightSeconds: assUnipedalRight ? Number(assUnipedalRight) : undefined,
                    }, ['Balance'])}
                  />
                </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard === 'core_endurance' && (() => {
              const clientGoals = activeClient?.goals || [];
              const mcgillGoalName = 'Core Endurance & Stability: McGill\'s Test';
              const mcgillGoal = clientGoals.find((g) => g.activityName === mcgillGoalName);
              const mcgillStatus = pendingGoalStatuses[mcgillGoalName] ?? (mcgillGoal?.status || 'Pending');
              const mcgillDone = mcgillGoal?.status === 'Pass' || mcgillGoal?.status === 'AlreadyFit';

              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Core Endurance & Stability:') && g.activityName !== mcgillGoalName);
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };

              // Every custom Core Endurance activity name any coach has
              // ever added, across every client - so a coach can reuse
              // an existing activity instead of retyping it.
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Core Endurance & Stability:') && name !== mcgillGoalName)
                  .map((name) => name.replace('Core Endurance & Stability: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['core_endurance_picker'];

              const completedItems: { key: string; label: string; status: 'Pass' | 'AlreadyFit'; observation: string }[] = [];
              const activeCustomGoals: typeof customGoals = [];
              customGoals.forEach((g) => {
                if (g.status === 'Pass' || g.status === 'AlreadyFit') {
                  completedItems.push({ key: g.activityName, label: g.activityName.replace('Core Endurance & Stability: ', ''), status: g.status, observation: observationDrafts[g.activityName] || '' });
                } else {
                  activeCustomGoals.push(g);
                }
              });
              if (mcgillDone && mcgillGoal) {
                completedItems.unshift({ key: mcgillGoalName, label: 'McGill\'s Core Endurance Test', status: mcgillGoal.status as 'Pass' | 'AlreadyFit', observation: observationDrafts[mcgillGoalName] || '' });
              }

              return (
                <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4" /> Core Endurance & Stability
                  </div>

                  {!mcgillDone && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-white">McGill's Core Endurance Test</div>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Flexor Endurance (seconds)</label>
                          <input type="number" value={assMcgillFlexor} onChange={(e) => setAssMcgillFlexor(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Extensor Endurance (seconds)</label>
                          <input type="number" value={assMcgillExtensor} onChange={(e) => setAssMcgillExtensor(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Right Side Bridge (seconds)</label>
                          <input type="number" value={assMcgillRightBridge} onChange={(e) => setAssMcgillRightBridge(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Left Side Bridge (seconds)</label>
                          <input type="number" value={assMcgillLeftBridge} onChange={(e) => setAssMcgillLeftBridge(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Flexor - Extensor Ratio</label>
                          <input type="text" value={assMcgillFlexorExtensorRatio} onChange={(e) => setAssMcgillFlexorExtensorRatio(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Right Side - Left Side Ratio</label>
                          <input type="text" value={assMcgillRightLeftSideRatio} onChange={(e) => setAssMcgillRightLeftSideRatio(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Right Side to Extensor Ratio</label>
                          <input type="text" value={assMcgillRightToExtensorRatio} onChange={(e) => setAssMcgillRightToExtensorRatio(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Left Side to Extensor Ratio</label>
                          <input type="text" value={assMcgillLeftToExtensorRatio} onChange={(e) => setAssMcgillLeftToExtensorRatio(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                        </div>
                      </div>

                      <ActivityGoalRow
                        label="McGill's Core Endurance Test - Overall"
                        status={mcgillStatus}
                        observation={observationDrafts[mcgillGoalName] || ''}
                        onObservationChange={(text) => setObs(mcgillGoalName, text)}
                        onRecord={(status) => recordFor(mcgillGoalName, status)}
                      />
                    </div>
                  )}

                  {activeCustomGoals.map((goal) => (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('Core Endurance & Stability: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        <input
                          type="number"
                          value={customValueDrafts[goal.activityName] || ''}
                          onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                          placeholder="Time (sec)"
                          className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                        />
                      }
                    />
                  ))}

                  <CompletedActivitiesSection
                    sectionKey="core_endurance"
                    items={completedItems}
                    expanded={!!expandedCompletedSections['core_endurance']}
                    onToggle={() => setExpandedCompletedSections((prev) => ({ ...prev, core_endurance: !prev['core_endurance'] }))}
                    onObservationChange={setObs}
                    onRecord={recordFor}
                  />

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Core Endurance Activity</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoalNameInput}
                        onChange={(e) => setNewGoalNameInput(e.target.value)}
                        placeholder="e.g. Plank Hold"
                        className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGoalNameInput.trim() && activeClient) {
                            addCustomClientGoal(activeClient.id, `Core Endurance & Stability: ${newGoalNameInput.trim()}`, undefined, 'time_seconds');
                            setNewGoalNameInput('');
                          }
                        }}
                        className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                      >
                        Add
                      </button>
                    </div>

                    {allKnownActivityNames.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, core_endurance_picker: !prev['core_endurance_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                        </button>
                        {showActivityPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allKnownActivityNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  if (activeClient) addCustomClientGoal(activeClient.id, `Core Endurance & Stability: ${name}`, undefined, 'time_seconds');
                                }}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <SaveBar
                    label="Save Core Endurance & Stability"
                    notes={assNotesByCategory['Core Endurance & Stability'] || ''}
                    onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Core Endurance & Stability': text }))}
                    milestone={assMilestoneByCategory['Core Endurance & Stability'] || ''}
                    onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Core Endurance & Stability': text }))}
                    clientVisible={assClientVisible}
                    onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                    onSave={() => handleSaveCategory({
                      mcgillFlexorSeconds: assMcgillFlexor ? Number(assMcgillFlexor) : undefined,
                      mcgillExtensorSeconds: assMcgillExtensor ? Number(assMcgillExtensor) : undefined,
                      mcgillRightSideBridgeSeconds: assMcgillRightBridge ? Number(assMcgillRightBridge) : undefined,
                      mcgillLeftSideBridgeSeconds: assMcgillLeftBridge ? Number(assMcgillLeftBridge) : undefined,
                      mcgillFlexorExtensorRatio: assMcgillFlexorExtensorRatio.trim() || undefined,
                      mcgillRightLeftSideRatio: assMcgillRightLeftSideRatio.trim() || undefined,
                      mcgillRightToExtensorRatio: assMcgillRightToExtensorRatio.trim() || undefined,
                      mcgillLeftToExtensorRatio: assMcgillLeftToExtensorRatio.trim() || undefined,
                    }, ['Core Endurance & Stability'])}
                  />
                </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard === 'flex_mobility' && (() => {
              const clientGoals = activeClient?.goals || [];
              const standardNames = [
                'Flexibility & Mobility: Thomas Test',
                'Flexibility & Mobility: Passive Straight Leg Raise',
                'Flexibility & Mobility: Shoulder Flexion Test',
                'Flexibility & Mobility: Shoulder Extension Test',
              ];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Flexibility & Mobility:') && !standardNames.includes(g.activityName));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Flexibility & Mobility:') && !standardNames.includes(name))
                  .map((name) => name.replace('Flexibility & Mobility: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['flex_mobility_picker'];
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              const recordFor = (
                name: string,
                status: 'Pending' | 'Pass' | 'AlreadyFit',
                setPassState: (v: boolean | null) => void
              ) => {
                setPassState(status === 'Pending' ? false : true);
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              // Once an activity has actually been saved as Pass or
              // AlreadyFit, it moves to Statistics and no longer needs
              // to appear here - but if there's a mark that hasn't
              // been saved yet, keep showing it so the coach can still
              // see what they just tapped before hitting Save.
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Flexibility Test
                </div>

                {shouldShowActivity(standardNames[0]) && (
                <ActivityGoalRow
                  label="Thomas Test"
                  status={pendingGoalStatuses[standardNames[0]] ?? (goalFor(standardNames[0])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[0]] || ''}
                  onObservationChange={(text) => setObs(standardNames[0], text)}
                  onRecord={(status) => recordFor(standardNames[0], status, setAssThomasPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assThomasScore} onChange={(e) => setAssThomasScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[1]) && (
                <ActivityGoalRow
                  label="Passive Straight Leg Raise"
                  status={pendingGoalStatuses[standardNames[1]] ?? (goalFor(standardNames[1])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[1]] || ''}
                  onObservationChange={(text) => setObs(standardNames[1], text)}
                  onRecord={(status) => recordFor(standardNames[1], status, setAssSlrPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assSlrScore} onChange={(e) => setAssSlrScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[2]) && (
                <ActivityGoalRow
                  label="Shoulder Flexion Test"
                  status={pendingGoalStatuses[standardNames[2]] ?? (goalFor(standardNames[2])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[2]] || ''}
                  onObservationChange={(text) => setObs(standardNames[2], text)}
                  onRecord={(status) => recordFor(standardNames[2], status, setAssShoulderFlexionPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assShoulderFlexionScore} onChange={(e) => setAssShoulderFlexionScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[3]) && (
                <ActivityGoalRow
                  label="Shoulder Extension Test"
                  status={pendingGoalStatuses[standardNames[3]] ?? (goalFor(standardNames[3])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[3]] || ''}
                  onObservationChange={(text) => setObs(standardNames[3], text)}
                  onRecord={(status) => recordFor(standardNames[3], status, setAssShoulderExtensionPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assShoulderExtensionScore} onChange={(e) => setAssShoulderExtensionScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {customGoals.filter((g) => !standardNames.includes(g.activityName) && shouldShowActivity(g.activityName)).map((goal) => (
                  <ActivityGoalRow
                    key={goal.id}
                    label={goal.activityName.replace('Flexibility & Mobility: ', '')}
                    status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                    observation={observationDrafts[goal.activityName] || ''}
                    onObservationChange={(text) => setObs(goal.activityName, text)}
                    onRecord={(status) => {
                      setPendingGoalStatuses((prev) => ({ ...prev, [goal.activityName]: status }));
                    }}
                    valueInput={
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={customValueDrafts[goal.activityName] || ''}
                        onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                        placeholder="Score out of 10"
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      />
                    }
                  />
                ))}

                {standardNames.every((n) => !shouldShowActivity(n)) && customGoals.filter((g) => !standardNames.includes(g.activityName)).every((g) => !shouldShowActivity(g.activityName)) && (
                  <div className="text-center py-3">
                    <p className="text-xs text-emerald-400 font-bold">✓ All flexibility tests marked - check Statistics for results</p>
                  </div>
                )}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Flexibility Activity</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalNameInput}
                      onChange={(e) => setNewGoalNameInput(e.target.value)}
                      placeholder="e.g. Ankle Dorsiflexion"
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGoalNameInput.trim() && activeClient) {
                          addCustomClientGoal(activeClient.id, `Flexibility & Mobility: ${newGoalNameInput.trim()}`, undefined, 'score_10');
                          setNewGoalNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownActivityNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, flex_mobility_picker: !prev['flex_mobility_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                      </button>
                      {showActivityPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownActivityNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                if (activeClient) addCustomClientGoal(activeClient.id, `Flexibility & Mobility: ${name}`, undefined, 'score_10');
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <SaveBar
                  label="Save Flexibility & Mobility"
                  notes={assNotesByCategory['Flexibility & Mobility'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Flexibility & Mobility': text }))}
                  milestone={assMilestoneByCategory['Flexibility & Mobility'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Flexibility & Mobility': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({
                    thomasTestPass: assThomasPass ?? undefined,
                    thomasTestScore: assThomasScore ? Number(assThomasScore) : undefined,
                    thomasTestObservation: (observationDrafts[standardNames[0]] || '').trim() || undefined,
                    passiveStraightLegRaisePass: assSlrPass ?? undefined,
                    passiveStraightLegRaiseScore: assSlrScore ? Number(assSlrScore) : undefined,
                    passiveStraightLegRaiseObservation: (observationDrafts[standardNames[1]] || '').trim() || undefined,
                    shoulderFlexionTestPass: assShoulderFlexionPass ?? undefined,
                    shoulderFlexionScore: assShoulderFlexionScore ? Number(assShoulderFlexionScore) : undefined,
                    shoulderFlexionObservation: (observationDrafts[standardNames[2]] || '').trim() || undefined,
                    shoulderExtensionTestPass: assShoulderExtensionPass ?? undefined,
                    shoulderExtensionScore: assShoulderExtensionScore ? Number(assShoulderExtensionScore) : undefined,
                    shoulderExtensionObservation: (observationDrafts[standardNames[3]] || '').trim() || undefined,
                  }, ['Flexibility & Mobility'])}
                />
              </div>
              );
            })()}


            {assessmentAreaView === 'log' && logSubCard === 'movement' && (() => {
              const clientGoals = activeClient?.goals || [];
              const standardNames = [
                'Movement: Bend & Lift Squat Pattern',
                'Movement: Single Leg Step Up',
                'Movement: Shoulder Push Stabilization',
                'Movement: Pull Stability Standing Row',
                'Movement: Thoracic Spine Mobility',
                'Movement: Overhead Squat Test',
              ];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Movement:') && !standardNames.includes(g.activityName));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Movement:') && !standardNames.includes(name))
                  .map((name) => name.replace('Movement: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['movement_picker'];
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              const recordFor = (
                name: string,
                status: 'Pending' | 'Pass' | 'AlreadyFit',
                setPassState: (v: boolean | null) => void
              ) => {
                setPassState(status === 'Pending' ? false : true);
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Movement Test
                </div>

                {shouldShowActivity(standardNames[0]) && (
                <ActivityGoalRow
                  label="Bend & Lift Squat Pattern"
                  status={pendingGoalStatuses[standardNames[0]] ?? (goalFor(standardNames[0])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[0]] || ''}
                  onObservationChange={(text) => setObs(standardNames[0], text)}
                  onRecord={(status) => recordFor(standardNames[0], status, setAssBendLiftPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assBendLiftScore} onChange={(e) => setAssBendLiftScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[1]) && (
                <ActivityGoalRow
                  label="Single Leg Step Up"
                  status={pendingGoalStatuses[standardNames[1]] ?? (goalFor(standardNames[1])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[1]] || ''}
                  onObservationChange={(text) => setObs(standardNames[1], text)}
                  onRecord={(status) => recordFor(standardNames[1], status, setAssSingleLegStepUpPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assSingleLegStepUpScore} onChange={(e) => setAssSingleLegStepUpScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[2]) && (
                <ActivityGoalRow
                  label="Shoulder Push Stabilization"
                  status={pendingGoalStatuses[standardNames[2]] ?? (goalFor(standardNames[2])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[2]] || ''}
                  onObservationChange={(text) => setObs(standardNames[2], text)}
                  onRecord={(status) => recordFor(standardNames[2], status, setAssShoulderPushPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assShoulderPushScore} onChange={(e) => setAssShoulderPushScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[3]) && (
                <ActivityGoalRow
                  label="Pull Stability Standing Row"
                  status={pendingGoalStatuses[standardNames[3]] ?? (goalFor(standardNames[3])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[3]] || ''}
                  onObservationChange={(text) => setObs(standardNames[3], text)}
                  onRecord={(status) => recordFor(standardNames[3], status, setAssPullStabilityPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assPullStabilityScore} onChange={(e) => setAssPullStabilityScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[4]) && (
                <ActivityGoalRow
                  label="Thoracic Spine Mobility"
                  status={pendingGoalStatuses[standardNames[4]] ?? (goalFor(standardNames[4])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[4]] || ''}
                  onObservationChange={(text) => setObs(standardNames[4], text)}
                  onRecord={(status) => recordFor(standardNames[4], status, setAssThoracicMobilityPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assThoracicMobilityScore} onChange={(e) => setAssThoracicMobilityScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {shouldShowActivity(standardNames[5]) && (
                <ActivityGoalRow
                  label="Overhead Squat Test"
                  status={pendingGoalStatuses[standardNames[5]] ?? (goalFor(standardNames[5])?.status || 'Pending')}
                  observation={observationDrafts[standardNames[5]] || ''}
                  onObservationChange={(text) => setObs(standardNames[5], text)}
                  onRecord={(status) => recordFor(standardNames[5], status, setAssOverheadSquatPass)}
                  valueInput={
                    <input type="number" min="1" max="10" value={assOverheadSquatScore} onChange={(e) => setAssOverheadSquatScore(e.target.value)} placeholder="Score out of 10" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  }
                />
                )}

                {customGoals.filter((g) => !standardNames.includes(g.activityName) && shouldShowActivity(g.activityName)).map((goal) => (
                  <ActivityGoalRow
                    key={goal.id}
                    label={goal.activityName.replace('Movement: ', '')}
                    status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                    observation={observationDrafts[goal.activityName] || ''}
                    onObservationChange={(text) => setObs(goal.activityName, text)}
                    onRecord={(status) => {
                      setPendingGoalStatuses((prev) => ({ ...prev, [goal.activityName]: status }));
                    }}
                    valueInput={
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={customValueDrafts[goal.activityName] || ''}
                        onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                        placeholder="Score out of 10"
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      />
                    }
                  />
                ))}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Movement Activity</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalNameInput}
                      onChange={(e) => setNewGoalNameInput(e.target.value)}
                      placeholder="e.g. Turkish Get-Up"
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGoalNameInput.trim() && activeClient) {
                          addCustomClientGoal(activeClient.id, `Movement: ${newGoalNameInput.trim()}`);
                          setNewGoalNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownActivityNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, movement_picker: !prev['movement_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                      </button>
                      {showActivityPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownActivityNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                if (activeClient) addCustomClientGoal(activeClient.id, `Movement: ${name}`);
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                    Movement Deficiencies & Corrective Flags
                  </label>
                  <input
                    type="text"
                    value={deficiencyInput}
                    onChange={(e) => setDeficiencyInput(e.target.value)}
                    placeholder="e.g. Anterior pelvic tilt, tight right hip flexor"
                    className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white"
                  />
                </div>

                <div className="border-t border-[#242428] pt-3 space-y-2">
                  <div className="text-[11px] font-bold text-white">
                    Tracked Movement Issues ({movementIssuesList.filter((i) => i.issueType === 'Movement').length})
                  </div>

                  {movementIssuesList.filter((i) => i.issueType === 'Movement').map((issue) => (
                    <div key={issue.id} className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{issue.issueName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMovementIssue(issue.id)}
                          className="text-neutral-500 hover:text-red-400 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="text-[10px] text-neutral-400">{issue.progressPercentage}% progress</div>
                      {(issue.beforeVideoUrl || issue.afterVideoUrl) && (
                        <div className="text-[10px] space-y-1">
                          {issue.beforeVideoUrl && (
                            <a href={issue.beforeVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#6ccbde] underline block">Before video</a>
                          )}
                          {issue.afterVideoUrl && (
                            <a href={issue.afterVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#6ccbde] underline block">After video</a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <input
                      type="text"
                      value={newIssueName}
                      onChange={(e) => setNewIssueName(e.target.value)}
                      placeholder="Issue name, e.g. Limited Hip Mobility"
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    />

                    <div>
                      <label className="text-[9px] text-neutral-500 uppercase block mb-1">Progress %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newIssueProgress}
                        onChange={(e) => setNewIssueProgress(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={newIssueBeforeVideo}
                        onChange={(e) => setNewIssueBeforeVideo(e.target.value)}
                        placeholder="Before video - paste Google Drive share link"
                        className="bg-[#0A0A0B] border border-[#26262A] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={newIssueAfterVideo}
                        onChange={(e) => setNewIssueAfterVideo(e.target.value)}
                        placeholder="After video - paste Google Drive share link"
                        className="bg-[#0A0A0B] border border-[#26262A] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddMovementIssue('Movement')}
                      className="w-full py-1.5 text-xs font-bold text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/10"
                    >
                      + Add Movement Issue
                    </button>
                  </div>
                </div>

                <SaveBar
                  label="Save Movement"
                  notes={assNotesByCategory['Movement'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Movement': text }))}
                  milestone={assMilestoneByCategory['Movement'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Movement': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  hideNotes
                  onSave={() => handleSaveCategory({
                    bendAndLiftSquatPatternPass: assBendLiftPass ?? undefined,
                    bendAndLiftSquatPatternScore: assBendLiftScore ? Number(assBendLiftScore) : undefined,
                    bendAndLiftSquatPatternObservation: (observationDrafts[standardNames[0]] || '').trim() || undefined,
                    singleLegStepUpPass: assSingleLegStepUpPass ?? undefined,
                    singleLegStepUpScore: assSingleLegStepUpScore ? Number(assSingleLegStepUpScore) : undefined,
                    singleLegStepUpObservation: (observationDrafts[standardNames[1]] || '').trim() || undefined,
                    shoulderPushStabilizationPass: assShoulderPushPass ?? undefined,
                    shoulderPushStabilizationScore: assShoulderPushScore ? Number(assShoulderPushScore) : undefined,
                    shoulderPushStabilizationObservation: (observationDrafts[standardNames[2]] || '').trim() || undefined,
                    pullStabilityStandingRowPass: assPullStabilityPass ?? undefined,
                    pullStabilityStandingRowScore: assPullStabilityScore ? Number(assPullStabilityScore) : undefined,
                    pullStabilityStandingRowObservation: (observationDrafts[standardNames[3]] || '').trim() || undefined,
                    thoracicSpineMobilityPass: assThoracicMobilityPass ?? undefined,
                    thoracicSpineMobilityScore: assThoracicMobilityScore ? Number(assThoracicMobilityScore) : undefined,
                    thoracicSpineMobilityObservation: (observationDrafts[standardNames[4]] || '').trim() || undefined,
                    overheadSquatTestPass: assOverheadSquatPass ?? undefined,
                    overheadSquatTestScore: assOverheadSquatScore ? Number(assOverheadSquatScore) : undefined,
                    overheadSquatTestObservation: (observationDrafts[standardNames[5]] || '').trim() || undefined,
                    movementPostureIssues: movementIssuesList.filter((i) => i.issueType === 'Movement'),
                  }, ['Movement'])}
                />
              </div>
              );
            })()}

            {/* SECTION 5: SKILL PROGRESSIONS */}
            {assessmentAreaView === 'log' && logSubCard === 'cardio' && (() => {
              const clientGoals = activeClient?.goals || [];
              const standardName = 'Cardio: VO2 Max';
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Cardio:') && g.activityName !== standardName);
              const allKnownGoalsRaw: GoalEntry[] = clientMasterRecords
                .flatMap((c) => c.goals || [])
                .filter((g) => g.activityName.startsWith('Cardio:') && g.activityName !== standardName);
              const allKnownActivityNames = Array.from(new Set(allKnownGoalsRaw.map((g) => g.activityName.replace('Cardio: ', ''))));
              const valueTypeForName = (name: string): GoalEntry['valueType'] => allKnownGoalsRaw.find((g) => g.activityName === `Cardio: ${name}`)?.valueType;
              const showActivityPicker = !!expandedCompletedSections['cardio_picker'];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              const addCircuitRound = (activityName: string) => {
                setCustomCircuitDrafts((prev) => {
                  const rounds = prev[activityName] || [];
                  return { ...prev, [activityName]: [...rounds, { round: rounds.length + 1, timeSeconds: '' }] };
                });
              };
              const updateCircuitRoundTime = (activityName: string, roundIndex: number, timeSeconds: string) => {
                setCustomCircuitDrafts((prev) => {
                  const rounds = [...(prev[activityName] || [])];
                  rounds[roundIndex] = { ...rounds[roundIndex], timeSeconds };
                  return { ...prev, [activityName]: rounds };
                });
              };
              const removeCircuitRound = (activityName: string, roundIndex: number) => {
                setCustomCircuitDrafts((prev) => {
                  const rounds = (prev[activityName] || []).filter((_, i) => i !== roundIndex).map((r, i) => ({ ...r, round: i + 1 }));
                  return { ...prev, [activityName]: rounds };
                });
              };
              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4" /> Cardiovascular Biomarkers & Aerobic Tests
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                    VO2 Max (ml/kg/min) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={assVo2}
                    onChange={(e) => setAssVo2(e.target.value)}
                    required
                    className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-cyan-300 font-mono focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Systolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      value={assBpSystolic}
                      onChange={(e) => setAssBpSystolic(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      placeholder="120"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Diastolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      value={assBpDiastolic}
                      onChange={(e) => setAssBpDiastolic(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      placeholder="80"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Resting HR (bpm)
                    </label>
                    <input
                      type="number"
                      value={assRestingHr}
                      onChange={(e) => setAssRestingHr(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Conditioning Score (1-100)
                    </label>
                    <input
                      type="number"
                      value={aerobicScore}
                      onChange={(e) => setAerobicScore(Number(e.target.value))}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => {
                  const unitLabel = goal.valueType === 'distance_km' ? 'km' : goal.valueType === 'duration_minutes' ? 'minutes' : goal.valueType === 'steps' ? 'steps' : '';
                  const isCircuits = goal.valueType === 'circuits';
                  const rounds = customCircuitDrafts[goal.activityName] || [];
                  return (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('Cardio: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        isCircuits ? (
                          <div className="space-y-2">
                            {rounds.map((r, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] text-neutral-500 font-bold w-14">Round {r.round}</span>
                                <input
                                  type="number"
                                  value={r.timeSeconds}
                                  onChange={(e) => updateCircuitRoundTime(goal.activityName, idx, e.target.value)}
                                  placeholder="Time (sec)"
                                  className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-lg p-2 text-xs text-white font-mono focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeCircuitRound(goal.activityName, idx)}
                                  className="text-[10px] text-red-400 hover:text-red-300 px-2"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addCircuitRound(goal.activityName)}
                              className="w-full py-1.5 text-[10px] font-bold text-[#6ccbde] border border-[#6ccbde]/30 rounded-lg hover:bg-[#6ccbde]/10"
                            >
                              + Add Round
                            </button>
                          </div>
                        ) : unitLabel ? (
                          <input
                            type="number"
                            value={customValueDrafts[goal.activityName] || ''}
                            onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                            placeholder={unitLabel}
                            className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                          />
                        ) : undefined
                      }
                    />
                  );
                })}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Cardio Activity</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { key: 'distance_km', label: 'Distance (km)' },
                      { key: 'duration_minutes', label: 'Duration (min)' },
                      { key: 'steps', label: 'Steps' },
                      { key: 'circuits', label: 'Circuits' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewGoalValueType(opt.key)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          newGoalValueType === opt.key ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/40' : 'bg-[#0A0A0B] text-neutral-500 border-[#26262A]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalNameInput}
                      onChange={(e) => setNewGoalNameInput(e.target.value)}
                      placeholder="e.g. 1-Mile Run Time"
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGoalNameInput.trim() && activeClient) {
                          addCustomClientGoal(activeClient.id, `Cardio: ${newGoalNameInput.trim()}`, undefined, newGoalValueType);
                          setNewGoalNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownActivityNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, cardio_picker: !prev['cardio_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                      </button>
                      {showActivityPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownActivityNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                if (activeClient) addCustomClientGoal(activeClient.id, `Cardio: ${name}`, undefined, valueTypeForName(name));
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <SaveBar
                  label="Save Cardio"
                  notes={assNotesByCategory['Cardio'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Cardio': text }))}
                  milestone={assMilestoneByCategory['Cardio'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Cardio': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({
                    vo2Max: assVo2 ? Number(assVo2) : undefined,
                    bloodPressureSystolic: assBpSystolic ? Number(assBpSystolic) : undefined,
                    bloodPressureDiastolic: assBpDiastolic ? Number(assBpDiastolic) : undefined,
                    restingHeartRateBpm: assRestingHr ? Number(assRestingHr) : undefined,
                    aerobicCapacityScore: aerobicScore,
                  }, ['Cardio'])}
                />
              </div>
              );
            })()}


            {assessmentAreaView === 'log' && logSubCard === 'muscular_endurance' && (() => {
              const clientGoals = activeClient?.goals || [];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Muscular Endurance:'));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Muscular Endurance:'))
                  .map((name) => name.replace('Muscular Endurance: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['muscular_endurance_picker'];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              return (
                <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4" /> Muscular Endurance Test
                  </div>

                  <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                    <span className="text-xs font-semibold text-white block">Push-Ups (reps)</span>
                    <input type="number" value={assPushUpsReps} onChange={(e) => setAssPushUpsReps(e.target.value)} placeholder="Reps" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  </div>
                  <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                    <span className="text-xs font-semibold text-white block">Pull-Ups (reps)</span>
                    <input type="number" value={pullUpsMax} onChange={(e) => setPullUpsMax(e.target.value)} placeholder="Reps" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  </div>
                  <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                    <span className="text-xs font-semibold text-white block">Bodyweight Squats (reps)</span>
                    <input type="number" value={assBodyweightSquatsReps} onChange={(e) => setAssBodyweightSquatsReps(e.target.value)} placeholder="Reps" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  </div>

                  {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('Muscular Endurance: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        <input
                          type="number"
                          value={customValueDrafts[goal.activityName] || ''}
                          onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                          placeholder="Reps"
                          className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                        />
                      }
                    />
                  ))}

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Muscular Endurance Activity</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoalNameInput}
                        onChange={(e) => setNewGoalNameInput(e.target.value)}
                        placeholder="e.g. Wall Sit"
                        className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGoalNameInput.trim() && activeClient) {
                            addCustomClientGoal(activeClient.id, `Muscular Endurance: ${newGoalNameInput.trim()}`, undefined, 'reps');
                            setNewGoalNameInput('');
                          }
                        }}
                        className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                      >
                        Add
                      </button>
                    </div>

                    {allKnownActivityNames.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, muscular_endurance_picker: !prev['muscular_endurance_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                        </button>
                        {showActivityPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allKnownActivityNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  if (activeClient) addCustomClientGoal(activeClient.id, `Muscular Endurance: ${name}`, undefined, 'reps');
                                }}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <SaveBar
                    label="Save Muscular Endurance"
                    notes={assNotesByCategory['Muscular Endurance'] || ''}
                    onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Muscular Endurance': text }))}
                    milestone={assMilestoneByCategory['Muscular Endurance'] || ''}
                    onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Muscular Endurance': text }))}
                    clientVisible={assClientVisible}
                    onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                    onSave={() => handleSaveCategory({
                      pushUpsReps: assPushUpsReps ? Number(assPushUpsReps) : undefined,
                      pullUpMaxReps: pullUpsMax ? Number(pullUpsMax) : undefined,
                      bodyweightSquatsReps: assBodyweightSquatsReps ? Number(assBodyweightSquatsReps) : undefined,
                    }, ['Muscular Endurance'])}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (activeClient && window.confirm('Remove Muscular Endurance for this client? This deletes all its saved data and moves it back to "tap to reveal".')) {
                        clearClientCategoryData(activeClient.id, ['pushUpsReps', 'pullUpMaxReps', 'bodyweightSquatsReps'], 'Muscular Endurance');
                        setLogSubCard(null);
                      }
                    }}
                    className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Remove Muscular Endurance for this Client
                  </button>
                </div>
              );
            })()}



            {assessmentAreaView === 'log' && logSubCard === 'muscular_strength' && (() => {
              const clientGoals = activeClient?.goals || [];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Muscular Strength:'));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Muscular Strength:'))
                  .map((name) => name.replace('Muscular Strength: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['muscular_strength_picker'];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };

              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4" /> Strength & 1RM
                </div>

                <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-semibold text-white block">Bench Press 1RM (kg)</span>
                  <input type="number" step="0.5" value={bench1RM} onChange={(e) => setBench1RM(e.target.value)} placeholder="kg" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                </div>
                <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-semibold text-white block">Squat 1RM (kg)</span>
                  <input type="number" step="0.5" value={squat1RM} onChange={(e) => setSquat1RM(e.target.value)} placeholder="kg" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                </div>
                <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-semibold text-white block">Deadlift 1RM (kg)</span>
                  <input type="number" step="0.5" value={deadlift1RM} onChange={(e) => setDeadlift1RM(e.target.value)} placeholder="kg" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                </div>
                <div className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-semibold text-white block">Overhead Press 1RM (kg)</span>
                  <input type="number" step="0.5" value={ohp1RM} onChange={(e) => setOhp1RM(e.target.value)} placeholder="kg" className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                </div>

                {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => (
                  <ActivityGoalRow
                    key={goal.id}
                    label={goal.activityName.replace('Muscular Strength: ', '')}
                    status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                    observation={observationDrafts[goal.activityName] || ''}
                    onObservationChange={(text) => setObs(goal.activityName, text)}
                    onRecord={(status) => recordFor(goal.activityName, status)}
                    valueInput={
                      <input
                        type="number"
                        step="0.5"
                        value={customValueDrafts[goal.activityName] || ''}
                        onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                        placeholder="kg"
                        className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                      />
                    }
                  />
                ))}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Muscular Strength Activity</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalNameInput}
                      onChange={(e) => setNewGoalNameInput(e.target.value)}
                      placeholder="e.g. Front Squat 1RM"
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGoalNameInput.trim() && activeClient) {
                          addCustomClientGoal(activeClient.id, `Muscular Strength: ${newGoalNameInput.trim()}`);
                          setNewGoalNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownActivityNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, muscular_strength_picker: !prev['muscular_strength_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                      </button>
                      {showActivityPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownActivityNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                if (activeClient) addCustomClientGoal(activeClient.id, `Muscular Strength: ${name}`);
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <SaveBar
                  label="Save Muscular Strength"
                  notes={assNotesByCategory['Muscular Strength'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Muscular Strength': text }))}
                  milestone={assMilestoneByCategory['Muscular Strength'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Muscular Strength': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({
                    benchPress1RM: bench1RM ? Number(bench1RM) : undefined,
                    squat1RM: squat1RM ? Number(squat1RM) : undefined,
                    deadlift1RM: deadlift1RM ? Number(deadlift1RM) : undefined,
                    overheadPress1RM: ohp1RM ? Number(ohp1RM) : undefined,
                  }, ['Muscular Strength'])}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (activeClient && window.confirm('Remove Muscular Strength for this client? This deletes all its saved data and moves it back to "tap to reveal".')) {
                      clearClientCategoryData(activeClient.id, ['benchPress1RM', 'squat1RM', 'deadlift1RM', 'overheadPress1RM'], 'Muscular Strength');
                      setLogSubCard(null);
                    }
                  }}
                  className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300"
                >
                  Remove Muscular Strength for this Client
                </button>
              </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard === 'saq' && (() => {
              const clientGoals = activeClient?.goals || [];
              const standardName = 'SAQ: T Test';
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('SAQ:') && g.activityName !== standardName);
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('SAQ:') && name !== standardName)
                  .map((name) => name.replace('SAQ: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['saq_picker'];

              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };

              return (
                <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4" /> Speed, Agility & Quickness - T Test
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Time to Complete (seconds)</label>
                    <input type="number" step="0.1" value={assTTestSeconds} onChange={(e) => setAssTTestSeconds(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none" />
                  </div>

                  {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('SAQ: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        <input
                          type="number"
                          step="0.1"
                          value={customValueDrafts[goal.activityName] || ''}
                          onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                          placeholder="Time (sec)"
                          className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                        />
                      }
                    />
                  ))}

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New SAQ Activity</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoalNameInput}
                        onChange={(e) => setNewGoalNameInput(e.target.value)}
                        placeholder="e.g. 5-10-5 Shuttle"
                        className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGoalNameInput.trim() && activeClient) {
                            addCustomClientGoal(activeClient.id, `SAQ: ${newGoalNameInput.trim()}`);
                            setNewGoalNameInput('');
                          }
                        }}
                        className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                      >
                        Add
                      </button>
                    </div>

                    {allKnownActivityNames.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, saq_picker: !prev['saq_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                        </button>
                        {showActivityPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allKnownActivityNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  if (activeClient) addCustomClientGoal(activeClient.id, `SAQ: ${name}`);
                                }}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <SaveBar
                    label="Save SAQ"
                    notes={assNotesByCategory['SAQ'] || ''}
                    onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'SAQ': text }))}
                    milestone={assMilestoneByCategory['SAQ'] || ''}
                    onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'SAQ': text }))}
                    clientVisible={assClientVisible}
                    onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                    onSave={() => handleSaveCategory({
                      tTestSeconds: assTTestSeconds ? Number(assTTestSeconds) : undefined,
                    }, ['SAQ'])}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (activeClient && window.confirm('Remove SAQ for this client? This deletes all its saved data and moves it back to "tap to reveal".')) {
                        clearClientCategoryData(activeClient.id, ['tTestSeconds'], 'SAQ');
                        setLogSubCard(null);
                      }
                    }}
                    className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Remove SAQ for this Client
                  </button>
                </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard === 'skills' && (() => {
              const clientGoals = activeClient?.goals || [];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const allKnownSkillNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Skills:'))
                  .map((name) => name.replace('Skills: ', ''))
              ));
              // Only top-level skills (not already a step under another
              // skill) can be picked as a parent for a new progression
              // step - a step's own sub-steps aren't supported, keeping
              // the roadmap a simple two-level chain.
              const topLevelSkillNames = Array.from(new Set([
                ...skillsList.map((sk) => sk.skillName),
                ...allKnownSkillNames,
              ])).filter((name) => !name.includes(' > '));
              const showSkillPicker = !!expandedCompletedSections['skills_picker'];
              return (
              <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Skills
                </div>

                {(() => {
                  // Groups each step under its parent skill (split on
                  // " > "), same grouping as Statistics, so a skill
                  // and all its progression steps sit together in one
                  // card rather than mixed into one flat list. Newest
                  // top-level skill shows first.
                  type Step = { sk: SkillProgressItem; name: string };
                  const roadmaps = new Map<string, Step[]>();
                  skillsList.forEach((sk) => {
                    const [parent, ...rest] = sk.skillName.split(' > ');
                    const stepName = rest.length > 0 ? rest.join(' > ') : sk.skillName;
                    if (!roadmaps.has(parent)) roadmaps.set(parent, []);
                    roadmaps.get(parent)!.push({ sk, name: stepName });
                  });
                  const groupedInAddedOrder = Array.from(roadmaps.entries());

                  return groupedInAddedOrder.map(([skillName, steps]) => {
                    const visibleSteps = steps.filter((step) => shouldShowActivity(`Skills: ${step.sk.skillName}`));
                    if (visibleSteps.length === 0) return null;
                    return (
                      <div key={skillName} className="bg-[#14161f] border border-[#242428] rounded-xl p-3 space-y-3">
                        <span className="text-xs font-black text-emerald-300">{skillName}</span>
                        {visibleSteps.map((step) => {
                          const goalName = `Skills: ${step.sk.skillName}`;
                          return (
                            <ActivityGoalRow
                              key={step.sk.id}
                              label={step.name === skillName ? skillName : step.name}
                              status={pendingGoalStatuses[goalName] ?? (goalFor(goalName)?.status || 'Pending')}
                              observation={observationDrafts[goalName] || ''}
                              onObservationChange={(text) => setObs(goalName, text)}
                              onRecord={(status) => recordFor(goalName, status)}
                              valueInput={
                                <input
                                  type="number"
                                  min="0"
                                  value={customValueDrafts[goalName] || ''}
                                  onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goalName]: e.target.value }))}
                                  placeholder="Reps done"
                                  className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                                />
                              }
                            />
                          );
                        })}
                      </div>
                    );
                  });
                })()}

                <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Skill or Progression Step</label>
                  {topLevelSkillNames.length > 0 && (
                    <select
                      value={newSkillParent}
                      onChange={(e) => setNewSkillParent(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white focus:outline-none"
                    >
                      <option value="">New top-level skill (e.g. "Muscle Up")</option>
                      {topLevelSkillNames.map((name) => (
                        <option key={name} value={name}>Add as a step under: {name}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      placeholder={newSkillParent ? 'e.g. Negative Straight Bar Dips' : 'e.g. Ring Muscle-Up'}
                      className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkillToForm}
                      className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                    >
                      Add
                    </button>
                  </div>

                  {allKnownSkillNames.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, skills_picker: !prev['skills_picker'] }))}
                        className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                      >
                        {showSkillPicker ? '▾' : '▸'} Tap to reveal {allKnownSkillNames.length} previously added {allKnownSkillNames.length === 1 ? 'skill' : 'skills'}
                      </button>
                      {showSkillPicker && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allKnownSkillNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setNewSkillName(name);
                                handleAddSkillToForm();
                              }}
                              className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <SaveBar
                  label="Save Skills"
                  notes={assNotesByCategory['Skills'] || ''}
                  onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Skills': text }))}
                  milestone={assMilestoneByCategory['Skills'] || ''}
                  onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Skills': text }))}
                  clientVisible={assClientVisible}
                  onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                  onSave={() => handleSaveCategory({
                    skillProgressions: skillsList,
                  }, ['Skills'])}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (activeClient && window.confirm('Remove Skills for this client? This deletes all its saved data and moves it back to "tap to reveal".')) {
                      clearClientCategoryData(activeClient.id, ['skillProgressions'], 'Skills');
                      setLogSubCard(null);
                    }
                  }}
                  className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300"
                >
                  Remove Skills for this Client
                </button>
              </div>
              );
            })()}

            {assessmentAreaView === 'log' && logSubCard === 'power' && (() => {
              const clientGoals = activeClient?.goals || [];
              const customGoals = clientGoals.filter((g) => g.activityName.startsWith('Power:'));
              const allKnownActivityNames = Array.from(new Set(
                clientMasterRecords
                  .flatMap((c) => c.goals || [])
                  .map((g) => g.activityName)
                  .filter((name) => name.startsWith('Power:'))
                  .map((name) => name.replace('Power: ', ''))
              ));
              const showActivityPicker = !!expandedCompletedSections['power_picker'];
              const recordFor = (name: string, status: 'Pending' | 'Pass' | 'AlreadyFit') => {
                setPendingGoalStatuses((prev) => ({ ...prev, [name]: status }));
              };
              const goalFor = (name: string) => clientGoals.find((g) => g.activityName === name);
              const shouldShowActivity = (name: string) => {
                const hasPendingMark = name in pendingGoalStatuses;
                if (hasPendingMark) return true;
                const savedStatus = goalFor(name)?.status;
                return savedStatus !== 'Pass' && savedStatus !== 'AlreadyFit';
              };
              const setObs = (name: string, text: string) => {
                setObservationDrafts((prev) => ({ ...prev, [name]: text }));
              };

              return (
                <div className="space-y-4 p-4 bg-[#101012] border border-[#242428] rounded-xl">
                  <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4" /> Power
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">
                      Vertical Jump (cm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={vertJumpCm}
                      onChange={(e) => setVertJumpCm(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  {customGoals.filter((g) => shouldShowActivity(g.activityName)).map((goal) => (
                    <ActivityGoalRow
                      key={goal.id}
                      label={goal.activityName.replace('Power: ', '')}
                      status={pendingGoalStatuses[goal.activityName] ?? goal.status}
                      observation={observationDrafts[goal.activityName] || ''}
                      onObservationChange={(text) => setObs(goal.activityName, text)}
                      onRecord={(status) => recordFor(goal.activityName, status)}
                      valueInput={
                        <input
                          type="number"
                          value={customValueDrafts[goal.activityName] || ''}
                          onChange={(e) => setCustomValueDrafts((prev) => ({ ...prev, [goal.activityName]: e.target.value }))}
                          placeholder="Value"
                          className="w-full bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white font-mono focus:outline-none"
                        />
                      }
                    />
                  ))}

                  <div className="bg-[#14161f] border border-dashed border-[#2e2e32] rounded-xl p-3 space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Add a New Power Activity</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGoalNameInput}
                        onChange={(e) => setNewGoalNameInput(e.target.value)}
                        placeholder="e.g. Broad Jump"
                        className="flex-1 bg-[#0A0A0B] border border-[#26262A] rounded-xl p-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newGoalNameInput.trim() && activeClient) {
                            addCustomClientGoal(activeClient.id, `Power: ${newGoalNameInput.trim()}`);
                            setNewGoalNameInput('');
                          }
                        }}
                        className="px-4 py-2 bg-[#6ccbde]/20 text-[#6ccbde] border border-[#6ccbde]/40 rounded-xl text-xs font-bold hover:bg-[#6ccbde]/30"
                      >
                        Add
                      </button>
                    </div>

                    {allKnownActivityNames.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCompletedSections((prev) => ({ ...prev, power_picker: !prev['power_picker'] }))}
                          className="text-[10px] font-bold text-[#6ccbde] hover:text-white"
                        >
                          {showActivityPicker ? '▾' : '▸'} Tap to reveal {allKnownActivityNames.length} previously added {allKnownActivityNames.length === 1 ? 'activity' : 'activities'}
                        </button>
                        {showActivityPicker && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allKnownActivityNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  if (activeClient) addCustomClientGoal(activeClient.id, `Power: ${name}`);
                                }}
                                className="px-3 py-1.5 bg-[#0A0A0B] border border-[#26262A] rounded-lg text-[11px] text-neutral-300 hover:border-[#6ccbde]/40 hover:text-[#6ccbde]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <SaveBar
                    label="Save Power"
                    notes={assNotesByCategory['Power'] || ''}
                    onNotesChange={(text: string) => setAssNotesByCategory((prev) => ({ ...prev, 'Power': text }))}
                    milestone={assMilestoneByCategory['Power'] || ''}
                    onMilestoneChange={(text: string) => setAssMilestoneByCategory((prev) => ({ ...prev, 'Power': text }))}
                    clientVisible={assClientVisible}
                    onToggleClientVisible={() => setAssClientVisible(!assClientVisible)}
                    onSave={() => handleSaveCategory({
                      verticalJumpCm: vertJumpCm ? Number(vertJumpCm) : undefined,
                    }, ['Power'])}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (activeClient && window.confirm('Remove Power for this client? This deletes all its saved data and moves it back to "tap to reveal".')) {
                        clearClientCategoryData(activeClient.id, ['verticalJumpCm'], 'Power');
                        setLogSubCard(null);
                      }
                    }}
                    className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Remove Power for this Client
                  </button>
                </div>
              );
            })()}


          </form>
            </>
          )}
        </div>

      {/* Health Screening Questionnaire (PRQ) viewer */}
      {showPrqReport && (() => {
        const prq = getClientPrq(selectedClientId);

        const Row: React.FC<{ label: string; value: any }> = ({ label, value }) => {
          if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
          return (
            <div className="flex justify-between gap-3 py-1 border-b border-white/[0.04] text-xs">
              <span className="text-neutral-500">{label}</span>
              <span className="text-white font-semibold text-right">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
            </div>
          );
        };

        const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
          <div className="bg-[#14161f] border border-white/[0.08] rounded-2xl p-4 space-y-1">
            <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">{title}</h4>
            {children}
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-[#0c0d10] border border-white/[0.1] rounded-2xl w-full max-w-lg my-6 shadow-2xl">
              <div className="sticky top-0 bg-[#0c0d10] border-b border-white/[0.08] p-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-sm font-black text-white">Health Screening — {activeClient?.name}</h3>
                  {prq && <p className="text-[10px] text-neutral-500">Completed {new Date(prq.completedAt).toLocaleDateString()}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrqReport(false)}
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-neutral-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!prq ? (
                <div className="p-8 text-center space-y-2">
                  <ClipboardList className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-sm font-bold text-white">Not completed yet</p>
                  <p className="text-xs text-neutral-500">This client hasn't filled in their Health Screening Questionnaire in the Client App.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <SectionCard title="Personal Details">
                    <Row label="Full Name" value={prq.fullName} />
                    <Row label="Email" value={prq.email} />
                    <Row label="Contact Number" value={prq.contactNumber} />
                    <Row label="Emergency Contact" value={prq.emergencyContactNumber} />
                    <Row label="Address" value={prq.address} />
                    <Row label="Date of Birth" value={prq.dateOfBirth} />
                    <Row label="Age" value={prq.age} />
                    <Row label="Sex" value={prq.sex} />
                    <Row label="Marital Status" value={prq.maritalStatus} />
                  </SectionCard>

                  <SectionCard title="Medical Information">
                    <Row label="Weight" value={prq.weightKg ? `${prq.weightKg} kg` : undefined} />
                    <Row label="Height" value={prq.heightCm ? `${prq.heightCm} cm` : undefined} />
                    <Row label="Present Health State" value={prq.presentHealthState} />
                    <Row label="Current Medications" value={prq.currentMedications} />
                    <Row label="Takes as Prescribed" value={prq.takesMedicationsAsPrescribed} />
                    <Row label="If Not, Why" value={prq.reasonNotTakingAsPrescribed} />
                    <Row label="Takes Supplements" value={prq.takesSupplements ? 'Yes' : 'No'} />
                    <Row label="Supplement Details" value={prq.supplementDetails} />
                    <Row label="Last Physician Visit" value={prq.lastPhysicianVisit} />
                    <Row label="Total Cholesterol" value={prq.totalCholesterol} />
                    <Row label="HDL" value={prq.hdl} />
                    <Row label="LDL" value={prq.ldl} />
                    <Row label="Blood Sugar Checked" value={prq.hasCheckedBloodSugar ? 'Yes' : 'No'} />
                    <Row label="Blood Sugar Results" value={prq.bloodSugarResults} />
                    <Row label="Medical Conditions" value={prq.medicalConditions} />
                    <Row label="Condition Notes" value={prq.medicalConditionsNotes} />
                    <Row label="Other Conditions" value={(prq as any).otherMedicalConditions} />
                    <Row label="Pregnancy - Weeks Along" value={prq.pregnancyWeeksAlong} />
                  </SectionCard>

                  <SectionCard title="Surgery & Injury History">
                    <Row label="Major Surgery" value={prq.hadMajorSurgery ? 'Yes' : 'No'} />
                    <Row label="Surgery Details" value={prq.majorSurgeryDetails} />
                    <Row label="Past Injuries" value={prq.hadPastInjuries ? 'Yes' : 'No'} />
                    <Row label="Past Injury Details" value={prq.pastInjuryDetails} />
                    <Row label="Activity-Limiting Injuries" value={prq.hasActivityLimitingInjuries ? 'Yes' : 'No'} />
                    <Row label="Details" value={prq.activityLimitingInjuryDetails} />
                    <Row label="Current Injuries" value={prq.hasCurrentInjuries ? 'Yes' : 'No'} />
                    <Row label="Current Injury Details" value={prq.currentInjuryDetails} />
                  </SectionCard>

                  <SectionCard title="Family History">
                    <Row label="Family Medical History" value={prq.familyMedicalHistory} />
                  </SectionCard>

                  <SectionCard title="Substance-Related Habits">
                    <Row label="Drinks Alcohol" value={prq.drinksAlcohol ? 'Yes' : 'No'} />
                    <Row label="Frequency" value={prq.alcoholFrequency} />
                    <Row label="Times per Week" value={prq.alcoholTimesPerWeek} />
                    <Row label="Average Amount" value={prq.alcoholAverageAmount} />
                    <Row label="Drinks Caffeine" value={prq.drinksCaffeine ? 'Yes' : 'No'} />
                    <Row label="Caffeine per Day" value={prq.caffeinePerDay} />
                    <Row label="Uses Tobacco" value={prq.usesTobacco ? 'Yes' : 'No'} />
                    <Row label="Tobacco Amount" value={prq.tobaccoAmount} />
                  </SectionCard>

                  <SectionCard title="Physical Activity">
                    <Row label="Structured Activity" value={prq.doesStructuredActivity ? 'Yes' : 'No'} />
                    <Row label="Description" value={prq.structuredActivityDescription} />
                    <Row label="Cardio Minutes/Session" value={prq.cardioMinutesPerSession} />
                    <Row label="Cardio Times/Week" value={prq.cardioTimesPerWeek} />
                    <Row label="Muscular Training Sessions/Week" value={prq.muscularTrainingSessionsPerWeek} />
                    <Row label="Flexibility Sessions/Week" value={prq.flexibilitySessionsPerWeek} />
                    <Row label="Sports/Recreation" value={prq.doesSportsOrRecreation ? 'Yes' : 'No'} />
                    <Row label="Sports Details" value={prq.sportsDetails} />
                    <Row label="Training Experience" value={prq.trainingExperienceLevel} />
                    <Row label="Feelings About Exercise" value={prq.feelingsAboutExercise} />
                    <Row label="Favorite Activities" value={prq.favoritePhysicalActivities} />
                  </SectionCard>

                  <SectionCard title="Occupational">
                    <Row label="Works" value={prq.works ? 'Yes' : 'No'} />
                    <Row label="Occupation" value={prq.occupation} />
                    <Row label="Work Schedule" value={prq.workSchedule} />
                    <Row label="Work Activity Level" value={prq.workActivityLevelDescription} />
                    <Row label="Daily Activity Level" value={prq.dailyActivityLevel} />
                  </SectionCard>

                  <SectionCard title="Sleep & Stress">
                    <Row label="Sleep Hours/Night" value={prq.sleepHoursPerNight} />
                    <Row label="Most Stressful Thing" value={prq.mostStressfulThing} />
                    <Row label="Stress Level (1-10)" value={prq.stressLevel} />
                    <Row label="Appetite Under Stress" value={prq.appetiteUnderStress} />
                  </SectionCard>

                  <SectionCard title="Weight History">
                    <Row label="Weight Goal" value={prq.weightGoalDirection} />
                    <Row label="Lowest Weight (5yr)" value={prq.lowestWeightPast5Years ? `${prq.lowestWeightPast5Years} kg` : undefined} />
                    <Row label="Highest Weight (5yr)" value={prq.highestWeightPast5Years ? `${prq.highestWeightPast5Years} kg` : undefined} />
                  </SectionCard>

                  <SectionCard title="Circumferences">
                    <Row label="Abdomen" value={prq.abdomenCircumferenceCm ? `${prq.abdomenCircumferenceCm} cm` : undefined} />
                    <Row label="Waist" value={prq.waistCircumferenceCm ? `${prq.waistCircumferenceCm} cm` : undefined} />
                    <Row label="Upper Arm" value={prq.upperArmCircumferenceCm ? `${prq.upperArmCircumferenceCm} cm` : undefined} />
                    <Row label="Mid-Thigh" value={prq.midThighCircumferenceCm ? `${prq.midThighCircumferenceCm} cm` : undefined} />
                  </SectionCard>

                  <SectionCard title="Body Composition">
                    <Row label="BMI" value={prq.bmi} />
                    <Row label="Fat Mass" value={prq.fatMassKg ? `${prq.fatMassKg} kg` : undefined} />
                    <Row label="Skeletal Muscle Mass" value={prq.skeletalMuscleMassKg ? `${prq.skeletalMuscleMassKg} kg` : undefined} />
                  </SectionCard>

                  <SectionCard title="Goals & Readiness">
                    <Row label="Readiness (1-10)" value={prq.readinessToAdoptHealthyLifestyle} />
                    <Row label="Has Specific Goals" value={prq.hasSpecificHealthGoals ? 'Yes' : 'No'} />
                    <Row label="Goals (Prioritized)" value={prq.healthGoalsPrioritized} />
                  </SectionCard>

                  <SectionCard title="COVID History">
                    <Row label="Diagnosed with COVID" value={prq.diagnosedWithCovidBefore ? 'Yes' : 'No'} />
                  </SectionCard>

                  <SectionCard title="Nutrition">
                    <Row label="Following a Diet" value={prq.followingADiet ? 'Yes' : 'No'} />
                    <Row label="Diet Description" value={prq.dietDescription} />
                    <Row label="Dietary Lifestyle" value={prq.dietaryLifestyle} />
                    <Row label="Dietary Lifestyle - Other" value={prq.dietaryLifestyleOtherNote} />
                    <Row label="Taste Preferences" value={prq.tastePreferences} />
                    <Row label="Texture Preferences" value={prq.texturePreferences} />
                    <Row label="Temperature Preference" value={prq.temperaturePreference} />
                    <Row label="Meal Timing Preferences" value={prq.mealTimingPreferences} />
                  </SectionCard>

                  <SectionCard title="Food & Medical Considerations">
                    <Row label="Specific Illness" value={prq.hasSpecificIllness ? 'Yes' : 'No'} />
                    <Row label="Illness Details" value={prq.illnessDetails} />
                    <Row label="Food Allergy" value={prq.hasFoodAllergy ? 'Yes' : 'No'} />
                    <Row label="Allergy Details" value={prq.foodAllergyDetails} />
                    <Row label="Foods Never Eaten" value={prq.foodsNeverEaten} />
                  </SectionCard>

                  <SectionCard title="Fitness Goal">
                    <Row label="Goal" value={prq.fitnessGoal} />
                  </SectionCard>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
