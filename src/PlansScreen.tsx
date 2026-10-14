import { Testimonials } from './Testimonials';
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
import { SuggestedWorkoutCard } from './SuggestedWorkoutCard';
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
  postponedFromDates?: string[];
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
  // Accepts "14:00" (24-hour) and "02:00 PM" (what the coach app saves).
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec((t || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const suffix = m[3] ? m[3].toUpperCase() : '';
  if (suffix) {
    if (h < 1 || h > 12) return null;
    if (suffix === 'PM' && h < 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
  }
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
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
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
      <div className="anim-card bg-[#1c1c1c] border border-white/[0.1] rounded-2xl w-full max-w-sm max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="font-subheader text-[17px] text-white uppercase tracking-wide">{mode === 'menu' ? 'Settings' : 'Change password'}</h3>
          <button type="button" onClick={onClose} className="text-white/40 text-lg leading-none px-1">×</button>
        </div>
        {mode === 'menu' ? (
          <div className="p-4 space-y-2.5">
            <button type="button" onClick={() => setMode('password')} className="w-full text-left bg-[#252525] border border-white/[0.06] rounded-xl px-4 py-3 text-sm font-semibold text-white">
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
  const [packageBaselineIds, setPackageBaselineIds] = useState<string[] | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [allSessionsList, setAllSessionsList] = useState<TodaySession[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<VisiblePlan | null>(null);
  const [packageHistoryOpen, setPackageHistoryOpen] = useState(false);

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
          setPackageBaselineIds(Array.isArray(data.packageBaselineIds) ? data.packageBaselineIds : null);
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
      // Today's sessions, plus any that were moved away from today (so the client sees "Postponed to ...").
      setTodaySessions(
        allSessions.filter(
          (s) => s.date === todayKey || (Array.isArray(s.postponedFromDates) && s.postponedFromDates.includes(todayKey))
        )
      );
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
  const completedSessions = allSessionsList.filter(
    (s: any) =>
      (s.status === 'Completed' || s.attendanceStatus === 'Present' || s.attendanceStatus === 'Late') &&
      (packageBaselineIds ? !packageBaselineIds.includes(s.id) : !startDate || s.date >= startDate)
  ).length;

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
          <p className="font-subheader text-[17px] text-white">{clientName}</p>
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
            <p className="font-subheader text-[17px] text-white">Package expired</p>
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

      {/* Journey roadmap - tap to see this package's attendance */}
      {journey && (() => {
        const todayK = toDateKey(new Date());
        // Renewal alert: running low on sessions / days, or already finished.
        const sessionsLeft = journey.mode === 'sessions' ? Math.max(0, (packageSessions || 0) - completedSessions) : null;
        const daysLeft = journey.mode === 'dates' && renewalDate
          ? Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        let alertText: string | null = null;
        if (journey.expired) alertText = 'Package finished - please contact your coach to renew.';
        else if (sessionsLeft !== null && sessionsLeft <= 2) alertText = `Renewal due soon - only ${sessionsLeft} session${sessionsLeft === 1 ? '' : 's'} left.`;
        else if (daysLeft !== null && daysLeft <= 7) alertText = `Renewal due soon - package ends in ${Math.max(0, daysLeft)} day${daysLeft === 1 ? '' : 's'}.`;

        // Sessions that belong to the current package, up to today.
        const inPackage = allSessionsList.filter((x: any) => (packageBaselineIds ? !packageBaselineIds.includes(x.id) : !startDate || x.date >= startDate));
        type Row = { key: string; date: string; time: string; label: string; color: string; note?: string };
        const rows: Row[] = [];
        inPackage.forEach((x) => {
          const att = x.attendanceStatus;
          (x.postponedFromDates || []).forEach((fd) => {
            if (fd <= todayK && fd !== x.date) rows.push({ key: `${x.id}-${fd}`, date: fd, time: '', label: 'POSTPONED', color: '#f59e0b', note: `Moved to ${x.date}` });
          });
          let label = '';
          let color = '#71717a';
          if (att === 'Late') { label = 'LATE'; color = '#fbbf24'; }
          else if (att === 'Present' || x.status === 'Completed') { label = 'PRESENT'; color = '#34d399'; }
          else if (att === 'Absent' || att === 'No Show') { label = 'ABSENT'; color = '#ec2226'; }
          else if (att === 'Cancelled' || x.status === 'Cancelled') { label = 'CANCELLED'; }
          else if (x.status === 'Postponed' || att === 'Postponed') return;
          else if (x.date < todayK) { label = 'NOT MARKED'; }
          if (!label || x.date > todayK) return;
          rows.push({ key: x.id, date: x.date, time: x.time, label, color });
        });
        rows.sort((p, q) => q.date.localeCompare(p.date));
        const absentCount = rows.filter((r) => r.label === 'ABSENT').length;
        return (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
            <button type="button" onClick={() => setPackageHistoryOpen((o) => !o)} className="w-full text-left p-4 space-y-2" aria-expanded={packageHistoryOpen}>
              <div className="flex items-center justify-between">
                <span className="font-subheader text-[17px] text-white">
                  <span className="font-mono">{completedSessions}</span>
                  {journey.mode === 'sessions' ? <> of <span className="font-mono">{packageSessions}</span> sessions done</> : <> session{completedSessions === 1 ? '' : 's'} done</>}
                </span>
                <span className="text-[11px] text-white/40 font-mono flex items-center gap-1.5">
                  {journey.mode === 'sessions'
                    ? `${sessionsLeft} left`
                    : `Week ${journey.currentWeek} of ${journey.totalWeeks}`}
                  <span style={{ display: 'inline-block', transform: packageHistoryOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                </span>
              </div>
              <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${journey.percent * 100}%`, background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
                />
              </div>
              {alertText && (
                <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: journey.expired ? '#ec2226' : '#f59e0b' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: journey.expired ? '#ec2226' : '#f59e0b' }} />
                  {alertText}
                </p>
              )}
              {!packageHistoryOpen && <p className="text-[10px] text-white/30 font-light">Tap to see your attendance for this package</p>}
            </button>

            {packageHistoryOpen && (
              <div className="border-t border-white/[0.06] p-3 space-y-2">
                <p className="text-[11px] text-white/50">
                  This package: <span className="text-emerald-400 font-semibold">{completedSessions} attended</span>
                  {absentCount > 0 && <> · <span className="text-[#ec2226] font-semibold">{absentCount} absent</span></>}
                </p>
                {rows.length === 0 ? (
                  <p className="text-xs text-white/40 font-light text-center py-3">No sessions in this package yet.</p>
                ) : (
                  rows.map((r) => {
                    const rd = parseDateKey(r.date);
                    const rt = r.time ? formatTime(r.time) : null;
                    return (
                      <div key={r.key} className="flex items-center gap-3 bg-[#252525] border border-white/[0.06] rounded-xl px-3 py-2">
                        <div className="w-16 shrink-0 text-xs font-semibold text-white">
                          {rd ? rd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : r.date}
                          <div className="text-[10px] text-white/40 font-light">{rd ? rd.toLocaleDateString(undefined, { weekday: 'short' }) : ''}</div>
                        </div>
                        <div className="flex-1 min-w-0 text-[11px] text-white/50 truncate">
                          {r.note || (rt ? `${rt.clock} ${rt.period}` : '')}
                        </div>
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                          style={{ color: r.color, borderColor: `${r.color}40`, backgroundColor: `${r.color}15` }}
                        >
                          {r.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Today - the suggested workout assigned for today (do it any time) plus any coach session */}
      {(() => {
        if (!sessionsLoaded || plansLoading) return <InlineLoader />;
        const todayKey = toDateKey(new Date());
        const todaysWorkouts = plans.filter((p) => p.date === todayKey);
        const d = parseDateKey(todayKey);
        const dateTile = (
          <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
            <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">
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
              const sd = parseDateKey(toDateKey(new Date()));
              const t = formatTime(s.time);
              const movedAway = s.date !== toDateKey(new Date());
              const absent = !movedAway && (s.attendanceStatus === 'Absent' || s.attendanceStatus === 'No Show');
              const color = movedAway ? '#f59e0b' : absent ? '#ec2226' : statusColor(s.status);
              const label = movedAway ? 'POSTPONED' : absent ? 'ABSENT' : s.status.toUpperCase();
              const movedTo = movedAway ? parseDateKey(s.date) : null;
              const movedTime = movedAway ? formatTime(s.time) : null;
              return (
                <div key={s.id} className="bg-[#252525] border border-white/[0.06] rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
                    <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">
                      {sd ? sd.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
                    </div>
                    <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{sd ? sd.getDate() : '—'}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
                      {sd ? sd.toLocaleDateString(undefined, { month: 'short' }) : ''}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none mb-1.5">Session with coach</div>
                    {movedAway ? (
                      <div className="text-sm font-bold text-amber-400 leading-snug">
                        Moved to {movedTo ? movedTo.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : s.date}
                        {movedTime ? ` · ${movedTime.clock} ${movedTime.period}` : ''}
                      </div>
                    ) : (
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
                    )}
                    <div className="text-xs font-semibold text-white/80 mt-1 truncate">{s.sessionType}</div>
                    <div className="text-[11px] text-white/40 font-light truncate">{s.location} · Coach {s.coachName}</div>
                  </div>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                  >
                    {label}
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
              return (
                <SuggestedWorkoutCard
                  key={w.id}
                  title={w.planTitle}
                  label="Do it yourself"
                  hint={`Do it any time today${w.durationMinutes ? ` · ${w.durationMinutes} mins` : ''}`}
                  done={done}
                  onClick={() => setSelectedWorkout(w)}
                />
              );
            })}

            </div>
          )}
          </>
        );
      })()}

      {/* Testimonials - auto-scrolling approved client feedback + a form to share your own */}
      <Testimonials clientId={clientId} clientName={clientName} />
    </div>
  );
};
