"use client";

import { WorkoutSession, WorkoutExercise } from "../page";
import { Checkin } from "./DailyCheckin";

interface HistoryViewProps {
  sessions: WorkoutSession[];
  exercises: WorkoutExercise[];
  checkins: Checkin[];
  userId: string | null;
  onRefetch: () => void;
}

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

export default function HistoryView(props: HistoryViewProps) {
  const { sessions, exercises } = props;

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
        // Filter exercises that have a weight value
        const exercisesWithWeight = sessionExercises.filter(
          (ex) => ex.weight !== null && ex.weight !== undefined
        );

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
          <div key={session.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150">
            {/* Card header */}
            <div className="flex justify-between items-baseline mb-3">
              <span className="font-mono font-medium text-sm tracking-[0.04em] uppercase text-desert-text-2">
                {session.label}
              </span>
              <span className="font-mono text-xs text-desert-text-3">
                {formatDate(session.date)}
              </span>
            </div>

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
