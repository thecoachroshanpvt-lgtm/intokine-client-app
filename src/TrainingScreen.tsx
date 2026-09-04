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

  return (
    <div className="px-5 pb-8 pt-4 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1 mb-4"
      >
        ← Back to Plans
      </button>

      <div className="bg-gradient-to-br from-[#ec2226]/15 to-[#6ccbde]/10 border border-white/[0.08] rounded-2xl p-5 mb-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-[#6ccbde] uppercase tracking-wide">Suggested Workout</span>
          {alreadyDone && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
              ✓ Completed
            </span>
          )}
        </div>
        <h1 className="text-xl font-black text-white">{workout.planTitle}</h1>
        <div className="text-xs text-white/50 font-light flex items-center gap-2 flex-wrap">
          <span>{workout.category}</span>
          {workout.durationMinutes ? (
            <>
              <span>·</span>
              <span>{workout.durationMinutes} mins</span>
            </>
          ) : null}
          <span>·</span>
          <span>From Coach {workout.coachName}</span>
        </div>
        {workout.targetFocus && (
          <p className="text-sm text-white/80 font-light">{workout.targetFocus}</p>
        )}
        {workout.coachSessionNotes && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 mt-1">
            <span className="text-[10px] font-bold text-white/40 uppercase block mb-1">Coach's Note</span>
            <p className="text-xs text-white/80 font-light">{workout.coachSessionNotes}</p>
          </div>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-sm text-white/50 font-light leading-relaxed">
            {workout.planDetails || 'Your coach hasn\u2019t added exercise details yet - do the session as briefed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((ex) => {
            const isDone = completedExerciseIds.has(ex.id);
            return (
              <div
                key={ex.id}
                className={`border rounded-2xl p-4 transition ${
                  isDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.05] border-white/[0.08]'
                }`}
              >
                <button onClick={() => toggleExerciseDone(ex.id)} className="w-full text-left flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                      isDone ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'
                    }`}
                  >
                    {isDone && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ex.supersetTag && (
                        <span className="text-[9px] font-bold text-[#6ccbde] bg-[#6ccbde]/10 px-1.5 py-0.5 rounded">{ex.supersetTag}</span>
                      )}
                      <span className={`text-sm font-semibold ${isDone ? 'text-white/60 line-through' : 'text-white'}`}>{ex.name}</span>
                    </div>
                    {ex.targetMuscle && (
                      <span className="text-[11px] text-white/40 font-light">{ex.targetMuscle}{ex.equipment ? ` · ${ex.equipment}` : ''}</span>
                    )}
                  </div>
                </button>

                {ex.sets.length > 0 && (
                  <div className="mt-3 space-y-1.5 pl-9">
                    {ex.sets.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-white/50 font-light">
                          {s.setType !== 'Working' ? `${s.setType} · ` : ''}Set {s.setNumber}
                        </span>
                        <span className="text-white font-mono">
                          {s.targetWeightKg ? `${s.targetWeightKg}kg × ` : ''}{s.targetReps} reps
                          {s.rpe ? ` @ RPE ${s.rpe}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {ex.coachCues && (
                  <p className="mt-2 pl-9 text-[11px] text-white/50 font-light italic">"{ex.coachCues}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!alreadyDone && (
        <button
          onClick={handleMarkWorkoutComplete}
          disabled={markingComplete || (exercises.length > 0 && !allExercisesDone)}
          className="w-full mt-5 py-3.5 rounded-2xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)', color: 'white' }}
        >
          {markingComplete
            ? 'Saving...'
            : exercises.length > 0 && !allExercisesDone
            ? 'Check off every exercise to finish'
            : 'Mark Workout Complete'}
        </button>
      )}
    </div>
  );
};
