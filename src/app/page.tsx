"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DashboardData {
  taskStats: { active: number; completed_this_week: number; overdue: number };
  todayTasks: { id: number; title: string; priority: string; due_date: string }[];
  habits: { name: string; icon: string; done_today: boolean }[];
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState<string>("there");

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get name from user metadata or use email prefix
        const name = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     user.email?.split('@')[0] ||
                     'there';
        setUserName(name);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      const todayISO = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      // Task Stats
      const { count: activeCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'done');

      const { count: completedThisWeekCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'done')
        .gte('completed_at', sevenDaysAgoISO);

      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', todayISO)
        .neq('status', 'done');

      const taskStats = {
        active: activeCount || 0,
        completed_this_week: completedThisWeekCount || 0,
        overdue: overdueCount || 0,
      };

      // Today Tasks
      const priorityOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };

      const { data: todayTasksRawData } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .or(`due_date.lte.${todayISO},due_date.is.null`)
        .neq('status', 'done');

      const todayTasks = todayTasksRawData
        ?.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        .slice(0, 10) || [];

      // Habits
      const { data: habitsRawData } = await supabase
        .from('habits')
        .select('id, name, icon')
        .eq('active', true);

      const { data: habitLogsRawData } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('date', todayISO);

      const todayDoneHabitIds = new Set(
        habitLogsRawData?.map(log => log.habit_id)
      );

      const habits = habitsRawData?.map(habit => ({
        name: habit.name,
        icon: habit.icon,
        done_today: todayDoneHabitIds.has(habit.id),
      })) || [];

      // Spending
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const { data: expensesData } = await supabase
        .from('finance_expenses')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      const { data: incomeData } = await supabase
        .from('finance_income')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      const month_expenses = expensesData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const month_income = incomeData?.reduce((sum, item) => sum + item.amount, 0) || 0;

      const spending = { month_expenses, month_income };

      // Goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('title, percent_complete')
        .eq('status', 'active');

      const goals = goalsData?.map(goal => ({
        title: goal.title,
        progress: goal.percent_complete
      })) || [];

      // Recent Journal
      const { data: recentJournalData } = await supabase
        .from('journal_entries')
        .select('date, mood, energy')
        .order('date', { ascending: false })
        .limit(7);
      
      const recentJournal = recentJournalData || [];

      setData({
        taskStats,
        todayTasks,
        habits,
        spending,
        goals,
        recentJournal,
      });
    }

    fetchDashboardData();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const today = new Date();
  const weekNumber = getISOWeek(today);
  const todayFormatted = today.toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 space-y-6">
      <div className="mt-6">
        <h1 className="text-3xl font-bold text-white">{getGreeting()}, {userName} 👋</h1>
        <p className="text-gray-500 mt-1">{todayFormatted} · Week {weekNumber}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-5">
          <p className="text-2xl font-bold text-white font-mono">
            {data.taskStats.active}
          </p>
          <p className="text-sm text-gray-500">Active Tasks</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-5">
          <p className="text-2xl font-bold text-green-400 font-mono">
            {data.taskStats.completed_this_week}
          </p>
          <p className="text-sm text-gray-500">Done This Week</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-5">
          <p className="text-2xl font-bold text-red-400 font-mono">
            {data.taskStats.overdue}
          </p>
          <p className="text-sm text-gray-500">Overdue</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-5">
          <p className="text-2xl font-bold text-amber-400 font-mono">
            ${data.spending.month_expenses.toFixed(0)}
          </p>
          <p className="text-sm text-gray-500">Spent This Month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Tasks */}
        <div className="bg-gray-900 rounded-lg p-5">
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
        <div className="bg-gray-900 rounded-lg p-5">
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
        <div className="bg-gray-900 rounded-lg p-5">
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
                    <span className="text-gray-500 font-mono">
                      {Math.round(goal.progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Mood */}
        <div className="bg-gray-900 rounded-lg p-5">
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
                  <span className="text-gray-500 text-xs font-mono">{entry.date}</span>
                  <div className="flex gap-2">
                    <span>{moodEmoji[entry.mood] || "—"}</span>
                    <span className="text-gray-600 font-mono">
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