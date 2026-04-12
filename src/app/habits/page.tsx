"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import PixelIcon from "@/components/PixelIcon";

interface Habit {
  id: number;
  name: string;
  icon: string;
  target_frequency: string;
  completed_today: boolean;
  streak: number;
}

const iconOptions = [
  // Wellness & mindfulness
  "habit_check", "habit_meditate", "habit_pray", "habit_brain", "habit_sleep",
  // Fitness & activity
  "habit_run", "habit_strength", "habit_water",
  // Nutrition
  "habit_nutrition", "habit_medicine",
  // Learning & creativity
  "habit_read", "habit_write", "habit_music",
  // Lifestyle & productivity
  "habit_clean", "habit_phonefree", "habit_sunrise",
];

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function getExpectedDates(frequency: string, days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const day = d.getDay(); // 0=Sun, 6=Sat
    const dateStr = d.toISOString().split("T")[0];

    if (frequency === "daily") {
      dates.push(dateStr);
    } else if (frequency === "weekdays") {
      if (day >= 1 && day <= 5) dates.push(dateStr);
    } else if (frequency === "weekends") {
      if (day === 0 || day === 6) dates.push(dateStr);
    } else if (frequency === "weekly") {
      // Every Monday counts
      if (day === 1) dates.push(dateStr);
    } else if (frequency === "monthly") {
      // First day of each month
      if (d.getDate() === 1) dates.push(dateStr);
    }
  }
  return dates;
}

