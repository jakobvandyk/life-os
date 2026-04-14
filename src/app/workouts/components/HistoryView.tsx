"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import { WorkoutSession, WorkoutExercise } from "../page";
import { Checkin } from "./DailyCheckin";

interface HistoryViewProps {
  sessions: WorkoutSession[];
  exercises: WorkoutExercise[];
  checkins: Checkin[];
  userId: string | null;
  onRefetch: () => void;
}

const RPE_OPTIONS = ["easy", "med", "hard", "fail"] as const;

function getRPEColor(rpe: string | null): string {
  switch (rpe) {
    case "easy":
      return "bg-desert-success-dim border-desert-success text-desert-success";
    case "med":
      return "bg-desert-accent-glow border-desert-accent text-desert-accent";
    case "hard":
      return "bg-desert-danger-dim border-desert-danger text-desert-danger";
    case "fail":
      return "bg-desert-mystic-dim border-desert-mystic text-desert-mystic";
    default:
      return "";
  }
}

interface ExerciseEdit {
  id: string;
  weight: number | null;
  sets: number | null;
  reps: number | null;
  rpe: string | null;
}

export default function HistoryView(props: HistoryViewProps) {
  const { sessions, exercises, userId, onRefetch } = props;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editExercises, setEditExercises] = useState<ExerciseEdit[]>([]);
  const [saving, setSaving] = useState(false);

  // Group exercises by session_id
  const exercisesBySession = exercises.reduce((acc, exercise) => {
    if (!acc[exercise.session_id]) {
      acc[exercise.session_id] = [];
    }
    acc[exercise.session_id].push(exercise);
    return acc;
  }, {} as Record<string, WorkoutExercise[]>);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-NZ', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!userId) return;

    // Delete exercises first, then session
    const { error: exError } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", userId);

    if (exError) {
      await queueWrite("workout_exercises", "delete", { session_id: sessionId, user_id: userId });
    }

    const { error: sessError } = await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (sessError) {
      await queueWrite("workout_sessions", "delete", { id: sessionId, user_id: userId });
    }

    setDeletingId(null);
    onRefetch();
  };

  const startEditing = (session: WorkoutSession) => {
    const sessionExercises = exercisesBySession[session.id] || [];
    setEditingId(session.id);
    setEditNotes(session.notes || "");
    setEditExercises(
      sessionExercises.map((ex) => ({
        id: ex.id,
        weight: ex.weight,
        sets: ex.sets,
        reps: ex.reps,
        rpe: ex.rpe,
      }))
    );
  };

  const handleSave = async () => {
    if (!userId || !editingId) return;
    setSaving(true);

    // Update session notes
    const { error: sessError } = await supabase
      .from("workout_sessions")
      .update({ notes: editNotes || null })
      .eq("id", editingId)
      .eq("user_id", userId);

    if (sessError) {
      await queueWrite("workout_sessions", "update", { id: editingId, notes: editNotes || null });
    }

    // Update each exercise
    for (const ex of editExercises) {
      const { error: exError } = await supabase
        .from("workout_exercises")
        .update({ weight: ex.weight, sets: ex.sets, reps: ex.reps, rpe: ex.rpe })
        .eq("id", ex.id)
        .eq("user_id", userId);

      if (exError) {
        await queueWrite("workout_exercises", "update", {
          id: ex.id,
          weight: ex.weight,
          sets: ex.sets,
          reps: ex.reps,
          rpe: ex.rpe,
        });
      }
    }

    setSaving(false);
    setEditingId(null);
    onRefetch();
  };

  const updateExercise = (id: string, field: keyof ExerciseEdit, value: number | string | null) => {
    setEditExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  // Render empty state if no sessions
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="font-sans text-sm text-desert-text-3">No sessions yet</p>
        <p className="font-sans text-xs text-desert-text-3 mt-1">
          Log your first workout from the Log tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">History</h2>

      {sessions.map((session) => {
        const sessionExercises = exercisesBySession[session.id] || [];
        const exercisesWithWeight = sessionExercises.filter(
          (ex) => ex.weight !== null && ex.weight !== undefined
        );
        const isEditing = editingId === session.id;
        const isDeleting = deletingId === session.id;

        // Edit mode
        if (isEditing) {
          return (
            <div key={session.id} className="bg-desert-surface border border-desert-accent rounded-sm p-4">
              <div className="flex justify-between items-baseline mb-3">
                <span className="font-mono font-medium text-sm tracking-[0.04em] uppercase text-desert-accent">
                  Editing: {session.label}
                </span>
                <span className="font-mono text-xs text-desert-text-3">
                  {formatDate(session.date)}
                </span>
              </div>

              <div className="space-y-2">
                {editExercises.map((ex) => {
                  const original = sessionExercises.find((e) => e.id === ex.id);
                  return (
                    <div key={ex.id} className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans text-sm text-desert-text-2 w-24 shrink-0">
                        {original?.name || "Exercise"}
                      </span>
                      <input
                        type="number"
                        value={ex.weight ?? ""}
                        onChange={(e) => updateExercise(ex.id, "weight", e.target.value ? Number(e.target.value) : null)}
                        placeholder="kg"
                        className="w-16 bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1 font-mono text-sm text-desert-text"
                      />
                      <input
                        type="number"
                        value={ex.sets ?? ""}
                        onChange={(e) => updateExercise(ex.id, "sets", e.target.value ? Number(e.target.value) : null)}
                        placeholder="sets"
                        className="w-14 bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1 font-mono text-sm text-desert-text"
                      />
                      <span className="text-desert-text-3">×</span>
                      <input
                        type="number"
                        value={ex.reps ?? ""}
                        onChange={(e) => updateExercise(ex.id, "reps", e.target.value ? Number(e.target.value) : null)}
                        placeholder="reps"
                        className="w-14 bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1 font-mono text-sm text-desert-text"
                      />
                      <div className="flex gap-1">
                        {RPE_OPTIONS.map((rpe) => (
                          <button
                            key={rpe}
                            onClick={() => updateExercise(ex.id, "rpe", ex.rpe === rpe ? null : rpe)}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              ex.rpe === rpe ? getRPEColor(rpe) : "border-desert-border text-desert-text-3"
                            }`}
                          >
                            {rpe}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-1.5 font-sans text-sm text-desert-text"
                />
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-desert-accent text-desert-bg font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-desert-accent-glow disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="border border-desert-border text-desert-text-2 font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg hover:border-desert-border-strong"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        // Build exercise summary line
        const exerciseParts = exercisesWithWeight.map((ex) => {
          const weightStr = `${ex.weight}kg`;
          const setsReps = `${ex.sets || 0}×${ex.reps || 0}`;
          const rpeBadge = ex.rpe ? (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${getRPEColor(
                ex.rpe
              )}`}
            >
              [{ex.rpe}]
            </span>
          ) : null;

          return (
            <span key={ex.id}>
              {ex.name}{" "}
              <span className="font-mono text-desert-text">{weightStr}</span>{" "}
              <span className="font-mono text-desert-text-2">{setsReps}</span>{" "}
              {rpeBadge}
            </span>
          );
        });

        return (
          <div key={session.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150 group">
            {/* Card header */}
            <div className="flex justify-between items-baseline mb-3">
              <span className="font-mono font-medium text-sm tracking-[0.04em] uppercase text-desert-text-2">
                {session.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-desert-text-3">
                  {formatDate(session.date)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditing(session)}
                    className="font-mono text-xs text-desert-text-3 hover:text-desert-accent px-1"
                    title="Edit session"
                  >
                    edit
                  </button>
                  <button
                    onClick={() => setDeletingId(session.id)}
                    className="font-mono text-xs text-desert-text-3 hover:text-desert-danger px-1"
                    title="Delete session"
                  >
                    del
                  </button>
                </div>
              </div>
            </div>

            {/* Delete confirmation */}
            {isDeleting && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-desert-bg border border-desert-danger rounded-sm">
                <span className="font-sans text-sm text-desert-danger">Delete this session?</span>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="font-mono text-xs text-desert-bg bg-desert-danger px-2 py-1 rounded-lg hover:opacity-80"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  className="font-mono text-xs text-desert-text-2 border border-desert-border px-2 py-1 rounded-lg hover:border-desert-border-strong"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Card body - exercise summary */}
            {exercisesWithWeight.length > 0 && (
              <p className="font-sans text-sm text-desert-text-2 leading-relaxed">
                {exerciseParts.reduce((acc, part, index) => {
                  if (index === 0) return [part];
                  return [...acc, " · ", part];
                }, [] as React.ReactNode[])}
              </p>
            )}

            {/* Card footer - notes */}
            {session.notes && session.notes.trim() !== "" && (
              <>
                <div className="border-t border-desert-border mt-3 pt-3" />
                <p className="font-sans text-sm text-desert-text-3 italic">{session.notes}</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
