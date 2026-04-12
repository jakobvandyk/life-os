"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import SessionLogger from "./components/SessionLogger";
import DailyView from "./components/DailyView";
import ProgressView from "./components/ProgressView";
import HistoryView from "./components/HistoryView";
import { Checkin } from "./components/DailyCheckin";
import PixelIcon from "@/components/PixelIcon";

export interface WorkoutSession {
  id: string;
  user_id: string;
  type: string;
  label: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface WorkoutExercise {
  id: string;
  user_id: string;
  session_id: string;
  exercise_id: string;
  name: string;
  weight: number | null;
  sets: number | null;
  reps: number | null;
  rpe: string | null;
  created_at: string;
}

type Tab = "log" | "daily" | "progress" | "history";

export default function WorkoutsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("log");
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch workout sessions (last 100)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(100);

      if (sessionsError) throw sessionsError;

      const sessionsList = sessionsData || [];
      setSessions(sessionsList);

      // Fetch exercises for those sessions
      if (sessionsList.length > 0) {
        const sessionIds = sessionsList.map(s => s.id);
        const { data: exercisesData, error: exercisesError } = await supabase
          .from("workout_exercises")
          .select("*")
          .eq("user_id", userId)
          .in("session_id", sessionIds);

        if (exercisesError) throw exercisesError;
        setExercises(exercisesData || []);
      } else {
        setExercises([]);
      }

      // Fetch checkins (last 60)
      const { data: checkinsData, error: checkinsError } = await supabase
        .from("workout_checkins")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(60);

      if (checkinsError) throw checkinsError;
      setCheckins(checkinsData || []);
    } catch (error) {
      console.error("Error fetching workout data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, fetchData]);

  const handleRefetch = () => {
    fetchData();
  };

  const sessionsWithExercises = useMemo(() => {
    return sessions.map(session => ({
      ...session,
      exercises: exercises.filter(ex => ex.session_id === session.id)
    }));
  }, [sessions, exercises]);

  if (loading && !userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-desert-text-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6 relative z-10">
      {/* Header */}
      <div className="pb-6 border-b border-desert-border">
        <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="workouts" size={22} className="text-desert-accent" /> Workouts</h1>
        <p className="text-desert-text-3 mt-1">
          Strength training · Session tracking
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2">
        {([
          { key: "log", label: "Log" },
          { key: "daily", label: "Daily" },
          { key: "progress", label: "Progress" },
          { key: "history", label: "History" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-sm text-sm font-mono uppercase tracking-wider transition-colors duration-150 ${
              activeTab === t.key
                ? "bg-desert-surface border border-desert-border text-desert-text"
                : "text-desert-text-3 hover:text-desert-text-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "log" && (
        <SessionLogger
          userId={userId}
          onRefetch={handleRefetch}
        />
      )}

      {activeTab === "daily" && (
        <DailyView
          sessions={sessions}
          exercises={exercises}
          userId={userId}
          onRefetch={handleRefetch}
          checkins={checkins}
        />
      )}

      {activeTab === "progress" && (
        <ProgressView
          sessions={sessionsWithExercises}
          userId={userId}
          onRefetch={handleRefetch}
        />
      )}

      {activeTab === "history" && (
        <HistoryView
          sessions={sessions}
          exercises={exercises}
          checkins={checkins}
          userId={userId}
          onRefetch={handleRefetch}
        />
      )}
    </div>
  );
}
