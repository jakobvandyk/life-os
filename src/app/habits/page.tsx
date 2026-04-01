"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Habit {
  id: number;
  name: string;
  icon: string;
  target_frequency: string;
  completed_today: boolean;
  streak: number;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: "",
    icon: "✅",
    target_frequency: "daily",
  });

  const fetchHabits = async () => {
    if (!userId) return; // Guard against null userId

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: habitsData, error: habitsError } = await supabase
      .from("habits")
      .select("*", { count: 'exact' })
      .eq("active", true)
      .eq("user_id", userId);

    if (habitsError) {
      console.error("Error fetching habits:", habitsError);
      return;
    }

    const { data: habitLogsData, error: habitLogsError } = await supabase
      .from("habit_logs")
      .select("habit_id, date")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo); // Fetch logs for the last 30 days for streak calculation

    if (habitLogsError) {
      console.error("Error fetching habit logs:", habitLogsError);
      return;
    }

    const habitsWithStatusAndStreak = habitsData.map((habit) => {
      const logsForHabit = habitLogsData.filter((log) => log.habit_id === habit.id);
      const completedToday = logsForHabit.some((log) => log.date === today);

      // Calculate streak
      let streak = 0;
      let currentDate = new Date();
      for (let i = 0; i < 365; i++) { // Check last 365 days
        const dateToCheck = currentDate.toISOString().split('T')[0];
        const hasLog = logsForHabit.some(log => log.date === dateToCheck);
        if (hasLog) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      return { ...habit, completed_today: completedToday, streak };
    });

    setHabits(habitsWithStatusAndStreak);
  };

  useEffect(() => {
    if (userId) {
      fetchHabits();
    }
  }, [userId]);

  const addHabit = async () => {
    if (!newHabit.name.trim() || !userId) return; // Guard against null userId

    const { error } = await supabase.from("habits").insert({
      name: newHabit.name,
      icon: newHabit.icon,
      target_frequency: newHabit.target_frequency,
      user_id: userId, // Include user_id
    });

    if (error) {
      console.error("Error adding habit:", error);
      return;
    }

    setNewHabit({ name: "", icon: "✅", target_frequency: "daily" });
    setShowForm(false);
    fetchHabits();
  };

  const toggleHabit = async (id: number) => {
    if (!userId) return; // Guard against null userId

    const today = new Date().toISOString().split('T')[0];

    const { data: existingLog, error: checkError } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("habit_id", id)
      .eq("date", today)
      .eq("user_id", userId);

    if (checkError) {
      console.error("Error checking habit log:", checkError);
      return;
    }

    if (existingLog && existingLog.length > 0) {
      // If exists, delete it
      const { error: deleteError } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", id)
        .eq("date", today)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Error deleting habit log:", deleteError);
        return;
      }
    } else {
      // If not, insert
      const { error: insertError } = await supabase.from("habit_logs").insert({
        habit_id: id,
        user_id: userId, // Include user_id
        date: today,
        value: 1,
      });

      if (insertError) {
        console.error("Error inserting habit log:", insertError);
        return;
      }
    }

    fetchHabits();
  };

  const completedToday = habits.filter((h) => h.completed_today).length;
  const totalHabits = habits.length;
  const completionRate =
    totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  const iconOptions = [
    "✅", "🧘", "📚", "🏃", "💧", "🍎", "💊", "🛌",
    "✍️", "🎵", "🧹", "📵", "🌅", "🧠", "💪", "🙏",
  ];

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-desert-border">
        <div>
          <h1 className="font-pixel text-lg text-desert-text">↻ Habits</h1>
          <p className="text-desert-text-3 mt-1">
            {completedToday}/{totalHabits} completed today ·{" "}
            {completionRate}%
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
        >
          + New Habit
        </button>
      </div>

      {/* Progress Bar */}
      {totalHabits > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
             <span className="text-desert-text-2">Today&apos;s Progress</span>
             <span className="font-mono text-desert-text">{completionRate}%</span>
          </div>
          <div className="w-full bg-desert-border rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                completionRate === 100
                  ? "bg-desert-success"
                  : "bg-desert-accent"
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Add Habit Form */}
      {showForm && (
        <div className="bg-desert-surface rounded-sm p-5 mb-6">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Habit name... (e.g. Meditate 10 minutes)"
              value={newHabit.name}
              onChange={(e) =>
                setNewHabit({...newHabit, name: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              autoFocus
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
            />
            <div className="flex gap-3 items-center">
              <div>
                <p className="text-xs text-desert-text-3 mb-1">Icon</p>
                <div className="flex gap-1 flex-wrap max-w-xs">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewHabit({...newHabit, icon })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-sm transition-colors ${
                        newHabit.icon === icon
                          ? "bg-desert-accent"
                          : "bg-desert-surface-hover hover:bg-desert-surface-hover"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <select
                  value={newHabit.target_frequency}
                  onChange={(e) =>
                    setNewHabit({...newHabit,
                      target_frequency: e.target.value,
                    })
                  }
                  className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  onClick={addHabit}
                  className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Habit List */}
      {habits.length === 0 ? (
        <div className="bg-desert-surface rounded-sm p-12 text-center">
          <p className="text-desert-text-3">
            No habits yet. Start building your routine!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="bg-desert-surface rounded-sm p-4 flex items-center gap-4 hover:border-desert-border-strong transition-colors"
            >
              {/* Toggle Button */}
              <button
                onClick={() => toggleHabit(habit.id)}
                className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl shrink-0 transition-all ${
                  habit.completed_today
                    ? "bg-desert-success-dim border-2 border-desert-success/50 scale-105"
                    : "bg-desert-surface-hover border-2 border-desert-border-strong hover:border-desert-accent"
                }`}
              >
                {habit.icon}
              </button>

              {/* Info */}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    habit.completed_today
                      ? "text-desert-success"
                      : "text-desert-text"
                  }`}
                >
                  {habit.name}
                </p>
                 <p className="text-xs text-desert-text-3">
                   {habit.target_frequency}
                 </p>
              </div>

              {/* Streak */}
              <div className="text-right">
                <p className="text-lg font-bold font-mono text-desert-text">
                  {habit.streak}
                </p>
                 <p className="text-xs text-desert-text-3">
                   day{habit.streak !== 1 ? "s" : ""} streak
                 </p>
              </div>

              {/* Status */}
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  habit.completed_today ? "bg-desert-success" : "bg-desert-surface-hover"
                }`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}