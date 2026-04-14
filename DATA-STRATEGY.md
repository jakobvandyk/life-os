# Life OS — Data Strategy & Workflow Guide

The guiding principle: **device > automated sync > CSV import > manual entry**. Each data point has one authoritative source. Other sources fill gaps but never overwrite.

---

## Source Authority Hierarchy

```
1. Device/API (Apple Health, Binance, Garmin)    — highest trust, most frequent
2. Structured Import (Cronometer CSV, OFX)       — batch, user-initiated
3. Manual Entry (DailyCheckin, Journal, etc.)     — user override, always respected
```

The twist: **manual entry is both lowest priority AND the ultimate override**. If a device writes a value, it's trusted. But if a user explicitly edits that value manually afterward, the manual value wins. The import endpoint enforces this by only filling null fields (selective merge).

---

## Data Flow Map

### Body & Recovery (`workout_checkins`)

| Field | Authoritative Source | Backup Source | Conflict Rule |
|---|---|---|---|
| weight | Apple Health (scale → Watch → webhook) | Cronometer CSV (fills nulls only) | AH overwrites; Cronometer skips if filled |
| body_fat_pct | Apple Health | Cronometer CSV (fills nulls only) | Same |
| waist_cm | Manual (tape measure) | Cronometer CSV (fills nulls only) | Cronometer skips if filled; AH writes if sent |
| sleep | Apple Health (Watch auto-detection) | Manual DailyCheckin fallback | AH overwrites; manual is fallback when Watch not worn |
| hrv (SDNN) | Apple Health (Watch) | — | Single source |
| hrv_rmssd | Manual (Kubios app readout) | — | Single source (manual transcription from Polar H10 → Kubios) |
| pns_index, sns_index, stress_index | Manual (Kubios app readout) | — | Single source |
| kubios_readiness | Manual (Kubios app readout) | — | Single source (0-100 scale) |
| mean_hr | Manual (Kubios app readout) | — | Single source |
| readiness (1-10) | Apple Health (subjective, via Shortcut) | Manual DailyCheckin | AH overwrites |
| shin_pain (0-10) | Manual (subjective) | Apple Health (via Shortcut) | Manual is primary |
| steps | Apple Health (Garmin → AH) | — | Single source |
| active_calories | Apple Health (Garmin → AH) | — | Single source |
| resting_hr | Apple Health (Garmin → AH) | — | Single source |
| vo2_max | Apple Health (Garmin → AH) | — | Single source |
| mindfulness_minutes | Apple Health → habit_logs auto-match | — | Requires habit named "mindful*" or "meditat*" |

### Nutrition (`nutrition_daily`)

| Field | Authoritative Source | Notes |
|---|---|---|
| calories, protein_g, carbs_g, fat_g, fiber_g | Cronometer CSV | Single source — log food in Cronometer, import CSV |
| water_ml, caffeine_mg, alcohol_g | Cronometer CSV | Single source |
| vitamin_d_iu, iron_mg, magnesium_mg, zinc_mg | Cronometer CSV | Single source |
| sodium_mg, potassium_mg | Cronometer CSV | Single source |

### Journal (`journal_entries`)

| Field | Authoritative Source | Backup Source | Conflict Rule |
|---|---|---|---|
| mood (1-5) | Manual (Journal page) | Cronometer CSV | Cronometer only fills nulls on **existing** entries — never creates entries |
| energy (1-5) | Manual (Journal page) | Cronometer CSV | Same |
| gratitude, reflection, wins | Manual | — | Single source |

### Finances

| Table | Authoritative Source | Notes |
|---|---|---|
| finance_accounts (crypto) | Binance API (daily 8am cron) | Auto-creates accounts per holding, overwrites balance |
| finance_accounts (bank/savings) | Manual | User updates balance from bank app |
| finance_transactions | OFX import (myBOQ) | Deduplicated by FITID |
| finance_income, finance_expenses | Manual | Recurring cashflow items |
| finance_exchange_rates | Binance API | Global table, daily update |

