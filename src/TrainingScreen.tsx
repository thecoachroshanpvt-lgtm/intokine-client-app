import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { initializeClientFirebaseApp, doc, setDoc, collection, query, where, onSnapshot } from './firebase';
import { ContactCoachPill } from './CoachContact';
import { IS_RECORDED } from './variant';
import { bestOfAllTime, type BestPlan, type BestPerf } from './BestOfAllTime';
import { ExerciseResultEditor, setText, type ResultMap, type ExerciseResult } from './ExerciseResultEditor';

/** Minutes (decimal) as a set cell: 10 -> 10 min, 0.75 -> 45 sec, 2.5 -> 2:30 min */
const durCell = (m: number): { value: string; unit: string } => {
  const total = Math.round((m || 0) * 60);
  const mi = Math.floor(total / 60);
  const sc = total % 60;
  if (mi && sc) return { value: `${mi}:${String(sc).padStart(2, '0')}`, unit: 'min' };
  if (sc) return { value: String(sc), unit: 'sec' };
  return { value: String(mi), unit: 'min' };
};

/** 45 -> "45 sec", 90 -> "1 min 30 sec", 600 -> "10 min" */
const fmtSecs = (total: number): string => {
  const m = Math.floor(total / 60);
  const sc = Math.round(total % 60);
  if (m && sc) return `${m} min ${sc} sec`;
  if (m) return `${m} min`;
  return `${sc} sec`;
};

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
  timeSeconds?: number;
  setsCount?: number;
  tempo?: string;
  holdSeconds?: number;
  rounds?: number;
  drillMode?: 'rounds' | 'duration';
  durationMinutes?: number;
  distanceKm?: number;
  method?: string;
}

interface TrainerizeExercise {
  id: string;
  name: string;
  category: string;
  equipment?: string;
  targetMuscle?: string;
  supersetTag?: string;
  exerciseType?: 'Weighted' | 'Bodyweight' | 'Isometric' | 'DistanceCardio' | 'DurationCardio' | 'TimeDistanceCardio' | 'Drill';
  sets: TrainerizeSet[];
  coachCues?: string;
  phase?: string;
  isStretchReminder?: boolean;
  videoUrl?: string; // demonstration video - a direct video file link or a YouTube link, added later
  previousBestPerformance?: string;
  previousVolumeKg?: number;
}

interface SuggestedWorkout {
  id: string;
  date: string;
  planTitle: string;
  category: string;
  planDetails: string;
  targetFocus: string;
  durationMinutes: number;
  rpeTarget: number;
  coachName: string;
  coachSessionNotes?: string;
  structuredExercises?: TrainerizeExercise[];
  clientCompletedAt?: string;
  clientExerciseResults?: ResultMap; // Zaki: what the client really did on exercises they could not do as planned
}

interface TrainingScreenProps {
  clientId: string;
  workout: SuggestedWorkout;
  onBack: () => void;
  onMarkedComplete: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  Weighted: 'Weighted',
  Bodyweight: 'Bodyweight',
  Isometric: 'Isometric',
  DistanceCardio: 'Cardio · Distance',
  DurationCardio: 'Cardio · Duration',
  TimeDistanceCardio: 'Cardio · Time + distance',
  Drill: 'Drill',
};

