import { getServiceClient } from "@/lib/supabase-service";

export const maxDuration = 10;

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.HEALTH_WEBHOOK_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = process.env.HEALTH_USER_ID;
  if (!userId) {
    return Response.json({ error: "User not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, hrv, readiness, mindfulness_minutes, sleep_hours, weight } = body;

  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const db = getServiceClient();
  const imported: string[] = [];

  // Upsert workout_checkins
  const checkinFields: Record<string, unknown> = {};
  if (hrv != null) { checkinFields.hrv = hrv; imported.push("hrv"); }
  if (sleep_hours != null) { checkinFields.sleep = sleep_hours; imported.push("sleep"); }
  if (weight != null) { checkinFields.weight = weight; imported.push("weight"); }
  if (readiness != null) { checkinFields.readiness = readiness; imported.push("readiness"); }

  if (Object.keys(checkinFields).length > 0) {
    const { data: existing } = await db
      .from("workout_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (existing) {
      await db.from("workout_checkins").update(checkinFields).eq("id", existing.id);
    } else {
      await db.from("workout_checkins").insert({ user_id: userId, date, ...checkinFields });
    }
  }

  // Mindfulness → habit log
  if (mindfulness_minutes != null && mindfulness_minutes > 0) {
    const { data: habit } = await db
      .from("habits")
      .select("id")
      .eq("user_id", userId)
      .or("name.ilike.%mindful%,name.ilike.%meditat%")
      .maybeSingle();

    if (habit) {
      await db
        .from("habit_logs")
        .upsert(
          { user_id: userId, habit_id: habit.id, date, value: mindfulness_minutes },
          { onConflict: "habit_id,date" }
        );
      imported.push("mindfulness");
    }
  }

  // Log sync
  await db.from("integration_syncs").insert({
    user_id: userId,
    source: "apple_health",
    status: "ok",
    records_imported: imported.length,
  });

  return Response.json({ ok: true, imported });
}
