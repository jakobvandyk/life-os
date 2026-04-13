import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let records: Array<{
    date: string;
    weight?: number;
    body_fat_pct?: number;
    hrv?: number;
    resting_hr?: number;
    steps?: number;
    active_calories?: number;
    vo2_max?: number;
    mean_hr?: number;
    sleep?: number;
  }>;

  try {
    records = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return Response.json({ error: "Empty records array" }, { status: 400 });
  }

  const FIELDS = ["weight", "body_fat_pct", "hrv", "resting_hr", "steps", "active_calories", "vo2_max", "mean_hr", "sleep"] as const;
  let upserted = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.date) { skipped++; continue; }

    const { data: existing } = await supabase
      .from("workout_checkins")
      .select("id, weight, body_fat_pct, hrv, resting_hr, steps, active_calories, vo2_max, mean_hr, sleep")
      .eq("user_id", user.id)
      .eq("date", record.date)
      .maybeSingle();

    const updates: Record<string, unknown> = {};
    for (const field of FIELDS) {
      const val = record[field];
      if (val != null && (!existing || (existing as Record<string, unknown>)[field] == null)) {
        updates[field] = val;
      }
    }

    if (Object.keys(updates).length === 0) { skipped++; continue; }

    if (existing) {
      await supabase.from("workout_checkins").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("workout_checkins").insert({ user_id: user.id, date: record.date, ...updates });
    }
    upserted++;
  }

  await supabase.from("integration_syncs").insert({
    user_id: user.id,
    source: "apple_health_import",
    status: "ok",
    records_imported: upserted,
  });

  return Response.json({ imported: upserted, skipped, total: records.length });
}
