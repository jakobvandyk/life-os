import { type NotificationRule, type NotificationPayload, type NotificationPreferences, RULE_LABELS } from "./types";
import { buildDailySummary, getIncompleteHabits } from "./summary";

function isInTimeWindow(currentTime: string, targetTime: string): boolean {
  const [ch, cm] = currentTime.split(":").map(Number);
  const [th, tm] = targetTime.split(":").map(Number);
  const currentMin = ch * 60 + cm;
  const targetMin = th * 60 + tm;
  return currentMin >= targetMin && currentMin < targetMin + 15;
}

export function isInQuietHours(currentTime: string, quietStart: string, quietEnd: string): boolean {
  const [ch, cm] = currentTime.split(":").map(Number);
  const [sh, sm] = quietStart.split(":").map(Number);
  const [eh, em] = quietEnd.split(":").map(Number);
  const cur = ch * 60 + cm;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function shouldFireTimedRule(
  rule: NotificationRule,
  currentTime: string,
  currentDayOfWeek: number,
  todayDate: string
): boolean {
  if (!rule.time) return false;
  if (rule.rule_type === "weekly_review") {
    if (rule.day_of_week != null && currentDayOfWeek !== rule.day_of_week) return false;
  }
  if (!isInTimeWindow(currentTime, rule.time)) return false;
  if (rule.last_fired_at) {
    const lastFired = rule.last_fired_at.substring(0, 10);
    if (rule.rule_type === "weekly_review") {
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

function subtractInterval(date: Date, interval: string): Date {
  const result = new Date(date);
  const parts = interval.toLowerCase().trim();
  const weekMatch = parts.match(/(\d+)\s*week/);
  const dayMatch = parts.match(/(\d+)\s*day/);
  const hourMatch = parts.match(/(\d+)\s*hour/);
  const minMatch = parts.match(/(\d+)\s*min/);
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

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function evaluateRules(
  supabase: { from: (table: string) => any },
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
        if (incomplete.length === 0) continue;
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
      const [h] = currentTime.split(":").map(Number);
      if (h < 15) continue;
      const { data: existing } = await supabase.from("notifications")
        .select("id").eq("user_id", prefs.user_id).eq("rule_type", "streak_at_risk")
        .gte("created_at", todayDate + "T00:00:00").limit(1);
      if (existing && existing.length > 0) continue;
      const incomplete = await getIncompleteHabits(supabase, prefs.user_id, todayDate);
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
      const { data: goals } = await supabase.from("goals")
        .select("id, title, target_date").eq("user_id", prefs.user_id)
        .neq("status", "completed").not("target_date", "is", null)
        .lte("target_date", cutoff).gte("target_date", todayDate);
      for (const goal of goals || []) {
        const { data: existing } = await supabase.from("notifications")
          .select("id").eq("user_id", prefs.user_id).eq("rule_type", "goal_deadline")
          .eq("entity_id", String(goal.id)).gte("created_at", todayDate + "T00:00:00").limit(1);
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
      const { data: overdueTasks } = await supabase.from("tasks")
        .select("id, title").eq("user_id", prefs.user_id)
        .neq("status", "done").not("due_date", "is", null).lt("due_date", todayDate);
      for (const task of overdueTasks || []) {
        const { data: existing } = await supabase.from("notifications")
          .select("id").eq("user_id", prefs.user_id).eq("rule_type", "task_overdue")
          .eq("entity_id", String(task.id)).gte("created_at", todayDate + "T00:00:00").limit(1);
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
      const { data: reminderTasks } = await supabase.from("tasks")
        .select("id, title, due_date, reminder_before").eq("user_id", prefs.user_id)
        .neq("status", "done").not("due_date", "is", null).not("reminder_before", "is", null);
      const now = new Date();
      for (const task of reminderTasks || []) {
        const dueDate = new Date(task.due_date + "T00:00:00");
        const reminderTime = subtractInterval(dueDate, task.reminder_before);
        if (now < reminderTime) continue;
        if (now > dueDate) continue;
        const { data: existing } = await supabase.from("notifications")
          .select("id").eq("user_id", prefs.user_id).eq("rule_type", "task_reminder")
          .eq("entity_id", String(task.id)).limit(1);
        if (existing && existing.length > 0) continue;
        const intervalLabel = formatInterval(task.reminder_before);
        results.push({
          rule,
          payload: {
            title: "Task Reminder",
            body: `"${task.title}" is due in ${intervalLabel}`,
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
