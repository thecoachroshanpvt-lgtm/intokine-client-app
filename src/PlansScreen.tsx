import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from './firebase';
import { TrainingScreen } from './TrainingScreen';

interface PlansScreenProps {
  clientId: string;
  clientName: string;
}

interface TrainerizeSet {
  id: string;
  setNumber: number;
  setType: 'Working' | 'Warmup' | 'Drop' | 'AMRAP' | 'Cooldown';
  previousPerformance?: string;
  previousWeightKg?: number;
  previousReps?: number;
  targetWeightKg: number;
  targetReps: number;
  rpe?: number;
  restSeconds?: number;
}

interface TrainerizeExercise {
  id: string;
  name: string;
  category: string;
  equipment?: string;
  targetMuscle?: string;
  supersetTag?: string;
  sets: TrainerizeSet[];
  coachCues?: string;
  previousBestPerformance?: string;
  previousVolumeKg?: number;
}

interface VisiblePlan {
  id: string;
  planTitle: string;
  date: string;
  category: string;
  coachName: string;
  durationMinutes?: number;
  targetFocus?: string;
  planDetails?: string;
  rpeTarget?: number;
  coachSessionNotes?: string;
  structuredExercises?: TrainerizeExercise[];
  isSuggestedWorkout?: boolean;
  clientCompletedAt?: string;
}

interface TodaySession {
  id: string;
  time: string;
  sessionType: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
}

