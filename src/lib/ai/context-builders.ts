import { SupabaseClient } from "@supabase/supabase-js";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FREQUENCY_TO_MONTHLY: Record<string, number> = {
  daily: 30,
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

export async function buildFocusContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const today = toDateStr(new Date());

  const [
    { data: overdueTasks },
    { data: todayTasks },
    { data: habits },
    { data: habitLogs },
    { data: goals },
    { data: calEvents },
    { data: recentCheckins },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, priority, due_date")
      .eq("user_id", userId)
      .neq("status", "done")
      .lt("due_date", today)
      .order("due_date")
      .limit(10),
    supabase
      .from("tasks")
      .select("title, priority")
      .eq("user_id", userId)
      .neq("status", "done")
      .eq("due_date", today)
      .order("priority")
      .limit(10),
    supabase
      .from("habits")
      .select("id, name, icon")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("user_id", userId)
      .eq("date", today),
    supabase
      .from("goals")
      .select("title, area, percent_complete, last_reviewed_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(10),
    supabase
      .from("calendar_events")
      .select("title, start_time, all_day")
      .eq("user_id", userId)
      .eq("date", today)
      .limit(10),
    supabase
      .from("workout_checkins")
      .select("date, hrv, hrv_rmssd, sleep, weight, readiness, shin_pain, waist_cm, pns_index, sns_index, stress_index, kubios_readiness, mean_hr")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3),
  ]);

  const completedHabitIds = new Set((habitLogs || []).map((l) => l.habit_id));
  const sections: string[] = [];

  if ((overdueTasks || []).length > 0) {
    sections.push(
      "OVERDUE TASKS:\n" +
        (overdueTasks || [])
          .map((t) => `- [${t.priority}] ${t.title} (due ${t.due_date})`)
          .join("\n")
    );
  }

  if ((todayTasks || []).length > 0) {
    sections.push(
      "TODAY'S TASKS:\n" +
        (todayTasks || []).map((t) => `- [${t.priority}] ${t.title}`).join("\n")
    );
  }

  if ((habits || []).length > 0) {
    sections.push(
      "HABITS (today):\n" +
        (habits || [])
          .map(
            (h) =>
              `- ${h.icon} ${h.name}: ${completedHabitIds.has(h.id) ? "✅ done" : "⬜ not done"}`
          )
          .join("\n")
    );
  }

  if ((goals || []).length > 0) {
    sections.push(
      "ACTIVE GOALS:\n" +
        (goals || [])
          .map((g) => {
            const stale =
              g.last_reviewed_at &&
              Date.now() - new Date(g.last_reviewed_at).getTime() >
                7 * 24 * 60 * 60 * 1000;
            return `- ${g.title} (${g.area}, ${Math.round(g.percent_complete || 0)}%)${stale ? " ⚠ not reviewed in >7 days" : ""}`;
          })
          .join("\n")
    );
  }

  if ((calEvents || []).length > 0) {
    sections.push(
      "TODAY'S CALENDAR:\n" +
        (calEvents || [])
          .map(
            (e) =>
              `- ${e.title}${e.all_day ? " (all day)" : ` at ${e.start_time}`}`
          )
          .join("\n")
    );
  }

  if ((recentCheckins || []).length > 0) {
    const latest = recentCheckins![0];
    const parts = [`Date: ${latest.date}`];
    if (latest.hrv_rmssd != null) parts.push(`RMSSD: ${latest.hrv_rmssd}ms (primary parasympathetic recovery metric — use this for training readiness, not SDNN)`);
    if (latest.hrv != null) parts.push(`SDNN: ${latest.hrv}ms (overall HRV from Apple Health)`);
    if (latest.sleep != null) parts.push(`Sleep: ${latest.sleep}h`);
    if (latest.readiness != null) parts.push(`Readiness: ${latest.readiness}/10`);
    if (latest.weight != null) parts.push(`Weight: ${latest.weight}kg`);
    if (latest.pns_index != null) parts.push(`PNS Index: ${latest.pns_index} (>0 = good parasympathetic tone, <0 = suppressed)`);
    if (latest.sns_index != null) parts.push(`SNS Index: ${latest.sns_index} (>0 = elevated sympathetic/stress, <0 = low sympathetic = good)`);
    if (latest.stress_index != null) parts.push(`Stress Index: ${latest.stress_index} (Baevsky: <100 low, 100-200 moderate, >200 high)`);
    if (latest.kubios_readiness != null) parts.push(`Kubios Readiness: ${latest.kubios_readiness}/100 (composite recovery score)`);
    if (latest.mean_hr != null) parts.push(`Mean HR: ${latest.mean_hr} bpm (during HRV reading)`);
    if (latest.shin_pain != null) parts.push(`Shin pain: ${latest.shin_pain}/10 (0=none, 10=severe)`);
    if (latest.waist_cm != null) parts.push(`Waist: ${latest.waist_cm}cm`);
    sections.push(
      "RECOVERY & BODY DATA (latest check-in):\n" + parts.join("\n") +
      "\n\nHRV Interpretation: RMSSD measures parasympathetic recovery — primary metric for training readiness. " +
      "PNS Index > 0 = good parasympathetic tone. SNS Index > 0 = elevated sympathetic (stress/overtraining). " +
      "Trending SNS upward while RMSSD stays flat is an early overtraining signal. " +
      "User is managing shin pain and returning to running — flag any recovery concerns."
    );
  }

  return sections.join("\n\n") || "No data available for today.";
}