// The columns shown for one set, depending on the exercise type.
const setCells = (ex: TrainerizeExercise, s: TrainerizeSet, withTempo: boolean): { label: string; value: string; unit?: string; accent?: boolean; text?: boolean }[] => {
  const type = ex.exerciseType || 'Weighted';
  const dash = '–';
  const cells: { label: string; value: string; unit?: string; accent?: boolean; text?: boolean }[] = [];
  if (type === 'Weighted') cells.push({ label: 'Weight', value: String(s.targetWeightKg || 0), unit: 'kg' }, { label: 'Reps', value: String(s.targetReps || 0) });
  else if (type === 'Bodyweight') cells.push({ label: 'Reps', value: String(s.targetReps || 0) });
  else if (type === 'Isometric') { const d = durCell((s.holdSeconds || 0) / 60); cells.push({ label: 'Hold', value: d.value, unit: d.unit }); }
  else if (type === 'TimeDistanceCardio') { const d = durCell(s.durationMinutes || 0); cells.push({ label: 'Time', value: d.value, unit: d.unit }, { label: 'Distance', value: String(s.distanceKm || 0), unit: 'km' }); }
  else if (type === 'Drill') { if (s.drillMode === 'duration') { const d = durCell(s.durationMinutes || 0); cells.push({ label: 'Duration', value: s.durationMinutes ? d.value : dash, unit: s.durationMinutes ? d.unit : undefined }); } else cells.push({ label: 'Rounds', value: s.rounds ? String(s.rounds) : dash }); }
  else if (type === 'DurationCardio') { const d = durCell(s.durationMinutes || 0); cells.push({ label: 'Time', value: d.value, unit: d.unit }, { label: 'Method', value: s.method || dash, text: true }); }
  else if (type === 'DistanceCardio') cells.push({ label: 'Distance', value: String(s.distanceKm || 0), unit: 'km' }, { label: 'Method', value: s.method || dash, text: true });
  if (withTempo && (type === 'Weighted' || type === 'Bodyweight')) cells.push({ label: 'Tempo', value: s.tempo || dash, text: true });
  return cells;
};

// Demonstration video. A small thumbnail on the exercise card; tapping it opens the video in a big popup.
// Until a video link is added to the exercise, the thumbnail and popup show a "coming soon" space.
const youtubeId = (url?: string) => {
  const m = url ? url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) : null;
  return m ? m[1] : '';
};

const PlayBadge: React.FC<{ size?: string }> = ({ size = 'w-8 h-8' }) => (
  <span className={`${size} rounded-full bg-black/55 flex items-center justify-center`}>
    <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 ml-0.5 text-white" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  </span>
);

