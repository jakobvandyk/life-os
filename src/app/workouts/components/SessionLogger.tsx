"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
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
    
    const baseClass = "px-3 py-2 rounded text-xs font-medium border transition-colors ";
    const unselectedClass = "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400";
    
    if (isSelected) {
      switch (rpeValue) {
        case 'easy':
          return baseClass + "bg-green-900/50 border-green-500 text-green-400";
        case 'med':
          return baseClass + "bg-amber-900/50 border-amber-500 text-amber-400";
        case 'hard':
          return baseClass + "bg-red-900/50 border-red-500 text-red-400";
        case 'fail':
          return baseClass + "bg-purple-900/50 border-purple-500 text-purple-400";
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
      const { data: sessionResult, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: userId,
          type: selectedSession,
          label: session.label,
          date: today,
          notes: sessionNotes || null
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

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

        if (exercisesError) throw exercisesError;
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
        <h2 className="text-xl font-bold text-white">Select Session Type</h2>
        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(SESSIONS) as [SessionTypeKey, SessionType][]).map(([key, session]) => (
            <button
              key={key}
              onClick={() => handleSessionSelect(key)}
              className="bg-gray-900 rounded-lg p-4 text-left hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <div className="font-bold text-white">{session.label}</div>
              <div className="text-sm text-gray-400 mt-1">{session.hint}</div>
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
        className="text-gray-400 hover:text-white text-sm font-medium flex items-center gap-2"
      >
        ← Back
      </button>

      {/* Session label */}
      <h2 className="text-xl font-bold text-white">{session.label}</h2>

      {/* Warmup banner */}
      <div className={`p-4 rounded-lg border ${
        session.warmupType === 'shoulder'
          ? 'bg-red-900/30 border-red-800 text-red-300'
          : 'bg-blue-900/30 border-blue-800 text-blue-300'
      }`}>
        <div className="font-semibold mb-1">Warm-up</div>
        <div className="text-sm">{session.warmup}</div>
      </div>

      {/* RIR Legend */}
      <div className="flex gap-3 text-xs">
        <span className="bg-blue-900/50 text-blue-400 border border-blue-800 px-2 py-1 rounded">
          Compound → RIR 2
        </span>
        <span className="bg-green-900/50 text-green-400 border border-green-800 px-2 py-1 rounded">
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
            <div key={exercise.id} className="bg-gray-900 rounded-lg p-4 space-y-3">
              {/* Exercise header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-white">{exercise.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs rounded px-1 ${
                      exercise.type === 'compound'
                        ? 'bg-blue-900/50 text-blue-400 border border-blue-800'
                        : 'bg-green-900/50 text-green-400 border border-green-800'
                    }`}>
                      {exercise.type === 'compound' ? 'Compound' : 'Isolation'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Target: {exercise.sets}×{exercise.reps}
                    </span>
                    <span className="text-xs text-gray-500">
                      {exercise.type === 'compound' 
                        ? <span className="text-blue-400">2-3 min rest</span>
                        : <span className="text-green-400">1-2 min rest</span>
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Input row */}
              <div className="flex items-end gap-4">
                {/* Weight */}
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Weight ({exercise.unit})</label>
                  <input
                    type="number"
                    step="any"
                    value={entry.weight}
                    onChange={(e) => handleEntryChange(exercise.id, 'weight', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center font-mono text-white focus:outline-none focus:border-amber-500"
                    placeholder="0"
                  />
                </div>

                {/* Sets */}
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Sets</label>
                  <input
                    type="number"
                    value={entry.sets}
                    onChange={(e) => handleEntryChange(exercise.id, 'sets', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Reps */}
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Reps</label>
                  <input
                    type="number"
                    value={entry.reps}
                    onChange={(e) => handleEntryChange(exercise.id, 'reps', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* RPE buttons */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Effort (RPE)</label>
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
                  <div className="text-red-400 text-sm mt-2">
                    Compound failure — reduce weight next session
                  </div>
                )}
                {showIsoFeedback && (
                  <div className="text-green-400 text-sm mt-2">
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
        <label className="block text-sm font-medium text-gray-300 mb-2">Session Notes</label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
          rows={3}
          placeholder="Optional notes about this session..."
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSaveSession}
        disabled={saving}
        className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-mono py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save session"}
      </button>
    </div>
  );
}
