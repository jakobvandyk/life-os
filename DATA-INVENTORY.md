# Life OS — Data Point Inventory

Complete inventory of every data point tracked, where it originates, and how it enters Life OS.

For workflow details, source authority rules, and the iOS Shortcut spec, see **DATA-STRATEGY.md**.

---

## Body & Recovery (`workout_checkins`)

| Data Point | Origin Device/Source | Ingestion Path | Authority |
|---|---|---|---|
| Weight (kg) | Bathroom scale | Apple Health webhook OR Cronometer CSV (fills nulls) OR manual | Apple Health |
| Body Fat (%) | Scale (bioimpedance) | Apple Health webhook OR Cronometer CSV (fills nulls) OR manual | Apple Health |
| Waist (cm) | Tape measure | Manual OR Cronometer CSV (fills nulls) | Manual |
| Sleep (hrs) | Apple Watch (auto-detect) | Apple Health webhook OR manual fallback | Apple Health |
| HRV SDNN (ms) | Apple Watch | Apple Health webhook | Apple Health |
| HRV RMSSD (ms) | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| PNS Index | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| SNS Index | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| Stress Index (Baevsky) | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| Kubios Readiness (0-100) | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| Mean HR (bpm) | Polar H10 → Kubios app | Manual (DailyCheckin Kubios section) | Kubios |
| Readiness (1-10) | Subjective | Apple Health webhook OR manual | Apple Health |
| Shin Pain (0-10) | Subjective | Manual OR Apple Health webhook | Manual |
| Steps | Garmin → Apple Health | Apple Health webhook | Apple Health |
| Active Calories (kcal) | Garmin → Apple Health | Apple Health webhook | Apple Health |
| Resting HR (bpm) | Garmin → Apple Health | Apple Health webhook | Apple Health |
| VO2 Max (ml/kg/min) | Garmin → Apple Health | Apple Health webhook | Apple Health |
| Mindfulness (mins) | Apple Watch | Apple Health webhook → habit_logs auto-match | Apple Health |
| Tags | Subjective annotation | Manual (DailyCheckin) | Manual |

## Nutrition (`nutrition_daily`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Calories (kcal) | Food logging | Cronometer CSV import | Cronometer |
| Protein (g) | Food logging | Cronometer CSV import | Cronometer |
| Carbs (g) | Food logging | Cronometer CSV import | Cronometer |
| Fat (g) | Food logging | Cronometer CSV import | Cronometer |
| Fiber (g) | Food logging | Cronometer CSV import | Cronometer |
| Water (ml) | Food/drink logging | Cronometer CSV import | Cronometer |
| Caffeine (mg) | Food/drink logging | Cronometer CSV import | Cronometer |
| Alcohol (g) | Food/drink logging | Cronometer CSV import | Cronometer |
| Vitamin D (IU) | Food logging | Cronometer CSV import | Cronometer |
| Iron (mg) | Food logging | Cronometer CSV import | Cronometer |
| Magnesium (mg) | Food logging | Cronometer CSV import | Cronometer |
| Zinc (mg) | Food logging | Cronometer CSV import | Cronometer |
| Sodium (mg) | Food logging | Cronometer CSV import | Cronometer |
| Potassium (mg) | Food logging | Cronometer CSV import | Cronometer |

## Training (`workout_sessions`, `workout_exercises`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Session type | User selection | Manual (SessionLogger) | Manual |
| Exercise name | Predefined per session type | Manual (SessionLogger) | Manual |
| Weight (kg) | Plates on bar | Manual (SessionLogger) | Manual |
| Sets / Reps | Counting | Manual (SessionLogger) | Manual |
| RPE (easy/med/hard/fail) | Subjective effort | Manual (SessionLogger) | Manual |
| Session notes | Annotation | Manual (SessionLogger) | Manual |

## Journal (`journal_entries`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Mood (1-5) | Self-assessment | Manual (Journal page) — Cronometer fills nulls on existing entries | Manual |
| Energy (1-5) | Self-assessment | Manual (Journal page) — Cronometer fills nulls on existing entries | Manual |
| Gratitude / Reflection / Wins | Written reflection | Manual (Journal page) | Manual |

## Habits (`habits`, `habit_logs`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Habit completion | Self-tracking | Manual toggle (Habits page) | Manual |
| Mindfulness auto-log | Apple Watch | Apple Health webhook → auto-match habit by name | Apple Health |
| Streak | Derived from habit_logs + frequency | Calculated client-side | Derived |

## Goals & Tasks (`goals`, `key_results`, `tasks`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Goal / KR definition | Planning | Manual (Goals page) | Manual |
| KR current value | Tracking | Manual update (Goals page) | Manual |
| Task CRUD | Planning / doing | Manual (Tasks page) | Manual |

## Finances

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Crypto balances | Binance account | API sync (daily 8am cron) — auto-creates accounts | Binance API |
| Bank balances | Bank apps | Manual update (Finances page) | Manual |
| Income / Expenses | Payslips / bills | Manual entry (Finances page) | Manual |
| Transactions | myBOQ bank | OFX file upload (Settings) — deduplicated by FITID | OFX file |
| Exchange rates | Binance API | Daily cron sync | Binance API |
| Tax flags | Tax planning | Manual (Finances page) | Manual |

## Calendar (`calendar_events`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Events | Google Calendar | iCal feed sync (one-way pull, 90-day window) | Google Calendar |
| Manual events | User creation | Manual (Calendar page) — not synced back | Manual |

## Knowledge Base (`kb_notes`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| Notes | Writing / research | Manual (Knowledge page) | Manual |
| AI insights | Claude analysis | Import Insight modal (.md/.txt) OR AI Chat "Save to KB" | Import |

## Weekly Review (`weekly_reviews`)

| Data Point | Origin | Ingestion Path | Authority |
|---|---|---|---|
| 8-section reflection | Written reflection | Manual (Review page) | Manual |
| Auto-pulled data | Derived from other tables | Fetched on page load | Derived |
| AI summary | Anthropic API | Generated on form submission | Claude |

## Integration Metadata

| Data Point | Origin | Ingestion Path |
|---|---|---|
| Sync logs | System | Auto-logged by each endpoint → `integration_syncs` |
| Raw imports | Cronometer CSV | Stored as JSONB → `raw_imports` |

---

## Cross-Domain Insight Opportunities

| Insight | Data Required | Value |
|---|---|---|
| Underfueling alert | Calories + weight trend + HRV drop | Flag calorie deficit + declining RMSSD |
| Protein target check | Protein + weight + training day | Hit 1.8g/kg on training days? |
| Sleep-nutrition link | Caffeine/alcohol + sleep hours + next-day HRV | Quantify late caffeine impact |
| Recovery nutrition | Calories + RPE + next-day readiness | Were rest day calories sufficient? |
| Overtraining signal | HRV trend + resting HR trend + sleep trend | Detect sympathetic overload |
| Step-activity correlation | Steps + active calories + mood/energy | Movement impact on wellbeing |
