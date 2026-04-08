# Life OS — Data Point Inventory

Complete inventory of every data point tracked, where it's recorded, and how it enters Life OS.

---

## Body & Recovery

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Weight (kg) | Bathroom scale | Manual — DailyCheckin form OR Apple Health webhook |
| Body Fat (%) | Bathroom scale (bioimpedance) | Manual — DailyCheckin form OR Apple Health webhook |
| Waist (cm) | Tape measure | Manual — DailyCheckin form OR Apple Health webhook |
| Sleep (hrs) | Apple Watch / manual | Manual — DailyCheckin form OR Apple Health webhook |
| HRV SDNN (ms) | Apple Watch | Apple Health webhook (iOS Shortcut) OR manual |
| HRV RMSSD (ms) | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| PNS Index | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| SNS Index | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| Stress Index (Baevsky) | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| Kubios Readiness (0-100) | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| Mean HR (bpm) | Polar H10 → Kubios app | Manual — DailyCheckin Kubios section |
| Readiness (1-10) | Subjective self-assessment | Manual — DailyCheckin form OR Apple Health webhook |
| Shin Pain (0-10) | Subjective self-assessment | Manual — DailyCheckin form OR Apple Health webhook |
| Mindfulness (mins) | Apple Watch / manual | Apple Health webhook → habit_logs auto-match |
| Tags | Subjective annotation | Manual — DailyCheckin form |

## Training

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Session type | User selection | Manual — SessionLogger (upper/lower strength/volume) |
| Session label | User input | Manual — SessionLogger |
| Session date | Auto (today) or manual | Manual — SessionLogger |
| Session notes | User input | Manual — SessionLogger |
| Exercise name | Predefined list per session type | Manual — SessionLogger |
| Exercise weight (kg) | Gym — plates on bar | Manual — SessionLogger |
| Exercise sets | Counting | Manual — SessionLogger |
| Exercise reps | Counting | Manual — SessionLogger |
| Exercise RPE | Subjective (easy/med/hard/fail) | Manual — SessionLogger |

## Journal

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Mood (1-5) | Subjective self-assessment | Manual — Journal page |
| Energy (1-5) | Subjective self-assessment | Manual — Journal page |
| Gratitude | Written reflection | Manual — Journal page |
| Reflection | Written reflection | Manual — Journal page |
| Wins | Written reflection | Manual — Journal page |

## Habits

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Habit completion (boolean) | Self-tracking | Manual — Habits page toggle |
| Habit value (numeric) | Self-tracking or webhook | Manual toggle OR Apple Health webhook (mindfulness) |
| Streak (computed) | Derived from habit_logs | Calculated client-side |

## Goals & Tasks

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Goal title, area, timeframe | Planning | Manual — Goals page |
| Goal % complete | Derived from key results | Calculated from KR progress |
| Key result title, target, current, unit | Tracking | Manual — Goals page |
| Task title, description, priority, status | Planning / doing | Manual — Tasks page |
| Task due date | Planning | Manual — Tasks page |
| Task completed_at | Automatic on status change | Auto-set when marked done |

## Finances

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Account balances | Bank apps / Binance | Manual — Finances page OR Binance API sync (daily cron) |
| Account metadata (type, currency, tier, asset class) | Configuration | Manual — Finances page |
| Income streams (amount, frequency) | Payslips / knowledge | Manual — Finances page |
| Expense items (category, amount, frequency) | Bills / knowledge | Manual — Finances page |
| Liabilities (amount, due day) | Statements | Manual — Finances page |
| Bank transactions | myBOQ bank export | OFX file upload — Settings page |
| Exchange rates (NZD/AUD/USD) | Binance API | Binance sync cron (daily) |
| Tax flags | Tax planning | Manual — Finances page |
| Finance snapshots | Point-in-time capture | Manual or auto — Finances page |
| Crypto balances | Binance account | API sync — Binance cron (daily, auto-creates accounts) |

## Calendar

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Events (title, date, time, all_day) | Google Calendar / manual | iCal feed sync — Settings page OR manual entry |
| Event notes, colour | User annotation | Manual — Calendar page |

## Knowledge Base

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Notes (title, content, type) | Writing / research / AI | Manual — Knowledge page |
| Note tags | Categorisation | Manual — Knowledge page |
| Linked goals/tasks | Cross-referencing | Manual — Knowledge page |
| AI insights | Claude analysis export | Import Insight modal (.md/.txt upload or paste) |

## Weekly Review

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| 8-section reflection (habits, goals, tasks, finance, wins, challenges, intentions) | Written reflection | Manual — Review page |
| Auto-pulled snapshots (habits, goals, tasks, finance) | Derived from other tables | Auto-fetched on review creation |
| AI summary | Anthropic API | Generated on review completion |

## Integration Metadata

| Data Point | Source of Recording | How It Gets Into Life OS |
|---|---|---|
| Sync logs (source, status, record count) | System | Auto-logged by each integration endpoint |
| Raw imports (Cronometer payload) | Cronometer CSV | CSV upload — Settings page (stored raw, not parsed) |

---

## Cronometer — Potential New Data Points

These fields are available in Cronometer CSV exports but **not currently mapped** into Life OS.

### Biometric Mapping (eliminates double-entry)

| Cronometer Field | Maps To | Life OS Table | Priority |
|---|---|---|---|
| Weight | weight | workout_checkins | **High** — currently manual |
| Body Fat | body_fat_pct | workout_checkins | **High** — currently manual |
| Waist | waist_cm | workout_checkins | **High** — currently manual |
| Mood | mood (1-5) | journal_entries | **High** — currently manual |
| Energy | energy (1-5) | journal_entries | **High** — currently manual |
| Sleep Score | sleep | workout_checkins | **Medium** — also from Apple Health |

### Nutrition Data (new capabilities)

| Cronometer Field | Potential Feature | Priority |
|---|---|---|
| Calories (in) | Daily calorie card + deficit/surplus vs weight trend | **High** |
| Protein (g) | Protein per kg card on workout days (target 1.6-2.2g/kg) | **High** |
| Carbs (g) | Macro ratio breakdown (donut/bar chart) | **Medium** |
| Fat (g) | Macro ratio breakdown | **Medium** |
| Fibre (g) | Trend line, gut health tracking | **Low** |
| Water (ml) | Daily hydration tracker | **Low** |
| Magnesium, Zinc, Vitamin D, Iron | Micronutrient flags — alert when below RDA (affects recovery/HRV) | **Medium** |
| Sodium, Potassium | Electrolyte balance tracking | **Low** |
| Caffeine | Correlate with sleep quality and HRV | **Medium** |
| Alcohol | Correlate with HRV drop and sleep disruption | **Medium** |

### Cross-Domain Insights (AI context enrichment)

| Insight | Data Required | Value |
|---|---|---|
| Underfueling alert | Calories + weight trend + HRV drop | Flag calorie deficit + declining RMSSD |
| Protein target check | Protein + weight + training day | Did you hit 1.8g/kg on training days? |
| Sleep-nutrition link | Caffeine/alcohol + sleep score + next-day HRV | Quantify impact of late caffeine |
| Recovery nutrition | Calories + RPE + next-day readiness | Were rest day calories sufficient? |
