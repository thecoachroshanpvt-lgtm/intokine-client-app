
/**
 * Single source of truth for the activity-based assessment categories.
 *
 * Both the UI (ActivityAssessment.tsx) and the store's delete/revert
 * logic read from here, so the list of "which record fields belong to
 * which pre-defined activity" can never drift between the two.
 */

export type ActivityKind =
  | 'score10' // one number, 1-10
  | 'number' // one free number with a unit (seconds, reps, kg, cm ...)
  | 'dual' // left + right numbers (seconds)
  | 'circuits'; // a list of round times (seconds)

export interface ValueField {
  key: string;
  label: string;
}

/** A pre-defined (always available) activity with its own dedicated record fields. */
export interface StandardActivityDef {
  name: string; // full name, e.g. "Movement: Single Leg Step Up"
  label: string;
  kind: ActivityKind | 'multi';
  unit?: string;
  /** false = just a measurement, never "Passed" (e.g. push-up reps). */
  hasStatus: boolean;
  /** Value fields in input order. */
  fields: ValueField[];
  passField?: string;
  obsField?: string;
  /** Auto-computed text ratios for multi-field tests (McGill's): fields[a] / fields[b]. */
  ratios?: { key: string; a: number; b: number }[];
  /** Record fields computed from this activity plus another (e.g. waist:hip ratio); cleared with it. */
  derivedFields?: (string)[];
  /** Section heading this activity is listed under (fixed-list categories only). */
  group?: string;
  /** Field indexes drawn on the graph (default: all). */
  graphFields?: number[];
}

export interface CustomKindChoice {
  label: string;
  kind: ActivityKind;
  unit?: string;
  valueType: string | undefined;
  /** Two-value ('dual') activities that are not left/right: names of the two inputs, e.g. Distance and Duration. */
  fieldLabels?: [string, string];
  /** Still understood for activities already saved, but no longer offered when adding a new one. */
  hidden?: boolean;
}

export interface CategoryConfig {
  /** Record.category value and goal-name prefix (without ": "). */
  category: string;
  title: string;
  standards: StandardActivityDef[];
  /** How a coach-added activity is measured. More than one entry = coach picks when adding. */
  customKinds: CustomKindChoice[];
  placeholder: string;
  /** Optional categories can be "removed for this client" and revealed again. */
  optional?: boolean;
  /** Fields passed to clearClientCategoryData when the whole category is removed. */
  clearFields?: string[];
  /** Activities can be added as a step under another ("Parent > Step"), e.g. Skills. */
  hierarchical?: boolean;
  /** Each added activity has a target to reach (reps or seconds). */
  hasTarget?: boolean;
  /** Pure measurement list: no coach-added activities, nothing is ever "Passed". */
  fixedList?: boolean;
  /** Each activity carries a standing coach review (shown to the client), also settable when adding. */
  review?: boolean;
  /** Coach-added activities have no Still working / Passed / Already fit choice (results are just tracked). */
  noStatusForCustom?: boolean;
  /** Hide the "Already fit" choice (Posture only has Still working and Passed). */
  noAlreadyFit?: boolean;
}

const f = (key: string, label: string): ValueField => ({ key, label });

const score10Standard = (
  category: string,
  label: string,
  scoreKey: string,
  passKey: string,
  obsKey: string
): StandardActivityDef => ({
  name: `${category}: ${label}`,
  label,
  kind: 'score10',
  hasStatus: true,
  fields: [f(scoreKey, 'Score')],
  passField: passKey,
  obsField: obsKey,
});

const numberStandard = (
  category: string,
  label: string,
  key: string,
  unit: string,
  hasStatus: boolean
): StandardActivityDef => ({
  name: `${category}: ${label}`,
  label,
  kind: 'number',
  unit,
  hasStatus,
  fields: [f(key, label)],
});

