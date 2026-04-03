import { createClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // Parse days param (default 14, max 90)
  const daysParam = request.nextUrl.searchParams.get("days");
  const days = Math.min(Math.max(parseInt(daysParam || "14", 10) || 14, 1), 90);

  const to = new Date().toISOString().split("T")[0];
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().split("T")[0];

  // Fetch date-filtered tables in parallel
  const [
    { data: checkins },
    { data: sessions },
    { data: journalEntries },
    { data: habitLogs },
    { data: completedTasks },
    { data: weeklyReviews },
    { data: habits },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from("workout_checkins")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("completed_at", from)
      .lte("completed_at", to + "T23:59:59"),
    supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .gte("week_start_date", from)
      .lte("week_start_date", to),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  // Fetch workout exercises by session IDs
  const sessionIds = (sessions || []).map((s) => s.id);
  let exercises: Record<string, unknown>[] = [];
  if (sessionIds.length > 0) {
    const { data: exerciseData } = await supabase
      .from("workout_exercises")
      .select("*")
      .in("session_id", sessionIds);
    exercises = exerciseData || [];
  }

  // Fetch key_results by active goal IDs
  const goalIds = (goals || []).map((g) => g.id);
  let keyResults: Record<string, unknown>[] = [];
  if (goalIds.length > 0) {
    const { data: krData } = await supabase
      .from("key_results")
      .select("*")
      .in("goal_id", goalIds);
    keyResults = krData || [];
  }

  // Strip user_id from all records
  const strip = <T extends Record<string, unknown>>(records: T[]) =>
    records.map(({ user_id: _uid, ...rest }) => rest);

  const payload = {
    exported_at: new Date().toISOString(),
    period: { from, to, days },
    checkins: strip(checkins || []),
    workout_sessions: strip(sessions || []),
    workout_exercises: strip(exercises),
    journal_entries: strip(journalEntries || []),
    habit_logs: strip(habitLogs || []),
    habits: strip(habits || []),
    goals: strip(goals || []),
    key_results: strip(keyResults),
    tasks_completed: strip(completedTasks || []),
    weekly_reviews: strip(weeklyReviews || []),
  };

  const filename = `life-os-export-${to}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
