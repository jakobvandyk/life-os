import { getServiceClient } from "@/lib/supabase-service";

export const maxDuration = 10;

// iOS Shortcuts' default date-as-text is NZ locale (d/M/yyyy); Postgres needs ISO.
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${dmy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

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

  const { date, hrv, hrv_rmssd, readiness, mindfulness_minutes, sleep_hours, sleep_score, weight, shin_pain, waist_cm, pns_index, sns_index, stress_index, kubios_readiness, mean_hr, body_fat_pct, steps, active_calories, resting_hr, vo2_max } = body;

  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const db = getServiceClient();

  const day = normalizeDate(date);
  if (!day) {
    await db.from("integration_syncs").insert({
      user_id: userId,
      source: "apple_health",
      status: "error",
      records_imported: 0,
      error_message: `unparseable date: ${JSON.stringify(date)}`,
    });
    return Response.json({ error: `unparseable date: ${JSON.stringify(date)}` }, { status: 400 });
  }

  const imported: string[] = [];
  const writeErrors: string[] = [];

  // Upsert workout_checkins
  const checkinFields: Record<string, unknown> = {};
  if (hrv != null) { checkinFields.hrv = hrv; imported.push("hrv"); }
  if (hrv_rmssd != null) { checkinFields.hrv_rmssd = hrv_rmssd; imported.push("hrv_rmssd"); }
  if (sleep_hours != null) { checkinFields.sleep = sleep_hours; imported.push("sleep"); }
  if (sleep_score != null) { checkinFields.sleep_score = sleep_score; imported.push("sleep_score"); }
  if (weight != null) { checkinFields.weight = weight; imported.push("weight"); }
  if (readiness != null) { checkinFields.readiness = readiness; imported.push("readiness"); }
  if (shin_pain != null) { checkinFields.shin_pain = shin_pain; imported.push("shin_pain"); }
  if (waist_cm != null) { checkinFields.waist_cm = waist_cm; imported.push("waist_cm"); }
  if (pns_index != null) { checkinFields.pns_index = pns_index; imported.push("pns_index"); }
  if (sns_index != null) { checkinFields.sns_index = sns_index; imported.push("sns_index"); }
  if (stress_index != null) { checkinFields.stress_index = stress_index; imported.push("stress_index"); }
  if (kubios_readiness != null) { checkinFields.kubios_readiness = kubios_readiness; imported.push("kubios_readiness"); }
  if (mean_hr != null) { checkinFields.mean_hr = mean_hr; imported.push("mean_hr"); }
  if (body_fat_pct != null) { checkinFields.body_fat_pct = body_fat_pct; imported.push("body_fat_pct"); }
  if (steps != null) { checkinFields.steps = steps; imported.push("steps"); }
  if (active_calories != null) { checkinFields.active_calories = active_calories; imported.push("active_calories"); }
  if (resting_hr != null) { checkinFields.resting_hr = resting_hr; imported.push("resting_hr"); }
  if (vo2_max != null) { checkinFields.vo2_max = vo2_max; imported.push("vo2_max"); }

  if (Object.keys(checkinFields).length > 0) {
    const { data: existing, error: lookupError } = await db
      .from("workout_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("date", day)
      .maybeSingle();

    if (lookupError) {
      writeErrors.push(`checkin lookup: ${lookupError.message}`);
    } else if (existing) {
      const { error } = await db.from("workout_checkins").update(checkinFields).eq("id", existing.id);
      if (error) writeErrors.push(`checkin update: ${error.message}`);
    } else {
      const { error } = await db.from("workout_checkins").insert({ user_id: userId, date: day, ...checkinFields });
      if (error) writeErrors.push(`checkin insert: ${error.message}`);
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
      const { error } = await db
        .from("habit_logs")
        .upsert(
          { user_id: userId, habit_id: habit.id, date: day, value: mindfulness_minutes },
          { onConflict: "habit_id,date" }
        );
      if (error) writeErrors.push(`habit upsert: ${error.message}`);
      else imported.push("mindfulness");
    }
  }

  // Log sync
  await db.from("integration_syncs").insert({
    user_id: userId,
    source: "apple_health",
    status: writeErrors.length ? "error" : "ok",
    records_imported: writeErrors.length ? 0 : imported.length,
    error_message: writeErrors.length ? writeErrors.join("; ") : null,
  });

  if (writeErrors.length) {
    return Response.json({ ok: false, errors: writeErrors }, { status: 500 });
  }
  return Response.json({ ok: true, imported });
}
