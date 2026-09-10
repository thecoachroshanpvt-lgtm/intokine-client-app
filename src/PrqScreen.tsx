import React, { useState } from 'react';
import { initializeClientFirebaseApp, doc, setDoc } from './firebase';

interface PrqScreenProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  onComplete: () => void;
}

interface PrqFormData {
  submissionDate: string;
  fullName: string;
  email: string;
  address: string;
  contactNumber: string;
  emergencyContactNumber: string;
  dateOfBirth: string;
  age: string;
  maritalStatus: string;
  sex: string;

  weightKg: string;
  heightCm: string;
  presentHealthState: string;
  currentMedications: string;
  takesMedicationsAsPrescribed: string;
  reasonNotTakingAsPrescribed: string;
  takesSupplements: boolean | null;
  supplementDetails: string;
  lastPhysicianVisit: string;
  totalCholesterol: string;
  hdl: string;
  ldl: string;
  hasCheckedBloodSugar: boolean | null;
  bloodSugarResults: string;
  medicalConditions: string[];
  medicalConditionsNotes: string;
  pregnancyWeeksAlong: string;

  hadMajorSurgery: boolean | null;
  majorSurgeryDetails: string;
  hadPastInjuries: boolean | null;
  pastInjuryDetails: string;
  hasActivityLimitingInjuries: boolean | null;
  activityLimitingInjuryDetails: string;
  hasCurrentInjuries: boolean | null;
  currentInjuryDetails: string;

  familyMedicalHistory: string[];

  drinksAlcohol: boolean | null;
  alcoholFrequency: string;
  alcoholTimesPerWeek: string;
  alcoholAverageAmount: string;
  drinksCaffeine: boolean | null;
  caffeinePerDay: string;
  usesTobacco: boolean | null;
  tobaccoAmount: string;

  doesStructuredActivity: boolean | null;
  structuredActivityDescription: string;
  cardioMinutesPerSession: string;
  cardioTimesPerWeek: string;
  muscularTrainingSessionsPerWeek: string;
  flexibilitySessionsPerWeek: string;
  doesSportsOrRecreation: boolean | null;
  sportsDetails: string;
  feelingsAboutExercise: string;
  favoritePhysicalActivities: string;
  trainingExperienceLevel: string;

  works: boolean | null;
  occupation: string;
  workSchedule: string;
  workActivityLevelDescription: string;
  dailyActivityLevel: string;

  sleepHoursPerNight: string;
  mostStressfulThing: string;
  stressLevel: string;
  appetiteUnderStress: string;

  weightGoalDirection: string;
  lowestWeightPast5Years: string;
  highestWeightPast5Years: string;
  idealWeight: string;

  abdomenCircumferenceCm: string;
  waistCircumferenceCm: string;
  upperArmCircumferenceCm: string;
  midThighCircumferenceCm: string;

  bmi: string;
  fatMassKg: string;
  skeletalMuscleMassKg: string;

  readinessToAdoptHealthyLifestyle: string;
  hasSpecificHealthGoals: boolean | null;
  healthGoalsPrioritized: string;

  diagnosedWithCovidBefore: boolean | null;

  followingADiet: boolean | null;
  dietDescription: string;
  tastePreferences: string[];
  texturePreferences: string[];
  temperaturePreference: string;
  mealTimingPreferences: string[];
  dietaryLifestyle: string;
  dietaryLifestyleOtherNote: string;

  hasSpecificIllness: boolean | null;
  illnessDetails: string;
  hasFoodAllergy: boolean | null;
  foodAllergyDetails: string;
  foodsNeverEaten: string;

  fitnessGoal: string;

