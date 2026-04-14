# Cronometer Biometrics CSV Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import historical biometrics data from Cronometer's long-format CSV export (Day, Group, Metric, Unit, Amount) into workout_checkins and journal_entries — a one-time backfill of ~7,600 rows spanning 2020–2026.

**Architecture:** Extend the existing `/api/import/cronometer` route to auto-detect the biometrics CSV format (long-format with `Day,Group,Metric,Unit,Amount` headers) vs the existing nutrition format (wide-format with `Date,Energy (kcal),...`). Pivot long-format rows into per-date records, sum multi-entry metrics (sleep), average others (heart rate), then upsert into workout_checkins with selective merge (don't overwrite existing values from Apple Health). Add `sleep_score` column to workout_checkins via Supabase migration.

**Tech Stack:** Next.js API route, Supabase PostgreSQL, TypeScript

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/import/cronometer/route.ts` | Modify | Add biometrics format detection + long-format parser alongside existing nutrition parser |
| Supabase migration (via dashboard/SQL) | Create | Add `sleep_score` column to `workout_checkins` |
| `src/app/workouts/components/DailyCheckin.tsx` | Modify | Add `sleep_score` to Checkin interface |
| `src/lib/local-db.ts` | Modify | Add `sleep_score` to LocalWorkoutCheckin |
| `src/lib/ai/context-builders.ts` | Modify | Include `sleep_score` in checkin queries and AI context |
| `src/app/page.tsx` | Modify | Add sleep_score to dashboard sparklines |
| `src/app/api/integrations/health/route.ts` | Modify | Accept `sleep_score` in webhook payload |
| `CLAUDE.md` | Modify | Document `sleep_score` column, biometrics import format, recovery via Shortcut |

---

### Task 1: Add sleep_score column to workout_checkins

**Files:**
- Supabase migration SQL

- [ ] **Step 1: Run migration SQL in Supabase**

```sql
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS sleep_score real;
```

Run this via Supabase dashboard SQL editor or `mcp__supabase__apply_migration`.

- [ ] **Step 2: Verify column exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'workout_checkins' AND column_name = 'sleep_score';
```

Expected: one row showing `sleep_score | real`

- [ ] **Step 3: Commit migration record**

```bash
git add -A && git commit -m "feat: add sleep_score column to workout_checkins"
```

---

### Task 2: Update TypeScript interfaces for sleep_score

**Files:**
- Modify: `src/app/workouts/components/DailyCheckin.tsx:12` (Checkin interface)
- Modify: `src/lib/local-db.ts:66-77` (LocalWorkoutCheckin interface)

- [ ] **Step 1: Add sleep_score to DailyCheckin Checkin interface**

In `src/app/workouts/components/DailyCheckin.tsx`, add to the `Checkin` interface after `sleep`:

```typescript
sleep_score?: number | null;
```

- [ ] **Step 2: Add sleep_score to LocalWorkoutCheckin**

In `src/lib/local-db.ts`, add to the `LocalWorkoutCheckin` interface after `sleep`:

```typescript
sleep_score: number | null;
```

- [ ] **Step 3: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -5
```

Expected: no type errors related to sleep_score

- [ ] **Step 4: Commit**

```bash
git add src/app/workouts/components/DailyCheckin.tsx src/lib/local-db.ts
git commit -m "feat: add sleep_score to TypeScript interfaces"
```

---

### Task 3: Add biometrics format detection and parser to cronometer route

**Files:**
- Modify: `src/app/api/import/cronometer/route.ts`

This is the core task. The existing route handles wide-format nutrition CSVs. We add detection for the long-format biometrics CSV and a completely separate code path.

- [ ] **Step 1: Add format detection function**

Add after the existing `compact` function (around line 34):

```typescript
/** Detect if CSV is biometrics long-format (Day,Group,Metric,Unit,Amount) */
function isBiometricsFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  return normalized.includes("day") && normalized.includes("metric") && normalized.includes("amount");
}
```

- [ ] **Step 2: Add metric mapping and pivot function**

Add after the detection function:

```typescript
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
        // Keep first (manual Weight preferred over Apple Health)
        if (day.weight == null) day.weight = amount;
        break;
      case "Body Fat":
      case "Body Fat (Apple Health)":
        if (day.body_fat_pct == null) day.body_fat_pct = amount;
        break;
      case "Sleep":
      case "Sleep (Apple Health)":
        // Sum all sleep sessions per day
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
        // Average all HR readings per day
        day.hr_sum = (day.hr_sum ?? 0) + amount;
        day.hr_count = (day.hr_count ?? 0) + 1;
        break;
      case "Mood":
        day.mood = Math.min(5, Math.max(1, Math.round(amount)));
        break;
      case "Energy Level":
        day.energy = Math.min(5, Math.max(1, Math.round(amount)));
        break;
      // Skip: Height (static), Recovery (1 row, using Shortcut going forward)
    }
  }

  return byDate;
}
```

- [ ] **Step 3: Add biometrics upsert handler**

Add a new function after `pivotBiometrics`:

```typescript
async function importBiometrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: Record<string, string>[]
): Promise<{ imported: number; skipped: number; checkins: number; journal: number }> {
  const byDate = pivotBiometrics(rows);
  let imported = 0;
  let skipped = 0;
  let checkinCount = 0;
  let journalCount = 0;

  for (const [date, day] of byDate) {
    // Build checkin fields (selective merge — don't overwrite existing)
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

    // Mood/Energy → journal_entries (update only, never create)
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

    imported++;
  }

  skipped = rows.length - [...byDate.values()].length;

  return { imported: byDate.size, skipped, checkins: checkinCount, journal: journalCount };
}
```

- [ ] **Step 4: Update POST handler with format branching**

Replace the existing POST handler body (after auth check and file reading, around line 53) to branch on format:

```typescript
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

  // Existing nutrition import below (unchanged)
