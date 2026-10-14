import React, { useState } from 'react';
import { initializeClientFirebaseApp, doc, setDoc } from './firebase';

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
  setsCount?: number;
  tempo?: string;
  holdSeconds?: number;
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
  exerciseType?: 'Weighted' | 'Bodyweight' | 'Isometric' | 'DistanceCardio' | 'DurationCardio';
  sets: TrainerizeSet[];
  coachCues?: string;
  phase?: string;
  isStretchReminder?: boolean;
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
}

interface TrainingScreenProps {
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
};

// The columns shown for one set, depending on the exercise type.
const setCells = (ex: TrainerizeExercise, s: TrainerizeSet, withTempo: boolean): { label: string; value: string; unit?: string; accent?: boolean }[] => {
  const type = ex.exerciseType || 'Weighted';
  const dash = '–';
  const rpe = s.rpe ? String(s.rpe) : dash;
  const cells: { label: string; value: string; unit?: string; accent?: boolean }[] = [];
  if (type === 'Weighted') cells.push({ label: 'Weight', value: String(s.targetWeightKg || 0), unit: 'kg' }, { label: 'Reps', value: String(s.targetReps || 0) });
  else if (type === 'Bodyweight') cells.push({ label: 'Reps', value: String(s.targetReps || 0) });
  else if (type === 'Isometric') cells.push({ label: 'Hold', value: String(s.holdSeconds || 0), unit: 'sec' });
  else if (type === 'DurationCardio') cells.push({ label: 'Time', value: String(s.durationMinutes || 0), unit: 'min' }, { label: 'Method', value: s.method || dash });
  else if (type === 'DistanceCardio') cells.push({ label: 'Distance', value: String(s.distanceKm || 0), unit: 'km' }, { label: 'Method', value: s.method || dash });
  if (withTempo && (type === 'Weighted' || type === 'Bodyweight')) cells.push({ label: 'Tempo', value: s.tempo || dash });
  if (type === 'Weighted' || type === 'Bodyweight' || type === 'Isometric') cells.push({ label: 'RPE', value: rpe, accent: true });
  return cells;
};

const PHASE_ORDER = ['Warmup', 'Main', 'Cooldown'] as const;
const phaseGroup = (ex: TrainerizeExercise): (typeof PHASE_ORDER)[number] => (ex.phase === 'Warmup' ? 'Warmup' : ex.phase === 'Cooldown' ? 'Cooldown' : 'Main');
const PHASE_TITLE: Record<string, string> = { Warmup: 'Warm-up', Main: 'Exercises', Cooldown: 'Cool down' };