const bcaMetric = (label: string, valueKey: string, normalKey: string, unit: string): StandardActivityDef => ({
  name: `BCA: ${label}`,
  label,
  kind: 'multi',
  unit,
  hasStatus: false,
  fields: [
    f(valueKey, 'Current'),
    f(`${normalKey}NormalMin` as string, 'Normal from'),
    f(`${normalKey}NormalMax` as string, 'Normal to'),
    f(`${normalKey}Goal` as string, 'Goal'),
  ],
  graphFields: [0],
});

export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  BCA: {
    category: 'BCA',
    title: 'BCA',
    standards: [
      bcaMetric('Body Weight', 'weightKg', 'weight', 'kg'),
      bcaMetric('Body Fat', 'bodyFatPercentage', 'bodyFat', '%'),
      bcaMetric('Body Fat (kg)', 'bodyFatKg', 'bodyFatKg', 'kg'),
      bcaMetric('Muscle Mass', 'muscleMassKg', 'muscleMass', 'kg'),
      bcaMetric('Skeletal Muscle Mass', 'skeletalMuscleMassKg', 'skeletalMuscle', 'kg'),
      bcaMetric('BMI', 'bmi', 'bmi', ''),
      bcaMetric('Visceral Fat', 'visceralFatLevel', 'visceralFat', ''),
      numberStandard('BCA', 'Chest', 'chestCircumferenceIn', 'in', false),
      { ...numberStandard('BCA', 'Waist', 'waistCircumferenceIn', 'in', false), derivedFields: ['waistToHipRatio'] },
      { ...numberStandard('BCA', 'Hips', 'hipsCircumferenceIn', 'in', false), derivedFields: ['waistToHipRatio'] },
      numberStandard('BCA', 'Right Arm', 'rightArmCircumferenceIn', 'in', false),
      numberStandard('BCA', 'Left Arm', 'leftArmCircumferenceIn', 'in', false),
      numberStandard('BCA', 'Right Thigh', 'rightThighCircumferenceIn', 'in', false),
      numberStandard('BCA', 'Left Thigh', 'leftThighCircumferenceIn', 'in', false),
      numberStandard('BCA', 'Calf', 'calfCircumferenceIn', 'in', false),
    ],
    customKinds: [{ label: 'Value', kind: 'number', unit: '', valueType: undefined }],
    placeholder: '',
    fixedList: true,
  },

  Posture: {
    category: 'Posture',
    noAlreadyFit: true,
    title: 'Posture',
    standards: [],
    customKinds: [{ label: 'Score out of 10', kind: 'score10', valueType: 'score_10' }],
    placeholder: 'e.g. Forward Head Posture',
  },

  'Flexibility & Mobility': {
    category: 'Flexibility & Mobility',
    title: 'Flexibility & Mobility',
    standards: [
      score10Standard('Flexibility & Mobility', 'Thomas Test', 'thomasTestScore', 'thomasTestPass', 'thomasTestObservation'),
      score10Standard('Flexibility & Mobility', 'Passive Straight Leg Raise', 'passiveStraightLegRaiseScore', 'passiveStraightLegRaisePass', 'passiveStraightLegRaiseObservation'),
      score10Standard('Flexibility & Mobility', 'Shoulder Flexion Test', 'shoulderFlexionScore', 'shoulderFlexionTestPass', 'shoulderFlexionObservation'),
      score10Standard('Flexibility & Mobility', 'Shoulder Extension Test', 'shoulderExtensionScore', 'shoulderExtensionTestPass', 'shoulderExtensionObservation'),
    ],
    customKinds: [{ label: 'Score out of 10', kind: 'score10', valueType: 'score_10' }],
    placeholder: 'e.g. Ankle Dorsiflexion',
    review: true,
  },

  Movement: {
    category: 'Movement',
    title: 'Movement',
    standards: [
      score10Standard('Movement', 'Bend & Lift Squat Pattern', 'bendAndLiftSquatPatternScore', 'bendAndLiftSquatPatternPass', 'bendAndLiftSquatPatternObservation'),
      score10Standard('Movement', 'Single Leg Step Up', 'singleLegStepUpScore', 'singleLegStepUpPass', 'singleLegStepUpObservation'),
      score10Standard('Movement', 'Shoulder Push Stabilization', 'shoulderPushStabilizationScore', 'shoulderPushStabilizationPass', 'shoulderPushStabilizationObservation'),
      score10Standard('Movement', 'Pull Stability Standing Row', 'pullStabilityStandingRowScore', 'pullStabilityStandingRowPass', 'pullStabilityStandingRowObservation'),
      score10Standard('Movement', 'Thoracic Spine Mobility', 'thoracicSpineMobilityScore', 'thoracicSpineMobilityPass', 'thoracicSpineMobilityObservation'),
      score10Standard('Movement', 'Overhead Squat Test', 'overheadSquatTestScore', 'overheadSquatTestPass', 'overheadSquatTestObservation'),
    ],
    customKinds: [{ label: 'Score out of 10', kind: 'score10', valueType: 'score_10' }],
    placeholder: 'e.g. Turkish Get-Up',
  },

  Balance: {
    category: 'Balance',
    title: 'Balance',
    standards: [
      {
        name: 'Balance: Unipedal Stance Test',
        label: 'Unipedal Stance Test',
        kind: 'dual',
        unit: 'sec',
        hasStatus: true,
        fields: [f('unipedalStanceLeftSeconds', 'Left'), f('unipedalStanceRightSeconds', 'Right')],
      },
    ],
    customKinds: [
      { label: 'Both sides - one time', kind: 'number', unit: 'sec', valueType: 'bilateral_time' },
      { label: 'Left & right - two times', kind: 'dual', unit: 'sec', valueType: 'unilateral_time' },
    ],
    review: true,
    placeholder: 'e.g. Single Leg Balance Eyes Closed',
  },

  'Core Endurance & Stability': {
    category: 'Core Endurance & Stability',
    noStatusForCustom: true,
    title: 'Core Endurance & Stability',
    standards: [
      {
        name: "Core Endurance & Stability: McGill's Test",
        label: "McGill's Core Endurance Test",
        kind: 'multi',
        unit: 'sec',
        hasStatus: false,
        fields: [
          f('mcgillFlexorSeconds', 'Flexor'),
          f('mcgillExtensorSeconds', 'Extensor'),
          f('mcgillRightSideBridgeSeconds', 'Right side bridge'),
          f('mcgillLeftSideBridgeSeconds', 'Left side bridge'),
        ],
        ratios: [
          { key: 'mcgillFlexorExtensorRatio', a: 0, b: 1 },
          { key: 'mcgillRightLeftSideRatio', a: 2, b: 3 },
          { key: 'mcgillRightToExtensorRatio', a: 2, b: 1 },
          { key: 'mcgillLeftToExtensorRatio', a: 3, b: 1 },
        ],
      },
    ],
    customKinds: [
      { label: 'Time (min · sec)', kind: 'number', unit: 'sec', valueType: 'time_seconds' },
      { label: 'Reps', kind: 'number', unit: 'reps', valueType: 'reps' },
    ],
    review: true,
    placeholder: 'e.g. Plank Hold',
  },

  SAQ: {
    category: 'SAQ',
    noStatusForCustom: true,
    title: 'SAQ',
    standards: [numberStandard('SAQ', 'T Test', 'tTestSeconds', 'sec', true)],
    customKinds: [{ label: 'Time in seconds', kind: 'number', unit: 'sec', valueType: 'time_seconds' }],
    placeholder: 'e.g. 5-10-5 Shuttle',
    optional: true,
    clearFields: ['tTestSeconds'],
  },

  'Muscular Endurance': {
    category: 'Muscular Endurance',
    noStatusForCustom: true,
    title: 'Muscular Endurance',
    standards: [
      numberStandard('Muscular Endurance', 'Push-Ups', 'pushUpsReps', 'reps', false),
      numberStandard('Muscular Endurance', 'Pull-Ups', 'pullUpMaxReps', 'reps', false),
      numberStandard('Muscular Endurance', 'Bodyweight Squats', 'bodyweightSquatsReps', 'reps', false),
    ],
    customKinds: [
      { label: 'Reps', kind: 'number', unit: 'reps', valueType: 'reps' },
      { label: 'Time (min · sec)', kind: 'number', unit: 'sec', valueType: 'time_seconds' },
    ],
    review: true,
    placeholder: 'e.g. Wall Sit',
    optional: true,
    clearFields: ['pushUpsReps', 'pullUpMaxReps', 'bodyweightSquatsReps'],
  },

  'Muscular Strength': {
    category: 'Muscular Strength',
    noStatusForCustom: true,
    title: 'Muscular Strength',
    standards: [
      numberStandard('Muscular Strength', 'Bench Press 1RM', 'benchPress1RM', 'kg', false),
      numberStandard('Muscular Strength', 'Squat 1RM', 'squat1RM', 'kg', false),
      numberStandard('Muscular Strength', 'Deadlift 1RM', 'deadlift1RM', 'kg', false),
      numberStandard('Muscular Strength', 'Overhead Press 1RM', 'overheadPress1RM', 'kg', false),
    ],
    customKinds: [{ label: 'Weight in kg', kind: 'number', unit: 'kg', valueType: undefined }],
    review: true,
    placeholder: 'e.g. Front Squat 1RM',
    optional: true,
    clearFields: ['benchPress1RM', 'squat1RM', 'deadlift1RM', 'overheadPress1RM'],
  },

  Power: {
    category: 'Power',
    noStatusForCustom: true,
    title: 'Power',
    standards: [numberStandard('Power', 'Vertical Jump', 'verticalJumpCm', 'cm', false)],
    customKinds: [{ label: 'Value', kind: 'number', unit: '', valueType: undefined }],
    placeholder: 'e.g. Broad Jump',
    optional: true,
    clearFields: ['verticalJumpCm'],
  },

  Cardio: {
    category: 'Cardio',
    title: 'Cardio',
    standards: [
      numberStandard('Cardio', 'VO2 Max', 'vo2Max', 'ml/kg/min', true),
      {
        name: 'Cardio: Blood Pressure',
        label: 'Blood Pressure',
        kind: 'multi',
        unit: 'mmHg',
        hasStatus: false,
        fields: [f('bloodPressureSystolic', 'Systolic'), f('bloodPressureDiastolic', 'Diastolic')],
      },
      numberStandard('Cardio', 'Resting Heart Rate', 'restingHeartRateBpm', 'bpm', false),
      numberStandard('Cardio', 'Conditioning Score', 'aerobicCapacityScore', '/100', false),
    ],
    customKinds: [
      { label: 'Distance + Duration', kind: 'dual', unit: '', valueType: 'distance_duration', fieldLabels: ['Distance (km)', 'Duration (min)'] },
      { label: 'Distance (km)', kind: 'number', unit: 'km', valueType: 'distance_km', hidden: true },
      { label: 'Duration (min)', kind: 'number', unit: 'min', valueType: 'duration_minutes', hidden: true },
      { label: 'Steps', kind: 'number', unit: 'steps', valueType: 'steps' },
      { label: 'Circuits', kind: 'circuits', unit: 'sec', valueType: 'circuits' },
    ],
    placeholder: 'e.g. 1-Mile Run Time',
  },

  Skills: {
    category: 'Skills',
    title: 'Skills',
    standards: [],
    customKinds: [
      { label: 'Reps', kind: 'number', unit: 'reps', valueType: 'reps' },
      { label: 'Hold (seconds)', kind: 'number', unit: 'sec', valueType: 'time_seconds' },
    ],
    placeholder: 'e.g. Ring Muscle-Up',
    optional: true,
    clearFields: ['skillProgressions'],
    hierarchical: true,
    hasTarget: true,
  },
};

CATEGORY_CONFIGS.BCA.standards.forEach((st, i) => {
  st.group = i < 7 ? 'BCA' : 'Measurements';
});