export async function buildReviewContext(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string
): Promise<string> {
  const weekEnd = new Date(weekStartDate + "T12:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = toDateStr(weekEnd);

  const [
    { data: habitLogs },
    { data: habits },
    { data: completedTasks },
    { data: goals },
    { data: income },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("habit_id, date")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", weekEndStr),
    supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("tasks")
      .select("title")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("completed_at", weekStartDate)
      .lte("completed_at", weekEndStr + "T23:59:59")
      .limit(10),
    supabase
      .from("goals")
      .select("title, percent_complete, area")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(10),
    supabase
      .from("finance_income")
      .select("amount, frequency")
      .eq("user_id", userId),
    supabase
      .from("finance_expenses")
      .select("amount, frequency")
      .eq("user_id", userId),
  ]);

  const sections: string[] = [];

  if ((habits || []).length > 0) {
    const logs = habitLogs || [];
    sections.push(
      "HABIT COMPLETION THIS WEEK:\n" +
        (habits || [])
          .map((h) => {
            const count = logs.filter((l) => l.habit_id === h.id).length;
            return `- ${h.name}: ${count}/7 days`;
          })
          .join("\n")
    );
  }

  if ((completedTasks || []).length > 0) {
    sections.push(
      `TASKS COMPLETED (${(completedTasks || []).length}):\n` +
        (completedTasks || []).map((t) => `- ${t.title}`).join("\n")
    );
  }

  if ((goals || []).length > 0) {
    sections.push(
      "GOAL PROGRESS:\n" +
        (goals || [])
          .map(
            (g) =>
              `- ${g.title} (${g.area}): ${Math.round(g.percent_complete || 0)}%`
          )
          .join("\n")
    );
  }

  const monthlyIncome = (income || []).reduce(
    (s, i) => s + i.amount * (FREQUENCY_TO_MONTHLY[i.frequency] || 1),
    0
  );
  const monthlyExpenses = (expenses || []).reduce(
    (s, e) => s + e.amount * (FREQUENCY_TO_MONTHLY[e.frequency] || 1),
    0
  );
  sections.push(
    `FINANCE SUMMARY:\n- Monthly income: $${(monthlyIncome / 100).toFixed(0)}\n- Monthly expenses: $${(monthlyExpenses / 100).toFixed(0)}\n- Surplus: $${((monthlyIncome - monthlyExpenses) / 100).toFixed(0)}`
  );

  return sections.join("\n\n") || "No data available for this week.";
}

export async function buildSpendingContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [{ data: transactions }, { data: expenses }, { data: income }] =
    await Promise.all([
      supabase
        .from("finance_transactions")
        .select("amount, category, date, description")
        .eq("user_id", userId)
        .gte("date", toDateStr(sixtyDaysAgo))
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("finance_expenses")
        .select("category, amount, frequency")
        .eq("user_id", userId),
      supabase
        .from("finance_income")
        .select("name, amount, frequency")
        .eq("user_id", userId),
    ]);

  const sections: string[] = [];

  // Group transactions by category
  const byCat: Record<string, number> = {};
  (transactions || []).forEach((t) => {
    const cat = t.category || "uncategorised";
    byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount);
  });

  if (Object.keys(byCat).length > 0) {
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    sections.push(
      "SPENDING BY CATEGORY (last 60 days):\n" +
        sorted
          .slice(0, 10)
          .map(([cat, amt]) => `- ${cat}: $${(amt / 100).toFixed(0)}`)
          .join("\n")
    );
  }

  if ((expenses || []).length > 0) {
    sections.push(
      "BUDGETED EXPENSES:\n" +
        (expenses || [])
          .slice(0, 10)
          .map(
            (e) =>
              `- ${e.category}: $${(e.amount / 100).toFixed(0)}/${e.frequency}`
          )
          .join("\n")
    );
  }

  if ((income || []).length > 0) {
    sections.push(
      "INCOME STREAMS:\n" +
        (income || [])
          .map(
            (i) =>
              `- ${i.name}: $${(i.amount / 100).toFixed(0)}/${i.frequency}`
          )
          .join("\n")
    );
  }

  return sections.join("\n\n") || "No spending data available.";
}

export async function buildJournalContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const [{ data: entries }, { data: habits }, { data: habitLogs }] =
    await Promise.all([
      supabase
        .from("journal_entries")
        .select("date, mood, energy, gratitude, reflection, wins")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(3),
      supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", userId)
        .eq("active", true),
      supabase
        .from("habit_logs")
        .select("habit_id, date")
        .eq("user_id", userId)
        .gte(
          "date",
          toDateStr(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          )
        ),
    ]);

  const sections: string[] = [];

  const moodMap: Record<number, string> = {
    1: "😞",
    2: "😐",
    3: "🙂",
    4: "😊",
    5: "🤩",
  };

  if ((entries || []).length > 0) {
    sections.push(
      "RECENT JOURNAL ENTRIES:\n" +
        (entries || [])
          .map((e) => {
            const parts = [`${e.date} — mood: ${moodMap[e.mood] || "?"}, energy: ${e.energy}/5`];
            if (e.gratitude) parts.push(`  Gratitude: ${e.gratitude.slice(0, 100)}`);
            if (e.reflection) parts.push(`  Reflection: ${e.reflection.slice(0, 100)}`);
            if (e.wins) parts.push(`  Wins: ${e.wins.slice(0, 100)}`);
            return parts.join("\n");
          })
          .join("\n\n")
    );
  }

  // Find struggling habits (< 50% this week)
  if ((habits || []).length > 0) {
    const logs = habitLogs || [];
    const struggling = (habits || []).filter((h) => {
      const count = logs.filter((l) => l.habit_id === h.id).length;
      return count < 4; // less than ~50% of 7 days
    });
    if (struggling.length > 0) {
      sections.push(
        "HABITS NEEDING ATTENTION (< 50% this week):\n" +
          struggling.map((h) => `- ${h.name}`).join("\n")
      );
    }
  }

  return sections.join("\n\n") || "No journal data available.";
}