```

The rest of the existing nutrition import code stays exactly as-is.

- [ ] **Step 5: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/import/cronometer/route.ts
git commit -m "feat: add biometrics long-format CSV import to cronometer route"
```

---

### Task 4: Update health webhook to accept sleep_score

**Files:**
- Modify: `src/app/api/integrations/health/route.ts:23`

- [ ] **Step 1: Add sleep_score to destructured body fields**

In the destructuring on line 23, add `sleep_score` to the list:

```typescript
const { date, hrv, hrv_rmssd, readiness, mindfulness_minutes, sleep_hours, sleep_score, weight, shin_pain, waist_cm, pns_index, sns_index, stress_index, kubios_readiness, mean_hr, body_fat_pct, steps, active_calories, resting_hr, vo2_max } = body;
```

- [ ] **Step 2: Add sleep_score to checkin fields mapping**

After the `sleep_hours` mapping (line 36), add:

```typescript
if (sleep_score != null) { checkinFields.sleep_score = sleep_score; imported.push("sleep_score"); }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/integrations/health/route.ts
git commit -m "feat: accept sleep_score in Apple Health webhook"
```

---

### Task 5: Add sleep_score to AI context builder and dashboard sparklines

**Files:**
- Modify: `src/lib/ai/context-builders.ts:71`
- Modify: `src/app/page.tsx` (sparkline data and checkin type)

- [ ] **Step 1: Add sleep_score to context builder select query**

In `src/lib/ai/context-builders.ts:71`, add `sleep_score` to the select string:

```typescript
.select("date, hrv, hrv_rmssd, sleep, sleep_score, weight, readiness, shin_pain, waist_cm, pns_index, sns_index, stress_index, kubios_readiness, mean_hr, body_fat_pct, tags")
```

- [ ] **Step 2: Add sleep_score to AI context output**

In the same file, after the sleep line (around line 140), add:

```typescript
if (latest.sleep_score != null) parts.push(`Sleep Score: ${latest.sleep_score}%`);
```

- [ ] **Step 3: Add sleep_score to dashboard checkin type**

In `src/app/page.tsx`, add `sleep_score` to the checkin interface (around line 15):

```typescript
sleep_score: number | null;
```

- [ ] **Step 4: Add sleep_score to dashboard select query**

In `src/app/page.tsx`, add `sleep_score` to the checkin select (around line 288):

```typescript
.select("date, weight, body_fat_pct, hrv, hrv_rmssd, sleep, sleep_score, readiness, kubios_readiness, steps, active_calories, resting_hr, vo2_max")
```

- [ ] **Step 5: Add sleep_score sparkline**

In the sparklines array in `src/app/page.tsx` (around line 688), add after the Sleep entry:

```typescript
{ label: "Sleep Score", data: dates.map((d) => checkinMap.get(d)?.sleep_score ?? null), color: "var(--color-desert-celestial)", unit: "%", format: (v) => v.toFixed(0) },
```

- [ ] **Step 6: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/context-builders.ts src/app/page.tsx
git commit -m "feat: add sleep_score to AI context and dashboard sparklines"
```

---

### Task 6: Update settings UI result display and documentation

**Files:**
- Modify: `src/app/settings/page.tsx:119` (upload result message)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update upload result to show biometrics-specific counts**

In `src/app/settings/page.tsx:117-119`, update the success message to handle the biometrics response which returns `{ imported, skipped, checkins, journal }`:

```typescript
if (res.ok) {
  const parts = [`${source}: ${data.imported} dates imported`];
  if (data.skipped) parts.push(`${data.skipped} skipped`);
  if (data.checkins) parts.push(`${data.checkins} checkin records`);
  if (data.journal) parts.push(`${data.journal} journal updates`);
  if (data.nutrition) parts.push(`${data.nutrition} nutrition records`);
  if (data.total_value) parts.push(`$${data.total_value}`);
  setUploadResult(parts.join(", "));
}
```

- [ ] **Step 2: Update Cronometer description in settings**

In `src/app/settings/page.tsx:214`, change the description from nutrition-only:

```typescript
<p className="text-desert-text-3 text-xs">Upload CSV — nutrition or biometrics export</p>
```

- [ ] **Step 3: Update CLAUDE.md**

Add `sleep_score` to the workout_checkins field documentation. Update Cronometer integration docs to mention biometrics format support. Add note about Garmin recovery via iOS Shortcut → readiness field.

Key additions to document:
- `workout_checkins.sleep_score` (real, nullable, percentage from Garmin/Apple Health)
- Cronometer import now accepts both nutrition (wide) and biometrics (long) CSV formats
- Garmin Recovery: map to `readiness` field via iOS Shortcut (divide by 10 for 0-10 scale)
- Apple Health webhook now accepts `sleep_score`

- [ ] **Step 4: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit and push**

```bash
git add src/app/settings/page.tsx CLAUDE.md
git commit -m "feat: update settings UI and docs for biometrics import"
git push
```

---

## Task Dependencies

```
Task 1 (migration) ─┐
                     ├─> Task 3 (parser) ─> Task 6 (UI + docs)
Task 2 (types)  ────┘          │
                               ├─> Task 4 (webhook)
                               └─> Task 5 (AI + sparklines)
```

Tasks 1 and 2 can run in parallel. Task 3 depends on both. Tasks 4, 5, and 6 can run in parallel after Task 3.