### Calendar (`calendar_events`)

| Source | Direction | Notes |
|---|---|---|
| Google Calendar | One-way pull via iCal feed | Deduplicated by external_uid, 90-day window |
| Manual | Life OS only | Not synced back to Google |

---

## Daily Workflow (Recommended)

### Morning (5 min)

1. **iOS Shortcut fires automatically** (or manual trigger)
   - Reads Apple Health: HRV SDNN, sleep, weight, steps, resting HR, VO2 max, active calories, readiness, mindfulness
   - Posts to `/api/integrations/health` webhook
   - Data lands in `workout_checkins` for today

2. **Kubios HRV reading** (if doing morning readiness test with Polar H10)
   - Open Kubios app, do 3-min measurement
   - Open Life OS → Workouts → DailyCheckin → Kubios section
   - Enter: RMSSD, PNS index, SNS index, stress index, readiness (0-100), mean HR
   - Save

3. **Journal entry** (optional)
   - Life OS → Journal → select mood + energy emoji
   - Write gratitude/reflection if desired

### During the Day

4. **Log food in Cronometer** (as you eat)
   - This is the only place you track nutrition — Cronometer is the source of truth

5. **Habits** — toggle as completed throughout the day

6. **Tasks** — update status, add new tasks as needed

### Evening / End of Day

7. **Workout logging** (if training day)
   - Life OS → Workouts → SessionLogger
   - Select session type, log exercises with weight/sets/reps/RPE
   - Save session

8. **Manual DailyCheckin top-ups** (if Apple Health missed anything)
   - Body fat from scale (if not synced)
   - Waist measurement (tape measure days)
   - Shin pain rating
   - Tags (rest-day, travel, deload, etc.)

### Weekly

9. **Cronometer CSV export + import** (Sunday evening)
   - Cronometer → Export → Daily Summary CSV
   - Life OS → Settings → Cronometer → Upload CSV
   - This backfills: nutrition_daily (full week), plus weight/body_fat/waist gaps in workout_checkins

10. **Weekly Review** (Sunday)
    - Life OS → Review → fill 8 sections
    - Generate AI summary
    - Optionally export data for deeper Claude analysis

### Monthly / As Needed

11. **OFX bank import** — download from myBOQ, upload in Settings
12. **iCal sync** — trigger in Settings (or auto if cron configured)
13. **Finance account balance updates** — manually update bank/savings balances
14. **Goal progress updates** — update key result current values

---

## Data Device Chain

```
Garmin Watch
  └─ Garmin Connect (auto-sync)
       └─ Apple Health (auto-sync)
            └─ iOS Shortcut (scheduled or manual)
                 └─ POST /api/integrations/health
                      └─ workout_checkins (upsert by user_id + date)

Polar H10
  └─ Kubios App (Bluetooth)
       └─ User reads values
            └─ Manual entry in DailyCheckin
                 └─ workout_checkins (upsert by user_id + date)

Bathroom Scale
  └─ Apple Health (if smart scale) OR manual reading
       └─ iOS Shortcut OR manual DailyCheckin
            └─ workout_checkins.weight

Cronometer App
  └─ CSV export (weekly)
       └─ POST /api/import/cronometer
            └─ nutrition_daily (upsert)
            └─ workout_checkins (selective merge — nulls only)
            └─ journal_entries (update existing only)
            └─ raw_imports (audit trail)

Binance
  └─ API (daily cron, 8am)
       └─ GET /api/sync/binance
            └─ finance_accounts (upsert per holding)
            └─ finance_exchange_rates (overwrite)

Google Calendar
  └─ iCal feed (read-only)
       └─ GET /api/sync/ical
            └─ calendar_events (upsert by external_uid)

myBOQ Bank
  └─ OFX export (manual)
       └─ POST /api/import/ofx
            └─ finance_transactions (upsert by FITID)
```

---

## iOS Shortcut Specification

The iOS Shortcut is the critical automated bridge between Apple Health (which aggregates Garmin + Apple Watch + scale data) and Life OS.