function calculateStreak(logs: { date: string }[], frequency: string): number {
  const logDates = new Set(logs.map((l) => l.date));
  const expected = getExpectedDates(frequency, 365);

  // For weekly/monthly, we check if the current period is done yet
  // If the current period hasn't passed its expected date, start checking from the next expected
  const today = new Date().toISOString().split("T")[0];

  let streak = 0;
  for (const date of expected) {
    // Skip today if not yet completed (grace: don't break streak for today)
    if (date === today) {
      if (logDates.has(date)) streak++;
      continue;
    }
    if (logDates.has(date)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function isDueToday(frequency: string): boolean {
  const day = new Date().getDay();
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return day >= 1 && day <= 5;
  if (frequency === "weekends") return day === 0 || day === 6;
  if (frequency === "weekly") return day === 1;
  if (frequency === "monthly") return new Date().getDate() === 1;
  return true;
}

function streakUnit(frequency: string): string {
  if (frequency === "weekly") return "week";
  if (frequency === "monthly") return "month";
  return "day";
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newHabit, setNewHabit] = useState({
    name: "",
    icon: "habit_check",
    target_frequency: "daily",
  });
  const [editHabit, setEditHabit] = useState({
    name: "",
    icon: "habit_check",
    target_frequency: "daily",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchHabits = async () => {
    if (!userId) return;

    const today = new Date().toISOString().split("T")[0];
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: habitsData, error: habitsError } = await supabase
      .from("habits")
      .select("*", { count: "exact" })
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
      .gte("date", yearAgo);

    if (habitLogsError) {
      console.error("Error fetching habit logs:", habitLogsError);
      return;
    }

    const habitsWithStatusAndStreak = habitsData.map((habit) => {
      const logsForHabit = habitLogsData.filter(
        (log) => log.habit_id === habit.id
      );
      const completedToday = logsForHabit.some((log) => log.date === today);
      const streak = calculateStreak(logsForHabit, habit.target_frequency);

      return { ...habit, completed_today: completedToday, streak };
    });

    setHabits(habitsWithStatusAndStreak);
  };

  useEffect(() => {
    if (userId) fetchHabits();
  }, [userId]);

  const addHabit = async () => {
    if (!newHabit.name.trim() || !userId) return;
    const payload = {
      name: newHabit.name,
      icon: newHabit.icon,
      target_frequency: newHabit.target_frequency,
      user_id: userId,
    };
    const { error } = await supabase.from("habits").insert(payload);
    if (error) await queueWrite("habits", "insert", payload);

    setNewHabit({ name: "", icon: "habit_check", target_frequency: "daily" });
    setShowForm(false);
    fetchHabits();
  };

  const saveEdit = async (id: number) => {
    if (!editHabit.name.trim() || !userId) return;
    const payload = {
      name: editHabit.name,
      icon: editHabit.icon,
      target_frequency: editHabit.target_frequency,
    };
    const { error } = await supabase
      .from("habits")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) await queueWrite("habits", "update", { id, ...payload });

    setEditingId(null);
    fetchHabits();
  };

  const deleteHabit = async (id: number) => {
    if (!userId) return;
    const { error } = await supabase
      .from("habits")
      .update({ active: false })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) await queueWrite("habits", "update", { id, active: false });
    fetchHabits();
  };

  const toggleHabit = async (id: number) => {
    if (!userId) return;

    const today = new Date().toISOString().split("T")[0];

    const { data: existingLog, error: checkError } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("habit_id", id)
      .eq("date", today)
      .eq("user_id", userId);

    if (checkError) {
      await queueWrite("habit_logs", "insert", {
        habit_id: id,
        user_id: userId,
        date: today,
        value: 1,
      });
      fetchHabits();
      return;
    }

    if (existingLog && existingLog.length > 0) {
      const { error: deleteError } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", id)
        .eq("date", today)
        .eq("user_id", userId);

      if (deleteError)
        await queueWrite("habit_logs", "delete", { id: existingLog[0].id });
    } else {
      const payload = { habit_id: id, user_id: userId, date: today, value: 1 };
      const { error: insertError } = await supabase
        .from("habit_logs")
        .insert(payload);
      if (insertError) await queueWrite("habit_logs", "insert", payload);
    }

    fetchHabits();
  };

  const dueToday = habits.filter((h) => isDueToday(h.target_frequency));
  const completedToday = dueToday.filter((h) => h.completed_today).length;
  const totalDue = dueToday.length;
  const completionRate =
    totalDue > 0 ? Math.round((completedToday / totalDue) * 100) : 0;

  const HabitForm = ({
    values,
    onChange,
    onSave,
    onCancel,
    saveLabel,
  }: {
    values: { name: string; icon: string; target_frequency: string };
    onChange: (v: { name: string; icon: string; target_frequency: string }) => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel: string;
  }) => (
    <div className="bg-desert-surface rounded-sm p-5 mb-6">
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Habit name... (e.g. Meditate 10 minutes)"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          autoFocus
          className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <p className="text-xs text-desert-text-3 mb-1">Icon</p>
            <div className="flex gap-1 flex-wrap">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  onClick={() => onChange({ ...values, icon })}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    values.icon === icon
                      ? "bg-desert-accent text-desert-bg"
                      : "bg-desert-surface-hover hover:bg-desert-border text-desert-text"
                  }`}
                >
                  <PixelIcon name={icon} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-end sm:ml-auto">
            <select
              value={values.target_frequency}
              onChange={(e) =>
                onChange({ ...values, target_frequency: e.target.value })
              }
              className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
            >
              {frequencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
            >
              {saveLabel}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-desert-border">
        <div>
          <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3">
            <PixelIcon name="habits" size={22} className="text-desert-accent" />{" "}
            Habits
          </h1>
          <p className="text-desert-text-3 mt-1">
            {completedToday}/{totalDue} completed today · {completionRate}%
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
      {totalDue > 0 && (
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
        <HabitForm
          values={newHabit}
          onChange={setNewHabit}
          onSave={addHabit}
          onCancel={() => setShowForm(false)}
          saveLabel="Add"
        />
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
            <div key={habit.id}>
              {editingId === habit.id ? (
                <HabitForm
                  values={editHabit}
                  onChange={setEditHabit}
                  onSave={() => saveEdit(habit.id)}
                  onCancel={() => setEditingId(null)}
                  saveLabel="Save"
                />
              ) : (
                <div className="bg-desert-surface rounded-sm p-4 flex items-center gap-4 hover:border-desert-border-strong transition-colors group">
                  {/* Toggle Button */}
                  <button
                    onClick={() => toggleHabit(habit.id)}
                    className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl shrink-0 transition-all ${
                      habit.completed_today
                        ? "bg-desert-success-dim border-2 border-desert-success/50 scale-105"
                        : "bg-desert-surface-hover border-2 border-desert-border-strong hover:border-desert-accent"
                    }`}
                  >
                    {iconOptions.includes(habit.icon) ? (
                      <PixelIcon name={habit.icon} size={22} />
                    ) : (
                      <span className="text-xl">{habit.icon}</span>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
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
                      {frequencyOptions.find(
                        (f) => f.value === habit.target_frequency
                      )?.label || habit.target_frequency}
                      {!isDueToday(habit.target_frequency) && (
                        <span className="ml-2 text-desert-text-3/60">
                          · not due today
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Streak */}
                  <div className="text-right">
                    <p className="text-lg font-bold font-mono text-desert-text">
                      {habit.streak}
                    </p>
                    <p className="text-xs text-desert-text-3">
                      {streakUnit(habit.target_frequency)}
                      {habit.streak !== 1 ? "s" : ""} streak
                    </p>
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(habit.id);
                        setEditHabit({
                          name: habit.name,
                          icon: habit.icon,
                          target_frequency: habit.target_frequency,
                        });
                      }}
                      className="p-1.5 text-desert-text-3 hover:text-desert-accent transition-colors"
                      title="Edit habit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="p-1.5 text-desert-text-3 hover:text-desert-danger transition-colors"
                      title="Archive habit"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Status */}
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      habit.completed_today
                        ? "bg-desert-success"
                        : "bg-desert-surface-hover"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