  consentConfirmed: boolean;
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

const emptyForm = (name: string, email: string): PrqFormData => ({
  submissionDate: new Date().toISOString().split('T')[0],
  fullName: name,
  email,
  address: '',
  contactNumber: '',
  emergencyContactNumber: '',
  dateOfBirth: '',
  age: '',
  maritalStatus: '',
  sex: '',
  weightKg: '',
  heightCm: '',
  presentHealthState: '',
  currentMedications: '',
  takesMedicationsAsPrescribed: '',
  reasonNotTakingAsPrescribed: '',
  takesSupplements: null,
  supplementDetails: '',
  lastPhysicianVisit: '',
  totalCholesterol: '',
  hdl: '',
  ldl: '',
  hasCheckedBloodSugar: null,
  bloodSugarResults: '',
  medicalConditions: [],
  medicalConditionsNotes: '',
  pregnancyWeeksAlong: '',
  hadMajorSurgery: null,
  majorSurgeryDetails: '',
  hadPastInjuries: null,
  pastInjuryDetails: '',
  hasActivityLimitingInjuries: null,
  activityLimitingInjuryDetails: '',
  hasCurrentInjuries: null,
  currentInjuryDetails: '',
  familyMedicalHistory: [],
  drinksAlcohol: null,
  alcoholFrequency: '',
  alcoholTimesPerWeek: '',
  alcoholAverageAmount: '',
  drinksCaffeine: null,
  caffeinePerDay: '',
  usesTobacco: null,
  tobaccoAmount: '',
  doesStructuredActivity: null,
  structuredActivityDescription: '',
  cardioMinutesPerSession: '',
  cardioTimesPerWeek: '',
  muscularTrainingSessionsPerWeek: '',
  flexibilitySessionsPerWeek: '',
  doesSportsOrRecreation: null,
  sportsDetails: '',
  feelingsAboutExercise: '',
  favoritePhysicalActivities: '',
  trainingExperienceLevel: '',
  works: null,
  occupation: '',
  workSchedule: '',
  workActivityLevelDescription: '',
  dailyActivityLevel: '',
  sleepHoursPerNight: '',
  mostStressfulThing: '',
  stressLevel: '',
  appetiteUnderStress: '',
  weightGoalDirection: '',
  lowestWeightPast5Years: '',
  highestWeightPast5Years: '',
  idealWeight: '',
  abdomenCircumferenceCm: '',
  waistCircumferenceCm: '',
  upperArmCircumferenceCm: '',
  midThighCircumferenceCm: '',
  bmi: '',
  fatMassKg: '',
  skeletalMuscleMassKg: '',
  readinessToAdoptHealthyLifestyle: '',
  hasSpecificHealthGoals: null,
  healthGoalsPrioritized: '',
  diagnosedWithCovidBefore: null,
  followingADiet: null,
  dietDescription: '',
  tastePreferences: [],
  texturePreferences: [],
  temperaturePreference: '',
  mealTimingPreferences: [],
  dietaryLifestyle: '',
  dietaryLifestyleOtherNote: '',
  hasSpecificIllness: null,
  illnessDetails: '',
  hasFoodAllergy: null,
  foodAllergyDetails: '',
  foodsNeverEaten: '',
  fitnessGoal: '',
  consentConfirmed: false,
});

export const PrqScreen: React.FC<PrqScreenProps> = ({ clientId, clientName, clientEmail, onComplete }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PrqFormData>(() => emptyForm(clientName, clientEmail));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof PrqFormData>(key: K, value: PrqFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInList = (key: 'medicalConditions' | 'familyMedicalHistory' | 'tastePreferences' | 'texturePreferences' | 'mealTimingPreferences', value: string) => {
    setForm((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  const TOTAL_STEPS = 16;

  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="text-xs font-semibold text-white/70 block mb-1.5">{children}</label>
  );

  const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ value, onChange, placeholder, type = 'text' }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6ccbde]"
    />
  );

  const TextArea: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6ccbde] resize-none"
    />
  );

  const YesNo: React.FC<{ value: boolean | null; onChange: (v: boolean) => void; thirdOption?: { label: string; onSelect: () => void } }> = ({ value, onChange, thirdOption }) => (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${value === true ? 'bg-[#6ccbde] text-black' : 'bg-white/[0.06] text-white/60'}`}>Yes</button>
      <button type="button" onClick={() => onChange(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${value === false ? 'bg-[#6ccbde] text-black' : 'bg-white/[0.06] text-white/60'}`}>No</button>
      {thirdOption && (
        <button type="button" onClick={thirdOption.onSelect} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition bg-white/[0.06] text-white/60">{thirdOption.label}</button>
      )}
    </div>
  );

  const ChipGroup: React.FC<{ options: string[]; selected: string[]; onToggle: (v: string) => void }> = ({ options, selected, onToggle }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${selected.includes(opt) ? 'bg-[#6ccbde] text-black' : 'bg-white/[0.06] text-white/60'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const SingleSelect: React.FC<{ options: string[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${value === opt ? 'bg-[#6ccbde] text-black' : 'bg-white/[0.06] text-white/60'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const Scale1to10: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <div className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(n))}
          className={`py-2 rounded-lg text-xs font-bold transition ${value === String(n) ? 'bg-[#6ccbde] text-black' : 'bg-white/[0.06] text-white/60'}`}
        >
          {n}
        </button>
      ))}
    </div>
  );

  const stepTitles = [
    'Personal Details', 'Medical Information', 'Surgery & Injury History', 'Family History',
    'Substance-Related Habits', 'Physical Activity', 'Occupational', 'Sleep & Stress',
    'Weight History', 'Circumferences', 'Body Composition', 'Goals & Readiness',
    'COVID History', 'Nutrition Preferences', 'Food & Medical Considerations', 'Your Fitness Goal',
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div><Label>Full Name</Label><TextInput value={form.fullName} onChange={(v) => set('fullName', v)} /></div>
            <div><Label>Email</Label><TextInput type="email" value={form.email} onChange={(v) => set('email', v)} /></div>
            <div><Label>Address</Label><TextArea value={form.address} onChange={(v) => set('address', v)} /></div>
            <div><Label>Contact Number</Label><TextInput type="tel" value={form.contactNumber} onChange={(v) => set('contactNumber', v)} /></div>
            <div><Label>Emergency Contact Number</Label><TextInput type="tel" value={form.emergencyContactNumber} onChange={(v) => set('emergencyContactNumber', v)} /></div>
            <div><Label>Date of Birth</Label><TextInput type="date" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} /></div>
            <div><Label>Age</Label><TextInput type="number" value={form.age} onChange={(v) => set('age', v)} /></div>
            <div><Label>Sex</Label><SingleSelect options={['Male', 'Female']} value={form.sex} onChange={(v) => set('sex', v)} /></div>
            <div><Label>Marital Status</Label><TextInput value={form.maritalStatus} onChange={(v) => set('maritalStatus', v)} /></div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div><Label>Weight (kg)</Label><TextInput type="number" value={form.weightKg} onChange={(v) => set('weightKg', v)} /></div>
            <div><Label>Height (cm)</Label><TextInput type="number" value={form.heightCm} onChange={(v) => set('heightCm', v)} /></div>
            <div><Label>How would you describe your present state of health?</Label><SingleSelect options={['Very healthy', 'Healthy', 'Unhealthy', 'Unwell']} value={form.presentHealthState} onChange={(v) => set('presentHealthState', v)} /></div>
            <div><Label>List current medications, how often you take them and dosages</Label><TextArea value={form.currentMedications} onChange={(v) => set('currentMedications', v)} /></div>
            <div><Label>Do you take all your medications as prescribed?</Label><SingleSelect options={['Yes', 'No', 'N/A']} value={form.takesMedicationsAsPrescribed} onChange={(v) => set('takesMedicationsAsPrescribed', v)} /></div>
            {form.takesMedicationsAsPrescribed === 'No' && (
              <div><Label>If not, please share why</Label><TextArea value={form.reasonNotTakingAsPrescribed} onChange={(v) => set('reasonNotTakingAsPrescribed', v)} /></div>
            )}
            <div><Label>Do you take any vitamin, mineral, or herbal supplements?</Label><YesNo value={form.takesSupplements} onChange={(v) => set('takesSupplements', v)} /></div>
            {form.takesSupplements && (
              <div><Label>List type and amount per day</Label><TextArea value={form.supplementDetails} onChange={(v) => set('supplementDetails', v)} /></div>
            )}
            <div><Label>When was the last time you visited your physician?</Label><TextInput value={form.lastPhysicianVisit} onChange={(v) => set('lastPhysicianVisit', v)} /></div>
            <div><Label>Total Cholesterol</Label><TextInput type="number" value={form.totalCholesterol} onChange={(v) => set('totalCholesterol', v)} /></div>
            <div><Label>HDL</Label><TextInput type="number" value={form.hdl} onChange={(v) => set('hdl', v)} /></div>
            <div><Label>LDL</Label><TextInput type="number" value={form.ldl} onChange={(v) => set('ldl', v)} /></div>
            <div><Label>Have you ever had your blood sugar checked?</Label><YesNo value={form.hasCheckedBloodSugar} onChange={(v) => set('hasCheckedBloodSugar', v)} /></div>
            {form.hasCheckedBloodSugar && (
              <div><Label>What were the results?</Label><TextArea value={form.bloodSugarResults} onChange={(v) => set('bloodSugarResults', v)} /></div>
            )}
            <div>
              <Label>Please check any that apply to you</Label>
              <ChipGroup options={MEDICAL_CONDITIONS} selected={form.medicalConditions} onToggle={(v) => toggleInList('medicalConditions', v)} />
            </div>
            {form.medicalConditions.includes('Pregnant') && (
              <div><Label>How many weeks along?</Label><TextInput type="number" value={form.pregnancyWeeksAlong} onChange={(v) => set('pregnancyWeeksAlong', v)} /></div>
            )}
            <div><Label>Any important information about your condition(s)?</Label><TextArea value={form.medicalConditionsNotes} onChange={(v) => set('medicalConditionsNotes', v)} /></div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div><Label>Have you had major surgery?</Label><YesNo value={form.hadMajorSurgery} onChange={(v) => set('hadMajorSurgery', v)} /></div>
            {form.hadMajorSurgery && <div><Label>Please describe</Label><TextArea value={form.majorSurgeryDetails} onChange={(v) => set('majorSurgeryDetails', v)} /></div>}
            <div><Label>Have you had any past injuries?</Label><YesNo value={form.hadPastInjuries} onChange={(v) => set('hadPastInjuries', v)} /></div>
            {form.hadPastInjuries && <div><Label>What was the injury?</Label><TextArea value={form.pastInjuryDetails} onChange={(v) => set('pastInjuryDetails', v)} /></div>}
            <div><Label>Have you experienced any injuries that may limit your physical activity?</Label><YesNo value={form.hasActivityLimitingInjuries} onChange={(v) => set('hasActivityLimitingInjuries', v)} /></div>
            {form.hasActivityLimitingInjuries && <div><Label>What was the injury?</Label><TextArea value={form.activityLimitingInjuryDetails} onChange={(v) => set('activityLimitingInjuryDetails', v)} /></div>}
            <div><Label>Do you currently have any injuries?</Label><YesNo value={form.hasCurrentInjuries} onChange={(v) => set('hasCurrentInjuries', v)} /></div>
            {form.hasCurrentInjuries && <div><Label>Please describe</Label><TextArea value={form.currentInjuryDetails} onChange={(v) => set('currentInjuryDetails', v)} /></div>}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label>Has anyone in your immediate family been diagnosed with the following?</Label>
              <ChipGroup options={FAMILY_HISTORY_OPTIONS} selected={form.familyMedicalHistory} onToggle={(v) => toggleInList('familyMedicalHistory', v)} />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div><Label>Do you drink alcohol?</Label><YesNo value={form.drinksAlcohol} onChange={(v) => set('drinksAlcohol', v)} /></div>
            {form.drinksAlcohol && (
              <>
                <div><Label>How often?</Label><TextInput value={form.alcoholFrequency} onChange={(v) => set('alcoholFrequency', v)} /></div>
                <div><Label>Times per week?</Label><TextInput type="number" value={form.alcoholTimesPerWeek} onChange={(v) => set('alcoholTimesPerWeek', v)} /></div>
                <div><Label>Average amount?</Label><TextInput value={form.alcoholAverageAmount} onChange={(v) => set('alcoholAverageAmount', v)} /></div>
              </>
            )}
            <div><Label>Do you drink caffeinated beverages?</Label><YesNo value={form.drinksCaffeine} onChange={(v) => set('drinksCaffeine', v)} /></div>
            {form.drinksCaffeine && <div><Label>Number per day?</Label><TextInput type="number" value={form.caffeinePerDay} onChange={(v) => set('caffeinePerDay', v)} /></div>}
            <div><Label>Do you use tobacco?</Label><YesNo value={form.usesTobacco} onChange={(v) => set('usesTobacco', v)} /></div>
            {form.usesTobacco && <div><Label>How much per day?</Label><TextInput value={form.tobaccoAmount} onChange={(v) => set('tobaccoAmount', v)} /></div>}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div><Label>Do you currently participate in any structured physical activity?</Label><YesNo value={form.doesStructuredActivity} onChange={(v) => set('doesStructuredActivity', v)} /></div>
            {form.doesStructuredActivity && <div><Label>Please describe</Label><TextArea value={form.structuredActivityDescription} onChange={(v) => set('structuredActivityDescription', v)} /></div>}
            <div><Label>Minutes of cardio per session</Label><TextInput type="number" value={form.cardioMinutesPerSession} onChange={(v) => set('cardioMinutesPerSession', v)} /></div>
            <div><Label>Cardio sessions per week</Label><TextInput type="number" value={form.cardioTimesPerWeek} onChange={(v) => set('cardioTimesPerWeek', v)} /></div>
            <div><Label>Muscular training sessions per week</Label><TextInput type="number" value={form.muscularTrainingSessionsPerWeek} onChange={(v) => set('muscularTrainingSessionsPerWeek', v)} /></div>
            <div><Label>Flexibility and mobility sessions per week</Label><TextInput type="number" value={form.flexibilitySessionsPerWeek} onChange={(v) => set('flexibilitySessionsPerWeek', v)} /></div>
            <div><Label>Do you engage in any sports or recreational activities?</Label><YesNo value={form.doesSportsOrRecreation} onChange={(v) => set('doesSportsOrRecreation', v)} /></div>
            {form.doesSportsOrRecreation && <div><Label>Which activities, and how many days a week?</Label><TextArea value={form.sportsDetails} onChange={(v) => set('sportsDetails', v)} /></div>}
            <div><Label>Your training experience level</Label><SingleSelect options={['Beginner', 'Intermediate', 'Advanced']} value={form.trainingExperienceLevel} onChange={(v) => set('trainingExperienceLevel', v)} /></div>
            <div><Label>What are your honest feelings about exercise?</Label><TextArea value={form.feelingsAboutExercise} onChange={(v) => set('feelingsAboutExercise', v)} /></div>
            <div><Label>Favorite physical activities</Label><TextArea value={form.favoritePhysicalActivities} onChange={(v) => set('favoritePhysicalActivities', v)} /></div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div><Label>Do you work?</Label><YesNo value={form.works} onChange={(v) => set('works', v)} /></div>
            {form.works && (
              <>
                <div><Label>What is your occupation?</Label><TextInput value={form.occupation} onChange={(v) => set('occupation', v)} /></div>
                <div><Label>Work schedule</Label><TextInput value={form.workSchedule} onChange={(v) => set('workSchedule', v)} /></div>
              </>
            )}
            <div><Label>Describe your activity level during the work day</Label><TextArea value={form.workActivityLevelDescription} onChange={(v) => set('workActivityLevelDescription', v)} /></div>
            <div><Label>Your overall daily activity level</Label><SingleSelect options={['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active']} value={form.dailyActivityLevel} onChange={(v) => set('dailyActivityLevel', v)} /></div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div><Label>How many hours of sleep do you get at night?</Label><TextInput type="number" value={form.sleepHoursPerNight} onChange={(v) => set('sleepHoursPerNight', v)} /></div>
            <div><Label>What is most stressful to you?</Label><TextArea value={form.mostStressfulThing} onChange={(v) => set('mostStressfulThing', v)} /></div>
            <div><Label>Rate your stress level (1 = no stress, 10 = constant stress)</Label><Scale1to10 value={form.stressLevel} onChange={(v) => set('stressLevel', v)} /></div>
            <div><Label>How is your appetite affected by stress?</Label><SingleSelect options={['Increased', 'Not affected', 'Decreased']} value={form.appetiteUnderStress} onChange={(v) => set('appetiteUnderStress', v)} /></div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div><Label>What would you like to do with your weight?</Label><SingleSelect options={['Lose weight', 'Gain weight', 'Maintain weight']} value={form.weightGoalDirection} onChange={(v) => set('weightGoalDirection', v)} /></div>
            <div><Label>Lowest weight in the past 5 years (kg)</Label><TextInput type="number" value={form.lowestWeightPast5Years} onChange={(v) => set('lowestWeightPast5Years', v)} /></div>
            <div><Label>Highest weight in the past 5 years (kg)</Label><TextInput type="number" value={form.highestWeightPast5Years} onChange={(v) => set('highestWeightPast5Years', v)} /></div>
            <div><Label>Your ideal, sustainable weight (kg)</Label><TextInput type="number" value={form.idealWeight} onChange={(v) => set('idealWeight', v)} /></div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <p className="text-xs text-white/40">These can be measured by your coach - fill in if you already know them.</p>
            <div><Label>Abdomen circumference (cm)</Label><TextInput type="number" value={form.abdomenCircumferenceCm} onChange={(v) => set('abdomenCircumferenceCm', v)} /></div>
            <div><Label>Waist circumference (cm)</Label><TextInput type="number" value={form.waistCircumferenceCm} onChange={(v) => set('waistCircumferenceCm', v)} /></div>
            <div><Label>Upper arm circumference (cm)</Label><TextInput type="number" value={form.upperArmCircumferenceCm} onChange={(v) => set('upperArmCircumferenceCm', v)} /></div>
            <div><Label>Mid-thigh circumference (cm)</Label><TextInput type="number" value={form.midThighCircumferenceCm} onChange={(v) => set('midThighCircumferenceCm', v)} /></div>
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <p className="text-xs text-white/40">If you already know these from a body composition scan, add them here.</p>
            <div><Label>BMI</Label><TextInput type="number" value={form.bmi} onChange={(v) => set('bmi', v)} /></div>
            <div><Label>Fat mass (kg)</Label><TextInput type="number" value={form.fatMassKg} onChange={(v) => set('fatMassKg', v)} /></div>
            <div><Label>Skeletal muscle mass (kg)</Label><TextInput type="number" value={form.skeletalMuscleMassKg} onChange={(v) => set('skeletalMuscleMassKg', v)} /></div>
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <div><Label>How likely are you to adopt a healthier lifestyle? (1 = very unlikely, 10 = very likely)</Label><Scale1to10 value={form.readinessToAdoptHealthyLifestyle} onChange={(v) => set('readinessToAdoptHealthyLifestyle', v)} /></div>
            <div><Label>Do you have any specific goals for improving your health?</Label><YesNo value={form.hasSpecificHealthGoals} onChange={(v) => set('hasSpecificHealthGoals', v)} /></div>
            {form.hasSpecificHealthGoals && <div><Label>List them in order of importance</Label><TextArea value={form.healthGoalsPrioritized} onChange={(v) => set('healthGoalsPrioritized', v)} /></div>}
          </div>
        );

      case 12:
        return (
          <div className="space-y-4">
            <div><Label>Have you been diagnosed with COVID before?</Label><YesNo value={form.diagnosedWithCovidBefore} onChange={(v) => set('diagnosedWithCovidBefore', v)} /></div>
          </div>
        );

      case 13:
        return (
          <div className="space-y-4">
            <div><Label>Are you currently following any diet?</Label><YesNo value={form.followingADiet} onChange={(v) => set('followingADiet', v)} /></div>
            {form.followingADiet && <div><Label>Please describe the diet</Label><TextArea value={form.dietDescription} onChange={(v) => set('dietDescription', v)} /></div>}
            <div><Label>Dietary lifestyle</Label><SingleSelect options={['None', 'Halal', 'Vegetarian', 'Vegan', 'Kosher', 'Pescatarian', 'Other']} value={form.dietaryLifestyle} onChange={(v) => set('dietaryLifestyle', v)} /></div>
            {form.dietaryLifestyle === 'Other' && <div><Label>Please specify</Label><TextInput value={form.dietaryLifestyleOtherNote} onChange={(v) => set('dietaryLifestyleOtherNote', v)} /></div>}
            <div><Label>Food preferences by taste</Label><ChipGroup options={TASTE_OPTIONS} selected={form.tastePreferences} onToggle={(v) => toggleInList('tastePreferences', v)} /></div>
            <div><Label>Food preferences by texture</Label><ChipGroup options={TEXTURE_OPTIONS} selected={form.texturePreferences} onToggle={(v) => toggleInList('texturePreferences', v)} /></div>
            <div><Label>Temperature preference</Label><SingleSelect options={['Hot meals', 'Cold meals', 'No preference']} value={form.temperaturePreference} onChange={(v) => set('temperaturePreference', v)} /></div>
            <div><Label>Meal timing preferences</Label><ChipGroup options={MEAL_TIMING_OPTIONS} selected={form.mealTimingPreferences} onToggle={(v) => toggleInList('mealTimingPreferences', v)} /></div>
          </div>
        );

      case 14:
        return (
          <div className="space-y-4">
            <div><Label>Do you have any specific illness?</Label><YesNo value={form.hasSpecificIllness} onChange={(v) => set('hasSpecificIllness', v)} /></div>
            {form.hasSpecificIllness && <div><Label>Please explain</Label><TextArea value={form.illnessDetails} onChange={(v) => set('illnessDetails', v)} /></div>}
            <div><Label>Do you have any food allergy?</Label><YesNo value={form.hasFoodAllergy} onChange={(v) => set('hasFoodAllergy', v)} /></div>
            {form.hasFoodAllergy && <div><Label>Please describe</Label><TextArea value={form.foodAllergyDetails} onChange={(v) => set('foodAllergyDetails', v)} /></div>}
            <div><Label>Any food or drink you avoid entirely? (e.g. milk, fish)</Label><TextArea value={form.foodsNeverEaten} onChange={(v) => set('foodsNeverEaten', v)} /></div>
          </div>
        );

      case 15:
        return (
          <div className="space-y-4">
            <div><Label>What is your fitness goal?</Label><TextArea value={form.fitnessGoal} onChange={(v) => set('fitnessGoal', v)} placeholder="Tell your coach what you're working toward..." /></div>
            <label className="flex items-start gap-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl p-3.5 mt-4">
              <input
                type="checkbox"
                checked={form.consentConfirmed}
                onChange={(e) => set('consentConfirmed', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#6ccbde]"
              />
              <span className="text-xs text-white/70">
                I confirm the information above is accurate to the best of my knowledge, and I consent to participate in a supervised exercise and nutrition program based on it.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!form.consentConfirmed) {
      setError('Please confirm the consent statement to finish.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');

      const toNum = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));

      const record: any = {
        id: `PRQ-${clientId}`,
        clientId,
        completedAt: new Date().toISOString(),
        submissionDate: form.submissionDate,
        fullName: form.fullName,
        email: form.email,
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
        takesSupplements: !!form.takesSupplements,
        supplementDetails: form.supplementDetails || undefined,
        lastPhysicianVisit: form.lastPhysicianVisit,
        totalCholesterol: toNum(form.totalCholesterol),
        hdl: toNum(form.hdl),
        ldl: toNum(form.ldl),
        hasCheckedBloodSugar: !!form.hasCheckedBloodSugar,
        bloodSugarResults: form.bloodSugarResults || undefined,
        medicalConditions: form.medicalConditions,
        medicalConditionsNotes: form.medicalConditionsNotes || undefined,
        pregnancyWeeksAlong: toNum(form.pregnancyWeeksAlong),
        hadMajorSurgery: !!form.hadMajorSurgery,
        majorSurgeryDetails: form.majorSurgeryDetails || undefined,
        hadPastInjuries: !!form.hadPastInjuries,
        pastInjuryDetails: form.pastInjuryDetails || undefined,
        hasActivityLimitingInjuries: !!form.hasActivityLimitingInjuries,
        activityLimitingInjuryDetails: form.activityLimitingInjuryDetails || undefined,
        hasCurrentInjuries: !!form.hasCurrentInjuries,
        currentInjuryDetails: form.currentInjuryDetails || undefined,
        familyMedicalHistory: form.familyMedicalHistory,
        drinksAlcohol: !!form.drinksAlcohol,
        alcoholFrequency: form.alcoholFrequency || undefined,
        alcoholTimesPerWeek: toNum(form.alcoholTimesPerWeek),
        alcoholAverageAmount: form.alcoholAverageAmount || undefined,
        drinksCaffeine: !!form.drinksCaffeine,
        caffeinePerDay: toNum(form.caffeinePerDay),
        usesTobacco: !!form.usesTobacco,
        tobaccoAmount: form.tobaccoAmount || undefined,
        doesStructuredActivity: !!form.doesStructuredActivity,
        structuredActivityDescription: form.structuredActivityDescription || undefined,
        cardioMinutesPerSession: toNum(form.cardioMinutesPerSession),
        cardioTimesPerWeek: toNum(form.cardioTimesPerWeek),
        muscularTrainingSessionsPerWeek: toNum(form.muscularTrainingSessionsPerWeek),
        flexibilitySessionsPerWeek: toNum(form.flexibilitySessionsPerWeek),
        doesSportsOrRecreation: !!form.doesSportsOrRecreation,
        sportsDetails: form.sportsDetails || undefined,
        feelingsAboutExercise: form.feelingsAboutExercise,
        favoritePhysicalActivities: form.favoritePhysicalActivities,
        trainingExperienceLevel: form.trainingExperienceLevel || undefined,
        works: !!form.works,
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
        hasSpecificHealthGoals: !!form.hasSpecificHealthGoals,
        healthGoalsPrioritized: form.healthGoalsPrioritized || undefined,
        diagnosedWithCovidBefore: !!form.diagnosedWithCovidBefore,
        followingADiet: !!form.followingADiet,
        dietDescription: form.dietDescription || undefined,
        tastePreferences: form.tastePreferences,
        texturePreferences: form.texturePreferences,
        temperaturePreference: form.temperaturePreference || 'No preference',
        mealTimingPreferences: form.mealTimingPreferences,
        dietaryLifestyle: form.dietaryLifestyle || undefined,
        dietaryLifestyleOtherNote: form.dietaryLifestyleOtherNote || undefined,
        hasSpecificIllness: !!form.hasSpecificIllness,
        illnessDetails: form.illnessDetails || undefined,
        hasFoodAllergy: !!form.hasFoodAllergy,
        foodAllergyDetails: form.foodAllergyDetails || undefined,
        foodsNeverEaten: form.foodsNeverEaten || undefined,
        fitnessGoal: form.fitnessGoal,
        consentConfirmed: form.consentConfirmed,
        consentDate: new Date().toISOString().split('T')[0],
      };

      // Firestore rejects undefined values - strip them before saving.
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

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-lg font-bold text-white mb-1">Health Screening</h1>
        <p className="text-xs text-white/40 mb-3">
          A few minutes now helps your coach build a program that's actually right for you.
        </p>
        <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ec2226] to-[#6ccbde] transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-white/30 mt-1.5">
          Step {step + 1} of {TOTAL_STEPS} · {stepTitles[step]}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {renderStep()}
        {error && <p className="text-xs text-[#ec2226] mt-4">{error}</p>}
      </div>

      <div className="px-5 py-4 border-t border-white/[0.08] flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            className="px-5 py-3 rounded-xl bg-white/[0.06] text-white/70 text-sm font-bold"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
        >
          {submitting ? 'Saving...' : isLastStep ? 'Finish & Submit' : 'Next'}
        </button>
      </div>
    </div>
  );
};