const VideoThumb: React.FC<{ url?: string; name: string; dim?: boolean; onOpen: () => void }> = ({ url, name, dim, onOpen }) => {
  const yt = youtubeId(url);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Watch ${name} demonstration`}
      className={`relative shrink-0 w-[64px] h-[48px] rounded-lg overflow-hidden bg-black/30 flex items-center justify-center ${dim ? 'opacity-50' : ''}`}
    >
      {yt ? (
        <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : url ? (
        <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      ) : null}
      <span className="relative flex flex-col items-center gap-1">
        <PlayBadge />
        {!url && <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">Demo</span>}
      </span>
    </button>
  );
};

const VideoPopup: React.FC<{ url?: string; name: string; onClose: () => void }> = ({ url, name, onClose }) => {
  const yt = youtubeId(url);
  // Same as the other popups in the app: the page behind stays still and pull-to-refresh is off while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute('data-popup-open');
    };
  }, []);
  return createPortal(
    <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div data-no-pull className="anim-card w-full max-w-md bg-[#1c1c1c] border border-white/[0.1] rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="font-subheader text-[18px] text-white leading-tight truncate">{name}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6ccbde] mt-0.5">Demonstration</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 shrink-0 rounded-full bg-white/[0.08] text-white/70 hover:text-white flex items-center justify-center text-sm">✕</button>
        </div>
        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
          {yt ? (
            <iframe
              src={`https://www.youtube.com/embed/${yt}?rel=0&playsinline=1&autoplay=1`}
              title={`${name} demonstration`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : url ? (
            <video src={url} controls autoPlay playsInline className="absolute inset-0 w-full h-full object-contain bg-black" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#252525]">
              <PlayBadge size="w-14 h-14" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Demo video coming soon</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const PHASE_ORDER = ['Warmup', 'Main', 'Cooldown'] as const;
const phaseGroup = (ex: TrainerizeExercise): (typeof PHASE_ORDER)[number] => (ex.phase === 'Warmup' ? 'Warmup' : ex.phase === 'Cooldown' ? 'Cooldown' : 'Main');
const PHASE_TITLE: Record<string, string> = { Warmup: 'Warm-up', Main: 'Exercises', Cooldown: 'Cool down' };

export const TrainingScreen: React.FC<TrainingScreenProps> = ({ clientId, workout, onBack, onMarkedComplete }) => {
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
  const [markingComplete, setMarkingComplete] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(!!workout.clientCompletedAt);
  const [videoEx, setVideoEx] = useState<TrainerizeExercise | null>(null);
  // Zaki: numbers the client changed on exercises they could not do as planned. Saved together with Mark Workout Complete.
  const [results, setResults] = useState<ResultMap>(workout.clientExerciseResults || {});
  const [editingId, setEditingId] = useState<string | null>(null);
  // How hard each exercise felt (RPE 1-10). Only the client enters this; it is saved with Mark Workout Complete.
  const [rpes, setRpes] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    Object.entries(workout.clientExerciseResults || {}).forEach(([id, r]) => { if (r && typeof r.rpe === 'number') o[id] = r.rpe; });
    return o;
  });
  const [saveNote, setSaveNote] = useState('');
  // Zaki only: what the client has really done before, to show the best of all time on each exercise.
  const [bestPlans, setBestPlans] = useState<BestPlan[]>([]);
  const [bestPerf, setBestPerf] = useState<BestPerf[]>([]);
  useEffect(() => {
    if (!IS_RECORDED) return;
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    const u1 = onSnapshot(
      query(collection(db, 'intokine_given_session_plans'), where('clientId', '==', clientId), where('clientVisible', '==', true)),
      (snap) => setBestPlans(snap.docs.map((d) => d.data() as BestPlan)),
      () => {}
    );
    const u2 = onSnapshot(
      doc(db, 'intokine_clients', clientId),
      (snap) => {
        const d: any = snap.exists() ? snap.data() : {};
        setBestPerf(Array.isArray(d.performanceScores) ? d.performanceScores : []);
      },
      () => {}
    );
    return () => { u1(); u2(); };
  }, [clientId]);
  // A workout can only be marked done on its assigned day. After that day it counts as not done, unless the coach moved it.
  const now = new Date();
  const todayK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const missed = !alreadyDone && !!workout.date && workout.date < todayK;
  const toggleExerciseDone = (id: string) => {
    setCompletedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveResult = (id: string, r: ExerciseResult) => {
    setResults((prev) => ({ ...prev, [id]: r }));
    setCompletedExerciseIds((prev) => new Set(prev).add(id)); // saving what they did also counts the exercise as done
    setEditingId(null);
  };
  const resetResult = (id: string) => {
    setResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setEditingId(null);
  };

  const exercises = workout.structuredExercises || [];
  const allExercisesDone = exercises.length > 0 && exercises.every((ex) => completedExerciseIds.has(ex.id));
  const isDoneId = (id: string) => alreadyDone || completedExerciseIds.has(id);
  const doneCount = exercises.filter((ex) => isDoneId(ex.id)).length;
  const realCount = exercises.filter((ex) => !ex.isStretchReminder).length;
  // The first exercise not ticked yet is the one the client is on.
  const upNextId = alreadyDone ? '' : exercises.find((ex) => !ex.isStretchReminder && !completedExerciseIds.has(ex.id))?.id || '';

  const handleMarkWorkoutComplete = async () => {
    setMarkingComplete(true);
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');
      // Clients can only ever set this one field on their own
      // suggested workout - never touch anything else on the plan
      // record, matching the same narrow-write pattern used for the
      // profile photo elsewhere in this app.
      const stamp = new Date().toISOString();
      const edits: ResultMap = {};
      exercises.forEach((e) => { if (results[e.id]?.edited && completedExerciseIds.has(e.id)) edits[e.id] = results[e.id]; });
      exercises.forEach((e) => { if (rpes[e.id]) edits[e.id] = { ...(edits[e.id] || { edited: false, sets: [] }), rpe: rpes[e.id] }; });
      try {
        await setDoc(doc(db, 'intokine_given_session_plans', workout.id), { clientCompletedAt: stamp, ...(Object.keys(edits).length > 0 ? { clientExerciseResults: edits } : {}) }, { merge: true });
      } catch (err) {
        // The workout must still count as done even if the changed numbers cannot be stored.
        if (Object.keys(edits).length === 0) throw err;
        await setDoc(doc(db, 'intokine_given_session_plans', workout.id), { clientCompletedAt: stamp }, { merge: true });
        setSaveNote('Your workout is saved, but the numbers you changed could not be saved. Please tell your coach.');
      }
      setAlreadyDone(true);
      onMarkedComplete();
    } catch (e) {
      console.warn('Could not mark workout complete:', e);
      setSaveNote('Could not save. Check your internet and try again.');
    } finally {
      setMarkingComplete(false);
    }
  };

  const groups = PHASE_ORDER.map((p) => ({ phase: p, items: exercises.filter((ex) => phaseGroup(ex) === p) })).filter((g) => g.items.length > 0);
  const showPhaseTitles = groups.length > 1;
  const meta = [
    workout.durationMinutes ? `${workout.durationMinutes} min` : '',
    realCount ? `${realCount} exercises` : '',
  ].filter(Boolean);

  return (
    <div className="px-5 pb-8 pt-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button onClick={onBack} className="text-[12px] font-semibold text-[#6ccbde] hover:text-white flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Plans
        </button>
        <ContactCoachPill clientId={clientId} coachName={workout.coachName} workoutTitle={workout.planTitle} />
      </div>

      {/* Hero */}
      <div className="rounded-3xl px-5 pt-5 pb-5 mb-7" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-subheader text-[12px] text-[#6ccbde] uppercase tracking-wide">Suggested Workout</span>
          {alreadyDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">✓ Completed</span>}
          {missed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">Not done</span>}
        </div>
        <h1 className="font-header text-[40px] leading-[1] text-white uppercase break-words">{workout.planTitle}</h1>
        {meta.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap font-subheader text-[14px] uppercase tracking-wide text-white/70">
            {meta.map((m, i) => (
              <React.Fragment key={m}>
                {i > 0 && <span className="w-1 h-1 rounded-full bg-white/25" />}
                <span>{m}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {(workout.category || workout.targetFocus) && (
          <div className="mt-1.5 text-[12px] text-white/45">{[workout.category, workout.targetFocus].filter(Boolean).join(' · ')}</div>
        )}

        {exercises.length > 0 && (
          <div className="mt-5">
            <div className="flex gap-1">
              {exercises.map((ex) => (
                <span key={ex.id} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${isDoneId(ex.id) ? (doneCount === exercises.length ? 'bg-emerald-400' : 'bg-[#6ccbde]') : 'bg-white/[0.12]'}`} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-white/45">
              <span>From Coach <span className="text-white/75 font-semibold">{workout.coachName}</span></span>
              <span><span className="font-mono text-white/80">{doneCount}</span> of <span className="font-mono">{exercises.length}</span> done</span>
            </div>
          </div>
        )}

        {workout.coachSessionNotes && (
          <div className="mt-2.5 flex gap-2">
            <div className="w-[3px] rounded-full bg-[#6ccbde] shrink-0" />
            <p className="text-[12px] text-white/75 leading-relaxed italic">"{workout.coachSessionNotes}"</p>
          </div>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="bg-[#252525] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 leading-relaxed">
            {workout.planDetails || 'Your coach hasn’t added exercise details yet - do the session as briefed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => {
            const realInGroup = g.items.filter((e) => !e.isStretchReminder);
            return (
              <section key={g.phase}>
                {showPhaseTitles && (
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-subheader text-[13px] uppercase tracking-[0.14em] text-[#6ccbde]">{PHASE_TITLE[g.phase]}</h2>
                    <div className="flex-1 h-px bg-white/[0.08]" />
                  </div>
                )}
                <div className="relative space-y-2">
                  {/* the rail the exercises hang on */}
                  <div className="absolute left-[13px] top-4 bottom-4 w-px bg-white/[0.1]" />
                  {g.items.map((ex) => {
                    const isDone = isDoneId(ex.id);

                    if (ex.isStretchReminder) {
                      return (
                        <button key={ex.id} onClick={() => toggleExerciseDone(ex.id)} className="relative w-full pl-10 text-left block">
                          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${isDone ? 'bg-emerald-500 text-[#0b0c10]' : 'bg-[#252525] text-[#6ccbde]'}`}>{isDone ? '✓' : '✦'}</span>
                          <span className={`block rounded-2xl px-3 py-2.5 bg-[#252525] font-subheader text-[15px] leading-tight ${isDone ? 'text-white/45' : 'text-white'}`}>{ex.name}</span>
                        </button>
                      );
                    }

                    const idx = realInGroup.findIndex((e) => e.id === ex.id) + 1;
                    const first = ex.sets[0];
                    const withTempo = ex.sets.some((s) => !!s.tempo);
                    const multi = ex.sets.length > 1;
                    const headCells = first ? setCells(ex, first, withTempo) : [];
                    const cols = `${multi ? '2rem ' : ''}repeat(${Math.max(headCells.length, 1)}, minmax(0, 1fr))`;
                    const isNext = ex.id === upNextId;
                    return (
                      <React.Fragment key={ex.id}>
                        <div className="relative pl-10">
                          <button
                            onClick={() => toggleExerciseDone(ex.id)}
                            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                            className={`absolute left-0 top-2.5 w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-[13px] transition ${
                              isDone ? 'bg-emerald-500 text-[#0b0c10]' : isNext ? 'bg-[#6ccbde] text-[#0b0c10] shadow-[0_0_0_4px_rgba(108,203,222,0.18)]' : 'bg-[#252525] text-white/70'
                            }`}
                          >
                            {isDone ? '✓' : idx}
                          </button>

                          <div className={`rounded-2xl p-3 transition ${isDone ? 'bg-[#252525]/60' : 'bg-[#252525]'}`}>
                            <div className="flex items-start gap-2.5">
                            <button onClick={() => toggleExerciseDone(ex.id)} className="flex-1 min-w-0 text-left">
                              {isNext && <span className="block font-subheader text-[11px] uppercase tracking-[0.14em] text-[#6ccbde] mb-0.5">Up next</span>}
                              <span className="flex items-start gap-2 flex-wrap">
                                {ex.supersetTag && <span className="text-[9px] font-bold text-[#6ccbde] bg-[#6ccbde]/10 px-1.5 py-0.5 rounded mt-1.5">{ex.supersetTag}</span>}
                                <span className={`font-subheader text-[16px] leading-[1.15] break-words ${isDone ? 'text-white/45 line-through decoration-white/30' : 'text-white'}`}>{ex.name}</span>
                              </span>
                              <span className="block text-[10.5px] text-white/40 mt-0.5">
                                {[TYPE_LABEL[ex.exerciseType || 'Weighted'], ex.targetMuscle, ex.equipment].filter(Boolean).join(' · ')}
                              </span>
                              {IS_RECORDED && (() => {
                                const best = bestOfAllTime(ex.name, ex.exerciseType, bestPlans, bestPerf);
                                return best ? (
                                  <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 text-[11px] font-semibold">
                                    Best <span className="font-mono">{best}</span>
                                  </span>
                                ) : null;
                              })()}
                            </button>
                            <VideoThumb url={ex.videoUrl} name={ex.name} dim={isDone} onOpen={() => setVideoEx(ex)} />
                            </div>

                            {/* Targets */}
                            {ex.sets.length > 0 && (
                              <div className={`mt-2.5 ${isDone ? 'opacity-50' : ''}`}>
                                {!multi ? (
                                  <div className="flex items-stretch">
                                    {headCells.map((c, i) => (
                                      <div key={c.label} className={`flex-1 min-w-0 ${i > 0 ? 'pl-2.5 ml-2.5 border-l border-white/[0.1]' : ''}`}>
                                        <div className={`${c.text ? 'text-[15px] font-semibold leading-tight' : 'font-mono text-[20px] font-bold leading-none'} truncate ${c.accent ? 'text-[#6ccbde]' : 'text-white'}`}>
                                          {c.value}
                                          {c.unit && c.value !== '–' && <span className="text-[11px] font-medium text-white/40 ml-1">{c.unit}</span>}
                                        </div>
                                        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mt-0.5">{c.label}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="grid items-center text-center" style={{ gridTemplateColumns: cols }}>
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Set</span>
                                      {headCells.map((c) => (
                                        <span key={c.label} className="text-[9px] font-bold uppercase tracking-wider text-white/40">{c.label}</span>
                                      ))}
                                    </div>
                                    {ex.sets.map((s, sIdx) => (
                                      <div key={s.id || sIdx} className="grid items-center text-center rounded-lg bg-white/[0.04] py-1.5" style={{ gridTemplateColumns: cols }}>
                                        <span className="font-mono text-[12px] text-white/40">{s.setType !== 'Working' ? s.setType[0] : s.setNumber || sIdx + 1}</span>
                                        {setCells(ex, s, withTempo).map((c) => (
                                          <span key={c.label} className={`${c.text ? 'text-[14px]' : 'font-mono text-[15px]'} font-semibold leading-tight truncate px-1 ${c.accent ? 'text-[#6ccbde]' : 'text-white'}`}>
                                            {c.value}
                                            {c.unit && c.value !== '–' && <span className="text-[10px] font-medium text-white/40 ml-0.5">{c.unit}</span>}
                                          </span>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* RPE: entered by the client, never by the coach */}
                            {['Weighted', 'Bodyweight', 'Isometric'].includes(ex.exerciseType || 'Weighted') && ex.sets.length > 0 && !ex.isStretchReminder && (
                              <div className="mt-4">
                                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 mb-1.5">Your RPE · how hard was it?{rpes[ex.id] ? <span className="text-[#6ccbde]"> · {rpes[ex.id]}</span> : null}</div>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                    <button key={n} type="button" disabled={alreadyDone}
                                      onClick={() => setRpes((p) => { const o = { ...p }; if (o[ex.id] === n) delete o[ex.id]; else o[ex.id] = n; return o; })}
                                      className={`flex-1 h-8 rounded-lg text-[12px] font-mono font-bold border transition ${rpes[ex.id] === n ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/60' : 'border-white/[0.08] text-white/45'} disabled:opacity-60`}>{n}</button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Zaki: what the client really did, when it was not the planned numbers */}
                            {IS_RECORDED && results[ex.id]?.edited && editingId !== ex.id && (
                              <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">What I did</span>
                                  {!alreadyDone && !missed && <button type="button" onClick={() => setEditingId(ex.id)} className="text-[11px] font-semibold text-amber-300">Change</button>}
                                </div>
                                <div className="mt-1.5 space-y-0.5">
                                  {results[ex.id].sets.map((r, i) => (
                                    <div key={i} className="text-[13px] font-mono text-white/90">{results[ex.id].sets.length > 1 ? `${i + 1}.  ` : ''}{setText(ex.exerciseType, r)}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {IS_RECORDED && editingId === ex.id && (
                              <ExerciseResultEditor
                                kind={ex.exerciseType}
                                sets={ex.sets}
                                initial={results[ex.id]}
                                onSave={(r) => saveResult(ex.id, r)}
                                onCancel={() => setEditingId(null)}
                                onReset={results[ex.id] ? () => resetResult(ex.id) : undefined}
                              />
                            )}
                            {IS_RECORDED && !alreadyDone && !missed && !results[ex.id]?.edited && editingId !== ex.id && ex.sets.length > 0 && (
                              <button type="button" onClick={() => setEditingId(ex.id)} className="mt-3 text-[11px] font-semibold text-white/55 underline decoration-white/20">
                                Did less?
                              </button>
                            )}

                            {ex.coachCues && (
                              <div className="mt-4 flex gap-2.5">
                                <div className="w-[3px] rounded-full bg-[#ec2226]/70 shrink-0" />
                                <p className="text-[11.5px] text-white/60 leading-snug">{ex.coachCues}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="relative pl-10">
                        {/* Between this exercise and the next: Rest / Sets / Time apply after the exercises before it. 1 → centred · 2 → left + right · 3 → Rest left, Time middle, Sets right */}
                        {(() => {
                          const pills: { key: string; node: React.ReactNode }[] = [];
                          if (first?.restSeconds) pills.push({ key: 'rest', node: <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 text-[11px] font-semibold">Rest <span className="font-mono">{fmtSecs(first.restSeconds)}</span></span> });
                          if (first?.setsCount) pills.push({ key: 'sets', node: <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#6ccbde]/10 text-[#6ccbde] text-[11px] font-semibold"><span className="font-mono">{first.setsCount}</span> Sets</span> });
                          if (first?.timeSeconds) pills.push({ key: 'time', node: <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 text-[11px] font-semibold">Time <span className="font-mono">{fmtSecs(first.timeSeconds)}</span></span> });
                          if (!pills.length) return null;
                          const rest = pills.find((p) => p.key === 'rest'), sets = pills.find((p) => p.key === 'sets'), time = pills.find((p) => p.key === 'time');
                          const ordered = pills.length === 3 ? [rest!, time!, sets!] : pills;
                          const place = (i: number) => pills.length === 1 ? 'col-start-2 justify-self-center' : pills.length === 2 ? (i === 0 ? 'col-start-1 justify-self-start' : 'col-start-3 justify-self-end') : ['justify-self-start', 'justify-self-center', 'justify-self-end'][i];
                          return (
                            <div className="grid grid-cols-3 items-center px-1">
                              {ordered.map((p, i) => <span key={p.key} className={place(i)}>{p.node}</span>)}
                            </div>
                          );
                        })()}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {missed && (
        <div className="mt-7 rounded-2xl bg-[#252525] px-4 py-4 text-center">
          <p className="font-subheader text-[15px] text-white">This workout was not done on its day</p>
          <p className="text-[11px] text-white/50 font-light mt-1">It can only be marked done on the day it was assigned. Ask your coach if you need it moved.</p>
        </div>
      )}
      {!alreadyDone && !missed && (
        <div className="mt-7">
          {exercises.length > 0 && (
            <div className="text-[11px] text-white/45 mb-2 px-1 text-center">
              {allExercisesDone ? 'All done - nice work' : 'Tap the number beside each exercise when you finish it'}
            </div>
          )}
          {(() => {
            const locked = markingComplete || (exercises.length > 0 && !allExercisesDone);
            return (
              <button
                onClick={handleMarkWorkoutComplete}
                disabled={locked}
                className={`w-full py-4 rounded-2xl font-subheader text-[16px] uppercase tracking-wide transition ${locked ? 'bg-[#252525] text-white/40 cursor-not-allowed' : 'text-white'}`}
                style={locked ? undefined : { background: '#ec2226' }}
              >
                {markingComplete
                  ? 'Saving...'
                  : exercises.length > 0 && !allExercisesDone
                  ? `${doneCount} of ${exercises.length} done`
                  : 'Mark Workout Complete'}
              </button>
            );
          })()}
          {saveNote && <p className="mt-3 text-center text-[12px] text-amber-300">{saveNote}</p>}
        </div>
      )}

      {videoEx && <VideoPopup url={videoEx.videoUrl} name={videoEx.name} onClose={() => setVideoEx(null)} />}
    </div>
  );
};