### Trigger
- **Automation**: Daily at a set time (e.g. 6:30am, after Watch has synced overnight data)
- **Manual**: Shortcut can also be run on-demand from Home Screen / widget

### HealthKit Queries

Each query reads from Apple Health for **today's date**:

| HealthKit Type | Query Method | Field Name in JSON |
|---|---|---|
| `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | Most recent sample | `hrv` |
| `HKQuantityTypeIdentifierRestingHeartRate` | Most recent sample | `resting_hr` |
| `HKQuantityTypeIdentifierVO2Max` | Most recent sample | `vo2_max` |
| `HKQuantityTypeIdentifierStepCount` | Sum for today | `steps` |
| `HKQuantityTypeIdentifierActiveEnergyBurned` | Sum for today | `active_calories` |
| `HKQuantityTypeIdentifierAppleSleepingWristTemperature` | — | (not used) |
| `HKCategoryTypeIdentifierSleepAnalysis` | Total sleep duration (hrs) | `sleep_hours` |
| `HKQuantityTypeIdentifierBodyMass` | Most recent sample (kg) | `weight` |
| `HKQuantityTypeIdentifierBodyFatPercentage` | Most recent sample (%) | `body_fat_pct` |
| `HKQuantityTypeIdentifierWaistCircumference` | Most recent sample (cm) | `waist_cm` |
| `HKQuantityTypeIdentifierAppleExerciseTime` | Sum for today (mins) | (not currently used — could map to active_minutes) |
| `HKCategoryTypeIdentifierMindfulSession` | Sum duration (mins) | `mindfulness_minutes` |

### JSON Payload

```json
{
  "date": "2026-04-12",
  "hrv": 48,
  "sleep_hours": 7.5,
  "weight": 89.2,
  "body_fat_pct": 18.5,
  "waist_cm": 84.0,
  "resting_hr": 52,
  "vo2_max": 45.2,
  "steps": 8432,
  "active_calories": 520,
  "mindfulness_minutes": 10,
  "readiness": 7,
  "shin_pain": 2
}
```

All fields except `date` are optional — only include fields that have data. The webhook ignores null/missing fields.

### HTTP Request

```
POST https://life-os-zeta-brown.vercel.app/api/integrations/health
Headers:
  Content-Type: application/json
  x-api-key: {HEALTH_WEBHOOK_KEY}
Body: {JSON payload above}
```

### Shortcut Build Steps (Apple Shortcuts)

```
1.  [Text] → Set variable "apiKey" to your HEALTH_WEBHOOK_KEY value
2.  [Text] → Set variable "baseURL" to "https://life-os-zeta-brown.vercel.app/api/integrations/health"
3.  [Date] → Get current date → Format as "yyyy-MM-dd" → Set variable "today"

--- HealthKit Reads ---

4.  [Find Health Samples]
    Type: Heart Rate Variability SDNN
    Sort: by Start Date, descending
    Limit: 1
    → Get "Value" → Set variable "hrv"

5.  [Find Health Samples]
    Type: Resting Heart Rate
    Sort: by Start Date, descending
    Limit: 1
    → Get "Value" → Round to integer → Set variable "resting_hr"

6.  [Find Health Samples]
    Type: VO2 Max
    Sort: by Start Date, descending
    Limit: 1
    → Get "Value" → Set variable "vo2_max"

7.  [Find Health Samples]
    Type: Step Count
    Start Date: Start of Today
    End Date: Now
    → Calculate Statistics: Sum
    → Round to integer → Set variable "steps"

8.  [Find Health Samples]
    Type: Active Energy Burned
    Start Date: Start of Today
    End Date: Now
    → Calculate Statistics: Sum
    → Round to integer → Set variable "active_calories"

9.  [Find Health Samples]
    Type: Sleep Analysis
    Start Date: Yesterday 6pm
    End Date: Today 12pm
    → Calculate Statistics: Sum of duration (hours)
    → Round to 1 decimal → Set variable "sleep_hours"

