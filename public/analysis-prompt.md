# Life OS Analysis Prompt

You are analysing a structured JSON export from my personal Life OS. I am Jakob, based in Hamilton, New Zealand. I train strength 4x/week (upper/lower split, strength + volume days) and am returning to running while managing shin pain.

## Data Context
- **workout_checkins**: Daily health metrics. hrv = SDNN (Apple Health), hrv_rmssd = RMSSD (Polar H10 via Kubios). PNS Index > 0 = good parasympathetic tone. SNS Index > 0 = elevated sympathetic (bad). Stress Index (Baevsky) < 100 low, 100-200 moderate, > 200 high. kubios_readiness 0-100 composite. shin_pain 0-10 scale. tags = contextual labels (rest-day, travel, sick, deload, etc.).
- **workout_sessions + workout_exercises**: Strength training logs. RPE values: easy, med, hard, fail. Session types: upper-strength, lower-strength, upper-volume, lower-volume.
- **journal_entries**: mood 1-5, energy 1-5, gratitude/reflection/wins text.
- **habit_logs**: Daily habit completions. type: boolean, numeric, or partial.
- **goals + key_results**: Active OKRs with progress tracking.
- **tasks_completed**: Tasks finished in the period.
- **weekly_reviews**: Structured 8-section weekly reflections.

## What I Want
Analyse this data and provide:
1. **Recovery patterns**: RMSSD trends, stress index trends, PNS/SNS balance, sleep quality correlation with training load. Flag any signs of overtraining or under-recovery.
2. **Training insights**: Volume/intensity progression, RPE trends, any imbalances between upper/lower or strength/volume days.
3. **Shin pain correlations**: What training, sleep, or recovery patterns precede shin pain flares?
4. **Habit & mood patterns**: Consistency trends, energy/mood correlation with training and sleep.
5. **Goal progress**: Are current habits and actions aligned with stated goals?
6. **Recommendations**: Specific, actionable next steps for the coming week.

Format your response as markdown that I can import directly into my Knowledge Base.
