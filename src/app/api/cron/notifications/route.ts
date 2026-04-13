import { getServiceClient } from "@/lib/supabase-service";
import { type NotificationPreferences, type NotificationRule } from "@/lib/notifications/types";
import { evaluateRules, isInQuietHours } from "@/lib/notifications/evaluate";
import { dispatch } from "@/lib/notifications/channels";

type DispatchDb = Parameters<typeof dispatch>[0];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: allPrefs } = await (db.from("notification_preferences") as any).select("*");
  if (!allPrefs || allPrefs.length === 0) {
    return Response.json({ message: "No users with notification preferences" });
  }

  let totalDispatched = 0;

  for (const prefs of allPrefs as NotificationPreferences[]) {
    const now = new Date();
    const userTime = now.toLocaleTimeString("en-GB", { timeZone: prefs.timezone, hour: "2-digit", minute: "2-digit" });
    const userDate = now.toLocaleDateString("en-CA", { timeZone: prefs.timezone });
    const userDayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: prefs.timezone })).getDay();

    const quiet = isInQuietHours(userTime, prefs.quiet_start, prefs.quiet_end);

    const { data: rules } = await (db.from("notification_rules") as any)
      .select("*").eq("user_id", prefs.user_id);
    if (!rules || rules.length === 0) continue;

    // Re-fire snoozed notifications
    const { data: snoozed } = await (db.from("notifications") as any)
      .select("*").eq("user_id", prefs.user_id)
      .not("snoozed_until", "is", null)
      .lte("snoozed_until", now.toISOString());

    for (const notif of snoozed || []) {
      await dispatch(
        db as unknown as DispatchDb, prefs, [notif.channel],
        { title: notif.title, body: notif.body, link: notif.link, rule_type: notif.rule_type },
        quiet
      );
      await (db.from("notifications") as any)
        .update({ snoozed_until: null, read: false }).eq("id", notif.id);
      totalDispatched++;
    }

    // Evaluate rules
    const toFire = await evaluateRules(
      db, prefs, rules as NotificationRule[],
      userTime, userDayOfWeek, userDate
    );

    for (const { rule, payload, replyMarkup } of toFire) {
      await dispatch(db as unknown as DispatchDb, prefs, rule.channels, payload, quiet, replyMarkup);
      await (db.from("notification_rules") as any)
        .update({ last_fired_at: now.toISOString() }).eq("id", rule.id);
      totalDispatched++;
    }
  }

  return Response.json({ dispatched: totalDispatched });
}
