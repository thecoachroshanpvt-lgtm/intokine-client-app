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
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from './firebase';
import { createPortal } from 'react-dom';
import { TrainingScreen } from './TrainingScreen';
import { InlineLoader } from './InlineLoader';
import { PasswordInput } from './PasswordInput';

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
  date: string;
  time: string;
  coachName: string;
  sessionType: string;
  location: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
  attendanceStatus?: string;
}

// Local calendar date (YYYY-MM-DD) - toISOString() is UTC and shifts the day
// for anyone ahead of UTC during the first hours of the day.
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// "14:00" -> { clock: "2:00", period: "PM" }; anything unexpected is shown as-is.
function formatTime(t: string): { clock: string; period: string } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, period: h >= 12 ? 'PM' : 'AM' };
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

/** Settings pop-up: change password and log out. */
const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<'menu' | 'password'>('menu');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, []);

  const logOut = async () => {
    const { auth } = initializeClientFirebaseApp();
    if (auth) await signOut(auth);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    const { auth } = initializeClientFirebaseApp();
    const user = auth?.currentUser;
    if (!auth || !user || !user.email) { setError('Please log in again and retry.'); return; }
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setDone(true);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') setError('Current password is incorrect.');
      else if (code === 'auth/too-many-requests') setError('Too many attempts. Please try again later.');
      else if (code === 'auth/requires-recent-login') setError('Please log out, log in again, and retry.');
      else setError('Could not change the password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6ccbde]';

  return createPortal(
    <div className="anim-overlay fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-5 pb-24" onClick={onClose}>
      <div className="anim-card bg-[#1c1c1e] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">{mode === 'menu' ? 'Settings' : 'Change password'}</h3>
          <button type="button" onClick={onClose} className="text-white/40 text-lg leading-none px-1">×</button>
        </div>
        {mode === 'menu' ? (
          <div className="p-4 space-y-2.5">
            <button type="button" onClick={() => setMode('password')} className="w-full text-left bg-[#242426] border border-white/[0.06] rounded-xl px-4 py-3 text-sm font-semibold text-white">
              Change password
            </button>
            <button type="button" onClick={logOut} className="w-full text-left bg-[#ec2226]/10 border border-[#ec2226]/30 rounded-xl px-4 py-3 text-sm font-semibold text-[#ec2226]">
              Log out
            </button>
          </div>
        ) : done ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-emerald-300">Your password has been changed.</p>
            <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ec2226] to-[#6ccbde]">Done</button>
          </div>
        ) : (
          <form onSubmit={changePassword} className="p-4 space-y-3">
            <PasswordInput autoComplete="current-password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} required />
            <PasswordInput autoComplete="new-password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} required />
            <PasswordInput autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} required />
            {error && <p className="text-xs text-[#ec2226]">{error}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ec2226] to-[#6ccbde] disabled:opacity-50">
              {busy ? 'Saving...' : 'Change password'}
            </button>
            <button type="button" onClick={() => { setMode('menu'); setError(''); }} className="w-full text-xs text-white/50">Back</button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export const PlansScreen: React.FC<PlansScreenProps> = ({ clientId, clientName }) => {
  const [plans, setPlans] = useState<VisiblePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [packageSessions, setPackageSessions] = useState<number | null>(null);
  const [packageBaseline, setPackageBaseline] = useState<number | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [allSessionsList, setAllSessionsList] = useState<TodaySession[]>([]);
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

    // Live listener: a renewal or date change made in Coach OS / Owner OS shows up here without reopening the app.
    const unsubscribe = onSnapshot(
      doc(db, 'intokine_clients', clientId),
      (clientDoc) => {
        if (clientDoc.exists()) {
          const data = clientDoc.data();
          setStartDate(data.startDate || null);
          setRenewalDate(data.renewalDate || null);
          setPackageSessions(typeof data.packageSessions === 'number' && data.packageSessions > 0 ? data.packageSessions : null);
          setPackageBaseline(typeof data.packageBaseline === 'number' ? data.packageBaseline : null);
          setProfilePhoto(data.profilePhotoBase64 || null);
        }
      },
      (e) => console.warn('Could not load client record:', e)
    );

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;

    const todayKey = toDateKey(new Date());
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
      const allSessions = snapshot.docs.map((d) => d.data() as TodaySession);
      setTodaySessions(allSessions.filter((s) => s.date === todayKey));
      setAllSessionsList(allSessions);
      setSessionsLoaded(true);
    }, () => setSessionsLoaded(true));

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

  // Only sessions in the current package count - renewing starts a new package, so this restarts at 0.
  const doneSessionsAll = allSessionsList.filter(
    (s) => (s.status === 'Completed' || s.attendanceStatus === 'Present') && (packageBaseline !== null || !startDate || s.date >= startDate)
  ).length;
  // After a renewal the coach side records how many were already done, so the new package starts at 0 exactly.
  const completedSessions = packageBaseline !== null ? Math.max(0, doneSessionsAll - packageBaseline) : doneSessionsAll;

  const journey = (() => {
    // Package measured in sessions: finished when that many sessions are done.
    if (packageSessions) {
      const percent = Math.min(1, completedSessions / packageSessions);
      return {
        mode: 'sessions' as const,
        totalWeeks: 0,
        currentWeek: 0,
        percent,
        phase: getPhase(percent),
        expired: completedSessions >= packageSessions,
      };
    }
    if (!startDate || !renewalDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(renewalDate).getTime();
    const now = Date.now();
    const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 7))));
    const percent = Math.min(1, Math.max(0, (now - start) / (end - start)));
    const expired = now > end;
    return { mode: 'dates' as const, totalWeeks, currentWeek, percent, phase: getPhase(percent), expired };
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
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="ml-auto w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {photoError && <p className="text-xs text-[#ec2226] font-light">{photoError}</p>}

      {/* Package expired notification */}
      {journey?.expired && (
        <div className="bg-[#ec2226]/10 border border-[#ec2226]/40 rounded-2xl p-4 flex items-start gap-3" role="alert">
          <span className="w-2 h-2 mt-1.5 rounded-full bg-[#ec2226] shrink-0" style={{ animation: 'bcaPulse 1.8s ease-out infinite' }} />
          <div>
            <p className="text-sm font-bold text-white">Package expired</p>
            <p className="text-[11px] text-white/60 font-light mt-0.5 leading-relaxed">
              {journey.mode === 'sessions' ? (
                <>You completed all <span className="font-mono">{packageSessions}</span> sessions in your package. Please contact your coach to renew.</>
              ) : (
                <>Your package ended on {renewalDate}. You completed <span className="font-mono">{completedSessions}</span> session{completedSessions === 1 ? '' : 's'}. Please contact your coach to renew.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Journey roadmap */}
      {journey && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              <span className="font-mono">{completedSessions}</span>
              {journey.mode === 'sessions' ? <> of <span className="font-mono">{packageSessions}</span> sessions done</> : <> session{completedSessions === 1 ? '' : 's'} done</>}
            </span>
            <span className="text-[11px] text-white/40 font-mono">
              {journey.mode === 'sessions'
                ? `${Math.max(0, (packageSessions || 0) - completedSessions)} left`
                : `Week ${journey.currentWeek} of ${journey.totalWeeks}`}
            </span>
          </div>
          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${journey.percent * 100}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
            />
          </div>
        </div>
      )}

      {/* Today - the suggested workout assigned for today (do it any time) plus any coach session */}
      {(() => {
        if (!sessionsLoaded || plansLoading) return <InlineLoader />;
        const todayKey = toDateKey(new Date());
        const todaysWorkouts = plans.filter((p) => p.date === todayKey);
        const d = parseDateKey(todayKey);
        const dateTile = (
          <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">
              {d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
            </div>
            <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{d ? d.getDate() : '—'}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
              {d ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}
            </div>
          </div>
        );
        return (
          <>
          <div className="space-y-2">
            <span className="text-[11px] text-white/40 uppercase font-semibold block">Today</span>

            {todaySessions
              .map((s) => {
              const sd = parseDateKey(s.date);
              const t = formatTime(s.time);
              const color = statusColor(s.status);
              return (
                <div key={s.id} className="bg-[#242426] border border-white/[0.06] rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">
                      {sd ? sd.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
                    </div>
                    <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{sd ? sd.getDate() : '—'}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
                      {sd ? sd.toLocaleDateString(undefined, { month: 'short' }) : ''}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none mb-1.5">Session with coach</div>
                    <div className="flex items-baseline gap-1">
                      {t ? (
                        <>
                          <span className="text-base font-semibold font-mono text-white leading-none">{t.clock}</span>
                          <span className="text-[10px] font-bold text-white/50">{t.period}</span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-white">{s.time || 'Time TBC'}</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white/80 mt-1 truncate">{s.sessionType}</div>
                    <div className="text-[11px] text-white/40 font-light truncate">{s.location} · Coach {s.coachName}</div>
                  </div>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                  >
                    {s.status.toUpperCase()}
                  </span>
                </div>
              );
            })}

            {todaySessions.length === 0 && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
                <p className="text-sm text-white/50 font-light leading-relaxed">No training with your coach today.</p>
              </div>
            )}
          </div>

          {todaysWorkouts.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-white/40 uppercase font-semibold block">Suggested workout</span>
            {todaysWorkouts.map((w) => {
              const done = !!w.clientCompletedAt;
              const color = done ? '#34d399' : '#ec2226';
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWorkout(w)}
                  className="w-full text-left bg-gradient-to-br from-[#ec2226]/20 to-[#6ccbde]/15 hover:from-[#ec2226]/25 hover:to-[#6ccbde]/20 border border-[#6ccbde]/20 rounded-2xl p-4 flex items-center gap-3 transition"
                >
                  <div className="w-12 h-12 shrink-0 rounded-full bg-[#0b0c10]/60 border border-white/10 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6ccbde" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#6ccbde] leading-none">Do it yourself</div>
                    <div className="text-base font-bold text-white mt-1.5 truncate">{w.planTitle}</div>
                    <div className="text-[11px] text-white/50 font-light truncate">
                      Do it any time today
                      {w.durationMinutes ? ` · ${w.durationMinutes} mins` : ''}
                    </div>
                  </div>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                  >
                    {done ? 'DONE' : 'ASSIGNED'}
                  </span>
                </button>
              );
            })}

            </div>
          )}
          </>
        );
      })()}
    </div>
  );
};