// Resizes and compresses an uploaded profile photo before storing it
// as base64 directly in Firestore - there's no separate file storage
// service in this project, and a single compressed photo per client
// comfortably fits within Firestore's document size limits.
function compressImageToBase64(file: File, maxWidth = 400, quality = 0.7): Promise<string> {
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

function getPhase(percentThrough: number): string {
  if (percentThrough < 0.34) return 'Foundation Phase';
  if (percentThrough < 0.67) return 'Building Phase';
  return 'Peak Phase';
}

export const PlansScreen: React.FC<PlansScreenProps> = ({ clientId, clientName }) => {
  const [plans, setPlans] = useState<VisiblePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<VisiblePlan | null>(null);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) {
      setPlansLoading(false);
      return;
    }

    const plansQuery = query(
      collection(db, 'intokine_given_session_plans'),
      where('clientId', '==', clientId),
      where('clientVisible', '==', true)
    );

    const unsubscribe = onSnapshot(
      plansQuery,
      (snapshot) => {
        const results = snapshot.docs.map((d) => d.data() as VisiblePlan);
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPlans(results);
        setPlansLoading(false);
      },
      (err) => {
        console.warn('Could not load plans:', err);
        setPlansLoading(false);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    const fetchClientRecord = async () => {
      try {
        const clientDoc = await getDoc(doc(db, 'intokine_clients', clientId));
        if (clientDoc.exists()) {
          const data = clientDoc.data();
          setStartDate(data.startDate || null);
          setRenewalDate(data.renewalDate || null);
          setProfilePhoto(data.profilePhotoBase64 || null);
        }
      } catch (e) {
        console.warn('Could not load client record:', e);
      }
    };

    fetchClientRecord();
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    const todayKey = new Date().toISOString().split('T')[0];
    // Query by clientId only, matching the Firestore rule exactly -
    // same proven pattern as the Schedule tab. Adding a second date
    // filter directly into the query can require a composite index
    // Firestore was never told to create, which fails silently from
    // the user's perspective. Filtering by date client-side avoids
    // that entirely.
    const sessionsQuery = query(
      collection(db, 'intokine_sessions'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const allSessions = snapshot.docs.map((d) => d.data() as TodaySession & { date: string });
      setTodaySessions(allSessions.filter((s) => s.date === todayKey));
    });

    return () => unsubscribe();
  }, [clientId]);

  const handlePhotoUpload = async (file: File) => {
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const compressed = await compressImageToBase64(file);
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');
      // This update only ever touches profilePhotoBase64 - the
      // Firestore rule specifically only allows a client to change
      // this one field on their own record, nothing else.
      await setDoc(doc(db, 'intokine_clients', clientId), { profilePhotoBase64: compressed }, { merge: true });
      setProfilePhoto(compressed);
    } catch (e: any) {
      setPhotoError('Could not upload photo. Please try again.');
      console.warn('Photo upload error:', e);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const journey = (() => {
    if (!startDate || !renewalDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(renewalDate).getTime();
    const now = Date.now();
    const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 7))));
    const percent = Math.min(1, Math.max(0, (now - start) / (end - start)));
    return { totalWeeks, currentWeek, percent, phase: getPhase(percent) };
  })();

  const statusColor = (status: TodaySession['status']) => {
    if (status === 'Completed') return '#6ccbde';
    if (status === 'Cancelled') return '#71717a';
    if (status === 'Postponed') return '#f59e0b';
    return '#ec2226';
  };

  if (selectedWorkout) {
    return (
      <TrainingScreen
        workout={{
          id: selectedWorkout.id,
          date: selectedWorkout.date,
          planTitle: selectedWorkout.planTitle,
          category: selectedWorkout.category,
          planDetails: selectedWorkout.planDetails || '',
          targetFocus: selectedWorkout.targetFocus || '',
          durationMinutes: selectedWorkout.durationMinutes || 0,
          rpeTarget: selectedWorkout.rpeTarget || 0,
          coachName: selectedWorkout.coachName,
          coachSessionNotes: selectedWorkout.coachSessionNotes,
          structuredExercises: selectedWorkout.structuredExercises,
          clientCompletedAt: selectedWorkout.clientCompletedAt,
        }}
        onBack={() => setSelectedWorkout(null)}
        onMarkedComplete={() => {
          setPlans((prev) => prev.map((p) => (p.id === selectedWorkout.id ? { ...p, clientCompletedAt: new Date().toISOString() } : p)));
        }}
      />
    );
  }

  return (
    <div className="px-5 pb-8 pt-4 space-y-4 max-w-4xl mx-auto">
      {/* Profile photo */}
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = '';
            }}
          />
          {profilePhoto ? (
            <img src={profilePhoto} alt={clientName} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/[0.08] border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 text-lg font-header">
              {clientName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#ec2226] flex items-center justify-center text-white text-[10px]">
            +
          </div>
        </label>
        <div>
          <p className="text-sm font-semibold text-white">{clientName}</p>
          <p className="text-[11px] text-white/40 font-light">
            {uploadingPhoto ? 'Uploading...' : 'Tap to add a profile photo'}
          </p>
        </div>
      </div>
      {photoError && <p className="text-xs text-[#ec2226] font-light">{photoError}</p>}

      {/* Journey roadmap */}
      {journey && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{journey.phase}</span>
            <span className="text-[11px] text-white/40 font-mono">Week {journey.currentWeek} of {journey.totalWeeks}</span>
          </div>
          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${journey.percent * 100}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
            />
          </div>
        </div>
      )}

      {/* Today's status */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-2">
        <span className="text-[11px] text-white/40 uppercase font-semibold">Today</span>
        {todaySessions.length === 0 ? (
          <p className="text-sm text-white/50 font-light">Nothing scheduled for today.</p>
        ) : (
          todaySessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between">
              <span className="text-sm text-white">{s.time && `${s.time} · `}{s.sessionType}</span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: statusColor(s.status), borderColor: `${statusColor(s.status)}40`, backgroundColor: `${statusColor(s.status)}15` }}
              >
                {s.status.toUpperCase()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Today's suggested workout - self-guided, tap to open the training page */}
      {(() => {
        const todayKey = new Date().toISOString().split('T')[0];
        const todaysSuggestedWorkout = plans.find((p) => p.isSuggestedWorkout && p.date === todayKey);
        if (!todaysSuggestedWorkout) return null;
        const done = !!todaysSuggestedWorkout.clientCompletedAt;
        return (
          <button
            onClick={() => setSelectedWorkout(todaysSuggestedWorkout)}
            className="w-full text-left bg-gradient-to-br from-[#ec2226]/20 to-[#6ccbde]/15 border border-white/[0.12] hover:border-white/25 rounded-2xl p-4 space-y-1.5 transition"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[#6ccbde] uppercase tracking-wide">
                {done ? 'Suggested Workout · Done' : "Today's Suggested Workout"}
              </span>
              <span className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">
                {done ? '✓' : 'Tap to start →'}
              </span>
            </div>
            <p className="text-sm font-bold text-white">{todaysSuggestedWorkout.planTitle}</p>
            <p className="text-[11px] text-white/50 font-light">
              {todaysSuggestedWorkout.category}
              {todaysSuggestedWorkout.durationMinutes ? ` · ${todaysSuggestedWorkout.durationMinutes} mins` : ''}
              {' · Do this on your own today'}
            </p>
          </button>
        );
      })()}

      {/* Training plans */}
      {plansLoading ? (
        <div className="text-center py-12 text-white/40 text-sm font-light">Loading your plans...</div>
      ) : plans.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            Nothing shared yet — your coach will share your training plans here once they're ready.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plans.map((plan) => {
            const isSuggested = !!plan.isSuggestedWorkout;
            const done = !!plan.clientCompletedAt;
            return (
              <div
                key={plan.id}
                onClick={isSuggested ? () => setSelectedWorkout(plan) : undefined}
                role={isSuggested ? 'button' : undefined}
                tabIndex={isSuggested ? 0 : undefined}
                onKeyDown={isSuggested ? (e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedWorkout(plan); } : undefined}
                className={`text-left rounded-2xl p-4 space-y-2 transition ${
                  isSuggested
                    ? 'bg-gradient-to-br from-[#ec2226]/15 to-[#6ccbde]/10 border border-white/[0.12] hover:border-white/25 cursor-pointer'
                    : 'bg-white/[0.05] border border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{plan.planTitle}</span>
                  <span className="text-[10px] font-semibold text-[#ec2226] bg-[#ec2226]/10 px-2 py-0.5 rounded-full border border-[#ec2226]/25 whitespace-nowrap">
                    {plan.date}
                  </span>
                </div>
                <div className="text-xs text-white/50 font-light flex items-center gap-2 flex-wrap">
                  <span>{plan.category}</span>
                  {plan.durationMinutes && (
                    <>
                      <span>·</span>
                      <span>{plan.durationMinutes} mins</span>
                    </>
                  )}
                  <span>·</span>
                  <span>Coach {plan.coachName}</span>
                </div>
                {plan.targetFocus && (
                  <p className="text-xs text-white/70 font-light">{plan.targetFocus}</p>
                )}
                {isSuggested && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-[#6ccbde] uppercase tracking-wide">
                      Self-Guided Workout
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}`}>
                      {done ? '✓ Done' : 'Tap to start →'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