const ProgressRing: React.FC<{ done: number; total: number }> = ({ done, total }) => {
  const pct = total > 0 ? done / total : 0;
  const r = 24;
  const c = 2 * Math.PI * r;
  const complete = total > 0 && done === total;
  return (
    <div className="relative w-[60px] h-[60px] shrink-0">
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={complete ? '#34d399' : '#6ccbde'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 400ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono text-[15px] font-bold text-white">{done}<span className="text-white/40">/{total}</span></span>
      </div>
    </div>
  );
};

export const TrainingScreen: React.FC<TrainingScreenProps> = ({ workout, onBack, onMarkedComplete }) => {
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
  const [markingComplete, setMarkingComplete] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(!!workout.clientCompletedAt);

  const toggleExerciseDone = (id: string) => {
    setCompletedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exercises = workout.structuredExercises || [];
  const allExercisesDone = exercises.length > 0 && exercises.every((ex) => completedExerciseIds.has(ex.id));
  const doneCount = alreadyDone ? exercises.length : exercises.filter((ex) => completedExerciseIds.has(ex.id)).length;
  const realCount = exercises.filter((ex) => !ex.isStretchReminder).length;

  const handleMarkWorkoutComplete = async () => {
    setMarkingComplete(true);
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('Could not connect.');
      // Clients can only ever set this one field on their own
      // suggested workout - never touch anything else on the plan
      // record, matching the same narrow-write pattern used for the
      // profile photo elsewhere in this app.
      await setDoc(doc(db, 'intokine_given_session_plans', workout.id), { clientCompletedAt: new Date().toISOString() }, { merge: true });
      setAlreadyDone(true);
      onMarkedComplete();
    } catch (e) {
      console.warn('Could not mark workout complete:', e);
    } finally {
      setMarkingComplete(false);
    }
  };

  const groups = PHASE_ORDER.map((p) => ({ phase: p, items: exercises.filter((ex) => phaseGroup(ex) === p) })).filter((g) => g.items.length > 0);
  const showPhaseTitles = groups.length > 1;

  return (
    <div className="px-5 pb-8 pt-4 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-[12px] font-semibold text-[#6ccbde] hover:text-white flex items-center gap-1 mb-4">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Plans
      </button>

      {/* Hero */}
      <div className="rounded-3xl p-5 mb-5" style={{ background: 'linear-gradient(160deg, rgba(236,34,38,0.1), rgba(108,203,222,0.06))' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-subheader text-[12px] text-[#6ccbde] uppercase tracking-wide">Suggested Workout</span>
              {alreadyDone && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">✓ Completed</span>
              )}
            </div>
            <h1 className="font-header text-[32px] leading-[1.05] text-white uppercase break-words">{workout.planTitle}</h1>
            <div className="text-[12px] text-white/50 mt-2">From Coach <span className="text-white/80 font-semibold">{workout.coachName}</span></div>
          </div>
          {exercises.length > 0 && <ProgressRing done={doneCount} total={exercises.length} />}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Duration', value: workout.durationMinutes ? String(workout.durationMinutes) : '–', unit: workout.durationMinutes ? 'min' : '' },
            { label: 'Exercises', value: String(realCount || exercises.length || '–'), unit: '' },
            { label: 'Target RPE', value: workout.rpeTarget ? String(workout.rpeTarget) : '–', unit: workout.rpeTarget ? '/10' : '' },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl bg-black/20 px-3 py-2.5 text-center">
              <div className="font-mono text-[22px] font-bold text-white leading-none">{t.value}<span className="text-[11px] font-medium text-white/40 ml-0.5">{t.unit}</span></div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1.5">{t.label}</div>
            </div>
          ))}
        </div>

        {(workout.category || workout.targetFocus) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3.5">
            {workout.category && <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.08] text-white/70">{workout.category}</span>}
            {workout.targetFocus && <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#6ccbde]/15 text-[#6ccbde]">{workout.targetFocus}</span>}
          </div>
        )}

        {workout.coachSessionNotes && (
          <div className="mt-3.5 rounded-2xl bg-black/20 p-3.5 flex gap-2.5">
            <div className="w-[3px] rounded-full bg-[#6ccbde] shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1">Coach's note</span>
              <p className="text-[12px] text-white/80 leading-relaxed">{workout.coachSessionNotes}</p>
            </div>
          </div>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 leading-relaxed">
            {workout.planDetails || 'Your coach hasn’t added exercise details yet - do the session as briefed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const realInGroup = g.items.filter((e) => !e.isStretchReminder);
            return (
              <section key={g.phase} className="space-y-2.5">
                {showPhaseTitles && (
                  <h2 className="font-subheader text-[13px] uppercase tracking-[0.12em] text-[#6ccbde] px-1">{PHASE_TITLE[g.phase]}</h2>
                )}
                {g.items.map((ex) => {
                  const isDone = alreadyDone || completedExerciseIds.has(ex.id);

                  if (ex.isStretchReminder) {
                    return (
                      <button
                        key={ex.id}
                        onClick={() => toggleExerciseDone(ex.id)}
                        className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left border transition ${isDone ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-[#252525] border-white/[0.06]'}`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold ${isDone ? 'bg-emerald-500 text-[#0b0c10]' : 'bg-white/[0.08] text-[#6ccbde]'}`}>{isDone ? '✓' : '✦'}</span>
                        <span className={`font-subheader text-[16px] leading-tight ${isDone ? 'text-white/50' : 'text-white'}`}>{ex.name}</span>
                      </button>
                    );
                  }

                  const idx = realInGroup.findIndex((e) => e.id === ex.id) + 1;
                  const first = ex.sets[0];
                  const withTempo = ex.sets.some((s) => !!s.tempo);
                  const multi = ex.sets.length > 1;
                  const colCount = (ex.sets[0] ? setCells(ex, ex.sets[0], withTempo).length : 0);
                  const cols = `${multi ? '2.25rem ' : ''}repeat(${Math.max(colCount, 1)}, minmax(0, 1fr))`;
                  const headCells = ex.sets[0] ? setCells(ex, ex.sets[0], withTempo) : [];
                  return (
                    <React.Fragment key={ex.id}>
                      <div className={`rounded-2xl border overflow-hidden transition ${isDone ? 'bg-emerald-500/[0.07] border-emerald-500/25' : 'bg-[#252525] border-white/[0.06]'}`}>
                        {/* Header - tap to tick the exercise off */}
                        <button onClick={() => toggleExerciseDone(ex.id)} className="w-full text-left flex items-center gap-3 p-4">
                          <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-[15px] transition ${
                              isDone ? 'bg-emerald-500 text-[#0b0c10]' : 'bg-[#6ccbde] text-[#0b0c10]'
                            }`}
                          >
                            {isDone ? '✓' : idx}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              {ex.supersetTag && <span className="text-[9px] font-bold text-[#6ccbde] bg-[#6ccbde]/10 px-1.5 py-0.5 rounded">{ex.supersetTag}</span>}
                              <span className={`font-subheader text-[19px] leading-tight break-words ${isDone ? 'text-white/50' : 'text-white'}`}>{ex.name}</span>
                            </span>
                            {(ex.targetMuscle || ex.equipment) && (
                              <span className="block text-[11px] text-white/40 mt-0.5">{[ex.targetMuscle, ex.equipment].filter(Boolean).join(' · ')}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-white/[0.06] text-white/45">{TYPE_LABEL[ex.exerciseType || 'Weighted']}</span>
                        </button>

                        {/* Targets */}
                        {ex.sets.length > 0 && (
                          <div className="px-4 pb-4">
                            <div className="rounded-xl bg-black/20 px-2 py-2.5 space-y-1.5">
                              <div className="grid items-center text-center" style={{ gridTemplateColumns: cols }}>
                                {multi && <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Set</span>}
                                {headCells.map((c) => (
                                  <span key={c.label} className="text-[9px] font-bold uppercase tracking-wider text-white/40">{c.label}</span>
                                ))}
                              </div>
                              {ex.sets.map((s, sIdx) => (
                                <div key={s.id || sIdx} className="grid items-center text-center" style={{ gridTemplateColumns: cols }}>
                                  {multi && (
                                    <span className="font-mono text-[12px] text-white/35">{s.setType !== 'Working' ? s.setType[0] : s.setNumber || sIdx + 1}</span>
                                  )}
                                  {setCells(ex, s, withTempo).map((c) => (
                                    <span key={c.label} className={`font-mono text-[19px] font-semibold leading-tight truncate px-1 ${c.accent ? 'text-[#6ccbde]' : 'text-white'}`}>
                                      {c.value}
                                      {c.unit && c.value !== '–' && <span className="text-[10px] font-medium text-white/40 ml-0.5">{c.unit}</span>}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ex.coachCues && (
                          <div className="px-4 pb-4 -mt-1">
                            <div className="flex gap-2.5">
                              <div className="w-[3px] rounded-full bg-[#ec2226]/70 shrink-0" />
                              <p className="text-[12px] text-white/60 leading-relaxed">{ex.coachCues}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rest (left) and Sets (right) sit between this exercise and the next */}
                      {(first?.setsCount || first?.restSeconds) ? (
                        <div className="flex items-center justify-between gap-2 px-1">
                          <span className="min-w-0">
                            {first?.restSeconds ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-[11px] font-semibold">
                                Rest <span className="font-mono">{first.restSeconds}</span>s
                              </span>
                            ) : null}
                          </span>
                          {first?.setsCount ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#6ccbde]/10 text-[#6ccbde] text-[11px] font-semibold shrink-0">
                              <span className="font-mono">{first.setsCount}</span> Sets
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {!alreadyDone && (
        <div className="mt-6">
          {exercises.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-white/45 mb-2 px-1">
              <span>{allExercisesDone ? 'All done - nice work' : 'Tap each exercise as you finish it'}</span>
              <span className="font-mono">{doneCount}/{exercises.length}</span>
            </div>
          )}
          <button
            onClick={handleMarkWorkoutComplete}
            disabled={markingComplete || (exercises.length > 0 && !allExercisesDone)}
            className="w-full py-4 rounded-2xl font-subheader text-[16px] uppercase tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)', color: 'white' }}
          >
            {markingComplete
              ? 'Saving...'
              : exercises.length > 0 && !allExercisesDone
              ? 'Check off every exercise to finish'
              : 'Mark Workout Complete'}
          </button>
        </div>
      )}
    </div>
  );
};
