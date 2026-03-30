"use client";

import { useEffect, useState } from "react";

interface Habit {
  id: number;
  name: string;
  icon: string;
  target_frequency: string;
  completed_today: number;
  streak: number;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: "",
    icon: "✅",
    target_frequency: "daily",
  });

  const fetchHabits = () => {
    fetch("/api/habits").then((r) => r.json()).then(setHabits);
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newHabit),
    });
    setNewHabit({ name: "", icon: "✅", target_frequency: "daily" });
    setShowForm(false);
    fetchHabits();
  };

  const toggleHabit = async (id: number) => {
    await fetch(`/api/habits/${id}/toggle`, { method: "POST" });
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
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">🔁 Habits</h1>
          <p className="text-gray-500 mt-1">
            {completedToday}/{totalHabits} completed today ·{" "}
            {completionRate}%
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Habit
        </button>
      </div>

      {/* Progress Bar */}
      {totalHabits > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Today&apos;s Progress</span>
            <span className="text-white font-medium">{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                completionRate === 100
                  ? "bg-green-500"
                  : completionRate >= 50
                  ? "bg-indigo-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Add Habit Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-3 items-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">Icon</p>
                <div className="flex gap-1 flex-wrap max-w-xs">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewHabit({...newHabit, icon })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-sm transition-colors ${
                        newHabit.icon === icon
                          ? "bg-indigo-600"
                          : "bg-gray-800 hover:bg-gray-700"
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
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  onClick={addHabit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
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
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500">
            No habits yet. Start building your routine!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center gap-4 hover:border-gray-700 transition-colors"
            >
              {/* Toggle Button */}
              <button
                onClick={() => toggleHabit(habit.id)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                  habit.completed_today
                    ? "bg-green-500/20 border-2 border-green-500/50 scale-105"
                    : "bg-gray-800 border-2 border-gray-700 hover:border-indigo-500"
                }`}
              >
                {habit.icon}
              </button>

              {/* Info */}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    habit.completed_today
                      ? "text-green-400"
                      : "text-white"
                  }`}
                >
                  {habit.name}
                </p>
                <p className="text-xs text-gray-500">
                  {habit.target_frequency}
                </p>
              </div>

              {/* Streak */}
              <div className="text-right">
                <p className="text-lg font-bold text-white">
                  {habit.streak}
                </p>
                <p className="text-xs text-gray-500">
                  day{habit.streak !== 1 ? "s" : ""} streak
                </p>
              </div>

              {/* Status */}
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  habit.completed_today ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}