"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  taskStats: { active: number; completed_this_week: number; overdue: number };
  todayTasks: { id: number; title: string; priority: string; due_date: string }[];
  habits: { name: string; icon: string; done_today: number }[];
  spending: { month_expenses: number; month_income: number };
  goals: { title: string; progress: number }[];
  recentJournal: { date: string; mood: number; energy: number }[];
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-blue-400",
  low: "text-gray-400",
};

const moodEmoji = ["", "😞", "😐", "🙂", "😊", "🤩"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Good evening 👋</h1>
        <p className="text-gray-500 mt-1">{today}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-2xl font-bold text-white">
            {data.taskStats.active}
          </p>
          <p className="text-sm text-gray-500">Active Tasks</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-2xl font-bold text-green-400">
            {data.taskStats.completed_this_week}
          </p>
          <p className="text-sm text-gray-500">Done This Week</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-2xl font-bold text-red-400">
            {data.taskStats.overdue}
          </p>
          <p className="text-sm text-gray-500">Overdue</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-2xl font-bold text-amber-400">
            ${data.spending.month_expenses.toFixed(0)}
          </p>
          <p className="text-sm text-gray-500">Spent This Month</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            📋 Today&apos;s Focus
          </h2>
          {data.todayTasks.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No tasks due. Add some in Tasks →
            </p>
          ) : (
            <ul className="space-y-2">
              {data.todayTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`text-xs font-medium ${priorityColors[task.priority]}`}
                  >
                    ●
                  </span>
                  <span className="text-gray-300">{task.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Habits */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            🔁 Today&apos;s Habits
          </h2>
          {data.habits.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No habits yet. Add some in Habits →
            </p>
          ) : (
            <ul className="space-y-2">
              {data.habits.map((habit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span>{habit.done_today ? "✅" : "⬜"}</span>
                  <span
                    className={
                      habit.done_today ? "text-gray-400 line-through" : "text-gray-300"
                    }
                  >
                    {habit.icon} {habit.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Goals */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            🎯 Active Goals
          </h2>
          {data.goals.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No goals yet. Add some in Goals →
            </p>
          ) : (
            <ul className="space-y-3">
              {data.goals.map((goal, i) => (
                <li key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{goal.title}</span>
                    <span className="text-gray-500">
                      {Math.round(goal.progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Mood */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            📔 Recent Mood
          </h2>
          {data.recentJournal.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No journal entries yet. Start in Journal →
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recentJournal.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-500">{entry.date}</span>
                  <div className="flex gap-2">
                    <span>{moodEmoji[entry.mood] || "—"}</span>
                    <span className="text-gray-600">
                      ⚡{entry.energy || "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}