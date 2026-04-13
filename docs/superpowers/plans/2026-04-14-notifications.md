# Life OS Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable notification system with Web Push, Telegram, and in-app channels — supporting timed reminders, data-driven alerts, daily summaries, per-task reminders, Telegram reply commands, inline keyboards for habit completion, and snooze across all channels.

**Architecture:** Vercel cron (every 15min) evaluates notification rules in user's timezone, dispatches to enabled channels. Telegram bot webhook handles pairing + reply commands + inline keyboard callbacks. In-app bell component polls for unread notifications. Snooze endpoint supports re-firing from all three channels.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL + RLS), `web-push` npm package (VAPID), Telegram Bot API, Service Worker Push API

**Spec:** `docs/superpowers/specs/2026-04-14-notifications-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| Supabase migrations | Create | 4 new tables + 1 column |
| `src/lib/notifications/types.ts` | Create | Shared types and constants for notification system |
| `src/lib/notifications/defaults.ts` | Create | Default rule definitions, seed function |
| `src/lib/notifications/channels.ts` | Create | sendPush(), sendTelegram(), writeInApp() |
| `src/lib/notifications/evaluate.ts` | Create | Rule evaluation — timed checks, data queries, dedup |
| `src/lib/notifications/summary.ts` | Create | Build daily summary content |
| `src/app/api/cron/notifications/route.ts` | Create | Cron endpoint — orchestrates evaluation + dispatch |
| `src/app/api/notifications/snooze/route.ts` | Create | Snooze endpoint |
| `src/app/api/integrations/telegram/route.ts` | Create | Telegram webhook — pairing, commands, callbacks |
| `src/components/NotificationBell.tsx` | Create | Sidebar bell + dropdown |
| `src/app/layout.tsx` | Modify | Add NotificationBell |
| `src/app/settings/page.tsx` | Modify | Add Notifications section |
| `src/app/tasks/page.tsx` | Modify | Add reminder_before to task form |
| `public/sw.js` | Modify | Add push + notificationclick handlers |
| `vercel.json` | Modify | Add notifications cron |
| `CLAUDE.md` | Modify | Document notification system |

---

### Task 1: Database migrations

**Files:**
- Supabase migrations (4 new tables + 1 column modification)

- [ ] **Step 1: Create notification_preferences table**

```sql
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Pacific/Auckland',
  quiet_start time NOT NULL DEFAULT '22:00',
  quiet_end time NOT NULL DEFAULT '07:00',
  push_enabled boolean NOT NULL DEFAULT false,
  telegram_enabled boolean NOT NULL DEFAULT false,
  inapp_enabled boolean NOT NULL DEFAULT true,
  push_subscription jsonb,
  telegram_chat_id text
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Run via `mcp__supabase__apply_migration` with name `create_notification_preferences`.

- [ ] **Step 2: Create notification_rules table**

```sql
CREATE TABLE notification_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  time time,
  day_of_week smallint,
  channels text[] NOT NULL DEFAULT '{}',
  last_fired_at timestamptz,
  UNIQUE (user_id, rule_type)
);

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rules" ON notification_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Run via `mcp__supabase__apply_migration` with name `create_notification_rules`.

- [ ] **Step 3: Create notifications table**

```sql
CREATE TABLE notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  entity_id text,
  read boolean NOT NULL DEFAULT false,
  snoozed_until timestamptz,
  telegram_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notifications_unread ON notifications (user_id, read, created_at DESC);
CREATE INDEX idx_notifications_dedup ON notifications (user_id, rule_type, entity_id, created_at);
```

Run via `mcp__supabase__apply_migration` with name `create_notifications`.

- [ ] **Step 4: Create telegram_pairing_codes table**

```sql
CREATE TABLE telegram_pairing_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
```

No RLS — accessed by service role from webhook.

Run via `mcp__supabase__apply_migration` with name `create_telegram_pairing_codes`.

- [ ] **Step 5: Add reminder_before to tasks**

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_before interval;
```

Run via `mcp__supabase__apply_migration` with name `add_reminder_before_to_tasks`.

- [ ] **Step 6: Verify all tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notification_preferences', 'notification_rules', 'notifications', 'telegram_pairing_codes')
ORDER BY table_name;
```

Expected: 4 rows.

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'reminder_before';
```

Expected: 1 row.

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "feat: add notification system database tables"
```

---

### Task 2: Shared types and default rule definitions

**Files:**
- Create: `src/lib/notifications/types.ts`
- Create: `src/lib/notifications/defaults.ts`

- [ ] **Step 1: Create types module**

Create `src/lib/notifications/types.ts`:

```typescript
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

/** Human-readable labels for rule types */
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
```

- [ ] **Step 2: Create defaults module**

Create `src/lib/notifications/defaults.ts`:

```typescript
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

/**
 * Seed default notification rules for a user.
 * Called on first visit to notification settings (lazy init).
 * Only inserts rules that don't already exist (ON CONFLICT DO NOTHING).
 */
export async function seedDefaultRules(
  supabase: { from: (table: string) => unknown },
  userId: string
): Promise<void> {
  // Ensure preferences row exists
  await (supabase.from("notification_preferences") as ReturnType<typeof import("@/lib/supabase").supabase.from>)
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  // Insert default rules (skip existing)
  const rows = DEFAULT_RULES.map((r) => ({ user_id: userId, ...r }));
  await (supabase.from("notification_rules") as ReturnType<typeof import("@/lib/supabase").supabase.from>)
    .upsert(rows, { onConflict: "user_id,rule_type" });
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/types.ts src/lib/notifications/defaults.ts
git commit -m "feat: add notification types and default rule definitions"
```

---

### Task 3: Channel dispatch functions

**Files:**
- Create: `src/lib/notifications/channels.ts`

- [ ] **Step 1: Create channels module**

Create `src/lib/notifications/channels.ts`:

```typescript
import { type Channel, type NotificationPayload, type NotificationPreferences } from "./types";

// Dynamic import web-push only on server side
async function getWebPush() {
  const wp = await import("web-push");
  wp.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
  return wp;
}

/**
 * Send a Web Push notification.
 * Returns the Supabase notification ID if writeInApp was also called, or null.
 */
export async function sendPush(
  subscription: Record<string, unknown>,
  payload: NotificationPayload,
  notificationId?: number
): Promise<void> {
  const wp = await getWebPush();
  await wp.sendNotification(
    subscription as unknown as import("web-push").PushSubscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link,
      notificationId,
    })
  );
}

/**
 * Send a Telegram message.
 * Returns the message_id from Telegram's response (for snooze reply matching).
 */
export async function sendTelegram(
  chatId: string,
  payload: NotificationPayload,
  replyMarkup?: Record<string, unknown>
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: payload.body,
    parse_mode: "Markdown",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.result?.message_id ?? null;
}

/**
 * Reply to a Telegram chat (for bot commands).
 */
export async function replyTelegram(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

/**
 * Answer a Telegram callback query (dismiss button spinner).
 */
export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

/**
 * Edit a Telegram message's reply markup (update inline keyboard after button press).
 */
export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup: Record<string, unknown>
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
  });
}

/**
 * Write an in-app notification to the database.
 * Returns the notification ID.
 */
