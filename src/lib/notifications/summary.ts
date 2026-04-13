import { type NotificationPayload } from "./types";

interface SummaryData {
  habitsCompleted: number;
  habitsTotal: number;
  incompleteHabits: string[];
  steps: number | null;
  activeCals: number | null;
  weight: number | null;
  weightAvg7d: number | null;
  mood: number | null;
  energy: number | null;
  tasksCompleted: number;
  tasksRemaining: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function buildDailySummary(
  supabase: { from: (table: string) => any },
  userId: string,
  date: string
): Promise<NotificationPayload> {
  const { data: habits } = await supabase.from("habits")
    .select("id, name")
    .eq("user_id", userId)
    .eq("active", true);

  const { data: habitLogs } = await supabase.from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("date", date);

  const loggedIds = new Set((habitLogs || []).map((l: { habit_id: number }) => l.habit_id));
  const habitsCompleted = loggedIds.size;
  const habitsTotal = (habits || []).length;
  const incompleteHabits = (habits || [])
    .filter((h: { id: number; name: string }) => !loggedIds.has(h.id))
    .map((h: { id: number; name: string }) => h.name);

  const { data: checkin } = await supabase.from("workout_checkins")
    .select("steps, active_calories, weight")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const { data: recentCheckins } = await supabase.from("workout_checkins")
    .select("weight")
    .eq("user_id", userId)
    .not("weight", "is", null)
    .order("date", { ascending: false })
    .limit(7);

  const weights = (recentCheckins || [])
    .map((c: { weight: number | null }) => c.weight)
    .filter((w: number | null): w is number => w != null);
  const weightAvg7d = weights.length > 0
    ? weights.reduce((a: number, b: number) => a + b, 0) / weights.length
    : null;

  const { data: journal } = await supabase.from("journal_entries")
    .select("mood, energy")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const { data: tasks } = await supabase.from("tasks")
    .select("status")
    .eq("user_id", userId);
  const tasksCompleted = (tasks || []).filter((t: { status: string }) => t.status === "done").length;
  const tasksRemaining = (tasks || []).filter((t: { status: string }) => t.status !== "done").length;

  const summary: SummaryData = {
    habitsCompleted,
    habitsTotal,
    incompleteHabits,
    steps: checkin?.steps ?? null,
    activeCals: checkin?.active_calories ?? null,
    weight: checkin?.weight ?? null,
    weightAvg7d,
    mood: journal?.mood ?? null,
    energy: journal?.energy ?? null,
    tasksCompleted,
    tasksRemaining,
  };

  return {
    title: "Daily Summary",
    body: formatSummary(summary),
    link: "/",
    rule_type: "daily_summary",
  };
}

function formatSummary(s: SummaryData): string {
  const lines: string[] = ["*Daily Summary*\n"];

  lines.push(`Habits: ${s.habitsCompleted}/${s.habitsTotal} done`);
  if (s.incompleteHabits.length > 0 && s.incompleteHabits.length <= 5) {
    lines.push(`Remaining: ${s.incompleteHabits.join(", ")}`);
  }
  if (s.steps != null) lines.push(`Steps: ${s.steps.toLocaleString()}`);
  if (s.activeCals != null) lines.push(`Active cal: ${s.activeCals}`);
  if (s.weight != null) {
    let weightLine = `Weight: ${s.weight}kg`;
    if (s.weightAvg7d != null) {
      const diff = s.weight - s.weightAvg7d;
      weightLine += ` (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} vs 7d avg)`;
    }
    lines.push(weightLine);
  }
  if (s.mood != null) lines.push(`Mood: ${s.mood}/5`);
  if (s.energy != null) lines.push(`Energy: ${s.energy}/5`);
  lines.push(`Tasks: ${s.tasksCompleted} done, ${s.tasksRemaining} remaining`);

  return lines.join("\n");
}

export async function getIncompleteHabits(
  supabase: { from: (table: string) => any },
  userId: string,
  date: string
): Promise<Array<{ id: number; name: string }>> {
  const { data: habits } = await supabase.from("habits")
    .select("id, name")
    .eq("user_id", userId)
    .eq("active", true);

  const { data: logs } = await supabase.from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("date", date);

  const loggedIds = new Set((logs || []).map((l: { habit_id: number }) => l.habit_id));
  return (habits || []).filter((h: { id: number; name: string }) => !loggedIds.has(h.id));
}
