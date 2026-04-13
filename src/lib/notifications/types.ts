export type RuleType =
  | "morning_checkin"
  | "habit_reminder"
  | "journal_prompt"
  | "weekly_review"
  | "daily_summary"
  | "streak_at_risk"
  | "goal_deadline"
  | "task_overdue"
  | "task_reminder"
  | "sync_event";

export type Channel = "push" | "telegram" | "inapp";

export interface NotificationPreferences {
  user_id: string;
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  push_enabled: boolean;
  telegram_enabled: boolean;
  inapp_enabled: boolean;
  push_subscription: Record<string, unknown> | null;
  telegram_chat_id: string | null;
}

export interface NotificationRule {
  id: number;
  user_id: string;
  rule_type: RuleType;
  enabled: boolean;
  time: string | null;
  day_of_week: number | null;
  channels: Channel[];
  last_fired_at: string | null;
}

export interface Notification {
  id: number;
  user_id: string;
  rule_type: string;
  channel: Channel;
  title: string;
  body: string;
  link: string | null;
  entity_id: string | null;
  read: boolean;
  snoozed_until: string | null;
  telegram_message_id: number | null;
  created_at: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  link?: string;
  entity_id?: string;
  rule_type: RuleType;
}

export const TIMED_RULES: RuleType[] = [
  "morning_checkin",
  "habit_reminder",
  "journal_prompt",
  "weekly_review",
  "daily_summary",
];

export const DATA_RULES: RuleType[] = [
  "streak_at_risk",
  "goal_deadline",
  "task_overdue",
  "task_reminder",
];

export const RULE_LABELS: Record<RuleType, { name: string; description: string; link: string }> = {
  morning_checkin: { name: "Morning Check-in", description: "Remind to log weight, sleep, HRV", link: "/workouts" },
  habit_reminder: { name: "Habit Reminder", description: "Remind to complete today's habits", link: "/habits" },
  journal_prompt: { name: "Journal Prompt", description: "Remind to write journal entry", link: "/journal" },
  weekly_review: { name: "Weekly Review", description: "Remind to complete weekly review", link: "/review" },
  daily_summary: { name: "Daily Summary", description: "End-of-day digest", link: "/" },
  streak_at_risk: { name: "Streak at Risk", description: "Habit streak may break if not logged today", link: "/habits" },
  goal_deadline: { name: "Goal Deadline", description: "Goal target date approaching", link: "/goals" },
  task_overdue: { name: "Task Overdue", description: "Task past its due date", link: "/tasks" },
  task_reminder: { name: "Task Reminder", description: "Pre-due-date reminder for a task", link: "/tasks" },
  sync_event: { name: "Sync Events", description: "Import and sync completion alerts", link: "/settings" },
};
