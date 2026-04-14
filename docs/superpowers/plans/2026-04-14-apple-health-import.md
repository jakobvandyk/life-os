# Apple Health XML Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import historical Apple Health data from the standard `export.xml` file (~240MB) into `workout_checkins`, enabling backfill of weight, body fat, HRV, resting HR, steps, active calories, VO2 max, sleep hours, and mean HR spanning years of data.

**Architecture:** Client-side streaming XML parser reads the file in chunks (never loads 240MB into memory), extracts only the 9 relevant `<Record>` types, aggregates per day, then POSTs the compact daily JSON (~1 object per day) to a new `/api/import/apple-health` endpoint that upserts into `workout_checkins` with the same selective merge pattern (don't overwrite existing values).

**Tech Stack:** Browser File API (ReadableStream), Next.js API route, Supabase, TypeScript

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/apple-health-parser.ts` | Create | Client-side streaming XML parser — reads file in chunks, extracts records, aggregates per day |
| `src/app/api/import/apple-health/route.ts` | Create | API endpoint — accepts aggregated daily JSON, upserts into workout_checkins with selective merge |
| `src/app/settings/page.tsx` | Modify | Add Apple Health import UI — file input, progress indicator, upload trigger |
| `CLAUDE.md` | Modify | Document the new import route |

---

### Task 1: Create client-side Apple Health XML streaming parser

**Files:**
- Create: `src/lib/apple-health-parser.ts`

This is the core client-side module. It reads an Apple Health `export.xml` using the File API's ReadableStream, processes line-by-line to avoid loading 240MB into memory, and returns aggregated daily records.

- [ ] **Step 1: Create the parser module**

```typescript
/**
 * Client-side streaming parser for Apple Health export.xml
 * Reads in chunks via ReadableStream, extracts relevant <Record> types,
 * aggregates per day into compact daily objects.
 */

/** Metric types we extract from Apple Health XML */
const METRIC_TYPES = new Set([
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierBodyFatPercentage",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierVO2Max",
  "HKQuantityTypeIdentifierHeartRate",
  "HKCategoryTypeIdentifierSleepAnalysis",
]);

/** Sleep values that count as "asleep" (exclude InBed and Awake) */
const ASLEEP_VALUES = new Set([
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
  "HKCategoryValueSleepAnalysisAsleep", // Legacy pre-iOS 16
]);

export interface DailyRecord {
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
}

interface DayAccumulator {
  weight?: number;
  body_fat_pct?: number;
  hrv?: number;
  resting_hr?: number;
  steps: number;
  active_calories: number;
  vo2_max?: number;
  hr_sum: number;
  hr_count: number;
  sleep_seconds: number;
}

/** Extract an XML attribute value from a line */
function attr(line: string, name: string): string | null {
  // Match both single and double quoted attributes
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = line.match(re);
  return m ? m[1] : null;
}

/** Parse Apple Health date string "2024-01-01 08:00:00 +1300" → date part "2024-01-01" */
function parseDate(dateStr: string): string {
  return dateStr.substring(0, 10);
}

/** Parse date string to epoch ms for duration calc */
function parseDateTime(dateStr: string): number {
  // Format: "2024-01-01 23:00:00 +1300"
  // Convert to ISO: "2024-01-01T23:00:00+13:00"
  const iso = dateStr.replace(" ", "T").replace(/ ([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  return new Date(iso).getTime();
}

/**
 * Stream-parse an Apple Health export.xml file.
 * @param file The export.xml File object
 * @param onProgress Called with (bytesRead, totalBytes) for UI progress
 * @returns Array of aggregated daily records
 */
export async function parseAppleHealthExport(
  file: File,
  onProgress?: (bytesRead: number, totalBytes: number) => void
): Promise<DailyRecord[]> {
  const byDate = new Map<string, DayAccumulator>();

  function getDay(date: string): DayAccumulator {
    let day = byDate.get(date);
    if (!day) {
      day = { steps: 0, active_calories: 0, hr_sum: 0, hr_count: 0, sleep_seconds: 0 };
      byDate.set(date, day);
    }
    return day;
  }

  const stream = file.stream();
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let bytesRead = 0;
  const totalBytes = file.size;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += new TextEncoder().encode(value).length;
    buffer += value;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.includes("<Record ")) continue;

      const type = attr(line, "type");
      if (!type || !METRIC_TYPES.has(type)) continue;

      const startDateStr = attr(line, "startDate");
      if (!startDateStr) continue;
      const date = parseDate(startDateStr);

      const day = getDay(date);

      if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        const sleepValue = attr(line, "value");
        if (!sleepValue || !ASLEEP_VALUES.has(sleepValue)) continue;
        const endDateStr = attr(line, "endDate");
        if (!endDateStr) continue;
        const start = parseDateTime(startDateStr);
        const end = parseDateTime(endDateStr);
        if (end > start) {
          day.sleep_seconds += (end - start) / 1000;
        }
        continue;
      }

      const valueStr = attr(line, "value");
      if (!valueStr) continue;
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;

      switch (type) {
        case "HKQuantityTypeIdentifierBodyMass":
          if (day.weight == null) day.weight = value;
          break;
        case "HKQuantityTypeIdentifierBodyFatPercentage": {
          // Apple Health stores as decimal (0.25) or percentage (25) depending on source
          const pct = value <= 1 ? value * 100 : value;
          if (day.body_fat_pct == null) day.body_fat_pct = pct;
          break;
        }
        case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
          if (day.hrv == null) day.hrv = value;
          break;
        case "HKQuantityTypeIdentifierRestingHeartRate":
          if (day.resting_hr == null) day.resting_hr = value;
          break;
        case "HKQuantityTypeIdentifierStepCount":
          day.steps += value;
          break;
        case "HKQuantityTypeIdentifierActiveEnergyBurned":
          day.active_calories += value;
          break;
        case "HKQuantityTypeIdentifierVO2Max":
          if (day.vo2_max == null) day.vo2_max = value;
          break;
        case "HKQuantityTypeIdentifierHeartRate":
          day.hr_sum += value;
          day.hr_count += 1;
          break;
      }
    }

    if (onProgress) onProgress(bytesRead, totalBytes);
  }

  // Process remaining buffer
  if (buffer.includes("<Record ")) {
    const type = attr(buffer, "type");
    if (type && METRIC_TYPES.has(type)) {
      const startDateStr = attr(buffer, "startDate");
      if (startDateStr) {
        const date = parseDate(startDateStr);
        const day = getDay(date);
        // Handle last line same as above (simplified — unlikely to matter)
        const valueStr = attr(buffer, "value");
        if (valueStr) {
          const v = parseFloat(valueStr);
          if (!isNaN(v)) {
            if (type === "HKQuantityTypeIdentifierStepCount") day.steps += v;
            else if (type === "HKQuantityTypeIdentifierActiveEnergyBurned") day.active_calories += v;
          }
        }
      }
    }
  }

  // Convert accumulators to daily records
  const records: DailyRecord[] = [];
  for (const [date, day] of byDate) {
    const record: DailyRecord = { date };
    if (day.weight != null) record.weight = Math.round(day.weight * 10) / 10;
    if (day.body_fat_pct != null) record.body_fat_pct = Math.round(day.body_fat_pct * 10) / 10;
    if (day.hrv != null) record.hrv = Math.round(day.hrv);
    if (day.resting_hr != null) record.resting_hr = Math.round(day.resting_hr);
    if (day.steps > 0) record.steps = Math.round(day.steps);
    if (day.active_calories > 0) record.active_calories = Math.round(day.active_calories);
    if (day.vo2_max != null) record.vo2_max = Math.round(day.vo2_max * 10) / 10;
    if (day.hr_count > 0) record.mean_hr = Math.round(day.hr_sum / day.hr_count);
    if (day.sleep_seconds > 0) record.sleep = Math.round((day.sleep_seconds / 3600) * 10) / 10;
    // Only include if we have at least one metric beyond date
    if (Object.keys(record).length > 1) records.push(record);
  }

  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apple-health-parser.ts
git commit -m "feat: add client-side streaming Apple Health XML parser"
```

---

### Task 2: Create API endpoint for Apple Health daily record upserts

**Files:**
- Create: `src/app/api/import/apple-health/route.ts`

Accepts a JSON array of aggregated daily records from the client-side parser. Upserts into `workout_checkins` with selective merge (don't overwrite existing values). Processes in batches.

- [ ] **Step 1: Create the API route**

```typescript
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

  // Log sync
  await supabase.from("integration_syncs").insert({
    user_id: user.id,
    source: "apple_health_import",
    status: "ok",
    records_imported: upserted,
  });

  return Response.json({ imported: upserted, skipped, total: records.length });
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/import/apple-health/route.ts
git commit -m "feat: add Apple Health daily records import API endpoint"
```

---

### Task 3: Add Apple Health import UI to settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

Add a new integration card for Apple Health XML import below the existing Apple Health webhook card. Includes file input for `.xml`, progress bar during parsing, and result display.

- [ ] **Step 1: Add import for the parser**

At the top of `src/app/settings/page.tsx`, add after the existing imports:

```typescript
import { parseAppleHealthExport } from "@/lib/apple-health-parser";
```

- [ ] **Step 2: Add state for import progress**

After the existing `const ofxRef = useRef<HTMLInputElement>(null);` (line 35), add:

```typescript
const healthXmlRef = useRef<HTMLInputElement>(null);
const [healthImportProgress, setHealthImportProgress] = useState<string | null>(null);
```

- [ ] **Step 3: Add the import handler function**

After the existing `uploadFile` function (after line 132), add:

```typescript
  const importHealthXml = async (file: File) => {
    setSyncing("HealthImport");
    setUploadResult(null);
    setHealthImportProgress("Parsing XML...");
    try {
      const records = await parseAppleHealthExport(file, (read, total) => {
        const pct = Math.round((read / total) * 100);
        setHealthImportProgress(`Parsing XML... ${pct}%`);
      });
      setHealthImportProgress(`Uploading ${records.length} days...`);

      // Send in batches of 200 to avoid massive payloads
      const BATCH = 200;
      let totalImported = 0;
      let totalSkipped = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const res = await fetch("/api/import/apple-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        totalImported += data.imported;
        totalSkipped += data.skipped;
        setHealthImportProgress(`Uploading... ${Math.min(i + BATCH, records.length)}/${records.length} days`);
      }

      setUploadResult(`Apple Health: ${totalImported} days imported, ${totalSkipped} skipped (${records.length} total days parsed)`);
    } catch (e) {
      setUploadResult(`Apple Health: ${e instanceof Error ? e.message : "Import failed"}`);
    }
    setHealthImportProgress(null);
    setSyncing(null);
  };
```

- [ ] **Step 4: Add the UI card**

In the integrations section, AFTER the existing Apple Health webhook card (after line 209, after the closing `</div>` of the Apple Health card), add a new card:

```tsx
            {/* Apple Health Import */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_health" size={20} className="text-desert-danger" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Apple Health Import</p>
                    <p className="text-desert-text-3 text-xs">
                      {healthImportProgress || "Upload export.xml — historical backfill"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={healthXmlRef}
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importHealthXml(file);
                    }}
                  />
                  <button
                    onClick={() => healthXmlRef.current?.click()}
                    disabled={syncing === "HealthImport"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "HealthImport" ? "Importing..." : "Upload XML"}
                  </button>
                </div>
              </div>
            </div>
```

- [ ] **Step 5: Verify build compiles**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add Apple Health XML import UI to settings"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add the Apple Health import to the relevant sections:

a) In the **Project Structure** section, add under `api/`:
```
    ├── import/apple-health/route.ts
```

b) In the **Integrations** section, add after the Apple Health webhook entry:
```
- Apple Health Import: POST /api/import/apple-health (session auth, JSON body)
  - Client-side parser reads export.xml via streaming (handles 200MB+ files)
  - Extracts: weight, body_fat_pct, hrv, resting_hr, steps, active_calories, vo2_max, mean_hr, sleep
  - Aggregates per day (sum: steps/calories/sleep, average: HR, first: weight/body_fat/HRV/resting_hr/VO2)
  - Selective merge upsert — never overwrites existing workout_checkins values
  - Batched upload (200 days per request)
```

c) In the **What's Built** section, add to recent additions:
```
- Apple Health XML import (streaming client-side parser, 200MB+ files, selective merge backfill)
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/Jen/life-os/dashboard && npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: add Apple Health XML import to CLAUDE.md"
git push
```

---

## Task Dependencies

```
Task 1 (parser) ─┐
                  ├─> Task 3 (settings UI) ─> Task 4 (docs)
Task 2 (API)  ───┘
```

Tasks 1 and 2 can run in parallel. Task 3 depends on both. Task 4 depends on Task 3.
