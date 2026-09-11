import React, { useMemo, useState } from 'react';
import { initializeClientFirebaseApp, doc, setDoc } from './firebase';

// Shadow/silhouette figures whose pose matches what the current
// question is about, and whose body shape reflects the client's
// selected gender once that's known. Hand-built SVGs rather than
// uploaded image files, since those kept running into upload/naming
// issues - this way there's nothing external that can go missing or
// mismatched.
const Fig: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className, style }) => (
  <svg viewBox="0 0 200 400" fill="currentColor" className={className} style={style}>{children}</svg>
);

// Standing - neutral introductory pose
const StandM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}><circle cx="100" cy="52" r="40" /><path d="M100 98c-32 0-55 8-65 26-8 14-9 34-9 34l14 6-4 60 10 138c1 14 12 24 26 24h56c14 0 25-10 26-24l10-138-4-60 14-6s-1-20-9-34c-10-18-33-26-65-26Z" /></Fig>
);
const StandF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}><circle cx="100" cy="50" r="38" /><path d="M100 94c-26 0-44 10-52 28-7 15-6 34 4 46l-10 34c-6 20 4 40 22 46l-4 40c-2 18 12 34 30 34h20c18 0 32-16 30-34l-4-40c18-6 28-26 22-46l-10-34c10-12 11-31 4-46-8-18-26-28-52-28Z" /></Fig>
);
const StandN: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}><circle cx="100" cy="55" r="42" /><path d="M100 105c-48 0-82 32-88 82-3 28-3 90-3 150 0 20 16 36 36 36h110c20 0 36-16 36-36 0-60 0-122-3-150-6-50-40-82-88-82Z" /></Fig>
);

// Exercising - one arm raised holding a weight, active stance
const ExerciseM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="95" cy="55" r="38" />
    <path d="M95 100c-26 0-42 10-50 24l-30-20-12 18 38 30c6 4 14 5 20 1l14-9v10l-10 30-6 130c-1 14 10 26 24 26h44c14 0 25-12 24-26l-6-130v-45c8 2 14 8 14 16v40h22V150c0-28-18-46-46-50Z" />
    <rect x="0" y="60" width="16" height="40" rx="4" />
  </Fig>
);
const ExerciseF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="95" cy="53" r="36" />
    <path d="M95 96c-22 0-38 9-46 22l-28-19-12 18 36 28c6 4 13 5 19 1l13-8v14c8 4 12 12 12 20l-8 26-6 100c-1 14 10 26 24 26h20c14 0 25-12 24-26l-6-100-4-24 4-16h20v-24c0-24-16-38-38-38Z" />
    <rect x="2" y="58" width="14" height="36" rx="4" />
  </Fig>
);

// Sleeping - lying on side, resting
const SleepM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} >
    <g transform="translate(0,60) rotate(0)">
      <ellipse cx="150" cy="230" rx="34" ry="34" />
      <path d="M150 264c-30 0-100 6-120 20-12 8-14 22-14 30h180c10 0 18-8 18-18 0-16-30-32-64-32Z" />
      <ellipse cx="20" cy="270" rx="16" ry="10" />
    </g>
  </Fig>
);
const SleepF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <g transform="translate(0,60)">
      <ellipse cx="150" cy="228" rx="32" ry="32" />
      <path d="M150 260c-28 0-96 8-114 22-10 8-12 20-12 28h172c10 0 16-8 16-16 0-16-28-34-62-34Z" />
      <ellipse cx="22" cy="266" rx="16" ry="10" />
    </g>
  </Fig>
);

// Eating - seated, arm raised toward mouth, plate nearby
const EatM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="100" cy="60" r="38" />
    <path d="M75 98c4 10 8 24 6 34l-16 8v20h20l6 60-4 100c-1 12 9 22 20 22h20c12 0 21-11 20-22l-6-90 4-70 30 8 8-18-40-20c-8-10-20-24-28-32Z" />
    <ellipse cx="150" cy="230" rx="30" ry="8" />
  </Fig>
);
const EatF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="100" cy="58" r="36" />
    <path d="M78 94c4 9 7 22 5 31l-15 7v18h18l6 55-4 90c-1 12 9 22 20 22h16c12 0 20-11 19-22l-5-82 3-63 27 7 7-16-36-18c-7-9-18-22-25-29Z" />
    <ellipse cx="145" cy="210" rx="28" ry="7" />
  </Fig>
);

