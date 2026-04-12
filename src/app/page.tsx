"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PixelIcon from "@/components/PixelIcon";
import Sparkline from "@/components/Sparkline";

interface BiometricPoint {
  date: string;
  weight: number | null;
  body_fat_pct: number | null;
  hrv: number | null;
  hrv_rmssd: number | null;
  sleep: number | null;
  readiness: number | null;
  kubios_readiness: number | null;
  steps: number | null;
  active_calories: number | null;
  resting_hr: number | null;
  vo2_max: number | null;
}

interface NutritionPoint {
  date: string;
  calories: number | null;
  protein_g: number | null;
  water_ml: number | null;
}

interface JournalPoint {
  date: string;
  mood: number | null;
  energy: number | null;
}

interface TrendsData {
  checkins: BiometricPoint[];
  nutrition: NutritionPoint[];
  journal: JournalPoint[];
}

interface NutritionData {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  water_ml: number | null;
  caffeine_mg: number | null;
}

interface DashboardData {
  taskStats: { active: number; completed_this_week: number; overdue: number };
  todayTasks: { id: number; title: string; priority: string; due_date: string }[];
  habits: { name: string; icon: string; done_today: boolean }[];
  spending: { month_expenses: number; month_income: number };
  goals: { title: string; progress: number }[];
  recentJournal: { date: string; mood: number; energy: number }[];
  streak: number;
  nutrition: NutritionData | null;
  trends: TrendsData;
}

const priorityColors: Record<string, string> = {
  urgent: "text-desert-danger",
  high: "text-desert-danger",
  medium: "text-desert-warning",
  low: "text-desert-success",
};

const moodEmoji = ["", "😞", "😐", "🙂", "😊", "🤩"];
const energyEmoji = ["", "🪫", "😴", "⚡", "🔥", "🚀"];

