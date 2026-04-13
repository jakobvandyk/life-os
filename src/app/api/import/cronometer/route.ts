import { createClient } from "@/lib/supabase-server";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

/** Try multiple header names, return first valid number or null */
function findCol(row: Record<string, string>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

/** Remove null/undefined values from an object */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null)
  ) as Partial<T>;
}

/** Detect if CSV is biometrics long-format (Day,Group,Metric,Unit,Amount) */
function isBiometricsFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  return normalized.includes("day") && normalized.includes("metric") && normalized.includes("amount");
}

interface BiometricDay {
  weight?: number;
  body_fat_pct?: number;
  sleep_total?: number;
  sleep_score?: number;
  hrv?: number;
  resting_hr?: number;
  hr_sum?: number;
  hr_count?: number;
  mood?: number;
  energy?: number;
}

/** Pivot long-format biometric rows into per-date records */
function pivotBiometrics(rows: Record<string, string>[]): Map<string, BiometricDay> {
  const byDate = new Map<string, BiometricDay>();

  for (const row of rows) {
    const date = row["Day"] || row["day"];
    const metric = (row["Metric"] || row["metric"] || "").replace(/"/g, "");
    const amount = parseFloat(row["Amount"] || row["amount"] || "");
    if (!date || !metric || isNaN(amount)) continue;

    let day = byDate.get(date);
    if (!day) {
      day = {};
      byDate.set(date, day);
    }

    switch (metric) {
      case "Weight":
      case "Weight (Apple Health)":
        if (day.weight == null) day.weight = amount;
        break;
      case "Body Fat":
      case "Body Fat (Apple Health)":
        if (day.body_fat_pct == null) day.body_fat_pct = amount;
        break;
      case "Sleep":
      case "Sleep (Apple Health)":
        day.sleep_total = (day.sleep_total ?? 0) + amount;
        break;
      case "Sleep Score":
        day.sleep_score = amount;
        break;
      case "Heart Rate Variability (HRV) (Apple Health)":
        day.hrv = amount;
        break;
      case "Resting Heart Rate (Apple Health)":
        day.resting_hr = amount;
        break;
      case "Heart Rate (Apple Health)":
      case "Heart Rate (Garmin)":
        day.hr_sum = (day.hr_sum ?? 0) + amount;
        day.hr_count = (day.hr_count ?? 0) + 1;
        break;
      case "Mood":
        day.mood = Math.min(5, Math.max(1, Math.round(amount)));
        break;
      case "Energy Level":
        day.energy = Math.min(5, Math.max(1, Math.round(amount)));
        break;
    }
  }

  return byDate;
}

async function importBiometrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: Record<string, string>[]
): Promise<{ imported: number; skipped: number; checkins: number; journal: number }> {
  const byDate = pivotBiometrics(rows);
  let checkinCount = 0;
  let journalCount = 0;

  for (const [date, day] of byDate) {
    const checkinFields: Record<string, unknown> = {};
    const fieldMap: [string, unknown][] = [
      ["weight", day.weight],
      ["body_fat_pct", day.body_fat_pct],
      ["sleep", day.sleep_total],
      ["sleep_score", day.sleep_score],
      ["hrv", day.hrv],
      ["resting_hr", day.resting_hr],
      ["mean_hr", day.hr_sum != null && day.hr_count ? Math.round(day.hr_sum / day.hr_count) : null],
    ];

    const hasCheckinData = fieldMap.some(([, v]) => v != null);

    if (hasCheckinData) {
      const { data: existing } = await supabase
        .from("workout_checkins")
        .select("id, weight, body_fat_pct, sleep, sleep_score, hrv, resting_hr, mean_hr")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      for (const [key, value] of fieldMap) {
        if (value != null && (!existing || (existing as Record<string, unknown>)[key] == null)) {
          checkinFields[key] = value;
        }
      }

      if (Object.keys(checkinFields).length > 0) {
        if (existing) {
          await supabase.from("workout_checkins").update(checkinFields).eq("id", existing.id);
        } else {
          await supabase.from("workout_checkins").insert({ user_id: userId, date, ...checkinFields });
        }
        checkinCount++;
      }
    }

    if (day.mood != null || day.energy != null) {
      const { data: journalEntry } = await supabase
        .from("journal_entries")
        .select("id, mood, energy")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      if (journalEntry) {
        const journalUpdates: Record<string, unknown> = {};
        if (day.mood != null && journalEntry.mood == null) journalUpdates.mood = day.mood;
        if (day.energy != null && journalEntry.energy == null) journalUpdates.energy = day.energy;

        if (Object.keys(journalUpdates).length > 0) {
          await supabase.from("journal_entries").update(journalUpdates).eq("id", journalEntry.id);
          journalCount++;
        }
      }
    }
  }

  const skipped = rows.length - byDate.size;
  return { imported: byDate.size, skipped, checkins: checkinCount, journal: journalCount };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return Response.json({ error: "Empty CSV" }, { status: 400 });
  }

  // Detect format: biometrics (long) vs nutrition (wide)
  const headers = Object.keys(rows[0]);
  if (isBiometricsFormat(headers)) {
    const result = await importBiometrics(supabase, user.id, rows);

    await supabase.from("integration_syncs").insert({
      user_id: user.id,
      source: "cronometer",
      status: "ok",
      records_imported: result.imported,
    });

    return Response.json(result);
  }

  // Existing nutrition import continues below unchanged...
  let imported = 0;
  let skipped = 0;
  let nutritionCount = 0;
  let checkinCount = 0;

  for (const row of rows) {
    const date = row["Date"] || row["date"] || row["Day"];
    if (!date) {
      skipped++;
      continue;
    }

    // 1. Store raw payload (audit trail)
    const { error } = await supabase.from("raw_imports").upsert(
      {
        user_id: user.id,
        source: "cronometer",
        external_id: date,
        payload: row,
      },
      { onConflict: "source,external_id" }
    );

    if (error) {
      skipped++;
      continue;
    }
    imported++;

    // 2. Nutrition → nutrition_daily
    const nutritionPayload = compact({
      calories: findCol(row, "Energy (kcal)", "Calories (kcal)", "Energy"),
      protein_g: findCol(row, "Protein (g)", "Protein"),
      carbs_g: findCol(row, "Carbs (g)", "Net Carbs (g)", "Carbs", "Total Carbs (g)"),
      fat_g: findCol(row, "Fat (g)", "Fat", "Total Fat (g)"),
      fiber_g: findCol(row, "Fiber (g)", "Fibre (g)", "Fiber"),
      water_ml: findCol(row, "Water (g)", "Water (ml)", "Water"),
      caffeine_mg: findCol(row, "Caffeine (mg)", "Caffeine"),
      alcohol_g: findCol(row, "Alcohol (g)", "Alcohol"),
      vitamin_d_iu: findCol(row, "Vitamin D (IU)", "Vitamin D", "Vit D (IU)"),
      iron_mg: findCol(row, "Iron (mg)", "Iron"),
      magnesium_mg: findCol(row, "Magnesium (mg)", "Magnesium"),
      zinc_mg: findCol(row, "Zinc (mg)", "Zinc"),
      sodium_mg: findCol(row, "Sodium (mg)", "Sodium"),
      potassium_mg: findCol(row, "Potassium (mg)", "Potassium"),
    });

    if (Object.keys(nutritionPayload).length > 0) {
      const { error: nutErr } = await supabase.from("nutrition_daily").upsert(
        { user_id: user.id, date, ...nutritionPayload, updated_at: new Date().toISOString() },
        { onConflict: "user_id,date" }
      );
      if (!nutErr) nutritionCount++;
    }

    // 3. Biometrics → workout_checkins (selective merge — don't overwrite Apple Health)
    const cronoWeight = findCol(row, "Weight", "Weight (kg)");
    const cronoBodyFat = findCol(row, "Body Fat", "Body Fat (%)", "Body Fat %");
    const cronoWaist = findCol(row, "Waist", "Waist (cm)");

    if (cronoWeight != null || cronoBodyFat != null || cronoWaist != null) {
      const { data: existing } = await supabase
        .from("workout_checkins")
        .select("id, weight, body_fat_pct, waist_cm")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      const updates: Record<string, unknown> = {};
      if (cronoWeight != null && (!existing || existing.weight == null))
        updates.weight = cronoWeight;
      if (cronoBodyFat != null && (!existing || existing.body_fat_pct == null))
        updates.body_fat_pct = cronoBodyFat;
      if (cronoWaist != null && (!existing || existing.waist_cm == null))
        updates.waist_cm = cronoWaist;

      if (Object.keys(updates).length > 0) {
        if (existing) {
          await supabase.from("workout_checkins").update(updates).eq("id", existing.id);
        } else {
          await supabase.from("workout_checkins").insert({ user_id: user.id, date, ...updates });
        }
        checkinCount++;
      }
    }

    // 4. Mood/Energy → journal_entries (update only, never create)
    const cronoMood = findCol(row, "Mood");
    const cronoEnergy = findCol(row, "Energy Level");

    if (cronoMood != null || cronoEnergy != null) {
      const { data: journalEntry } = await supabase
        .from("journal_entries")
        .select("id, mood, energy")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      if (journalEntry) {
        const journalUpdates: Record<string, unknown> = {};
        if (cronoMood != null && journalEntry.mood == null)
          journalUpdates.mood = Math.min(5, Math.max(1, Math.round(cronoMood)));
        if (cronoEnergy != null && journalEntry.energy == null)
          journalUpdates.energy = Math.min(5, Math.max(1, Math.round(cronoEnergy)));

        if (Object.keys(journalUpdates).length > 0) {
          await supabase.from("journal_entries").update(journalUpdates).eq("id", journalEntry.id);
        }
      }
    }
  }

  // Log sync
  await supabase.from("integration_syncs").insert({
    user_id: user.id,
    source: "cronometer",
    status: "ok",
    records_imported: imported,
  });

  return Response.json({ imported, skipped, nutrition: nutritionCount, checkins: checkinCount });
}
