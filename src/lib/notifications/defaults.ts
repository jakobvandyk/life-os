import { type RuleType, type Channel } from "./types";

interface DefaultRule {
  rule_type: RuleType;
  enabled: boolean;
  time: string | null;
  day_of_week: number | null;
  channels: Channel[];
}

export const DEFAULT_RULES: DefaultRule[] = [
  { rule_type: "morning_checkin", enabled: true, time: "07:00", day_of_week: null, channels: ["push"] },
  { rule_type: "habit_reminder", enabled: true, time: "20:00", day_of_week: null, channels: ["push"] },
  { rule_type: "journal_prompt", enabled: true, time: "21:00", day_of_week: null, channels: ["push"] },
  { rule_type: "weekly_review", enabled: true, time: "18:00", day_of_week: 0, channels: ["push", "telegram"] },
  { rule_type: "daily_summary", enabled: true, time: "21:30", day_of_week: null, channels: ["telegram"] },
  { rule_type: "streak_at_risk", enabled: true, time: null, day_of_week: null, channels: ["telegram", "inapp"] },
  { rule_type: "goal_deadline", enabled: true, time: null, day_of_week: null, channels: ["inapp"] },
  { rule_type: "task_overdue", enabled: true, time: null, day_of_week: null, channels: ["inapp"] },
  { rule_type: "task_reminder", enabled: true, time: null, day_of_week: null, channels: ["push", "inapp"] },
  { rule_type: "sync_event", enabled: true, time: null, day_of_week: null, channels: ["inapp"] },
];

export async function seedDefaultRules(
  supabase: { from: (table: string) => { upsert: (data: unknown, opts?: { onConflict: string }) => Promise<{ error: unknown }> } },
  userId: string
): Promise<void> {
  await supabase.from("notification_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  const rows = DEFAULT_RULES.map((r) => ({ user_id: userId, ...r }));
  await supabase.from("notification_rules")
    .upsert(rows, { onConflict: "user_id,rule_type" });
}