// Reaching - both arms raised up, achievement / goal pose
const ReachM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="100" cy="60" r="38" />
    <path d="M60 96l-24-40-16 10 24 46c4 8 12 12 20 11l6-1v10l-10 30-6 130c-1 14 10 26 24 26h32c14 0 25-12 24-26l-6-130-10-30v-10l6 1c8 1 16-3 20-11l24-46-16-10-24 40c-8-6-20-10-34-10s-26 4-34 10Z" />
  </Fig>
);
const ReachF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="100" cy="58" r="36" />
    <path d="M64 92l-22-38-15 9 22 44c4 7 11 11 18 10l5-1v13c7 4 11 12 11 19l-7 25-5 95c-1 12 9 22 20 22h18c12 0 20-11 19-22l-5-95-6-24 5-20v-13l5 1c7 1 14-3 18-10l22-44-15-9-22 38c-7-5-18-9-30-9s-24 4-30 9Z" />
  </Fig>
);

// Medical - standing figure with a cross symbol, for health topics
const MedicalM: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="90" cy="52" r="38" />
    <path d="M90 98c-30 0-51 8-61 24-7 13-8 32-8 32l13 6-4 56 9 130c1 13 11 22 24 22h52c13 0 23-9 24-22l9-130-4-56 13-6s-1-19-8-32c-10-16-31-24-61-24Z" />
    <rect x="140" y="110" width="50" height="16" rx="3" />
    <rect x="157" y="93" width="16" height="50" rx="3" />
  </Fig>
);
const MedicalF: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <Fig className={className} style={style}>
    <circle cx="90" cy="50" r="36" />
    <path d="M90 92c-25 0-42 9-49 26-6 14-5 32 4 43l-9 32c-6 19 4 38 21 43l-4 38c-2 17 11 32 28 32h18c17 0 30-15 28-32l-4-38c17-5 27-24 21-43l-9-32c9-11 10-29 4-43-7-17-24-26-49-26Z" />
    <rect x="140" y="106" width="48" height="15" rx="3" />
    <rect x="156" y="90" width="15" height="48" rx="3" />
  </Fig>
);

// Maps each pose to its male/female/neutral component set
const POSES: Record<string, { m: React.FC<{ className?: string; style?: React.CSSProperties }>; f: React.FC<{ className?: string; style?: React.CSSProperties }>; n: React.FC<{ className?: string; style?: React.CSSProperties }> }> = {
  standing: { m: StandM, f: StandF, n: StandN },
  exercising: { m: ExerciseM, f: ExerciseF, n: StandN },
  sleeping: { m: SleepM, f: SleepF, n: SleepM },
  eating: { m: EatM, f: EatF, n: EatM },
  reaching: { m: ReachM, f: ReachF, n: ReachM },
  medical: { m: MedicalM, f: MedicalF, n: MedicalM },
};

const IconChevronLeft: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

// Which pose fits each of the 16 original sections
const SECTION_POSE: Record<string, string> = {
  'Personal Details': 'standing',
  'Medical Information': 'medical',
  'Surgery & Injury History': 'medical',
  'Family History': 'standing',
  'Substance-Related Habits': 'standing',
  'Physical Activity': 'exercising',
  'Occupational': 'standing',
  'Sleep & Stress': 'sleeping',
  'Weight History': 'standing',
  'Circumferences': 'standing',
  'Body Composition': 'exercising',
  'Goals & Readiness': 'reaching',
  'COVID History': 'medical',
  'Nutrition': 'eating',
  'Food & Medical Considerations': 'eating',
  'Fitness Goal': 'reaching',
};

// Every section stays within the brand's red-to-cyan identity, but
// each one shifts emphasis and direction slightly, so moving through
// the form still feels like it's progressing subject by subject
// rather than one flat, unchanging background throughout.
// One single, solid color tint on the dark background - no gradient,
// no mixing two colors, just one consistent brand-red shade.
const SINGLE_TINT = 'bg-[#ec2226]/10';

interface PrqScreenProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  onComplete: () => void;
}

interface PrqFormData {
  [key: string]: string | string[] | boolean | null;
}

type FieldType = 'text' | 'number' | 'textarea' | 'date' | 'yesno' | 'chips' | 'single' | 'scale' | 'consent';

interface QuestionConfig {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  options?: string[];
  section: string;
  showIf?: (form: PrqFormData) => boolean;
}

const MEDICAL_CONDITIONS = [
  'Allergies', 'Amenorrhea', 'Anemia', 'Anxiety', 'Arthritis', 'Asthma', 'Celiac disease',
  'Chronic sinus condition', 'Constipation', "Crohn's disease", 'Depression', 'Diabetes',
  'Diarrhea', 'Disordered eating', 'Gastroesophageal reflux disease (GERD)', 'High blood pressure',
  'Hypoglycemia', 'Hypo/hyperthyroidism', 'Insomnia', 'Intestinal problems', 'Irritability',
  'Irritable bowel syndrome (IBS)', 'Menopausal symptoms', 'Osteoporosis',
  'Premenstrual syndrome (PMS)', 'Polycystic ovary syndrome (PCOS)', 'Pregnant', 'Skin problems', 'Ulcer',
];
const FAMILY_HISTORY_OPTIONS = ['Heart disease', 'High cholesterol', 'High blood pressure', 'Cancer', 'Diabetes', 'Osteoporosis'];
const TASTE_OPTIONS = ['Sweet', 'Salty', 'Spicy', 'Savoury', 'Bitter', 'Umami'];
const TEXTURE_OPTIONS = ['Mild / Neutral', 'Crunchy', 'Soft', 'Creamy', 'Chewy'];
const MEAL_TIMING_OPTIONS = ['Big breakfast', 'Big lunch', 'Big dinner', 'Small frequent meals', 'Large meals', '3 standard meals'];