10. [Find Health Samples]
    Type: Body Mass
    Sort: by Start Date, descending
    Limit: 1
    → Get "Value" (kg) → Set variable "weight"

11. [Find Health Samples]
    Type: Body Fat Percentage
    Sort: by Start Date, descending
    Limit: 1
    → Get "Value" (multiply by 100 if decimal) → Set variable "body_fat_pct"

12. [Find Health Samples]
    Type: Mindful Minutes
    Start Date: Start of Today
    End Date: Now
    → Calculate Statistics: Sum
    → Round to integer → Set variable "mindfulness_minutes"

--- Manual Inputs (optional) ---

13. [Ask for Input]
    Prompt: "Garmin Recovery % (or skip)"
    Input Type: Number
    Default: (empty)
    → If has value: Calculate (value ÷ 10) → Round to 1 decimal → Set variable "readiness"

14. [Ask for Input]
    Prompt: "Shin pain 0-10 (or skip)"
    Input Type: Number
    Default: (empty)
    → If has value: Set variable "shin_pain"

--- Build JSON ---

15. [Dictionary]
    Add key "date" → value: today
    For each variable (hrv, resting_hr, vo2_max, steps, active_calories,
    sleep_hours, weight, body_fat_pct, mindfulness_minutes, readiness, shin_pain):
      → If variable has value: add key → value
      → If variable is empty: skip (do NOT add null)

--- Send Request ---

16. [Get Contents of URL]
    URL: baseURL
    Method: POST
    Headers:
      Content-Type: application/json
      x-api-key: apiKey
    Request Body: JSON (the dictionary from step 15)

17. [If] response contains "ok"
      → [Show Notification] "Life OS synced ✓" (optional)
    [Otherwise]
      → [Show Notification] "Life OS sync failed" (optional)
```

### Notes on Shortcut Construction

- **Sleep window**: Query sleep from yesterday 6pm to today 12pm to capture overnight sleep. Apple Watch records sleep in segments; summing the duration gives total hours.
- **Body fat**: Some scales store body fat as a decimal (0.185 = 18.5%). Check your scale's format — multiply by 100 if needed before sending.
- **Readiness (Garmin Recovery)**: Garmin Recovery/Body Battery doesn't sync to Apple Health — it's proprietary. The Shortcut prompts for it manually. Divide by 10 to map Garmin's 0-100% to the 0-10 readiness scale (e.g., 75% → 7.5). Skip the prompt on days you don't check Garmin.
- **Shin pain**: Subjective 0-10 scale. Prompted in the Shortcut, skip if no pain. Can also enter manually in DailyCheckin.
- **Error handling**: The webhook returns `{ ok: true, imported: [...] }` on success. If the Shortcut gets a non-200 response, it's usually an auth issue (wrong API key) or the server is cold-starting (retry once).
- **Garmin data availability**: Steps, resting HR, and VO2 max from Garmin take time to sync to Apple Health. Running the Shortcut at 6:30am+ ensures overnight Garmin → AH sync has completed.

---

## Known Gaps & Future Work

### Currently Not Tracked (Garmin-exclusive, no Apple Health sync)
- Body Battery (Garmin proprietary energy score, 0-100)
- Training Load / Training Status / Training Effect
- Stress Score (Garmin's all-day stress, different from Kubios Baevsky)
- Recovery Time estimate
- Intensity Minutes

These require the Garmin Health API (enterprise-only) or an unofficial Garmin Connect library. Not worth the fragility for a personal dashboard — revisit if Garmin opens their API.

### Improvement Opportunities
- **Cronometer auto-import**: Replace weekly CSV upload with Cronometer API (if/when they offer one) or a Shortcut that exports and uploads automatically
- **Goal auto-progress**: Link key results to computed queries (e.g. "body fat %" auto-reads latest workout_checkins.body_fat_pct)
- **Review snapshots**: Persist habit/goal/finance data at time of weekly review creation, not re-fetch on view
- **Transaction reconciliation**: Compare budgeted expenses to actual OFX transactions
