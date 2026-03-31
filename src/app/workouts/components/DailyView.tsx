"use client";

import DailyCheckin from "./DailyCheckin";
import { Checkin } from "./DailyCheckin";
import { WorkoutSession, WorkoutExercise } from "../page";

interface DailyViewProps {
  sessions: WorkoutSession[];
  exercises: WorkoutExercise[];
  userId: string | null;
  onRefetch: () => void;
  checkins: Checkin[];
}

export default function DailyView(props: DailyViewProps) {
  const { userId, onRefetch, checkins } = props;

  return (
    <div className="space-y-4">
      {userId ? (
        <DailyCheckin
          userId={userId}
          checkins={checkins}
          onRefetch={onRefetch}
        />
      ) : (
        <div className="bg-gray-900 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-2">Daily Check-in</h3>
          <p className="text-gray-400">
            Please log in to track your daily metrics.
          </p>
        </div>
      )}
    </div>
  );
}
