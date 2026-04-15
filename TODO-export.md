# Export Route — Missing Data

The export endpoint (`/api/export/analysis`) currently covers 11 tables but is missing several active data sources.

## Currently Exported
- workout_checkins, workout_sessions, workout_exercises
- journal_entries, habit_logs, habits
- goals, key_results
- nutrition_daily
- tasks (completed only)
- weekly_reviews

## Missing — Should Add
1. **finance_accounts** — all accounts (no date filter)
2. **finance_income** — date-filtered
3. **finance_expenses** — date-filtered
4. **finance_liabilities** — all (no date filter)
5. **finance_transactions** — date-filtered
6. **finance_tax_flags** — date-filtered
7. **calendar_events** — date-filtered (include future 90 days)
8. **kb_notes** — all notes + tags + relationships
9. **kb_tags** — all
10. **kb_note_tags** — all
11. **chat_sessions** — date-filtered
12. **chat_messages** — by session IDs
13. **tasks (all statuses)** — currently only exports done tasks; include todo/in_progress

## Lower Priority
- notification_preferences — user config
- notification_rules — rule definitions
- integration_syncs — audit trail
