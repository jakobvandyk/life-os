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
      return "bg-green-900/50 text-green-400 border border-green-800";
    case "med":
      return "bg-amber-900/50 text-amber-400 border border-amber-800";
    case "hard":
      return "bg-red-900/50 text-red-400 border border-red-800";
    case "fail":
      return "bg-purple-900/50 text-purple-400 border border-purple-800";
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
        <p className="text-gray-500 font-mono text-sm">No sessions yet</p>
        <p className="text-gray-600 text-xs mt-1">
          Log your first workout from the Log tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-white">History</h2>

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
              <span className="font-mono text-white">{weightStr}</span>{" "}
              <span className="font-mono text-gray-400">{setsReps}</span>{" "}
              {rpeBadge}
            </span>
          );
        });

        return (
          <div key={session.id} className="bg-gray-900 rounded-lg p-5">
            {/* Card header */}
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-base font-semibold text-white">
                {session.label}
              </span>
              <span className="text-xs font-mono text-gray-500">
                {formatDate(session.date)}
              </span>
            </div>

            {/* Card body - exercise summary */}
            {exercisesWithWeight.length > 0 && (
              <p className="text-sm text-gray-400 leading-relaxed">
                {exerciseParts.reduce((acc, part, index) => {
                  if (index === 0) return [part];
                  return [...acc, " · ", part];
                }, [] as React.ReactNode[])}
              </p>
            )}

            {/* Card footer - notes */}
            {session.notes && session.notes.trim() !== "" && (
              <>
                <div className="border-t border-gray-800 mt-3 pt-3" />
                <p className="text-sm text-gray-500 italic">{session.notes}</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