export async function writeInApp(
  supabase: { from: (table: string) => unknown },
  userId: string,
  payload: NotificationPayload,
  extra?: { telegram_message_id?: number }
): Promise<number | null> {
  const { data } = await (supabase.from("notifications") as ReturnType<typeof import("@/lib/supabase").supabase.from>)
    .insert({
      user_id: userId,
      rule_type: payload.rule_type,
      channel: "inapp" as const,
      title: payload.title,
      body: payload.body,
      link: payload.link || null,
      entity_id: payload.entity_id || null,
      telegram_message_id: extra?.telegram_message_id || null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

/**
 * Dispatch a notification to all enabled channels for a rule.
 * Respects quiet hours (push + telegram suppressed during quiet).
 */
export async function dispatch(
  supabase: { from: (table: string) => unknown },
  prefs: NotificationPreferences,
  enabledChannels: Channel[],
  payload: NotificationPayload,
  isQuietHours: boolean,
  replyMarkup?: Record<string, unknown>
): Promise<void> {
  let telegramMsgId: number | null = null;
  let inappId: number | null = null;

  for (const channel of enabledChannels) {
    // Skip push/telegram during quiet hours
    if (isQuietHours && (channel === "push" || channel === "telegram")) continue;
    // Skip channels not enabled at preference level
    if (channel === "push" && (!prefs.push_enabled || !prefs.push_subscription)) continue;
    if (channel === "telegram" && (!prefs.telegram_enabled || !prefs.telegram_chat_id)) continue;
    if (channel === "inapp" && !prefs.inapp_enabled) continue;

    if (channel === "inapp") {
      inappId = await writeInApp(supabase, prefs.user_id, payload);
    } else if (channel === "telegram" && prefs.telegram_chat_id) {
      telegramMsgId = await sendTelegram(prefs.telegram_chat_id, payload, replyMarkup);
      // Also log to notifications table for telegram (for snooze matching)
      await (supabase.from("notifications") as ReturnType<typeof import("@/lib/supabase").supabase.from>)
        .insert({
          user_id: prefs.user_id,
          rule_type: payload.rule_type,
          channel: "telegram",
          title: payload.title,
          body: payload.body,
          link: payload.link || null,
          entity_id: payload.entity_id || null,
          telegram_message_id: telegramMsgId,
        });
    } else if (channel === "push" && prefs.push_subscription) {
      // Write inapp first to get notification ID for snooze
      if (!inappId) {
        inappId = await writeInApp(supabase, prefs.user_id, payload);
      }
      await sendPush(prefs.push_subscription, payload, inappId ?? undefined).catch(() => {
        // Push failed (subscription expired, etc.) — continue silently
      });
      // Log push to notifications table
      await (supabase.from("notifications") as ReturnType<typeof import("@/lib/supabase").supabase.from>)
        .insert({
          user_id: prefs.user_id,
          rule_type: payload.rule_type,
          channel: "push",
          title: payload.title,
          body: payload.body,
          link: payload.link || null,
          entity_id: payload.entity_id || null,
        });
    }
  }
}
```

- [ ] **Step 2: Install web-push package**

```bash
cd /Users/Jen/life-os/dashboard && npm install web-push && npm install -D @types/web-push
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/channels.ts package.json package-lock.json
git commit -m "feat: add notification channel dispatch functions (push, telegram, inapp)"
```

---

### Task 4: Daily summary builder

**Files:**
- Create: `src/lib/notifications/summary.ts`

- [ ] **Step 1: Create summary module**

Create `src/lib/notifications/summary.ts`:

```typescript
import { type NotificationPayload } from "./types";

interface SummaryData {
  habitsCompleted: number;
  habitsTotal: number;
  streaksAtRisk: string[];
  steps: number | null;
  activeCals: number | null;
  weight: number | null;
  weightAvg7d: number | null;
  mood: number | null;
  energy: number | null;
  tasksCompleted: number;
  tasksRemaining: number;
}

/**
 * Build daily summary from the day's data.
 */
export async function buildDailySummary(
  supabase: { from: (table: string) => unknown },
  userId: string,
  date: string
): Promise<NotificationPayload> {
  const db = supabase as { from: (t: string) => ReturnType<typeof import("@/lib/supabase").supabase.from> };

  // Habits
  const { data: habits } = await db.from("habits")
    .select("id, name")
    .eq("user_id", userId)
    .eq("active", true);

  const { data: habitLogs } = await db.from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("date", date);

  const loggedIds = new Set((habitLogs || []).map((l: { habit_id: number }) => l.habit_id));
  const habitsCompleted = loggedIds.size;
  const habitsTotal = (habits || []).length;

  // Streaks at risk — habits with logs in the last 3+ days but not today
  // (Simplified: just list incomplete habits for today)
  const streaksAtRisk = (habits || [])
    .filter((h: { id: number; name: string }) => !loggedIds.has(h.id))
    .map((h: { id: number; name: string }) => h.name);

  // Checkin data
  const { data: checkin } = await db.from("workout_checkins")
    .select("steps, active_calories, weight")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  // 7-day weight average
  const { data: recentCheckins } = await db.from("workout_checkins")
    .select("weight")
    .eq("user_id", userId)
    .not("weight", "is", null)
    .order("date", { ascending: false })
    .limit(7);

  const weights = (recentCheckins || [])
    .map((c: { weight: number | null }) => c.weight)
    .filter((w: number | null): w is number => w != null);
  const weightAvg7d = weights.length > 0 ? weights.reduce((a: number, b: number) => a + b, 0) / weights.length : null;

  // Journal
  const { data: journal } = await db.from("journal_entries")
    .select("mood, energy")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  // Tasks
  const { data: tasks } = await db.from("tasks")
    .select("status")
    .eq("user_id", userId);
  const tasksCompleted = (tasks || []).filter((t: { status: string }) => t.status === "done").length;
  const tasksRemaining = (tasks || []).filter((t: { status: string }) => t.status !== "done").length;

  const summary: SummaryData = {
    habitsCompleted,
    habitsTotal,
    streaksAtRisk,
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
  if (s.streaksAtRisk.length > 0 && s.streaksAtRisk.length <= 5) {
    lines.push(`Remaining: ${s.streaksAtRisk.join(", ")}`);
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

/**
 * Get incomplete habits for inline keyboard buttons.
 */
export async function getIncompleteHabits(
  supabase: { from: (table: string) => unknown },
  userId: string,
  date: string
): Promise<Array<{ id: number; name: string }>> {
  const db = supabase as { from: (t: string) => ReturnType<typeof import("@/lib/supabase").supabase.from> };

  const { data: habits } = await db.from("habits")
    .select("id, name")
    .eq("user_id", userId)
    .eq("active", true);

  const { data: logs } = await db.from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("date", date);

  const loggedIds = new Set((logs || []).map((l: { habit_id: number }) => l.habit_id));
  return (habits || []).filter((h: { id: number; name: string }) => !loggedIds.has(h.id));
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/summary.ts
git commit -m "feat: add daily summary builder and incomplete habits query"
```

---

### Task 5: Rule evaluation logic

**Files:**
- Create: `src/lib/notifications/evaluate.ts`

- [ ] **Step 1: Create evaluation module**

Create `src/lib/notifications/evaluate.ts`:

```typescript
import { type NotificationRule, type NotificationPayload, type NotificationPreferences, RULE_LABELS } from "./types";
import { buildDailySummary, getIncompleteHabits } from "./summary";

/**
 * Check if a time (HH:MM) falls within a 15-minute window of the target time.
 */
function isInTimeWindow(currentTime: string, targetTime: string): boolean {
  const [ch, cm] = currentTime.split(":").map(Number);
  const [th, tm] = targetTime.split(":").map(Number);
  const currentMin = ch * 60 + cm;
  const targetMin = th * 60 + tm;
  return currentMin >= targetMin && currentMin < targetMin + 15;
}

/**
 * Check if current time is within quiet hours.
 */
export function isInQuietHours(currentTime: string, quietStart: string, quietEnd: string): boolean {
  const [ch, cm] = currentTime.split(":").map(Number);
  const [sh, sm] = quietStart.split(":").map(Number);
  const [eh, em] = quietEnd.split(":").map(Number);
  const cur = ch * 60 + cm;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  if (start <= end) {
    // Same day window (e.g., 09:00 - 17:00)
    return cur >= start && cur < end;
  }
  // Overnight window (e.g., 22:00 - 07:00)
  return cur >= start || cur < end;
}

/**
 * Check if a timed rule should fire now.
 */
function shouldFireTimedRule(
  rule: NotificationRule,
  currentTime: string,
  currentDayOfWeek: number,
  todayDate: string
): boolean {
  if (!rule.time) return false;

  // weekly_review: check day of week
  if (rule.rule_type === "weekly_review") {
    if (rule.day_of_week != null && currentDayOfWeek !== rule.day_of_week) return false;
  }

  // Check time window
  if (!isInTimeWindow(currentTime, rule.time)) return false;

  // Check last_fired_at deduplication
  if (rule.last_fired_at) {
    const lastFired = rule.last_fired_at.substring(0, 10);
    if (rule.rule_type === "weekly_review") {
      // Check if fired this week (within last 6 days)
      const lastDate = new Date(lastFired);
      const today = new Date(todayDate);
      const diffDays = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 6) return false;
    } else {
      if (lastFired === todayDate) return false;
    }
  }

  return true;
}

/**
 * Evaluate all rules for a user and return notifications to dispatch.
 */
export async function evaluateRules(
  supabase: { from: (table: string) => unknown },
  prefs: NotificationPreferences,
  rules: NotificationRule[],
  currentTime: string,
  currentDayOfWeek: number,
  todayDate: string
): Promise<Array<{
  rule: NotificationRule;
  payload: NotificationPayload;
  replyMarkup?: Record<string, unknown>;
}>> {
  const db = supabase as { from: (t: string) => ReturnType<typeof import("@/lib/supabase").supabase.from> };
  const results: Array<{
    rule: NotificationRule;
    payload: NotificationPayload;
    replyMarkup?: Record<string, unknown>;
  }> = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const label = RULE_LABELS[rule.rule_type];

    // --- Timed rules ---
    if (rule.time != null) {
      if (!shouldFireTimedRule(rule, currentTime, currentDayOfWeek, todayDate)) continue;

      if (rule.rule_type === "daily_summary") {
        const summaryPayload = await buildDailySummary(supabase, prefs.user_id, todayDate);
        const incomplete = await getIncompleteHabits(supabase, prefs.user_id, todayDate);
        const replyMarkup = incomplete.length > 0
          ? { inline_keyboard: incomplete.map((h) => [{ text: `✓ ${h.name}`, callback_data: `habit_done:${h.id}` }]) }
          : undefined;
        results.push({ rule, payload: summaryPayload, replyMarkup });
      } else if (rule.rule_type === "habit_reminder") {
        const incomplete = await getIncompleteHabits(supabase, prefs.user_id, todayDate);
        if (incomplete.length === 0) continue; // All done, skip reminder
        const replyMarkup = { inline_keyboard: incomplete.map((h) => [{ text: `✓ ${h.name}`, callback_data: `habit_done:${h.id}` }]) };
        results.push({
          rule,
          payload: {
            title: label.name,
            body: `${incomplete.length} habit${incomplete.length === 1 ? "" : "s"} remaining: ${incomplete.map((h) => h.name).join(", ")}`,
            link: label.link,
            rule_type: rule.rule_type,
          },
          replyMarkup,
        });
      } else {
        results.push({
          rule,
          payload: { title: label.name, body: label.description, link: label.link, rule_type: rule.rule_type },
        });
      }
      continue;
    }

    // --- Data-driven rules ---
    if (rule.rule_type === "streak_at_risk") {
      // Only check after 15:00 user time
      const [h] = currentTime.split(":").map(Number);
      if (h < 15) continue;

      // Already fired today?
      const { data: existing } = await db.from("notifications")
        .select("id")
        .eq("user_id", prefs.user_id)
        .eq("rule_type", "streak_at_risk")
        .gte("created_at", todayDate + "T00:00:00")
        .limit(1);
      if (existing && existing.length > 0) continue;

      const incomplete = await getIncompleteHabits(supabase, prefs.user_id, todayDate);
      // TODO: Could filter to only habits with streak > 3, but for v1 all incomplete is fine
      if (incomplete.length === 0) continue;

      results.push({
        rule,
        payload: {
          title: "Streak at Risk",
          body: `${incomplete.length} habit${incomplete.length === 1 ? "" : "s"} not logged yet: ${incomplete.map((h) => h.name).join(", ")}`,
          link: "/habits",
          rule_type: "streak_at_risk",
        },
      });
    }

    if (rule.rule_type === "goal_deadline") {
      const sevenDaysFromNow = new Date(todayDate);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const cutoff = sevenDaysFromNow.toISOString().substring(0, 10);

      const { data: goals } = await db.from("goals")
        .select("id, title, target_date")
        .eq("user_id", prefs.user_id)
        .neq("status", "completed")
        .not("target_date", "is", null)
        .lte("target_date", cutoff)
        .gte("target_date", todayDate);

      for (const goal of goals || []) {
        // Dedup: check if already notified for this goal today
        const { data: existing } = await db.from("notifications")
          .select("id")
          .eq("user_id", prefs.user_id)
          .eq("rule_type", "goal_deadline")
          .eq("entity_id", String(goal.id))
          .gte("created_at", todayDate + "T00:00:00")
          .limit(1);
        if (existing && existing.length > 0) continue;

        const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - new Date(todayDate).getTime()) / (1000 * 60 * 60 * 24));
        results.push({
          rule,
          payload: {
            title: "Goal Deadline",
            body: `"${goal.title}" is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
            link: "/goals",
            rule_type: "goal_deadline",
            entity_id: String(goal.id),
          },
        });
      }
    }

    if (rule.rule_type === "task_overdue") {
      const { data: overdueTasks } = await db.from("tasks")
        .select("id, title")
        .eq("user_id", prefs.user_id)
        .neq("status", "done")
        .not("due_date", "is", null)
        .lt("due_date", todayDate);

      for (const task of overdueTasks || []) {
        const { data: existing } = await db.from("notifications")
          .select("id")
          .eq("user_id", prefs.user_id)
          .eq("rule_type", "task_overdue")
          .eq("entity_id", String(task.id))
          .gte("created_at", todayDate + "T00:00:00")
          .limit(1);
        if (existing && existing.length > 0) continue;

        results.push({
          rule,
          payload: {
            title: "Task Overdue",
            body: `"${task.title}" is past its due date`,
            link: "/tasks",
            rule_type: "task_overdue",
            entity_id: String(task.id),
          },
        });
      }
    }

    if (rule.rule_type === "task_reminder") {
      const { data: reminderTasks } = await db.from("tasks")
        .select("id, title, due_date, reminder_before")
        .eq("user_id", prefs.user_id)
        .neq("status", "done")
        .not("due_date", "is", null)
        .not("reminder_before", "is", null);

      const now = new Date();
      for (const task of reminderTasks || []) {
        // Parse interval — Postgres returns interval as a string like "1 day" or "02:00:00"
        const dueDate = new Date(task.due_date + "T00:00:00");
        const reminderTime = subtractInterval(dueDate, task.reminder_before);
        if (now < reminderTime) continue; // Not yet time
        if (now > dueDate) continue; // Past due, task_overdue handles this

        const { data: existing } = await db.from("notifications")
          .select("id")
          .eq("user_id", prefs.user_id)
          .eq("rule_type", "task_reminder")
          .eq("entity_id", String(task.id))
          .limit(1);
        if (existing && existing.length > 0) continue;

        const label = formatInterval(task.reminder_before);
        results.push({
          rule,
          payload: {
            title: "Task Reminder",
            body: `"${task.title}" is due in ${label}`,
            link: "/tasks",
            rule_type: "task_reminder",
            entity_id: String(task.id),
          },
        });
      }
    }
  }

  return results;
}

/**
 * Parse a Postgres interval string and subtract from a date.
 * Handles: "HH:MM:SS", "N days", "N days HH:MM:SS", "N hours", "N minutes"
 */
function subtractInterval(date: Date, interval: string): Date {
  const result = new Date(date);
  const parts = interval.toLowerCase().trim();

  // Match patterns like "7 days", "1 day", "2 hours", "30 minutes", "1 week", "01:00:00"
  const dayMatch = parts.match(/(\d+)\s*day/);
  const hourMatch = parts.match(/(\d+)\s*hour/);
  const minMatch = parts.match(/(\d+)\s*min/);
  const weekMatch = parts.match(/(\d+)\s*week/);
  const timeMatch = parts.match(/^(\d{2}):(\d{2}):(\d{2})$/);

  if (weekMatch) result.setDate(result.getDate() - parseInt(weekMatch[1]) * 7);
  if (dayMatch) result.setDate(result.getDate() - parseInt(dayMatch[1]));
  if (hourMatch) result.setHours(result.getHours() - parseInt(hourMatch[1]));
  if (minMatch) result.setMinutes(result.getMinutes() - parseInt(minMatch[1]));
  if (timeMatch) {
    result.setHours(result.getHours() - parseInt(timeMatch[1]));
    result.setMinutes(result.getMinutes() - parseInt(timeMatch[2]));
  }

  return result;
}

/**
 * Format a Postgres interval string for human display.
 */
function formatInterval(interval: string): string {
  const parts = interval.toLowerCase().trim();
  const weekMatch = parts.match(/(\d+)\s*week/);
  const dayMatch = parts.match(/(\d+)\s*day/);
  const hourMatch = parts.match(/(\d+)\s*hour/);
  const minMatch = parts.match(/(\d+)\s*min/);
  const timeMatch = parts.match(/^(\d{2}):(\d{2}):(\d{2})$/);

  if (weekMatch) return `${weekMatch[1]} week${weekMatch[1] === "1" ? "" : "s"}`;
  if (dayMatch) return `${dayMatch[1]} day${dayMatch[1] === "1" ? "" : "s"}`;
  if (hourMatch) return `${hourMatch[1]} hour${hourMatch[1] === "1" ? "" : "s"}`;
  if (minMatch) return `${minMatch[1]} minute${minMatch[1] === "1" ? "" : "s"}`;
  if (timeMatch) {
    const h = parseInt(timeMatch[1]);
    const m = parseInt(timeMatch[2]);
    if (h > 0) return `${h} hour${h === 1 ? "" : "s"}`;
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  return interval;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/evaluate.ts
git commit -m "feat: add notification rule evaluation logic"
```

---

### Task 6: Cron endpoint

**Files:**
- Create: `src/app/api/cron/notifications/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron endpoint**

Create `src/app/api/cron/notifications/route.ts`:

```typescript
import { getServiceClient } from "@/lib/supabase-service";
import { type NotificationPreferences, type NotificationRule } from "@/lib/notifications/types";
import { evaluateRules } from "@/lib/notifications/evaluate";
import { dispatch, isInQuietHours } from "@/lib/notifications/evaluate";
import { dispatch as dispatchNotification } from "@/lib/notifications/channels";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  // Load all users with notification preferences
  const { data: allPrefs } = await db.from("notification_preferences").select("*");
  if (!allPrefs || allPrefs.length === 0) {
    return Response.json({ message: "No users with notification preferences" });
  }

  let totalDispatched = 0;

  for (const prefs of allPrefs as NotificationPreferences[]) {
    // Calculate current time in user's timezone
    const now = new Date();
    const userTime = now.toLocaleTimeString("en-GB", { timeZone: prefs.timezone, hour: "2-digit", minute: "2-digit" });
    const userDate = now.toLocaleDateString("en-CA", { timeZone: prefs.timezone }); // YYYY-MM-DD
    const userDayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: prefs.timezone })).getDay();

    // Check quiet hours
    const quiet = isInQuietHours(userTime, prefs.quiet_start, prefs.quiet_end);

    // Load user's rules
    const { data: rules } = await db.from("notification_rules")
      .select("*")
      .eq("user_id", prefs.user_id);
    if (!rules || rules.length === 0) continue;

    // Check for snoozed notifications to re-fire
    const { data: snoozed } = await db.from("notifications")
      .select("*")
      .eq("user_id", prefs.user_id)
      .not("snoozed_until", "is", null)
      .lte("snoozed_until", now.toISOString());

    for (const notif of snoozed || []) {
      // Re-fire to original channel
      await dispatchNotification(
        db,
        prefs,
        [notif.channel],
        { title: notif.title, body: notif.body, link: notif.link, rule_type: notif.rule_type },
        quiet
      );
      // Clear snooze
      await db.from("notifications").update({ snoozed_until: null, read: false }).eq("id", notif.id);
      totalDispatched++;
    }

    // Evaluate rules
    const toFire = await evaluateRules(
      db,
      prefs,
      rules as NotificationRule[],
      userTime,
      userDayOfWeek,
      userDate
    );

    for (const { rule, payload, replyMarkup } of toFire) {
      await dispatchNotification(db, prefs, rule.channels, payload, quiet, replyMarkup);

      // Update last_fired_at
      await db.from("notification_rules")
        .update({ last_fired_at: now.toISOString() })
        .eq("id", rule.id);

      totalDispatched++;
    }
  }

  return Response.json({ dispatched: totalDispatched });
}
```

- [ ] **Step 2: Update vercel.json**

Replace the contents of `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/sync/binance", "schedule": "0 8 * * *" },
    { "path": "/api/cron/notifications", "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 3: Fix import — isInQuietHours is in evaluate.ts, dispatch is in channels.ts**

The cron imports both. Make sure the import at the top is:

```typescript
import { isInQuietHours } from "@/lib/notifications/evaluate";
import { dispatch as dispatchNotification } from "@/lib/notifications/channels";
```

Remove the duplicate `dispatch` import.

- [ ] **Step 4: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/notifications/route.ts vercel.json
git commit -m "feat: add notification cron endpoint (every 15min)"
```

---

### Task 7: Snooze API endpoint

**Files:**
- Create: `src/app/api/notifications/snooze/route.ts`

- [ ] **Step 1: Create snooze endpoint**

Create `src/app/api/notifications/snooze/route.ts`:

```typescript
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notification_id: number; duration_minutes: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { notification_id, duration_minutes } = body;
  if (!notification_id || !duration_minutes) {
    return Response.json({ error: "notification_id and duration_minutes required" }, { status: 400 });
  }

  const snoozedUntil = new Date(Date.now() + duration_minutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({ snoozed_until: snoozedUntil, read: false })
    .eq("id", notification_id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, snoozed_until: snoozedUntil });
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/snooze/route.ts
git commit -m "feat: add notification snooze endpoint"
```

---

### Task 8: Service worker push handlers

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Add push and notificationclick handlers**

Append to the end of `public/sw.js` (after the existing fetch handler):

```javascript

// --- Push Notifications ---

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Life OS", {
      body: data.body,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { link: data.link, notificationId: data.notificationId },
      actions: [
        { action: "open", title: "Open" },
        { action: "snooze", title: "Snooze 1h" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { link, notificationId } = event.notification.data || {};

  if (event.action === "snooze" && notificationId) {
    event.waitUntil(
      fetch("/api/notifications/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notificationId, duration_minutes: 60 }),
      })
    );
    return;
  }

  const target = link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: add push notification handlers to service worker"
```

---

### Task 9: Telegram webhook

**Files:**
- Create: `src/app/api/integrations/telegram/route.ts`

This handles: pairing (`/start`, `/pair`), reply commands (`/done`, `/mood`, `/energy`, `/snooze`, `/help`), and callback queries (inline keyboard habit completion).

- [ ] **Step 1: Create Telegram webhook endpoint**

Create `src/app/api/integrations/telegram/route.ts`:

```typescript
import { getServiceClient } from "@/lib/supabase-service";
import { replyTelegram, answerCallbackQuery, editMessageReplyMarkup } from "@/lib/notifications/channels";

export async function POST(request: Request) {
  // Verify Telegram webhook secret
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  let update: Record<string, unknown>;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Handle callback queries (inline keyboard button presses) ---
  if (update.callback_query) {
    const cq = update.callback_query as {
      id: string;
      from: { id: number };
      message: { chat: { id: number }; message_id: number; reply_markup?: Record<string, unknown> };
      data: string;
    };
    const chatId = cq.message.chat.id;
    const callbackData = cq.data;

    // Look up user by chat_id
    const { data: pref } = await db.from("notification_preferences")
      .select("user_id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();
    if (!pref) {
      await answerCallbackQuery(cq.id, "Not connected to Life OS");
      return Response.json({ ok: true });
    }

    if (callbackData.startsWith("habit_done:")) {
      const habitId = parseInt(callbackData.split(":")[1]);
      const today = new Date().toISOString().substring(0, 10);

      // Log the habit
      await db.from("habit_logs").upsert(
        { user_id: pref.user_id, habit_id: habitId, date: today, value: 1 },
        { onConflict: "habit_id,date" }
      );

      // Get habit name for confirmation
      const { data: habit } = await db.from("habits")
        .select("name")
        .eq("id", habitId)
        .single();

      await answerCallbackQuery(cq.id, `✓ ${habit?.name || "Habit"} logged!`);

      // Update the inline keyboard — mark this habit as done
      const existingMarkup = cq.message.reply_markup as { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> } | undefined;
      if (existingMarkup?.inline_keyboard) {
        const updatedKeyboard = existingMarkup.inline_keyboard.map((row) =>
          row.map((btn) =>
            btn.callback_data === callbackData
              ? { text: `✅ ${habit?.name || "Done"}`, callback_data: "noop" }
              : btn
          )
        );
        await editMessageReplyMarkup(chatId, cq.message.message_id, { inline_keyboard: updatedKeyboard });
      }
    }

    return Response.json({ ok: true });
  }

  // --- Handle text messages ---
  const message = update.message as {
    chat: { id: number };
    text?: string;
    from?: { id: number; username?: string };
    reply_to_message?: { message_id: number };
  } | undefined;

  if (!message?.text) return Response.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();

  // /start — connection instructions
  if (text === "/start") {
    await replyTelegram(chatId, "Welcome to Life OS Bot!\n\nTo connect, go to Life OS Settings → Notifications → Connect Telegram, then send me the pairing code with:\n`/pair <code>`");
    return Response.json({ ok: true });
  }

  // /pair <code> — link Telegram to Life OS account
  if (text.startsWith("/pair ")) {
    const code = text.substring(6).trim();
    const { data: pairing } = await db.from("telegram_pairing_codes")
      .select("user_id, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!pairing) {
      await replyTelegram(chatId, "Invalid or expired pairing code. Get a new one from Life OS Settings.");
      return Response.json({ ok: true });
    }

    if (new Date(pairing.expires_at) < new Date()) {
      await db.from("telegram_pairing_codes").delete().eq("code", code);
      await replyTelegram(chatId, "That code has expired. Get a new one from Life OS Settings.");
      return Response.json({ ok: true });
    }

    // Save chat_id and enable telegram
    await db.from("notification_preferences")
      .update({ telegram_chat_id: String(chatId), telegram_enabled: true })
      .eq("user_id", pairing.user_id);

    // Delete the pairing code
    await db.from("telegram_pairing_codes").delete().eq("code", code);

    await replyTelegram(chatId, "✓ Connected to Life OS! You'll receive notifications here.");
    return Response.json({ ok: true });
  }

  // --- Authenticated commands (require linked account) ---
  const { data: pref } = await db.from("notification_preferences")
    .select("user_id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();

  if (!pref) {
    await replyTelegram(chatId, "Not connected. Send /start for setup instructions.");
    return Response.json({ ok: true });
  }

  const userId = pref.user_id;
  const today = new Date().toISOString().substring(0, 10);

  // /done <habit>
  if (text.startsWith("/done ")) {
    const query = text.substring(6).trim().toLowerCase();
    const { data: habits } = await db.from("habits")
      .select("id, name")
      .eq("user_id", userId)
      .eq("active", true);

    const matches = (habits || []).filter((h: { id: number; name: string }) =>
      h.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      await replyTelegram(chatId, `No habit found matching "${query}"`);
    } else if (matches.length === 1) {
      await db.from("habit_logs").upsert(
        { user_id: userId, habit_id: matches[0].id, date: today, value: 1 },
        { onConflict: "habit_id,date" }
      );
      // Get streak count
      const { data: logs } = await db.from("habit_logs")
        .select("date")
        .eq("habit_id", matches[0].id)
        .order("date", { ascending: false })
        .limit(30);
      const streak = countStreak(logs || []);
      await replyTelegram(chatId, `✓ *${matches[0].name}* logged! (${streak} day streak)`);
    } else {
      const list = matches.map((h: { id: number; name: string }, i: number) => `${i + 1}. ${h.name}`).join("\n");
      await replyTelegram(chatId, `Multiple matches:\n${list}\n\nBe more specific.`);
    }
    return Response.json({ ok: true });
  }

  // /mood <1-5>
  if (text.startsWith("/mood ")) {
    const val = parseInt(text.substring(6).trim());
    if (isNaN(val) || val < 1 || val > 5) {
      await replyTelegram(chatId, "Usage: /mood <1-5>");
      return Response.json({ ok: true });
    }
    await db.from("journal_entries").upsert(
      { user_id: userId, date: today, mood: val },
      { onConflict: "user_id,date" }
    );
    await replyTelegram(chatId, `✓ Mood set to ${val}/5`);
    return Response.json({ ok: true });
  }

  // /energy <1-5>
  if (text.startsWith("/energy ")) {
    const val = parseInt(text.substring(8).trim());
    if (isNaN(val) || val < 1 || val > 5) {
      await replyTelegram(chatId, "Usage: /energy <1-5>");
      return Response.json({ ok: true });
    }
    await db.from("journal_entries").upsert(
      { user_id: userId, date: today, energy: val },
      { onConflict: "user_id,date" }
    );
    await replyTelegram(chatId, `✓ Energy set to ${val}/5`);
    return Response.json({ ok: true });
  }

  // /snooze <duration> (must be reply to a notification)
  if (text.startsWith("/snooze ")) {
    if (!message.reply_to_message) {
      await replyTelegram(chatId, "Reply to a notification message with /snooze <duration>\nExamples: /snooze 30m, /snooze 1h, /snooze 2h");
      return Response.json({ ok: true });
    }

    const durationStr = text.substring(8).trim().toLowerCase();
    const minutes = parseDuration(durationStr);
    if (!minutes) {
      await replyTelegram(chatId, "Invalid duration. Examples: 30m, 1h, 2h");
      return Response.json({ ok: true });
    }

    const replyMsgId = message.reply_to_message.message_id;
    const { data: notif } = await db.from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("telegram_message_id", replyMsgId)
      .maybeSingle();

    if (!notif) {
      await replyTelegram(chatId, "Couldn't find that notification. Make sure you're replying to a Life OS notification.");
      return Response.json({ ok: true });
    }

    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await db.from("notifications")
      .update({ snoozed_until: snoozedUntil, read: false })
      .eq("id", notif.id);

    await replyTelegram(chatId, `✓ Snoozed for ${durationStr}`);
    return Response.json({ ok: true });
  }

  // /help
  if (text === "/help") {
    await replyTelegram(chatId, [
      "*Life OS Bot Commands*\n",
      "/done <habit> — Log a habit as done",
      "/mood <1-5> — Set today's mood",
      "/energy <1-5> — Set today's energy",
      "/snooze <duration> — Reply to a notification to snooze it (e.g. 30m, 1h, 2h)",
      "/help — Show this message",
    ].join("\n"));
    return Response.json({ ok: true });
  }

  // Unknown command
  await replyTelegram(chatId, "Unknown command. Send /help for available commands.");
  return Response.json({ ok: true });
}

/** Count consecutive days with logs ending at today or yesterday */
function countStreak(logs: Array<{ date: string }>): number {
  if (logs.length === 0) return 0;
  const dates = logs.map((l) => l.date).sort().reverse();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

/** Parse duration string like "30m", "1h", "2h" to minutes */
function parseDuration(s: string): number | null {
  const hMatch = s.match(/^(\d+)h$/);
  if (hMatch) return parseInt(hMatch[1]) * 60;
  const mMatch = s.match(/^(\d+)m$/);
  if (mMatch) return parseInt(mMatch[1]);
  return null;
}
```

- [ ] **Step 2: Add telegram route exclusion to proxy.ts**

Read `src/proxy.ts` and ensure `/api/` routes are already excluded from auth redirect. They should be based on CLAUDE.md ("API routes are excluded from auth redirect"). Verify — if `/api/integrations/telegram` would be caught by the proxy, it needs to be excluded since Telegram webhook requests have no session.

- [ ] **Step 3: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/integrations/telegram/route.ts
git commit -m "feat: add Telegram webhook (pairing, commands, inline keyboards)"
```

---

### Task 10: NotificationBell component

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create NotificationBell component**

Create `src/components/NotificationBell.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PixelIcon from "./PixelIcon";

interface NotificationItem {
  id: number;
  rule_type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  snoozed_until: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Poll for unread count every 60s
  useEffect(() => {
    if (!userId) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("channel", "inapp")
        .eq("read", false)
        .is("snoozed_until", null);
      setUnreadCount(count ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (!open || !userId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, rule_type, title, body, link, read, snoozed_until, created_at")
        .eq("user_id", userId)
        .eq("channel", "inapp")
        .is("snoozed_until", null)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };

    fetchNotifications();
  }, [open, userId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = async (id: number) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("channel", "inapp")
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const snoozeNotification = async (id: number, minutes: number) => {
    await fetch("/api/notifications/snooze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id, duration_minutes: minutes }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) {
      setOpen(false);
      router.push(notif.link);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-desert-text-3 hover:text-desert-text transition-colors"
      >
        <PixelIcon name="chat" size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-desert-danger text-desert-bg font-mono text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-desert-surface border border-desert-border rounded-sm shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-desert-border">
            <span className="font-mono text-xs text-desert-text-2 uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="font-mono text-[10px] text-desert-accent hover:text-desert-accent-glow"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-desert-text-3 text-xs">No notifications</div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-3 py-2.5 border-b border-desert-border cursor-pointer hover:bg-desert-surface-hover transition-colors ${
                  !notif.read ? "bg-desert-bg/50" : ""
                }`}
              >
                <div onClick={() => handleClick(notif)}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-mono text-xs font-medium ${!notif.read ? "text-desert-text" : "text-desert-text-2"}`}>
                      {notif.title}
                    </span>
                    <span className="font-mono text-[10px] text-desert-text-3">{formatTime(notif.created_at)}</span>
                  </div>
                  <p className="text-xs text-desert-text-3 line-clamp-2">{notif.body}</p>
                </div>
                {!notif.read && (
                  <div className="flex gap-1 mt-1.5">
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        onClick={(e) => { e.stopPropagation(); snoozeNotification(notif.id, m); }}
                        className="font-mono text-[9px] text-desert-text-3 hover:text-desert-accent px-1 py-0.5 border border-desert-border rounded-sm"
                      >
                        {m < 60 ? `${m}m` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationBell to layout**

Read `src/components/Sidebar.tsx` to find where to add the bell. It should go near the sync status / theme toggle area at the bottom of the sidebar. The bell should be next to the existing SyncStatus component.

Read the Sidebar component, find the SyncStatus location, and add `<NotificationBell />` next to it. The Sidebar component receives `user` as a prop — only render the bell when user is logged in.

Import at top of Sidebar:
```typescript
import NotificationBell from "./NotificationBell";
```

Add `<NotificationBell />` next to the SyncStatus component in the sidebar footer.

- [ ] **Step 3: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationBell.tsx src/components/Sidebar.tsx
git commit -m "feat: add notification bell with dropdown to sidebar"
```

---

### Task 11: Settings UI — Notifications section

**Files:**
- Modify: `src/app/settings/page.tsx`

This is a large UI addition. Add a "Notifications" section between "Integrations" and "Exchange Rates" with three sub-sections: Global settings (timezone + quiet hours), Channel connections (Push + Telegram + In-app), and Notification rules list.

- [ ] **Step 1: Add state and imports**

Add to imports at top of `src/app/settings/page.tsx`:

```typescript
import { type NotificationPreferences, type NotificationRule, RULE_LABELS, TIMED_RULES, type RuleType, type Channel } from "@/lib/notifications/types";
import { seedDefaultRules } from "@/lib/notifications/defaults";
```

Add state after existing state declarations:

```typescript
const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
const [notifRules, setNotifRules] = useState<NotificationRule[]>([]);
const [pairingCode, setPairingCode] = useState<string | null>(null);
const [generatingCode, setGeneratingCode] = useState(false);
```

- [ ] **Step 2: Load notification data in useEffect**

In the existing `load()` function inside useEffect, after loading rates and sync logs, add:

```typescript
// Load notification preferences and rules (seed defaults if needed)
await seedDefaultRules(supabase, user.id);
const { data: prefsData } = await supabase
  .from("notification_preferences")
  .select("*")
  .eq("user_id", user.id)
  .single();
setNotifPrefs(prefsData);

const { data: rulesData } = await supabase
  .from("notification_rules")
  .select("*")
  .eq("user_id", user.id)
  .order("id");
setNotifRules(rulesData || []);
```

- [ ] **Step 3: Add helper functions for notification settings**

After the `uploadFile` and `importHealthXml` functions, add:

```typescript
const updatePrefs = async (updates: Partial<NotificationPreferences>) => {
  if (!notifPrefs) return;
  const { error } = await supabase
    .from("notification_preferences")
    .update(updates)
    .eq("user_id", notifPrefs.user_id);
  if (!error) setNotifPrefs({ ...notifPrefs, ...updates });
};

const updateRule = async (ruleId: number, updates: Partial<NotificationRule>) => {
  const { error } = await supabase
    .from("notification_rules")
    .update(updates)
    .eq("id", ruleId);
  if (!error) {
    setNotifRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  }
};

const enablePush = async () => {
  if (!("Notification" in window)) {
    setUploadResult("Push notifications not supported in this browser");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setUploadResult("Push notification permission denied");
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  await updatePrefs({
    push_enabled: true,
    push_subscription: subscription.toJSON() as Record<string, unknown>,
  });
};

const disablePush = async () => {
  await updatePrefs({ push_enabled: false, push_subscription: null });
};

const generatePairingCode = async () => {
  if (!notifPrefs) return;
  setGeneratingCode(true);
  const code = "LOS-" + Math.random().toString(36).substring(2, 6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  // Clean up old codes for this user
  await supabase.from("telegram_pairing_codes").delete().eq("user_id", notifPrefs.user_id);
  await supabase.from("telegram_pairing_codes").insert({
    user_id: notifPrefs.user_id,
    code,
    expires_at: expiresAt,
  });
  setPairingCode(code);
  setGeneratingCode(false);
};

const disconnectTelegram = async () => {
  await updatePrefs({ telegram_enabled: false, telegram_chat_id: null });
  setPairingCode(null);
};

const toggleChannel = (rule: NotificationRule, channel: Channel) => {
  const channels = rule.channels.includes(channel)
    ? rule.channels.filter((c) => c !== channel)
    : [...rule.channels, channel];
  updateRule(rule.id, { channels });
};
```

- [ ] **Step 4: Add the Notifications section JSX**

In the return JSX, AFTER the Integrations section `</section>` and BEFORE the Exchange Rates section, add:

```tsx
{/* Notifications Section */}
{notifPrefs && (
  <section>
    <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
      Notifications
    </h2>
    <div className="space-y-4">
      {/* Global Settings */}
      <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
        <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider mb-3">Global</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-desert-text-3 text-xs block mb-1">Timezone</label>
            <select
              value={notifPrefs.timezone}
              onChange={(e) => updatePrefs({ timezone: e.target.value })}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text"
            >
              {Intl.supportedValuesOf("timeZone").filter((tz) =>
                ["Pacific/Auckland", "Australia/Sydney", "Australia/Melbourne", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"].includes(tz)
              ).map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-desert-text-3 text-xs block mb-1">Quiet start</label>
              <input
                type="time"
                value={notifPrefs.quiet_start}
                onChange={(e) => updatePrefs({ quiet_start: e.target.value })}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text"
              />
            </div>
            <div className="flex-1">
              <label className="text-desert-text-3 text-xs block mb-1">Quiet end</label>
              <input
                type="time"
                value={notifPrefs.quiet_end}
                onChange={(e) => updatePrefs({ quiet_end: e.target.value })}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Channel Connections */}
      <div className="space-y-2">
        <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider">Channels</p>

        {/* Web Push */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-desert-text font-mono text-sm font-medium">Web Push</p>
            <p className="text-desert-text-3 text-xs">
              {notifPrefs.push_enabled ? "Push notifications enabled" : "Browser notifications"}
            </p>
          </div>
          <button
            onClick={notifPrefs.push_enabled ? disablePush : enablePush}
            className={`px-3 py-1.5 font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm transition-colors duration-150 ${
              notifPrefs.push_enabled
                ? "border border-desert-danger text-desert-danger hover:bg-desert-danger hover:text-desert-bg"
                : "bg-desert-accent text-desert-bg hover:bg-desert-accent-glow"
            }`}
          >
            {notifPrefs.push_enabled ? "Disable" : "Enable Push"}
          </button>
        </div>

        {/* Telegram */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-desert-text font-mono text-sm font-medium">Telegram</p>
              <p className="text-desert-text-3 text-xs">
                {notifPrefs.telegram_chat_id ? "Connected" : "Bot notifications + habit logging"}
              </p>
            </div>
            {notifPrefs.telegram_chat_id ? (
              <button
                onClick={disconnectTelegram}
                className="px-3 py-1.5 border border-desert-danger text-desert-danger font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-danger hover:text-desert-bg transition-colors duration-150"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={generatePairingCode}
                disabled={generatingCode}
                className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
              >
                {generatingCode ? "..." : "Connect Telegram"}
              </button>
            )}
          </div>
          {pairingCode && !notifPrefs.telegram_chat_id && (
            <div className="mt-3 p-3 bg-desert-bg border border-desert-border-strong rounded-sm">
              <p className="text-desert-text-3 text-xs mb-2">Send this to your Life OS bot on Telegram:</p>
              <code className="font-mono text-sm text-desert-accent select-all">/pair {pairingCode}</code>
              <p className="text-desert-text-3 text-[10px] mt-2">Code expires in 10 minutes</p>
            </div>
          )}
        </div>

        {/* In-App */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-desert-text font-mono text-sm font-medium">In-App</p>
            <p className="text-desert-text-3 text-xs">Notification bell in sidebar</p>
          </div>
          <button
            onClick={() => updatePrefs({ inapp_enabled: !notifPrefs.inapp_enabled })}
            className={`px-3 py-1.5 font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm transition-colors duration-150 ${
              notifPrefs.inapp_enabled
                ? "bg-desert-success/20 text-desert-success border border-desert-success/30"
                : "bg-desert-bg border border-desert-border-strong text-desert-text-3"
            }`}
          >
            {notifPrefs.inapp_enabled ? "On" : "Off"}
          </button>
        </div>
      </div>

      {/* Notification Rules */}
      <div>
        <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider mb-2">Rules</p>
        <div className="bg-desert-surface border border-desert-border rounded-sm divide-y divide-desert-border">
          {notifRules.filter((r) => r.rule_type !== "sync_event").map((rule) => {
            const label = RULE_LABELS[rule.rule_type as RuleType];
            const isTimed = TIMED_RULES.includes(rule.rule_type as RuleType);
            return (
              <div key={rule.id} className="px-4 py-3 flex items-center gap-3">
                {/* Enable toggle */}
                <button
                  onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                  className={`w-8 h-4 rounded-full relative transition-colors ${
                    rule.enabled ? "bg-desert-accent" : "bg-desert-border"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-desert-bg transition-transform ${
                    rule.enabled ? "translate-x-4.5" : "translate-x-0.5"
                  }`} />
                </button>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-desert-text font-medium">{label?.name}</p>
                  <p className="text-desert-text-3 text-[10px] truncate">{label?.description}</p>
                </div>

                {/* Time picker (timed rules only) */}
                {isTimed && (
                  <input
                    type="time"
                    value={rule.time || ""}
                    onChange={(e) => updateRule(rule.id, { time: e.target.value })}
                    className="bg-desert-bg border border-desert-border-strong rounded-sm px-1.5 py-1 font-mono text-[10px] text-desert-text w-20"
                  />
                )}

                {/* Day picker (weekly_review only) */}
                {rule.rule_type === "weekly_review" && (
                  <select
                    value={rule.day_of_week ?? 0}
                    onChange={(e) => updateRule(rule.id, { day_of_week: parseInt(e.target.value) })}
                    className="bg-desert-bg border border-desert-border-strong rounded-sm px-1 py-1 font-mono text-[10px] text-desert-text"
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                )}

                {/* Channel chips */}
                <div className="flex gap-1">
                  {(["push", "telegram", "inapp"] as Channel[]).map((ch) => {
                    const connected = ch === "push" ? notifPrefs.push_enabled
                      : ch === "telegram" ? !!notifPrefs.telegram_chat_id
                      : true;
                    if (!connected) return null;
                    const active = rule.channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        onClick={() => toggleChannel(rule, ch)}
                        className={`px-1.5 py-0.5 font-mono text-[9px] uppercase rounded-sm transition-colors ${
                          active
                            ? "bg-desert-accent/20 text-desert-accent border border-desert-accent/30"
                            : "bg-desert-bg text-desert-text-3 border border-desert-border"
                        }`}
                      >
                        {ch === "inapp" ? "app" : ch}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add notification settings UI (global, channels, rules)"
```

---

### Task 12: Task reminder UI

**Files:**
- Modify: `src/app/tasks/page.tsx`

- [ ] **Step 1: Add reminder_before to task interface and form**

Read `src/app/tasks/page.tsx` to find the task interface and the create/edit form. Add:

1. `reminder_before` to the task type/interface
2. A "Remind me" select dropdown in the task form, shown only when `due_date` is set
3. Include `reminder_before` in task insert/update calls

The dropdown options:

```typescript
const REMINDER_OPTIONS = [
  { label: "None", value: "" },
  { label: "15 min", value: "15 minutes" },
  { label: "30 min", value: "30 minutes" },
  { label: "1 hour", value: "1 hour" },
  { label: "1 day", value: "1 day" },
  { label: "2 days", value: "2 days" },
  { label: "1 week", value: "1 week" },
  { label: "Custom", value: "custom" },
];
```

When "Custom" is selected, show a number input + unit select (minutes/hours/days/weeks). Construct the interval string as `"<number> <unit>"` (e.g., "3 days", "2 weeks").

Include `reminder_before` in the task select query, and in insert/update payloads. Set to `null` when "None" is selected.

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/tasks/page.tsx
git commit -m "feat: add reminder_before dropdown to task form"
```

---

### Task 13: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the relevant sections:

a) **Project Structure** — add under `api/`:
```
    ├── cron/notifications/route.ts
    ├── notifications/snooze/route.ts
    ├── integrations/telegram/route.ts
```

Add under `src/lib/`:
```
src/lib/notifications/ (types.ts, defaults.ts, channels.ts, evaluate.ts, summary.ts)
```

Add under `src/components/`:
```
NotificationBell
```

b) **Supabase Tables** — add:
```
notification_preferences, notification_rules, notifications, telegram_pairing_codes
```

c) **Key Schema Details** — add:
```
- Notification rule types: morning_checkin, habit_reminder, journal_prompt, weekly_review, daily_summary, streak_at_risk, goal_deadline, task_overdue, task_reminder, sync_event
- Notification channels: push, telegram, inapp
- Tasks support reminder_before (Postgres interval, nullable) for pre-due-date reminders
```

d) **Integrations** — add:
```
- Telegram Bot: POST /api/integrations/telegram (webhook, env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET)
  - Pairing flow via /pair <code>, commands: /done, /mood, /energy, /snooze, /help
  - Inline keyboards on habit reminders and daily summaries
  - Callback queries for habit completion buttons
- Notification Cron: GET /api/cron/notifications (every 15min via vercel.json, CRON_SECRET auth)
  - Evaluates timed + data-driven rules, dispatches to push/telegram/inapp
  - Respects timezone, quiet hours, deduplication
  - Re-fires snoozed notifications
```

e) **Required Vercel Environment Variables** — add:
```
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT — Web Push VAPID keys
- NEXT_PUBLIC_VAPID_PUBLIC_KEY — public VAPID key (client-side, for push subscription)
- TELEGRAM_BOT_TOKEN — Telegram bot API token
- TELEGRAM_WEBHOOK_SECRET — secret for verifying Telegram webhook requests
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: add notification system to CLAUDE.md"
git push
```

---

## Task Dependencies

```
Task 1 (migrations) ──┐
                       ├─> Task 2 (types/defaults) ──┐
                       │                              ├─> Task 3 (channels)
                       │                              ├─> Task 4 (summary)
                       │                              │        │
                       │                              │        v
                       │                              ├─> Task 5 (evaluate)
                       │                              │        │
                       │                              │        v
                       │                              ├─> Task 6 (cron)
                       │                              ├─> Task 7 (snooze endpoint)
                       │                              ├─> Task 9 (telegram webhook)
                       │                              └─> Task 10 (bell component)
                       │
                       └─> Task 8 (service worker — independent)
                       └─> Task 12 (task reminder UI — independent)

Task 6 depends on: 3, 4, 5
Task 9 depends on: 3
Task 10 depends on: 7
Task 11 (settings UI) depends on: 2, 10
Task 13 (docs) depends on: all
```

Tasks 1 → 2 are sequential. After Task 2, Tasks 3, 4, 7, 8, 12 can run in parallel. Task 5 depends on 4. Task 6 depends on 3, 4, 5. Task 9 depends on 3. Task 10 depends on 7. Task 11 depends on 2, 10. Task 13 is last.
