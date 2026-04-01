import { createClient } from "@/lib/supabase-server";
import { getServiceClient } from "@/lib/supabase-service";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function getUserId(request: Request): Promise<string | null> {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return process.env.HEALTH_USER_ID || null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Collect iCal URLs from environment
  const urls: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const url = process.env[`ICAL_URL_${i}`];
    if (url) urls.push(url);
  }

  if (urls.length === 0) {
    return Response.json({ error: "No iCal URLs configured" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ICAL = require("ical.js");
  const now = new Date();
  const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  let totalImported = 0;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();

      const jcal = ICAL.parse(text);
      const comp = new ICAL.Component(jcal);
      const vevents = comp.getAllSubcomponents("vevent");

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        const uid = event.uid;
        if (!uid) continue;

        const dtstart = event.startDate?.toJSDate();
        if (!dtstart) continue;

        // Only import events within next 90 days
        if (dtstart < now || dtstart > ninetyDaysLater) continue;

        const dtend = event.endDate?.toJSDate();
        const allDay = event.startDate?.isDate ?? false;

        const { error } = await getServiceClient()
          .from("calendar_events")
          .upsert(
            {
              user_id: userId,
              title: event.summary || "Untitled",
              type: "event",
              date: toDateStr(dtstart),
              start_time: allDay ? null : toTimeStr(dtstart),
              end_time: allDay || !dtend ? null : toTimeStr(dtend),
              all_day: allDay,
              notes: event.description || null,
              external_uid: uid,
            },
            { onConflict: "user_id,external_uid", ignoreDuplicates: false }
          );

        if (!error) totalImported++;
      }
    } catch {
      // Skip failed feeds, continue with others
    }
  }

  await getServiceClient().from("integration_syncs").insert({
    user_id: userId,
    source: "ical",
    status: "ok",
    records_imported: totalImported,
  });

  return Response.json({ ok: true, imported: totalImported, feeds: urls.length });
}