// D5: Contextual greeting messages
function getGreeting(data: DashboardData | null): { text: string; sub: string } {
  const hour = new Date().getHours();
  const base =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
      ? "Good afternoon"
      : "Good evening";

  if (!data) return { text: base, sub: "" };

  // Contextual sub-messages based on state
  if (data.taskStats.overdue > 0) {
    return {
      text: base,
      sub: `You have ${data.taskStats.overdue} overdue task${data.taskStats.overdue > 1 ? "s" : ""} — let's clear the deck.`,
    };
  }

  const habitsLeft = data.habits.filter((h) => !h.done_today).length;
  const habitsDone = data.habits.filter((h) => h.done_today).length;

  if (habitsDone === data.habits.length && data.habits.length > 0) {
    return { text: base, sub: "All habits done today. Solid work." };
  }

  if (data.taskStats.completed_this_week >= 10) {
    return { text: base, sub: `${data.taskStats.completed_this_week} tasks crushed this week.` };
  }

  if (habitsLeft > 0) {
    return {
      text: base,
      sub: `${habitsLeft} habit${habitsLeft > 1 ? "s" : ""} left today.`,
    };
  }

  if (data.todayTasks.length === 0) {
    return { text: base, sub: "Clear schedule today. Time for deep work?" };
  }

  return { text: base, sub: `${data.todayTasks.length} task${data.todayTasks.length > 1 ? "s" : ""} on deck.` };
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const EXPORT_DAYS = [7, 14, 30, 60, 90] as const;

function ExportCard() {
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/analysis?days=${days}`, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-os-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col-span-2 md:col-span-4 bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
      <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3">Export for Analysis</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {EXPORT_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 font-mono text-xs rounded-sm transition-colors duration-150 ${
                days === d
                  ? "bg-desert-accent text-desert-bg"
                  : "bg-desert-bg border border-desert-border-strong text-desert-text-2 hover:text-desert-text hover:border-desert-accent"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="px-4 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-xs rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? "Exporting..." : "Download JSON"}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState<string>("there");

  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there";
        setUserName(name);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      const todayISO = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split("T")[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { count: activeCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "done");

      const { count: completedThisWeekCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "done")
        .gte("completed_at", sevenDaysAgoISO);

      const { count: overdueCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .lt("due_date", todayISO)
        .neq("status", "done");

      const taskStats = {
        active: activeCount || 0,
        completed_this_week: completedThisWeekCount || 0,
        overdue: overdueCount || 0,
      };

      const priorityOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };

      const { data: todayTasksRawData } = await supabase
        .from("tasks")
        .select("id, title, priority, due_date")
        .or(`due_date.lte.${todayISO},due_date.is.null`)
        .neq("status", "done");

      const todayTasks =
        todayTasksRawData
          ?.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
          .slice(0, 8) || [];

      const { data: habitsRawData } = await supabase
        .from("habits")
        .select("id, name, icon")
        .eq("active", true);

      const { data: habitLogsRawData } = await supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("date", todayISO);

      const todayDoneHabitIds = new Set(habitLogsRawData?.map((log) => log.habit_id));

      const habits =
        habitsRawData?.map((habit) => ({
          name: habit.name,
          icon: habit.icon,
          done_today: todayDoneHabitIds.has(habit.id),
        })) || [];

      // Calculate habit streak (consecutive days with all habits done)
      let streak = 0;
      if (habitsRawData && habitsRawData.length > 0) {
        const { data: recentLogs } = await supabase
          .from("habit_logs")
          .select("habit_id, date")
          .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
          .order("date", { ascending: false });

        const habitCount = habitsRawData.length;
        const logsByDate: Record<string, Set<number>> = {};
        (recentLogs || []).forEach((l) => {
          if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
          logsByDate[l.date].add(l.habit_id);
        });

        const checkDate = new Date();
        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.toISOString().split("T")[0];
          if (logsByDate[dateStr] && logsByDate[dateStr].size >= habitCount) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      const { data: expensesData } = await supabase
        .from("finance_expenses")
        .select("amount");

      const { data: incomeData } = await supabase
        .from("finance_income")
        .select("amount");

      const month_expenses =
        expensesData?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const month_income =
        incomeData?.reduce((sum, item) => sum + item.amount, 0) || 0;

      const { data: goalsData } = await supabase
        .from("goals")
        .select("title, percent_complete")
        .eq("status", "active");

      const goals =
        goalsData?.map((goal) => ({
          title: goal.title,
          progress: goal.percent_complete,
        })) || [];

      const { data: recentJournalData } = await supabase
        .from("journal_entries")
        .select("date, mood, energy")
        .order("date", { ascending: false })
        .limit(7);

      const { data: nutritionData } = await supabase
        .from("nutrition_daily")
        .select("calories, protein_g, carbs_g, fat_g, fiber_g, water_ml, caffeine_mg")
        .eq("date", todayISO)
        .maybeSingle();

      // 30-day trends for biometrics
      const [{ data: trendCheckins }, { data: trendNutrition }, { data: trendJournal }] = await Promise.all([
        supabase
          .from("workout_checkins")
          .select("date, weight, body_fat_pct, hrv, hrv_rmssd, sleep, readiness, kubios_readiness, steps, active_calories, resting_hr, vo2_max")
          .gte("date", thirtyDaysAgoISO)
          .lte("date", todayISO)
          .order("date", { ascending: true }),
        supabase
          .from("nutrition_daily")
          .select("date, calories, protein_g, water_ml")
          .gte("date", thirtyDaysAgoISO)
          .lte("date", todayISO)
          .order("date", { ascending: true }),
        supabase
          .from("journal_entries")
          .select("date, mood, energy")
          .gte("date", thirtyDaysAgoISO)
          .lte("date", todayISO)
          .order("date", { ascending: true }),
      ]);

      setData({
        taskStats,
        todayTasks,
        habits,
        spending: { month_expenses, month_income },
        goals,
        recentJournal: recentJournalData || [],
        streak,
        nutrition: nutritionData || null,
        trends: {
          checkins: (trendCheckins as BiometricPoint[]) || [],
          nutrition: (trendNutrition as NutritionPoint[]) || [],
          journal: (trendJournal as JournalPoint[]) || [],
        },
      });
    }

    fetchDashboardData();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-desert-text-3">Loading...</p>
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
  const greeting = getGreeting(data);
  const habitsDone = data.habits.filter((h) => h.done_today).length;
  const habitsTotal = data.habits.length;

  return (
    <div className="min-h-screen p-6 relative z-10">
      {/* D4: Header banner */}
      <div className="mb-8 pb-6">
        <h1 className="font-pixel text-xl md:text-2xl text-desert-text">
          {greeting.text}, {userName}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-desert-text-2 text-sm">
            {todayFormatted}
          </p>
          <span className="bg-desert-accent-dim text-desert-accent font-mono text-[10px] px-2 py-0.5 rounded-lg">
            W{weekNumber}
          </span>
        </div>
        {greeting.sub && (
          <p className="text-desert-text-2 text-sm italic mt-2">{greeting.sub}</p>
        )}
        <div className="h-px bg-gradient-to-r from-transparent via-desert-border to-transparent mt-6" />
      </div>

      {/* D2: Bento grid layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Row 1: Stat cards — 4 across */}
        <div className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-accent rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-accent transition-colors duration-150">
          <p className="font-mono font-bold text-2xl text-desert-text">{data.taskStats.active}</p>
          <p className="text-xs text-desert-text-3 font-mono uppercase tracking-wider mt-1">Active Tasks</p>
        </div>
        <div className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-success rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-success transition-colors duration-150">
          <p className="font-mono font-bold text-2xl text-desert-success">
            {data.taskStats.completed_this_week}
          </p>
          <p className="text-xs text-desert-text-3 font-mono uppercase tracking-wider mt-1">Done This Week</p>
        </div>
        <div className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-danger rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-danger transition-colors duration-150">
          <p
            className={`font-mono font-bold text-2xl ${
              data.taskStats.overdue > 0 ? "text-desert-danger" : "text-desert-text"
            }`}
          >
            {data.taskStats.overdue}
          </p>
          <p className="text-xs text-desert-text-3 font-mono uppercase tracking-wider mt-1">Overdue</p>
        </div>
        <div className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-accent rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-accent transition-colors duration-150">
          <p className="font-mono font-bold text-2xl text-desert-accent">
            {data.streak > 0 ? `${data.streak}d` : "—"}
          </p>
          <p className="text-xs text-desert-text-3 font-mono uppercase tracking-wider mt-1">Habit Streak</p>
        </div>

        {/* Row 2: Today's Focus (wide) + Habits */}
        <Link
          href="/tasks"
          className="col-span-2 bg-desert-surface border border-desert-border border-l-2 border-l-desert-accent rounded-sm p-5 hover:border-desert-border-strong hover:border-l-desert-accent hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <h2 className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="tasks" size={14} /> Today&apos;s Focus
          </h2>
          {data.todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-2">
              <PixelIcon name="tumbleweed" size={24} className="text-desert-text-3" />
              <p className="text-desert-text-3 text-xs">Clear schedule</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data.todayTasks.slice(0, 6).map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-sm">
                  <span className={`text-xs ${priorityColors[task.priority]}`}>●</span>
                  <span className="text-desert-text truncate">{task.title}</span>
                </li>
              ))}
              {data.todayTasks.length > 6 && (
                <li className="text-desert-text-3 text-xs font-mono">
                  +{data.todayTasks.length - 6} more
                </li>
              )}
            </ul>
          )}
        </Link>

        <Link
          href="/habits"
          className="col-span-2 bg-desert-surface border border-desert-border border-l-2 border-l-desert-success rounded-sm p-5 hover:border-desert-border-strong hover:border-l-desert-success hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 group-hover:text-desert-text transition-colors flex items-center gap-2">
              <PixelIcon name="habits" size={14} /> Habits
            </h2>
            {habitsTotal > 0 && (
              <span className="font-mono text-xs text-desert-text-3">
                {habitsDone}/{habitsTotal}
              </span>
            )}
          </div>
          {data.habits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-2">
              <PixelIcon name="seedling" size={24} className="text-desert-text-3" />
              <p className="text-desert-text-3 text-xs">No habits yet</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="w-full bg-desert-border rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    habitsDone === habitsTotal && habitsTotal > 0
                      ? "bg-desert-success"
                      : "bg-desert-accent"
                  }`}
                  style={{
                    width: `${habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {data.habits.map((habit, i) => (
                  <span
                    key={i}
                    className={`text-lg transition-opacity duration-150 ${
                      habit.done_today ? "opacity-100" : "opacity-30"
                    }`}
                    title={`${habit.name}: ${habit.done_today ? "done" : "not done"}`}
                  >
                    {habit.icon}
                  </span>
                ))}
              </div>
            </>
          )}
        </Link>

        {/* Row 3: Goals (wide) + Mood (compact) */}
        <Link
          href="/goals"
          className="col-span-2 md:col-span-3 bg-desert-surface border border-desert-border border-l-2 border-l-desert-mystic rounded-sm p-5 hover:border-desert-border-strong hover:border-l-desert-mystic hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <h2 className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="goals" size={14} /> Goals
          </h2>
          {data.goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-2">
              <PixelIcon name="scroll_blank" size={24} className="text-desert-text-3" />
              <p className="text-desert-text-3 text-xs">No active goals</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.goals.slice(0, 4).map((goal, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-desert-text truncate pr-4">{goal.title}</span>
                    <span className="text-desert-text-3 font-mono text-xs shrink-0">
                      {Math.round(goal.progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-desert-border rounded-full h-1.5">
                    <div
                      className="bg-desert-accent h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Link>

        <Link
          href="/journal"
          className="col-span-2 md:col-span-1 bg-desert-surface border border-desert-border border-l-2 border-l-desert-celestial rounded-sm p-5 hover:border-desert-border-strong hover:border-l-desert-celestial hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <h2 className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="journal" size={14} /> Mood
          </h2>
          {data.recentJournal.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-2">
              <PixelIcon name="campfire_out" size={24} className="text-desert-text-3" />
              <p className="text-desert-text-3 text-xs">No entries</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.recentJournal.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-desert-text-3 text-[10px] font-mono">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString("en-NZ", {
                      weekday: "short",
                    })}
                  </span>
                  <div className="flex gap-1.5">
                    <span className="text-sm">{moodEmoji[entry.mood] || "—"}</span>
                    <span className="text-sm">{energyEmoji[entry.energy] || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Link>

        {/* Row 4: Nutrition */}
        {data.nutrition && data.nutrition.calories != null && (() => {
          const n = data.nutrition!;
          const totalMacroG = (n.protein_g || 0) + (n.carbs_g || 0) + (n.fat_g || 0);
          const proteinPct = totalMacroG > 0 ? ((n.protein_g || 0) / totalMacroG) * 100 : 0;
          const carbsPct = totalMacroG > 0 ? ((n.carbs_g || 0) / totalMacroG) * 100 : 0;
          const fatPct = totalMacroG > 0 ? ((n.fat_g || 0) / totalMacroG) * 100 : 0;
          return (
            <div className="col-span-2 md:col-span-4 bg-desert-surface border border-desert-border border-l-2 border-l-desert-forest rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-forest transition-colors duration-150">
              <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3">
                Today&apos;s Nutrition
              </p>
              <div className="flex items-end gap-6 flex-wrap">
                {/* Calories hero */}
                <div>
                  <p className="font-mono font-bold text-2xl text-desert-text">
                    {Math.round(n.calories!)}
                  </p>
                  <p className="text-[10px] text-desert-text-3 font-mono uppercase">kcal</p>
                </div>
                {/* Macros */}
                <div className="flex gap-4">
                  <div>
                    <p className="font-mono font-bold text-sm text-desert-accent">
                      {Math.round(n.protein_g || 0)}g
                    </p>
                    <p className="text-[10px] text-desert-text-3 font-mono uppercase">Protein</p>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-sm text-desert-warning">
                      {Math.round(n.carbs_g || 0)}g
                    </p>
                    <p className="text-[10px] text-desert-text-3 font-mono uppercase">Carbs</p>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-sm text-desert-text-2">
                      {Math.round(n.fat_g || 0)}g
                    </p>
                    <p className="text-[10px] text-desert-text-3 font-mono uppercase">Fat</p>
                  </div>
                  {n.fiber_g != null && (
                    <div>
                      <p className="font-mono font-bold text-sm text-desert-forest">
                        {Math.round(n.fiber_g)}g
                      </p>
                      <p className="text-[10px] text-desert-text-3 font-mono uppercase">Fiber</p>
                    </div>
                  )}
                </div>
                {/* Extras */}
                <div className="flex gap-4 ml-auto">
                  {n.water_ml != null && (
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-desert-celestial">
                        {(n.water_ml / 1000).toFixed(1)}L
                      </p>
                      <p className="text-[10px] text-desert-text-3 font-mono uppercase">Water</p>
                    </div>
                  )}
                  {n.caffeine_mg != null && n.caffeine_mg > 0 && (
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-desert-clay">
                        {Math.round(n.caffeine_mg)}mg
                      </p>
                      <p className="text-[10px] text-desert-text-3 font-mono uppercase">Caffeine</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Macro ratio bar */}
              {totalMacroG > 0 && (
                <div className="flex h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-desert-accent" style={{ width: `${proteinPct}%` }} />
                  <div className="bg-desert-warning" style={{ width: `${carbsPct}%` }} />
                  <div className="bg-desert-text-3" style={{ width: `${fatPct}%` }} />
                </div>
              )}
            </div>
          );
        })()}

        {/* Row 5: Biometric Trends (30 days) */}
        {(() => {
          const { checkins, nutrition: nutTrends, journal: journalTrends } = data.trends;
          // Build day-indexed maps for proper sparkline alignment
          const checkinMap = new Map(checkins.map((c) => [c.date, c]));
          const nutMap = new Map(nutTrends.map((n) => [n.date, n]));
          const journalMap = new Map(journalTrends.map((j) => [j.date, j]));

          // Generate all 30 dates
          const dates: string[] = [];
          for (let i = 30; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split("T")[0]);
          }

          const weightData = dates.map((d) => checkinMap.get(d)?.weight ?? null);
          const bodyFatData = dates.map((d) => checkinMap.get(d)?.body_fat_pct ?? null);
          const hrvData = dates.map((d) => {
            const c = checkinMap.get(d);
            return c?.hrv_rmssd ?? c?.hrv ?? null;
          });
          const sleepData = dates.map((d) => checkinMap.get(d)?.sleep ?? null);
          const readinessData = dates.map((d) => {
            const c = checkinMap.get(d);
            // Normalize kubios (0-100) to 1-10 scale if no Apple Health readiness
            if (c?.readiness != null) return c.readiness;
            if (c?.kubios_readiness != null) return c.kubios_readiness / 10;
            return null;
          });
          const stepsData = dates.map((d) => checkinMap.get(d)?.steps ?? null);
          const activeCalData = dates.map((d) => checkinMap.get(d)?.active_calories ?? null);
          const restingHrData = dates.map((d) => checkinMap.get(d)?.resting_hr ?? null);
          const vo2Data = dates.map((d) => checkinMap.get(d)?.vo2_max ?? null);
          const moodData = dates.map((d) => journalMap.get(d)?.mood ?? null);
          const energyData = dates.map((d) => journalMap.get(d)?.energy ?? null);
          const calData = dates.map((d) => nutMap.get(d)?.calories ?? null);
          const proteinData = dates.map((d) => nutMap.get(d)?.protein_g ?? null);

          type Metric = {
            label: string;
            data: (number | null)[];
            color: string;
            unit: string;
            format: (v: number) => string;
          };

          const metrics: Metric[] = [
            { label: "Weight", data: weightData, color: "var(--color-desert-text)", unit: "kg", format: (v) => v.toFixed(1) },
            { label: "Body Fat", data: bodyFatData, color: "var(--color-desert-warning)", unit: "%", format: (v) => v.toFixed(1) },
            { label: "HRV", data: hrvData, color: "var(--color-desert-success)", unit: "ms", format: (v) => Math.round(v).toString() },
            { label: "Sleep", data: sleepData, color: "var(--color-desert-celestial)", unit: "hrs", format: (v) => v.toFixed(1) },
            { label: "Readiness", data: readinessData, color: "var(--color-desert-forest)", unit: "/10", format: (v) => v.toFixed(1) },
            { label: "Resting HR", data: restingHrData, color: "var(--color-desert-danger)", unit: "bpm", format: (v) => Math.round(v).toString() },
            { label: "VO2 Max", data: vo2Data, color: "var(--color-desert-ocean)", unit: "ml/kg", format: (v) => v.toFixed(1) },
            { label: "Steps", data: stepsData, color: "var(--color-desert-forest)", unit: "", format: (v) => (v / 1000).toFixed(1) + "k" },
            { label: "Active Cal", data: activeCalData, color: "var(--color-desert-accent)", unit: "kcal", format: (v) => Math.round(v).toString() },
            { label: "Mood", data: moodData, color: "var(--color-desert-warning)", unit: "/5", format: (v) => v.toFixed(1) },
            { label: "Energy", data: energyData, color: "var(--color-desert-clay)", unit: "/5", format: (v) => v.toFixed(1) },
            { label: "Calories", data: calData, color: "var(--color-desert-driftwood)", unit: "kcal", format: (v) => Math.round(v).toString() },
            { label: "Protein", data: proteinData, color: "var(--color-desert-mystic)", unit: "g", format: (v) => Math.round(v).toString() },
          ];

          // Only show metrics that have at least 2 data points
          const activeMetrics = metrics.filter(
            (m) => m.data.filter((v) => v != null).length >= 2
          );

          if (activeMetrics.length === 0) return null;

          return (
            <div className="col-span-2 md:col-span-4 bg-desert-surface border border-desert-border border-l-2 border-l-desert-border-strong rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-border-strong transition-colors duration-150">
              <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-4">
                30-Day Trends
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {activeMetrics.map((m) => {
                  const valid = m.data.filter((v): v is number => v != null);
                  const latest = valid[valid.length - 1];
                  const first = valid[0];
                  const delta = latest - first;
                  const deltaStr = delta > 0 ? `+${m.format(delta)}` : m.format(delta);
                  // Higher is better for these metrics
                  const higherIsBetter = ["HRV", "Sleep", "Protein", "Readiness", "Mood", "Energy", "VO2 Max", "Steps", "Active Cal"];
                  const lowerIsBetter = ["Body Fat", "Resting HR"];
                  const deltaColor = higherIsBetter.includes(m.label)
                    ? delta >= 0 ? "text-desert-success" : "text-desert-danger"
                    : lowerIsBetter.includes(m.label)
                    ? delta <= 0 ? "text-desert-success" : "text-desert-danger"
                    : "text-desert-text-3";

                  return (
                    <div key={m.label} className="flex items-center gap-3">
                      <div className="min-w-[60px]">
                        <p className="font-mono font-bold text-sm text-desert-text">
                          {m.format(latest)}
                          <span className="text-desert-text-3 text-[10px] ml-0.5">{m.unit}</span>
                        </p>
                        <p className="text-[10px] text-desert-text-3 font-mono uppercase">{m.label}</p>
                        <p className={`text-[10px] font-mono ${deltaColor}`}>{deltaStr}</p>
                      </div>
                      <Sparkline data={m.data} color={m.color} width={100} height={28} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Row 6: Quick links */}
        <Link
          href="/finances"
          className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-warning rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-warning hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="finances" size={14} /> Finances
          </p>
          <p className="font-mono text-lg text-desert-text mt-2">
            ${(data.spending.month_income / 100).toLocaleString("en-NZ", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-desert-text-3 font-mono uppercase">Income/mo</p>
        </Link>

        <Link
          href="/calendar"
          className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-celestial rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-celestial hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="calendar" size={14} /> Calendar
          </p>
          <p className="text-desert-text-3 text-sm mt-2">View schedule →</p>
        </Link>

        <Link
          href="/review"
          className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-driftwood rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-driftwood hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="review" size={14} /> Review
          </p>
          <p className="text-desert-text-3 text-sm mt-2">Weekly check-in →</p>
        </Link>

        <Link
          href="/chat"
          className="bg-desert-surface border border-desert-border border-l-2 border-l-desert-clay rounded-sm p-4 hover:border-desert-border-strong hover:border-l-desert-clay hover:bg-desert-surface-hover transition-all duration-150 group"
        >
          <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 group-hover:text-desert-text transition-colors flex items-center gap-2">
            <PixelIcon name="chat" size={14} /> AI Chat
          </p>
          <p className="text-desert-text-3 text-sm mt-2">Ask anything →</p>
        </Link>

        {/* Export for Analysis */}
        <ExportCard />
      </div>
    </div>
  );
}
