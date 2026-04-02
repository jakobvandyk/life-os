"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import { SESSIONS, SessionTypeKey, ExerciseDef, SessionType } from "../constants";

interface ExerciseEntry {
  weight: string;
  sets: number;
  reps: number;
  rpe: string;
}

interface SessionLoggerProps {
  userId: string | null;
  onRefetch: () => void;
}

export default function SessionLogger({ userId, onRefetch }: SessionLoggerProps) {
  const [selectedSession, setSelectedSession] = useState<SessionTypeKey | null>(null);
  const [exerciseEntries, setExerciseEntries] = useState<Record<string, ExerciseEntry>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSessionSelect = (sessionKey: SessionTypeKey) => {
    setSelectedSession(sessionKey);
    const session = SESSIONS[sessionKey];
    const entries: Record<string, ExerciseEntry> = {};
    session.exercises.forEach(ex => {
      entries[ex.id] = {
        weight: "",
        sets: ex.sets,
        reps: ex.reps,
        rpe: ""
      };
    });
    setExerciseEntries(entries);
    setSessionNotes("");
  };

  const handleBackToPicker = () => {
    setSelectedSession(null);
    setExerciseEntries({});
    setSessionNotes("");
  };

  const handleEntryChange = (
    exerciseId: string,
    field: keyof ExerciseEntry,
    value: string
  ) => {
    setExerciseEntries(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: field === 'sets' || field === 'reps' ? parseInt(value) || 0 : value
      }
    }));
  };

  const handleRpeSelect = (exerciseId: string, rpe: string) => {
    setExerciseEntries(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        rpe: prev[exerciseId].rpe === rpe ? "" : rpe
      }
    }));
  };

  const getRpeButtonClass = (exerciseId: string, rpeValue: string) => {
    const entry = exerciseEntries[exerciseId];
    const isSelected = entry?.rpe === rpeValue;
    
    const baseClass = "px-3 py-2 rounded-sm text-xs font-medium border transition-colors duration-150 ";
    const unselectedClass = "bg-desert-bg border-desert-border-strong text-desert-text-3 hover:border-desert-border hover:text-desert-text-2";
    
    if (isSelected) {
      switch (rpeValue) {
        case 'easy':
          return baseClass + "bg-desert-success-dim border-desert-success text-desert-success";
        case 'med':
          return baseClass + "bg-desert-accent-glow border-desert-accent text-desert-accent";
        case 'hard':
          return baseClass + "bg-desert-danger-dim border-desert-danger text-desert-danger";
        case 'fail':
          return baseClass + "bg-desert-mystic-dim border-desert-mystic text-desert-mystic";
        default:
          return baseClass + unselectedClass;
      }
    }
    return baseClass + unselectedClass;
  };

  const handleSaveSession = async () => {
    if (!userId || !selectedSession) return;

    // Validate at least one exercise has weight entered
    const hasWeight = Object.values(exerciseEntries).some(entry => entry.weight && entry.weight !== "");
    if (!hasWeight) {
      alert("Please enter weight for at least one exercise.");
      return;
    }

    setSaving(true);
    try {
      const session = SESSIONS[selectedSession];
      const today = new Date().toISOString().split('T')[0];

      // Insert session
      const sessionPayload = {
        user_id: userId,
        type: selectedSession,
        label: session.label,
        date: today,
        notes: sessionNotes || null
      };
      const { data: sessionResult, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert(sessionPayload)
        .select("id")
        .single();

      if (sessionError) {
        await queueWrite("workout_sessions", "insert", sessionPayload);
        // Can't insert exercises without session ID when offline
      } else {
        const sessionId = sessionResult.id;

        // Insert exercises
        const exerciseInserts = session.exercises
          .filter(ex => exerciseEntries[ex.id]?.weight && exerciseEntries[ex.id].weight !== "")
          .map(ex => ({
            user_id: userId,
            session_id: sessionId,
            exercise_id: ex.id,
            name: ex.name,
            weight: parseFloat(exerciseEntries[ex.id].weight),
            sets: exerciseEntries[ex.id].sets,
            reps: exerciseEntries[ex.id].reps,
            rpe: exerciseEntries[ex.id].rpe || null
          }));

        if (exerciseInserts.length > 0) {
          const { error: exercisesError } = await supabase
            .from("workout_exercises")
            .insert(exerciseInserts);

          if (exercisesError) {
            for (const ex of exerciseInserts) {
              await queueWrite("workout_exercises", "insert", ex);
            }
          }
        }
      }

      // Reset form and refetch
      handleBackToPicker();
      onRefetch();
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Session type picker state
  if (!selectedSession) {
    return (
      <div className="space-y-4">
        <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">Select Session Type</h2>
        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(SESSIONS) as [SessionTypeKey, SessionType][]).map(([key, session]) => (
            <button
              key={key}
              onClick={() => handleSessionSelect(key)}
              className="bg-desert-surface border border-desert-border rounded-sm p-4 text-left hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150 cursor-pointer"
            >
              <div className="font-mono font-bold text-sm text-desert-text">{session.label}</div>
              <div className="text-sm text-desert-text-3 mt-1">{session.hint}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Exercise table state
  const session = SESSIONS[selectedSession];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={handleBackToPicker}
        className="text-desert-text-3 hover:text-desert-text text-sm font-mono transition-colors duration-150 flex items-center gap-2"
      >
        ← Back
      </button>

      {/* Session label */}
      <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">{session.label}</h2>

      {/* Warmup banner */}
      <div className={`p-4 rounded-sm border ${
        session.warmupType === 'shoulder'
          ? 'bg-desert-danger-dim border-desert-danger text-desert-danger'
          : 'bg-desert-celestial-dim border-desert-celestial text-desert-celestial'
      }`}>
        <div className="font-mono font-semibold mb-1">Warm-up</div>
        <div className="text-sm font-sans">{session.warmup}</div>
      </div>

      {/* RIR Legend */}
      <div className="flex gap-3 text-xs">
        <span className="bg-desert-celestial-dim border border-desert-celestial px-2 py-1 rounded-sm font-mono">
          Compound → RIR 2
        </span>
        <span className="bg-desert-success-dim border border-desert-success px-2 py-1 rounded-sm font-mono">
          Isolation → RIR 0-1
        </span>
      </div>

      {/* Exercise table */}
      <div className="space-y-4">
        {session.exercises.map(exercise => {
          const entry = exerciseEntries[exercise.id] || { weight: "", sets: exercise.sets, reps: exercise.reps, rpe: "" };
          const showFailureWarning = exercise.type === 'compound' && entry.rpe === 'fail';
          const showIsoFeedback = exercise.type === 'iso' && (entry.rpe === 'hard' || entry.rpe === 'fail');

          return (
            <div key={exercise.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 space-y-3">
              {/* Exercise header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono font-bold text-sm text-desert-text">{exercise.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs rounded px-1 font-mono ${
                      exercise.type === 'compound'
                        ? 'bg-desert-celestial-dim border border-desert-celestial text-desert-celestial'
                        : 'bg-desert-success-dim border border-desert-success text-desert-success'
                    }`}>
                      {exercise.type === 'compound' ? 'Compound' : 'Isolation'}
                    </span>
                    <span className="text-xs text-desert-text-3">
                      Target: {exercise.sets}×{exercise.reps}
                    </span>
                    <span className="text-xs text-desert-text-3">
                      {exercise.type === 'compound' 
                        ? <span className="text-desert-celestial">2-3 min rest</span>
                        : <span className="text-desert-success">1-2 min rest</span>
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Input row */}
              <div className="flex items-end gap-4">
                {/* Weight */}
                <div className="flex-1">
                  <label className="block text-xs text-desert-text-3 mb-1 font-mono">Weight ({exercise.unit})</label>
                  <input
                    type="number"
                    step="any"
                    value={entry.weight}
                    onChange={(e) => handleEntryChange(exercise.id, 'weight', e.target.value)}
                    className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-center font-mono text-desert-text focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                    placeholder="0"
                  />
                </div>

                {/* Sets */}
                <div className="w-20">
                  <label className="block text-xs text-desert-text-3 mb-1 font-mono">Sets</label>
                  <input
                    type="number"
                    value={entry.sets}
                    onChange={(e) => handleEntryChange(exercise.id, 'sets', e.target.value)}
                    className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-center font-mono text-desert-text focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                  />
                </div>

                {/* Reps */}
                <div className="w-20">
                  <label className="block text-xs text-desert-text-3 mb-1 font-mono">Reps</label>
                  <input
                    type="number"
                    value={entry.reps}
                    onChange={(e) => handleEntryChange(exercise.id, 'reps', e.target.value)}
                    className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-center font-mono text-desert-text focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                  />
                </div>
              </div>

               {/* RPE buttons */}
              <div>
                <label className="block text-xs text-desert-text-3 mb-2 font-mono">Effort (RPE)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'easy', label: 'Easy' },
                    { key: 'med', label: 'Med' },
                    { key: 'hard', label: 'Hard' },
                    { key: 'fail', label: 'Fail' },
                  ].map(rpe => (
                    <button
                      key={rpe.key}
                      onClick={() => handleRpeSelect(exercise.id, rpe.key)}
                      className={getRpeButtonClass(exercise.id, rpe.key)}
                    >
                      {rpe.label}
                    </button>
                  ))}
                </div>

                {/* Inline feedback */}
                {showFailureWarning && (
                  <div className="text-desert-danger text-sm mt-2 font-mono">
                    Compound failure — reduce weight next session
                  </div>
                )}
                {showIsoFeedback && (
                  <div className="text-desert-success text-sm mt-2 font-mono">
                    Good — target zone for isolation work
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Session notes */}
      <div>
        <label className="block text-sm font-mono text-desert-text-2 mb-2">Session Notes</label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-3 text-desert-text font-sans focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent resize-none"
          rows={3}
          placeholder="Optional notes about this session..."
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSaveSession}
        disabled={saving}
        className="w-full bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm py-2 px-4 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save session"}
      </button>
    </div>
  );
}
