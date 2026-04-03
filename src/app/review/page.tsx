"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import PixelIcon from "@/components/PixelIcon";

interface WeeklyReview {
  id: number;
  week_start_date: string;
  habit_reflection: string;
  goals_reflection: string;
  tasks_reflection: string;
  finance_note: string;
  wins: string[];
  challenges: string[];
  intentions: string[];
  ai_summary: string | null;
  habits_snapshot: Record<string, unknown> | null;
  goals_snapshot: Record<string, unknown> | null;
  tasks_snapshot: Record<string, unknown> | null;
  finance_snapshot: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
}

interface HabitStats {
  name: string;
  icon: string;
  daysCompleted: number;
  totalDays: number;
  pct: number;
}

interface GoalSnapshot {
  title: string;
  area: string;
  percent_complete: number;
}

interface TasksSnapshot {
  completed: number;
  total: number;
  overdue: { title: string; due_date: string }[];
}

interface FinanceSnapshot {
  monthlyIncome: number;
  monthlyExpenses: number;
  surplus: number;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(mondayStr: string): string {
  const mon = new Date(mondayStr + "T12:00:00");
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

const FREQUENCY_TO_MONTHLY: Record<string, number> = {
  daily: 30,
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

export default function ReviewPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [pastReviews, setPastReviews] = useState<{ id: number; week_start_date: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [weekStart, setWeekStart] = useState(() => toDateStr(getMonday(new Date())));

  // Auto-pulled data
  const [habitStats, setHabitStats] = useState<HabitStats[]>([]);
  const [goalSnapshots, setGoalSnapshots] = useState<GoalSnapshot[]>([]);
  const [tasksSnapshot, setTasksSnapshot] = useState<TasksSnapshot>({ completed: 0, total: 0, overdue: [] });
  const [financeSnapshot, setFinanceSnapshot] = useState<FinanceSnapshot>({ monthlyIncome: 0, monthlyExpenses: 0, surplus: 0 });

  // Form state
  const [habitReflection, setHabitReflection] = useState("");
  const [goalsReflection, setGoalsReflection] = useState("");
  const [tasksReflection, setTasksReflection] = useState("");
  const [financeNote, setFinanceNote] = useState("");
  const [wins, setWins] = useState(["", "", ""]);
  const [challenges, setChallenges] = useState(["", ""]);
  const [intentions, setIntentions] = useState(["", "", ""]);

  // Export state
  const [exportDays, setExportDays] = useState(14);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/analysis?days=${exportDays}`, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-os-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const weekEnd = useMemo(() => {
    const mon = new Date(weekStart + "T12:00:00");
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return toDateStr(sun);
  }, [weekStart]);

  const fetchAutoPulledData = useCallback(async () => {
    if (!userId) return;

    // Habits
    const [{ data: habits }, { data: habitLogs }] = await Promise.all([
      supabase.from("habits").select("id, name, icon").eq("user_id", userId).eq("active", true),
      supabase
        .from("habit_logs")
        .select("habit_id, date")
        .eq("user_id", userId)
        .gte("date", weekStart)
        .lte("date", weekEnd),
    ]);

    const today = new Date();
    const weekStartDate = new Date(weekStart + "T12:00:00");
    const daysSoFar = Math.min(7, Math.floor((today.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const stats: HabitStats[] = (habits || []).map((h) => {
      const completed = (habitLogs || []).filter((l) => l.habit_id === h.id).length;
      return {
        name: h.name,
        icon: h.icon,
        daysCompleted: completed,
        totalDays: daysSoFar,
        pct: daysSoFar > 0 ? Math.round((completed / daysSoFar) * 100) : 0,
      };
    });
    setHabitStats(stats);

    // Goals
    const { data: goals } = await supabase
      .from("goals")
      .select("title, area, percent_complete")
      .eq("user_id", userId)
      .eq("status", "active");
    setGoalSnapshots(
      (goals || []).map((g) => ({
        title: g.title,
        area: g.area,
        percent_complete: g.percent_complete || 0,
      }))
    );

    // Tasks
    const [{ data: allTasks }, { data: completedTasks }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, due_date, status")
        .eq("user_id", userId)
        .neq("status", "done"),
      supabase
        .from("tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "done")
        .gte("completed_at", weekStart)
        .lte("completed_at", weekEnd + "T23:59:59"),
    ]);
    const overdue = (allTasks || [])
      .filter((t) => t.due_date && t.due_date < toDateStr(new Date()) && t.status !== "done")
      .map((t) => ({ title: t.title, due_date: t.due_date! }));
    setTasksSnapshot({
      completed: (completedTasks || []).length,
      total: (completedTasks || []).length + (allTasks || []).length,
      overdue,
    });

    // Finance
    const [{ data: income }, { data: expenses }] = await Promise.all([
      supabase.from("finance_income").select("amount, frequency").eq("user_id", userId),
      supabase.from("finance_expenses").select("amount, frequency").eq("user_id", userId),
    ]);
    const monthlyIncome = (income || []).reduce(
      (sum, i) => sum + i.amount * (FREQUENCY_TO_MONTHLY[i.frequency] || 1),
      0
    );
    const monthlyExpenses = (expenses || []).reduce(
      (sum, e) => sum + e.amount * (FREQUENCY_TO_MONTHLY[e.frequency] || 1),
      0
    );
    setFinanceSnapshot({
      monthlyIncome,
      monthlyExpenses,
      surplus: monthlyIncome - monthlyExpenses,
    });
  }, [userId, weekStart, weekEnd]);

  const fetchReview = useCallback(async () => {
    if (!userId) return;

    // Fetch existing review for this week
    const { data } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start_date", weekStart)
      .single();

    if (data) {
      setReview(data);
      setHabitReflection(data.habit_reflection || "");
      setGoalsReflection(data.goals_reflection || "");
      setTasksReflection(data.tasks_reflection || "");
      setFinanceNote(data.finance_note || "");
      setWins(data.wins || ["", "", ""]);
      setChallenges(data.challenges || ["", ""]);
      setIntentions(data.intentions || ["", "", ""]);
    } else {
      setReview(null);
      setHabitReflection("");
      setGoalsReflection("");
      setTasksReflection("");
      setFinanceNote("");
      setWins(["", "", ""]);
      setChallenges(["", ""]);
      setIntentions(["", "", ""]);
    }

    // Fetch past reviews list
    const { data: past } = await supabase
      .from("weekly_reviews")
      .select("id, week_start_date")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false })
      .limit(20);
    setPastReviews(past || []);
  }, [userId, weekStart]);

  useEffect(() => {
    if (userId) {
      fetchReview();
      fetchAutoPulledData();
    }
  }, [userId, weekStart, fetchReview, fetchAutoPulledData]);

  const saveReview = async () => {
    if (!userId) return;
    setSaving(true);

    const payload = {
      user_id: userId,
      week_start_date: weekStart,
      habit_reflection: habitReflection,
      goals_reflection: goalsReflection,
      tasks_reflection: tasksReflection,
      finance_note: financeNote,
      wins,
      challenges,
      intentions,
      habits_snapshot: habitStats,
      goals_snapshot: goalSnapshots,
      tasks_snapshot: tasksSnapshot,
      finance_snapshot: financeSnapshot,
    };

    if (review) {
      const { error } = await supabase.from("weekly_reviews").update(payload).eq("id", review.id);
      if (error) {
        await queueWrite("weekly_reviews", "update", { id: review.id, ...payload });
      }
    } else {
      const { error } = await supabase.from("weekly_reviews").insert(payload);
      if (error) {
        await queueWrite("weekly_reviews", "insert", payload);
      }
    }

    await fetchReview();
    setSaving(false);
  };

  const fmtCents = (cents: number) => {
    const sign = cents < 0 ? "-" : "";
    return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const updateListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-desert-border">
        <div>
          <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="review" size={18} className="text-desert-accent" /> Weekly Review</h1>
          <p className="text-desert-text-3 mt-1">{formatWeekLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-3">
          {pastReviews.length > 0 && (
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-mono text-sm focus:outline-none focus:border-desert-accent transition-colors"
            >
              {/* Current week always available */}
              {!pastReviews.some((r) => r.week_start_date === toDateStr(getMonday(new Date()))) && (
                <option value={toDateStr(getMonday(new Date()))}>
                  This week — {formatWeekLabel(toDateStr(getMonday(new Date())))}
                </option>
              )}
              {pastReviews.map((r) => (
                <option key={r.id} value={r.week_start_date}>
                  {formatWeekLabel(r.week_start_date)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={saveReview}
            disabled={saving}
            className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Export for Analysis */}
      <div className="bg-desert-surface border border-desert-border rounded-sm p-4 mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2">Export for Analysis</p>
          <div className="flex gap-1.5">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setExportDays(d)}
                className={`px-2.5 py-1 font-mono text-xs rounded-sm transition-colors duration-150 ${
                  exportDays === d
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
            disabled={exporting}
            className="px-4 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-xs rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Download JSON"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* 1. Habits */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            1. Habits
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4 mb-3">
            {habitStats.length === 0 ? (
              <p className="text-desert-text-3 text-sm">No active habits</p>
            ) : (
              <div className="space-y-2">
                {habitStats.map((h) => (
                  <div key={h.name} className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center">{h.icon}</span>
                    <span className="text-desert-text text-sm flex-1 truncate">{h.name}</span>
                    <div className="w-24 bg-desert-border rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          h.pct >= 80 ? "bg-desert-success" : h.pct >= 50 ? "bg-desert-accent" : "bg-desert-danger"
                        }`}
                        style={{ width: `${Math.min(100, h.pct)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-desert-text-2 w-16 text-right">
                      {h.daysCompleted}/{h.totalDays} ({h.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <textarea
            placeholder="How did your habits go this week?"
            value={habitReflection}
            onChange={(e) => setHabitReflection(e.target.value)}
            rows={2}
            className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none"
          />
        </section>

        {/* 2. Goals */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            2. Goals
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4 mb-3">
            {goalSnapshots.length === 0 ? (
              <p className="text-desert-text-3 text-sm">No active goals</p>
            ) : (
              <div className="space-y-2">
                {goalSnapshots.map((g) => (
                  <div key={g.title} className="flex items-center gap-3">
                    <span className="text-desert-text text-sm flex-1 truncate">{g.title}</span>
                    <span className="font-mono text-xs text-desert-text-3 uppercase">{g.area.replace("_", " ")}</span>
                    <span className="font-mono text-xs text-desert-text-2 w-10 text-right">
                      {Math.round(g.percent_complete)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <textarea
            placeholder="What moved forward this week?"
            value={goalsReflection}
            onChange={(e) => setGoalsReflection(e.target.value)}
            rows={2}
            className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none"
          />
        </section>

        {/* 3. Tasks */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            3. Tasks
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4 mb-3">
            <div className="flex items-center gap-4 mb-2">
              <span className="text-desert-text text-sm">
                Completed: <span className="font-mono font-bold">{tasksSnapshot.completed}</span> / {tasksSnapshot.total}
              </span>
            </div>
            {tasksSnapshot.overdue.length > 0 && (
              <div className="mt-2 pt-2 border-t border-desert-border">
                <p className="text-desert-danger text-xs font-mono uppercase tracking-wider mb-1">
                  Overdue ({tasksSnapshot.overdue.length})
                </p>
                {tasksSnapshot.overdue.slice(0, 5).map((t) => (
                  <p key={t.title} className="text-desert-text-3 text-xs truncate">
                    • {t.title} (due {t.due_date})
                  </p>
                ))}
              </div>
            )}
          </div>
          <textarea
            placeholder="What didn't get done? Why?"
            value={tasksReflection}
            onChange={(e) => setTasksReflection(e.target.value)}
            rows={2}
            className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none"
          />
        </section>

        {/* 4. Finance */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            4. Finance
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4 mb-3">
            <div className="flex gap-6">
              <div>
                <p className="text-desert-text-3 text-xs font-mono uppercase tracking-wider">Income/mo</p>
                <p className="font-mono text-sm text-desert-success">{fmtCents(financeSnapshot.monthlyIncome)}</p>
              </div>
              <div>
                <p className="text-desert-text-3 text-xs font-mono uppercase tracking-wider">Expenses/mo</p>
                <p className="font-mono text-sm text-desert-danger">{fmtCents(financeSnapshot.monthlyExpenses)}</p>
              </div>
              <div>
                <p className="text-desert-text-3 text-xs font-mono uppercase tracking-wider">Surplus</p>
                <p className={`font-mono text-sm ${financeSnapshot.surplus >= 0 ? "text-desert-success" : "text-desert-danger"}`}>
                  {fmtCents(financeSnapshot.surplus)}
                </p>
              </div>
            </div>
          </div>
          <textarea
            placeholder="Any finance notes this week?"
            value={financeNote}
            onChange={(e) => setFinanceNote(e.target.value)}
            rows={2}
            className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none"
          />
        </section>

        {/* 5. Wins */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            5. Wins — What went well?
          </h2>
          <div className="space-y-2">
            {wins.map((w, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Win ${i + 1}...`}
                value={w}
                onChange={(e) => updateListItem(setWins, i, e.target.value)}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
            ))}
          </div>
        </section>

        {/* 6. Challenges */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            6. Challenges — What was hard?
          </h2>
          <div className="space-y-2">
            {challenges.map((c, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Challenge ${i + 1}...`}
                value={c}
                onChange={(e) => updateListItem(setChallenges, i, e.target.value)}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
            ))}
          </div>
        </section>

        {/* 7. Next Week */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            7. Next Week — What do I want to focus on?
          </h2>
          <div className="space-y-2">
            {intentions.map((intent, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Intention ${i + 1}...`}
                value={intent}
                onChange={(e) => updateListItem(setIntentions, i, e.target.value)}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
            ))}
          </div>
        </section>

        {/* 8. AI Summary */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            8. AI Summary
          </h2>
          {review?.ai_summary ? (
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <p className="text-desert-text text-sm whitespace-pre-wrap">{review.ai_summary}</p>
              <button
                onClick={async () => {
                  if (!review) return;
                  setGenerating(true);
                  const res = await fetch("/api/review-summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reviewId: review.id }),
                  });
                  if (res.ok) await fetchReview();
                  setGenerating(false);
                }}
                disabled={generating}
                className="mt-3 px-3 py-1.5 text-desert-text-3 hover:text-desert-text font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {generating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          ) : (
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 text-center">
              <p className="text-desert-text-3 text-sm mb-3">
                {review ? "Generate an AI summary of your review" : "Save your review first, then generate an AI summary"}
              </p>
              <button
                onClick={async () => {
                  if (!review) return;
                  setGenerating(true);
                  const res = await fetch("/api/review-summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reviewId: review.id }),
                  });
                  if (res.ok) await fetchReview();
                  setGenerating(false);
                }}
                disabled={!review || generating}
                className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? "Generating..." : "Generate Summary"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