// Each section gets its own gradient + icon, giving every question a
// distinct visual identity instead of a flat, uniform form.
// Single, consistent brand background for every question - the
// app's actual red-to-cyan identity, not a different color per topic.
const BRAND_BG = 'bg-[#0c0d10]';

const questions: QuestionConfig[] = [
  // Section 1 - Personal Details
  { key: 'fullName', type: 'text', label: "What's your full name?", section: 'Personal Details' },
  { key: 'sex', type: 'single', label: 'What is your sex?', options: ['Male', 'Female'], section: 'Personal Details' },
  { key: 'dateOfBirth', type: 'date', label: "When's your date of birth?", section: 'Personal Details' },
  { key: 'age', type: 'number', label: 'How old are you?', section: 'Personal Details' },
  { key: 'maritalStatus', type: 'text', label: "What's your marital status?", section: 'Personal Details' },
  { key: 'contactNumber', type: 'text', label: "What's the best number to reach you?", section: 'Personal Details' },
  { key: 'emergencyContactNumber', type: 'text', label: "Who should we call in an emergency, and what's their number?", section: 'Personal Details' },
  { key: 'address', type: 'textarea', label: "What's your home address?", section: 'Personal Details' },

  // Section 2 - Medical Information
  { key: 'weightKg', type: 'number', label: "What's your current weight? (kg)", section: 'Medical Information' },
  { key: 'heightCm', type: 'number', label: "What's your height? (cm)", section: 'Medical Information' },
  { key: 'presentHealthState', type: 'single', label: 'How would you describe your present state of health?', options: ['Very healthy', 'Healthy', 'Unhealthy', 'Unwell'], section: 'Medical Information' },
  { key: 'currentMedications', type: 'textarea', label: 'List any current medications, how often you take them, and dosages.', section: 'Medical Information' },
  { key: 'takesMedicationsAsPrescribed', type: 'single', label: 'Do you take all your medications exactly as prescribed?', options: ['Yes', 'No', 'N/A'], section: 'Medical Information' },
  { key: 'reasonNotTakingAsPrescribed', type: 'textarea', label: "If not, what's the reason?", section: 'Medical Information', showIf: (f) => f.takesMedicationsAsPrescribed === 'No' },
  { key: 'takesSupplements', type: 'yesno', label: 'Do you take any vitamin, mineral, or herbal supplements?', section: 'Medical Information' },
  { key: 'supplementDetails', type: 'textarea', label: 'What type, and how much per day?', section: 'Medical Information', showIf: (f) => f.takesSupplements === true },
  { key: 'lastPhysicianVisit', type: 'text', label: 'When did you last visit your physician?', section: 'Medical Information' },
  { key: 'totalCholesterol', type: 'number', label: 'Do you know your total cholesterol? (leave blank if unsure)', section: 'Medical Information' },
  { key: 'hdl', type: 'number', label: 'And your HDL?', section: 'Medical Information' },
  { key: 'ldl', type: 'number', label: 'And your LDL?', section: 'Medical Information' },
  { key: 'hasCheckedBloodSugar', type: 'yesno', label: 'Have you ever had your blood sugar checked?', section: 'Medical Information' },
  { key: 'bloodSugarResults', type: 'textarea', label: 'What were the results?', section: 'Medical Information', showIf: (f) => f.hasCheckedBloodSugar === true },
  { key: 'medicalConditions', type: 'chips', label: 'Do any of these apply to you? Select all that do.', options: MEDICAL_CONDITIONS, section: 'Medical Information' },
  { key: 'pregnancyWeeksAlong', type: 'number', label: 'How many weeks along are you?', section: 'Medical Information', showIf: (f) => Array.isArray(f.medicalConditions) && f.medicalConditions.includes('Pregnant') },
  { key: 'medicalConditionsNotes', type: 'textarea', label: 'Anything important we should know about the condition(s) you selected?', section: 'Medical Information' },

  // Section 3 - Surgery & Injury History
  { key: 'hadMajorSurgery', type: 'yesno', label: 'Have you had any major surgery?', section: 'Surgery & Injury History' },
  { key: 'majorSurgeryDetails', type: 'textarea', label: 'Please describe.', section: 'Surgery & Injury History', showIf: (f) => f.hadMajorSurgery === true },
  { key: 'hadPastInjuries', type: 'yesno', label: 'Have you had any past injuries?', section: 'Surgery & Injury History' },
  { key: 'pastInjuryDetails', type: 'textarea', label: 'What was the injury?', section: 'Surgery & Injury History', showIf: (f) => f.hadPastInjuries === true },
  { key: 'hasActivityLimitingInjuries', type: 'yesno', label: 'Have you experienced any injuries that may limit your physical activity?', section: 'Surgery & Injury History' },
  { key: 'activityLimitingInjuryDetails', type: 'textarea', label: 'What was the injury?', section: 'Surgery & Injury History', showIf: (f) => f.hasActivityLimitingInjuries === true },
  { key: 'hasCurrentInjuries', type: 'yesno', label: 'Do you currently have any injuries?', section: 'Surgery & Injury History' },
  { key: 'currentInjuryDetails', type: 'textarea', label: 'Please describe.', section: 'Surgery & Injury History', showIf: (f) => f.hasCurrentInjuries === true },

  // Section 4 - Family History
  { key: 'familyMedicalHistory', type: 'chips', label: 'Has anyone in your immediate family been diagnosed with any of these?', options: FAMILY_HISTORY_OPTIONS, section: 'Family History' },

  // Section 5 - Substance-Related Habits
  { key: 'drinksAlcohol', type: 'yesno', label: 'Do you drink alcohol?', section: 'Substance-Related Habits' },
  { key: 'alcoholFrequency', type: 'text', label: 'How often?', section: 'Substance-Related Habits', showIf: (f) => f.drinksAlcohol === true },
  { key: 'alcoholTimesPerWeek', type: 'number', label: 'How many times per week?', section: 'Substance-Related Habits', showIf: (f) => f.drinksAlcohol === true },
  { key: 'alcoholAverageAmount', type: 'text', label: "What's your average amount?", section: 'Substance-Related Habits', showIf: (f) => f.drinksAlcohol === true },
  { key: 'drinksCaffeine', type: 'yesno', label: 'Do you drink caffeinated beverages?', section: 'Substance-Related Habits' },
  { key: 'caffeinePerDay', type: 'number', label: 'How many per day?', section: 'Substance-Related Habits', showIf: (f) => f.drinksCaffeine === true },
  { key: 'usesTobacco', type: 'yesno', label: 'Do you use tobacco?', section: 'Substance-Related Habits' },
  { key: 'tobaccoAmount', type: 'text', label: 'How much, per day?', section: 'Substance-Related Habits', showIf: (f) => f.usesTobacco === true },

  // Section 6 - Physical Activity
  { key: 'doesStructuredActivity', type: 'yesno', label: 'Do you currently participate in any structured physical activity?', section: 'Physical Activity' },
  { key: 'structuredActivityDescription', type: 'textarea', label: 'Please describe.', section: 'Physical Activity', showIf: (f) => f.doesStructuredActivity === true },
  { key: 'cardioMinutesPerSession', type: 'number', label: 'How many minutes of cardio, per session?', section: 'Physical Activity' },
  { key: 'cardioTimesPerWeek', type: 'number', label: 'And how many cardio sessions per week?', section: 'Physical Activity' },
  { key: 'muscularTrainingSessionsPerWeek', type: 'number', label: 'How many muscular training sessions per week?', section: 'Physical Activity' },
  { key: 'flexibilitySessionsPerWeek', type: 'number', label: 'And flexibility or mobility sessions per week?', section: 'Physical Activity' },
  { key: 'doesSportsOrRecreation', type: 'yesno', label: 'Do you play any sports or do recreational activities?', section: 'Physical Activity' },
  { key: 'sportsDetails', type: 'textarea', label: 'Which ones, and how many days a week?', section: 'Physical Activity', showIf: (f) => f.doesSportsOrRecreation === true },
  { key: 'trainingExperienceLevel', type: 'single', label: "What's your training experience level?", options: ['Beginner', 'Intermediate', 'Advanced'], section: 'Physical Activity' },
  { key: 'feelingsAboutExercise', type: 'textarea', label: 'Honestly, how do you feel about exercise?', section: 'Physical Activity' },
  { key: 'favoritePhysicalActivities', type: 'textarea', label: 'What are some of your favorite physical activities?', section: 'Physical Activity' },

  // Section 7 - Occupational
  { key: 'works', type: 'yesno', label: 'Do you currently work?', section: 'Occupational' },
  { key: 'occupation', type: 'text', label: "What's your occupation?", section: 'Occupational', showIf: (f) => f.works === true },
  { key: 'workSchedule', type: 'text', label: "What's your work schedule like?", section: 'Occupational', showIf: (f) => f.works === true },
  { key: 'workActivityLevelDescription', type: 'textarea', label: 'How would you describe your activity level during the work day?', section: 'Occupational' },
  { key: 'dailyActivityLevel', type: 'single', label: 'Overall, how active is your day-to-day?', options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'], section: 'Occupational' },

  // Section 8 - Sleep & Stress
  { key: 'sleepHoursPerNight', type: 'number', label: 'How many hours of sleep do you get at night?', section: 'Sleep & Stress' },
  { key: 'mostStressfulThing', type: 'textarea', label: "What's most stressful to you right now?", section: 'Sleep & Stress' },
  { key: 'stressLevel', type: 'scale', label: 'On a scale of 1 to 10, how stressed do you feel? (1 = none, 10 = constant)', section: 'Sleep & Stress' },
  { key: 'appetiteUnderStress', type: 'single', label: 'How is your appetite affected by stress?', options: ['Increased', 'Not affected', 'Decreased'], section: 'Sleep & Stress' },

  // Section 9 - Weight History
  { key: 'weightGoalDirection', type: 'single', label: 'What would you like to do with your weight?', options: ['Lose weight', 'Gain weight', 'Maintain weight'], section: 'Weight History' },
  { key: 'lowestWeightPast5Years', type: 'number', label: "What's the lowest you've weighed in the past 5 years? (kg)", section: 'Weight History' },
  { key: 'highestWeightPast5Years', type: 'number', label: 'And the highest, in the past 5 years? (kg)', section: 'Weight History' },
  { key: 'idealWeight', type: 'number', label: "What's your ideal, sustainable weight? (kg)", section: 'Weight History' },

  // Section 10 - Circumferences
  { key: 'abdomenCircumferenceCm', type: 'number', label: 'Abdomen circumference, if known (cm)', section: 'Circumferences' },
  { key: 'waistCircumferenceCm', type: 'number', label: 'Waist circumference, if known (cm)', section: 'Circumferences' },
  { key: 'upperArmCircumferenceCm', type: 'number', label: 'Upper arm circumference, if known (cm)', section: 'Circumferences' },
  { key: 'midThighCircumferenceCm', type: 'number', label: 'Mid-thigh circumference, if known (cm)', section: 'Circumferences' },

  // Section 11 - Body Composition
  { key: 'bmi', type: 'number', label: 'BMI, if you know it from a recent scan', section: 'Body Composition' },
  { key: 'fatMassKg', type: 'number', label: 'Fat mass, if known (kg)', section: 'Body Composition' },
  { key: 'skeletalMuscleMassKg', type: 'number', label: 'Skeletal muscle mass, if known (kg)', section: 'Body Composition' },

  // Section 12 - Goals & Readiness
  { key: 'readinessToAdoptHealthyLifestyle', type: 'scale', label: 'How likely are you to adopt a healthier lifestyle? (1 = very unlikely, 10 = very likely)', section: 'Goals & Readiness' },
  { key: 'hasSpecificHealthGoals', type: 'yesno', label: 'Do you have specific goals for improving your health?', section: 'Goals & Readiness' },
  { key: 'healthGoalsPrioritized', type: 'textarea', label: 'List them in order of importance to you.', section: 'Goals & Readiness', showIf: (f) => f.hasSpecificHealthGoals === true },

  // Section 13 - COVID History
  { key: 'diagnosedWithCovidBefore', type: 'yesno', label: 'Have you been diagnosed with COVID before?', section: 'COVID History' },

  // Section 14 - Nutrition
  { key: 'followingADiet', type: 'yesno', label: 'Are you currently following any diet?', section: 'Nutrition' },
  { key: 'dietDescription', type: 'textarea', label: 'Please describe it.', section: 'Nutrition', showIf: (f) => f.followingADiet === true },
  { key: 'dietaryLifestyle', type: 'single', label: 'Do you follow a particular dietary lifestyle?', options: ['None', 'Halal', 'Vegetarian', 'Vegan', 'Kosher', 'Pescatarian', 'Other'], section: 'Nutrition' },
  { key: 'dietaryLifestyleOtherNote', type: 'text', label: 'Please specify.', section: 'Nutrition', showIf: (f) => f.dietaryLifestyle === 'Other' },
  { key: 'tastePreferences', type: 'chips', label: 'What flavors do you enjoy most?', options: TASTE_OPTIONS, section: 'Nutrition' },
  { key: 'texturePreferences', type: 'chips', label: 'And what textures?', options: TEXTURE_OPTIONS, section: 'Nutrition' },
  { key: 'temperaturePreference', type: 'single', label: 'Hot meals, cold meals, or no preference?', options: ['Hot meals', 'Cold meals', 'No preference'], section: 'Nutrition' },
  { key: 'mealTimingPreferences', type: 'chips', label: 'How do you like to structure your meals?', options: MEAL_TIMING_OPTIONS, section: 'Nutrition' },

  // Section 15 - Food & Medical Considerations
  { key: 'hasSpecificIllness', type: 'yesno', label: 'Do you have any specific illness we should factor in?', section: 'Food & Medical Considerations' },
  { key: 'illnessDetails', type: 'textarea', label: 'Please explain.', section: 'Food & Medical Considerations', showIf: (f) => f.hasSpecificIllness === true },
  { key: 'hasFoodAllergy', type: 'yesno', label: 'Do you have any food allergies?', section: 'Food & Medical Considerations' },
  { key: 'foodAllergyDetails', type: 'textarea', label: 'Please describe.', section: 'Food & Medical Considerations', showIf: (f) => f.hasFoodAllergy === true },
  { key: 'foodsNeverEaten', type: 'textarea', label: "Any food or drink you avoid entirely? (e.g. milk, fish)", section: 'Food & Medical Considerations' },

  // Section 16 - Fitness Goal
  { key: 'fitnessGoal', type: 'textarea', label: "Last one - what's your fitness goal? Tell your coach what you're really working toward.", section: 'Fitness Goal' },
  { key: 'consentConfirmed', type: 'consent', label: 'Almost done.', section: 'Fitness Goal' },
];

export const PrqScreen: React.FC<PrqScreenProps> = ({ clientId, clientName, clientEmail, onComplete }) => {
  const [form, setForm] = useState<PrqFormData>({ fullName: clientName, email: clientEmail });
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const visibleQuestions = useMemo(
    () => questions.filter((q) => !q.showIf || q.showIf(form)),
    // Re-filter whenever an answer changes, since a later question's
    // visibility can depend on an earlier one (e.g. "Pregnant" reveals
    // a weeks-along question further down the list).
    [form]
  );

  const current = visibleQuestions[index];
  // The pose reflects what this question is actually about (exercise,
  // sleep, eating, etc.), and the body shape reflects the client's
  // answered sex - neutral until that question is answered.
  const poseName = SECTION_POSE[current.section] || 'standing';
  const pose = POSES[poseName];
  const Silhouette = form.sex === 'Male' ? pose.m : form.sex === 'Female' ? pose.f : pose.n;
  const isLast = index === visibleQuestions.length - 1;

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleChip = (key: string, value: string) => {
    setForm((prev) => {
      const list = (prev[key] as string[]) || [];
      return { ...prev, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  };

  const goNext = () => {
    if (isLast) {
      handleSubmit();
    } else {
      setIndex((i) => Math.min(i + 1, visibleQuestions.length - 1));
      setError('');
    }
  };

  const goBack = () => {
    setIndex((i) => Math.max(i - 1, 0));
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.consentConfirmed) {
      setError('Please confirm to finish.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');

      const toNum = (v: any): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = Number(v);
        return isNaN(n) ? undefined : n;
      };
      const toBool = (v: any) => !!v;

      const record: any = {
        id: `PRQ-${clientId}`,
        clientId,
        completedAt: new Date().toISOString(),
        submissionDate: new Date().toISOString().split('T')[0],
        fullName: form.fullName || clientName,
        email: form.email || clientEmail,
        address: form.address,
        contactNumber: form.contactNumber,
        emergencyContactNumber: form.emergencyContactNumber,
        dateOfBirth: form.dateOfBirth,
        age: toNum(form.age) || 0,
        maritalStatus: form.maritalStatus,
        sex: form.sex || undefined,
        weightKg: toNum(form.weightKg) || 0,
        heightCm: toNum(form.heightCm) || 0,
        presentHealthState: form.presentHealthState || 'Healthy',
        currentMedications: form.currentMedications,
        takesMedicationsAsPrescribed: form.takesMedicationsAsPrescribed || 'N/A',
        reasonNotTakingAsPrescribed: form.reasonNotTakingAsPrescribed || undefined,
        takesSupplements: toBool(form.takesSupplements),
        supplementDetails: form.supplementDetails || undefined,
        lastPhysicianVisit: form.lastPhysicianVisit,
        totalCholesterol: toNum(form.totalCholesterol),
        hdl: toNum(form.hdl),
        ldl: toNum(form.ldl),
        hasCheckedBloodSugar: toBool(form.hasCheckedBloodSugar),
        bloodSugarResults: form.bloodSugarResults || undefined,
        medicalConditions: form.medicalConditions || [],
        medicalConditionsNotes: form.medicalConditionsNotes || undefined,
        pregnancyWeeksAlong: toNum(form.pregnancyWeeksAlong),
        hadMajorSurgery: toBool(form.hadMajorSurgery),
        majorSurgeryDetails: form.majorSurgeryDetails || undefined,
        hadPastInjuries: toBool(form.hadPastInjuries),
        pastInjuryDetails: form.pastInjuryDetails || undefined,
        hasActivityLimitingInjuries: toBool(form.hasActivityLimitingInjuries),
        activityLimitingInjuryDetails: form.activityLimitingInjuryDetails || undefined,
        hasCurrentInjuries: toBool(form.hasCurrentInjuries),
        currentInjuryDetails: form.currentInjuryDetails || undefined,
        familyMedicalHistory: form.familyMedicalHistory || [],
        drinksAlcohol: toBool(form.drinksAlcohol),
        alcoholFrequency: form.alcoholFrequency || undefined,
        alcoholTimesPerWeek: toNum(form.alcoholTimesPerWeek),
        alcoholAverageAmount: form.alcoholAverageAmount || undefined,
        drinksCaffeine: toBool(form.drinksCaffeine),
        caffeinePerDay: toNum(form.caffeinePerDay),
        usesTobacco: toBool(form.usesTobacco),
        tobaccoAmount: form.tobaccoAmount || undefined,
        doesStructuredActivity: toBool(form.doesStructuredActivity),
        structuredActivityDescription: form.structuredActivityDescription || undefined,
        cardioMinutesPerSession: toNum(form.cardioMinutesPerSession),
        cardioTimesPerWeek: toNum(form.cardioTimesPerWeek),
        muscularTrainingSessionsPerWeek: toNum(form.muscularTrainingSessionsPerWeek),
        flexibilitySessionsPerWeek: toNum(form.flexibilitySessionsPerWeek),
        doesSportsOrRecreation: toBool(form.doesSportsOrRecreation),
        sportsDetails: form.sportsDetails || undefined,
        feelingsAboutExercise: form.feelingsAboutExercise,
        favoritePhysicalActivities: form.favoritePhysicalActivities,
        trainingExperienceLevel: form.trainingExperienceLevel || undefined,
        works: toBool(form.works),
        occupation: form.occupation || undefined,
        workSchedule: form.workSchedule || undefined,
        workActivityLevelDescription: form.workActivityLevelDescription,
        dailyActivityLevel: form.dailyActivityLevel || undefined,
        sleepHoursPerNight: toNum(form.sleepHoursPerNight) || 0,
        mostStressfulThing: form.mostStressfulThing,
        stressLevel: toNum(form.stressLevel) || 5,
        appetiteUnderStress: form.appetiteUnderStress || 'Not affected',
        weightGoalDirection: form.weightGoalDirection || 'Maintain weight',
        lowestWeightPast5Years: toNum(form.lowestWeightPast5Years) || 0,
        highestWeightPast5Years: toNum(form.highestWeightPast5Years) || 0,
        idealWeight: toNum(form.idealWeight) || 0,
        abdomenCircumferenceCm: toNum(form.abdomenCircumferenceCm),
        waistCircumferenceCm: toNum(form.waistCircumferenceCm),
        upperArmCircumferenceCm: toNum(form.upperArmCircumferenceCm),
        midThighCircumferenceCm: toNum(form.midThighCircumferenceCm),
        bmi: toNum(form.bmi),
        fatMassKg: toNum(form.fatMassKg),
        skeletalMuscleMassKg: toNum(form.skeletalMuscleMassKg),
        readinessToAdoptHealthyLifestyle: toNum(form.readinessToAdoptHealthyLifestyle) || 5,
        hasSpecificHealthGoals: toBool(form.hasSpecificHealthGoals),
        healthGoalsPrioritized: form.healthGoalsPrioritized || undefined,
        diagnosedWithCovidBefore: toBool(form.diagnosedWithCovidBefore),
        followingADiet: toBool(form.followingADiet),
        dietDescription: form.dietDescription || undefined,
        tastePreferences: form.tastePreferences || [],
        texturePreferences: form.texturePreferences || [],
        temperaturePreference: form.temperaturePreference || 'No preference',
        mealTimingPreferences: form.mealTimingPreferences || [],
        dietaryLifestyle: form.dietaryLifestyle || undefined,
        dietaryLifestyleOtherNote: form.dietaryLifestyleOtherNote || undefined,
        hasSpecificIllness: toBool(form.hasSpecificIllness),
        illnessDetails: form.illnessDetails || undefined,
        hasFoodAllergy: toBool(form.hasFoodAllergy),
        foodAllergyDetails: form.foodAllergyDetails || undefined,
        foodsNeverEaten: form.foodsNeverEaten || undefined,
        fitnessGoal: form.fitnessGoal,
        consentConfirmed: toBool(form.consentConfirmed),
        consentDate: new Date().toISOString().split('T')[0],
      };

      const clean: any = {};
      Object.keys(record).forEach((key) => {
        if (record[key] !== undefined) clean[key] = record[key];
      });

      await setDoc(doc(db, 'intokine_prq_records', `PRQ-${clientId}`), clean);
      onComplete();
    } catch (e) {
      setError('This could not be saved. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = () => {
    const value = form[current.key];
    switch (current.type) {
      case 'text':
        return (
          <input
            autoFocus
            type="text"
            value={(value as string) || ''}
            onChange={(e) => set(current.key, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goNext()}
            className="w-full bg-transparent border-b-2 border-white/30 focus:border-white text-white text-2xl font-semibold py-3 focus:outline-none placeholder:text-white/30"
            placeholder="Type your answer..."
          />
        );
      case 'number':
        return (
          <input
            autoFocus
            type="number"
            value={(value as string) || ''}
            onChange={(e) => set(current.key, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goNext()}
            className="w-full bg-transparent border-b-2 border-white/30 focus:border-white text-white text-2xl font-semibold py-3 focus:outline-none placeholder:text-white/30"
            placeholder="0"
          />
        );
      case 'date':
        return (
          <input
            autoFocus
            type="date"
            value={(value as string) || ''}
            onChange={(e) => set(current.key, e.target.value)}
            className="w-full bg-transparent border-b-2 border-white/30 focus:border-white text-white text-xl font-semibold py-3 focus:outline-none [color-scheme:dark]"
          />
        );
      case 'textarea':
        return (
          <textarea
            autoFocus
            value={(value as string) || ''}
            onChange={(e) => set(current.key, e.target.value)}
            rows={4}
            className="w-full bg-white/10 backdrop-blur-sm border border-white/20 focus:border-white rounded-2xl text-white text-lg p-4 focus:outline-none placeholder:text-white/30 resize-none"
            placeholder="Type your answer..."
          />
        );
      case 'yesno':
        return (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { set(current.key, true); setTimeout(goNext, 150); }}
              className={`flex-1 py-4 rounded-2xl text-lg font-bold transition ${value === true ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'}`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => { set(current.key, false); setTimeout(goNext, 150); }}
              className={`flex-1 py-4 rounded-2xl text-lg font-bold transition ${value === false ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'}`}
            >
              No
            </button>
          </div>
        );
      case 'single':
        return (
          <div className="flex flex-wrap gap-2.5">
            {current.options!.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { set(current.key, opt); setTimeout(goNext, 150); }}
                className={`px-4 py-3 rounded-2xl text-sm font-bold transition ${value === opt ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'chips':
        return (
          <div className="flex flex-wrap gap-2.5">
            {current.options!.map((opt) => {
              const list = (value as string[]) || [];
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleChip(current.key, opt)}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition ${list.includes(opt) ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      case 'scale':
        return (
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { set(current.key, String(n)); setTimeout(goNext, 150); }}
                className={`py-3.5 rounded-xl text-base font-bold transition ${value === String(n) ? 'bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'}`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      case 'consent':
        return (
          <label className="flex items-start gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.consentConfirmed}
              onChange={(e) => set('consentConfirmed', e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-white shrink-0"
            />
            <span className="text-sm text-white/90">
              I confirm the information I've given is accurate to the best of my knowledge, and I consent to participate in a supervised exercise and nutrition program based on it.
            </span>
          </label>
        );
      default:
        return null;
    }
  };

  const isAutoAdvance = ['yesno', 'single', 'scale'].includes(current.type);

  return (
    <div className={`min-h-screen ${BRAND_BG} flex flex-col relative overflow-hidden`}>
      {/* One single, solid brand-red tint over the dark background -
          no gradient, same for every question */}
      <div className={`absolute inset-0 ${SINGLE_TINT} pointer-events-none`} />

      {/* Hand-drawn silhouette matching this question's topic and the
          client's answered gender. Fixed size and position in pixels
          so it never shifts or resizes between questions. */}
      <Silhouette
        style={{ width: '480px', height: '600px', right: '-40px', top: '40px' }}
        className="absolute text-white opacity-40 pointer-events-none"
      />

      <div className="relative z-10 px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden">
            <Silhouette className="w-6 h-6 text-[#6ccbde]" />
          </div>
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{current.section}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ec2226] to-[#6ccbde] transition-all duration-300"
            style={{ width: `${((index + 1) / visibleQuestions.length) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-white/40 mt-1.5">{index + 1} / {visibleQuestions.length}</p>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-8">
        <h1 className="text-2xl font-black text-white leading-snug mb-6">{current.label}</h1>
        {renderInput()}
        {error && <p className="text-sm text-red-200 mt-4 bg-red-900/30 rounded-xl px-3 py-2">{error}</p>}
      </div>

      <div className="relative z-10 px-6 pb-6 flex items-center gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center shrink-0"
          >
            <IconChevronLeft className="w-5 h-5" />
          </button>
        )}
        {!isAutoAdvance && (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#ec2226] to-[#6ccbde] text-white text-base font-black disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isLast ? 'Finish & Submit' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
};
