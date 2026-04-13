# Life OS Notification System — Design Spec

## Goal

Add a configurable notification system to Life OS with three delivery channels (Web Push, Telegram, In-app) supporting timed reminders, data-driven alerts, daily summaries, and per-task reminders.

## Architecture

A Vercel cron runs every 15 minutes, evaluates notification rules against current data, and dispatches to enabled channels. System events (sync/import) write directly to the in-app notifications table.

```
Vercel Cron (every 15min) → POST /api/cron/notifications
                           → Evaluate timed + data-driven rules
                           ├→ Web Push (web-push + VAPID)
                           ├→ Telegram (Bot API sendMessage)
                           └→ In-app (notifications table)

Sync/Import endpoints ────→ In-app (notifications table, direct write)
```

Timed reminders snap to the nearest 15-minute window. All times evaluated in the user's configured timezone. Quiet hours suppress all push and Telegram notifications.

---

## Data Model

### New table: `notification_preferences`

One row per user. Global notification settings.

| Column | Type | Default | Notes |
|---|---|---|---|
| user_id | uuid, PK, FK → auth.users | | |
| timezone | text | "Pacific/Auckland" | IANA timezone string |
| quiet_start | time | "22:00" | |
| quiet_end | time | "07:00" | |
| push_enabled | boolean | false | Master toggle — Web Push |
| telegram_enabled | boolean | false | Master toggle — Telegram |
| inapp_enabled | boolean | true | Master toggle — In-app |
| push_subscription | jsonb, nullable | null | Browser Push API subscription object |
| telegram_chat_id | text, nullable | null | From Telegram bot pairing |

RLS: `auth.uid() = user_id`

### New table: `notification_rules`

One row per notification type per user. Configurable per-notification settings.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | bigint, PK | auto | |
| user_id | uuid, FK | | |
| rule_type | text | | One of the defined rule types below |
| enabled | boolean | true | |
| time | time, nullable | | For timed reminders. Null for data-driven. |
| day_of_week | smallint, nullable | | 0=Sunday..6=Saturday. Only used by weekly_review. |
| channels | text[] | | e.g. `{"push", "telegram"}` |
| last_fired_at | timestamptz, nullable | null | Prevents duplicate firing within the same window |

RLS: `auth.uid() = user_id`
Unique constraint: `(user_id, rule_type)`

### New table: `notifications`

Log of sent notifications. In-app display + audit trail.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | bigint, PK | auto | |
| user_id | uuid, FK | | |
| rule_type | text | | |
| channel | text | | `push`, `telegram`, `inapp` |
| title | text | | |
| body | text | | |
| link | text, nullable | | Deep link path, e.g. "/habits" |
| entity_id | text, nullable | | Task/goal/habit ID for deduplication |
| read | boolean | false | For in-app dismissal |
| snoozed_until | timestamptz, nullable | null | If set, notification re-fires after this time |
| telegram_message_id | bigint, nullable | null | Telegram message ID, for matching /snooze replies |
| created_at | timestamptz | now() | |

RLS: `auth.uid() = user_id`
Index: `(user_id, read, created_at DESC)` for in-app queries

### Modified table: `tasks`

| Column | Type | Notes |
|---|---|---|
| reminder_before | interval, nullable | e.g. "1 hour", "2 days", "1 week". Null = no reminder. |

Preset options in UI: None, 15 min, 30 min, 1 hour, 1 day, 2 days, 1 week, Custom (number + unit picker for minutes/hours/days/weeks).

---

## Notification Rule Types

### Timed Reminders

| rule_type | Default time | Default channels | Description |
|---|---|---|---|
| `morning_checkin` | 07:00 | push | Remind to log weight, sleep, HRV |
| `habit_reminder` | 20:00 | push | Remind to complete today's habits |
| `journal_prompt` | 21:00 | push | Remind to write journal entry |
| `weekly_review` | 18:00 (Sunday) | push, telegram | Remind to complete weekly review |
| `daily_summary` | 21:30 | telegram | End-of-day digest |

### Data-Driven Alerts

| rule_type | Default channels | Condition |
|---|---|---|
| `streak_at_risk` | telegram, inapp | Active streak > 3 days, no log today, checked after 15:00 user time |
| `goal_deadline` | inapp | Goal target_date within 7 days, status != completed. Once per goal. |
| `task_overdue` | inapp | Task due_date < today, status != done. Once per task. |
| `task_reminder` | push, inapp | Task has due_date + reminder_before set, now >= due_date - reminder_before. Once per task. |

### System Events

| rule_type | Default channels | Trigger |
|---|---|---|
| `sync_event` | inapp | Written directly by sync/import endpoints on completion. Not cron-evaluated. |

---

## Evaluation Logic

The cron endpoint (`POST /api/cron/notifications`) runs every 15 minutes, protected by `CRON_SECRET` (same pattern as Binance sync).

### Flow

1. Load all users with `notification_preferences` (single-user system currently, but designed for multi-user)
2. For each user:
   a. Calculate current time in user's timezone
   b. Check quiet hours — if in quiet window, skip push and telegram (still evaluate inapp)
   c. Evaluate each enabled rule:
      - **Timed rules**: Is current time within the rule's 15-minute window? Is `last_fired_at` not today (or not this week for weekly_review)?
      - **Data-driven rules**: Query the relevant table for matching conditions. Check `notifications` table for existing notification with same `rule_type` + `entity_id` today (deduplication).
   d. For each rule that fires: dispatch to each enabled channel that is also enabled at the preference level

### Deduplication

- Timed reminders: `last_fired_at` on the rule itself. Updated after firing. Checked against today (or this week for weekly).
- Data-driven alerts: Check `notifications` table for existing row with same `rule_type` + `entity_id` + same day.
- Task reminders: Check `notifications` table for existing row with `rule_type = 'task_reminder'` + `entity_id = task.id`.

### Snooze

When a notification has `snoozed_until` set:
- The cron skips it during normal deduplication (it's "pending re-fire")
- When `now() >= snoozed_until`, the cron re-fires the notification to its original channels and clears `snoozed_until`
- Snooze is available via:
  - **In-app:** "Snooze" button on each notification item in the bell dropdown, with options: 15 min, 30 min, 1 hour, 2 hours
  - **Telegram:** Reply to a notification message with `/snooze <duration>` (e.g. `/snooze 1h`, `/snooze 30m`)
  - **Web Push:** Action button "Snooze 1h" on push notifications (uses the Notification Actions API, handled by service worker posting to a snooze endpoint)

**Snooze API endpoint:** `POST /api/notifications/snooze` — accepts `{ notification_id, duration_minutes }`, sets `snoozed_until = now() + duration`, marks `read = false`. Session-authenticated.

### Daily Summary Content

Built from queries against the day's data:
- Habits: count done / total due today
- Streaks: any at risk
- Steps, active calories (from workout_checkins)
- Weight + trend (vs 7-day average)
- Mood/energy if logged
- Tasks completed / remaining

Formatted as Telegram markdown for Telegram channel, plain text for push.

---

## Channel Implementation

### Web Push

**Library:** `web-push` npm package

**Env vars:**
- `VAPID_PUBLIC_KEY` — public VAPID key
- `VAPID_PRIVATE_KEY` — private VAPID key
- `VAPID_SUBJECT` — contact URI, e.g. `mailto:jakob@...`

**Subscription flow:**
1. User clicks "Enable Push Notifications" in settings
2. Call `Notification.requestPermission()` in browser
3. If granted, call `navigator.serviceWorker.ready` then `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
4. POST subscription object to a settings update endpoint
5. Saved to `notification_preferences.push_subscription`

**Service worker additions to `public/sw.js`:**

```javascript
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Life OS", {
      body: data.body,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { link: data.link, notificationId: data.notificationId },
      actions: [
        { action: "open", title: "Open" },
        { action: "snooze", title: "Snooze 1h" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { link, notificationId } = event.notification.data || {};

  if (event.action === "snooze" && notificationId) {
    // Fire-and-forget snooze request
    event.waitUntil(
      fetch("/api/notifications/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notificationId, duration_minutes: 60 }),
      })
    );
    return;
  }

  // Default: open the link
  const target = link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
```

**Manifest update:** No manifest changes needed for push — permissions are requested at runtime via the Push API.

### Telegram

**Bot setup (one-time manual):**
1. Create bot via @BotFather → get token
2. Set `TELEGRAM_BOT_TOKEN` env var
3. Register webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with URL `https://life-os-zeta-brown.vercel.app/api/integrations/telegram` and `secret_token` matching `TELEGRAM_WEBHOOK_SECRET` env var

**Pairing flow:**
1. User clicks "Connect Telegram" in notification settings
2. App generates a pairing code (8-char random, e.g. `LOS-a7x3`), stored in a `telegram_pairing_codes` table with user_id, code, expires_at (now + 10 min)
3. UI shows: "Send this to @YourBot on Telegram:" with copyable `/pair LOS-a7x3`
4. User messages bot → Telegram sends to webhook endpoint
5. Webhook matches code → saves `chat.id` to `notification_preferences.telegram_chat_id`
6. Bot replies: "Connected to Life OS"
7. Pairing code deleted

**Webhook endpoint (`POST /api/integrations/telegram`):**
- Verify `X-Telegram-Bot-Api-Secret-Token` header matches `TELEGRAM_WEBHOOK_SECRET`
- Look up user by `chat_id` from `notification_preferences` (for all commands except `/start` and `/pair`)
- Parse message text:
  - `/start` → reply with connection instructions
  - `/pair <code>` → validate code, save chat_id, confirm
  - `/done <habit>` → fuzzy match habit name against user's active habits, log today's date. Reply with confirmation + updated streak count. If ambiguous (multiple matches), reply with numbered options.
  - `/mood <1-5>` → upsert journal entry for today with mood value. Reply with confirmation.
  - `/energy <1-5>` → upsert journal entry for today with energy value. Reply with confirmation.
  - `/snooze <duration>` → if sent as a reply to a notification message, parse duration (e.g. "1h", "30m", "2h"), set `snoozed_until` on the notification. Reply with confirmation. If not a reply, reply with usage instructions.
  - `/help` → list available commands
  - Anything else → reply "Unknown command. Send /help for available commands."
- Uses service-role Supabase client (no user session, bot messages are external)
- Habit fuzzy matching: case-insensitive substring match on `habits.name`. If exactly one match, execute. If multiple, reply with numbered list. If none, reply "No habit found matching '<input>'".

**Sending notifications:**
```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
{ "chat_id": "<chat_id>", "text": "<markdown>", "parse_mode": "Markdown" }
```
The Telegram API returns `result.message_id` — save this to `notifications.telegram_message_id` so `/snooze` replies can be matched back to the notification.

**Disconnecting:** "Disconnect" button clears `telegram_chat_id`. Optional: send a goodbye message to the chat before clearing.

**Temporary table for pairing:**

| Column | Type | Notes |
|---|---|---|
| id | bigint, PK | |
| user_id | uuid, FK | |
| code | text, unique | e.g. "LOS-a7x3" |
| expires_at | timestamptz | now() + 10 minutes |

No RLS needed (accessed by service role from webhook). Expired rows cleaned up by the cron or on new pairing attempts.

### In-App

**Storage:** `notifications` table (defined above).

**Display:** `NotificationBell` component in sidebar.
- Bell icon with unread count badge (number, capped at "9+")
- Click opens a dropdown panel listing recent notifications (last 20)
- Each item shows: icon (based on rule_type), title, body preview, timestamp, link
- Click notification → mark as read + navigate to link
- "Mark all read" button at top of dropdown

**Querying:** On page load, fetch unread count. On bell click, fetch recent 20. Poll every 60 seconds for new count (or use Supabase realtime if desired, but polling is simpler for v1).

---

## Settings UI

New **Notifications** section in Settings page, between Integrations and Exchange Rates.

### Global Settings Card
- **Timezone** — select dropdown with common IANA timezones, auto-detected from `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load
- **Quiet hours** — two time inputs (start, end)

### Channel Connections (3 cards)
Same card style as integration cards:

**Web Push**
- Not connected: "Enable Push" button
- Connected: "Push notifications enabled" with "Disable" button
- Shows browser permission status

**Telegram**
- Not connected: "Connect Telegram" button → shows pairing instructions + code
- Connected: "Telegram connected" with chat_id displayed + "Disconnect" button

**In-App**
- Toggle on/off (master suppress for badge/dropdown)

### Notification Rules List
Below the channel cards. Each rule as a row:

| Toggle | Name | Description | Time | Channels |
|---|---|---|---|---|
| [on/off] | Morning Check-in | Log weight, sleep, HRV | 07:00 | [push] [telegram] [inapp] |

- Toggle: enables/disables the rule
- Time: editable time picker, only shown for timed reminders
- Day: shown only for weekly_review (day-of-week selector)
- Channels: clickable chip toggles, only showing connected channels

### Task Reminder
Not in this section. Per-task `reminder_before` dropdown on the task create/edit form:
- Options: None, 15 min, 30 min, 1 hour, 1 day, 2 days, 1 week, Custom
- Custom: number input + unit select (minutes/hours/days/weeks)
- Only visible when task has a due_date set

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/cron/notifications/route.ts` | Create | Cron endpoint — load preferences, evaluate rules, dispatch |
| `src/app/api/integrations/telegram/route.ts` | Create | Telegram webhook — pairing, /start, /done, /mood, /energy, /snooze, /help |
| `src/app/api/notifications/snooze/route.ts` | Create | Snooze endpoint — sets snoozed_until on a notification |
| `src/lib/notifications/evaluate.ts` | Create | Rule evaluation — timed checks, data queries, dedup |
| `src/lib/notifications/channels.ts` | Create | sendPush(), sendTelegram(), writeInApp() |
| `src/lib/notifications/defaults.ts` | Create | Default rule definitions, seed function |
| `src/lib/notifications/summary.ts` | Create | Build daily summary content from day's data |
| `src/app/settings/page.tsx` | Modify | Add Notifications section |
| `src/components/NotificationBell.tsx` | Create | Sidebar bell + dropdown |
| `src/app/layout.tsx` | Modify | Add NotificationBell to sidebar |
| `public/sw.js` | Modify | Add push + notificationclick handlers |
| `public/manifest.json` | No change | Push permissions requested at runtime, not in manifest |
| `vercel.json` | Modify | Add `/api/cron/notifications` every 15min |
| `CLAUDE.md` | Modify | Document notification system |

### New Supabase tables
- `notification_preferences` (RLS: auth.uid() = user_id)
- `notification_rules` (RLS: auth.uid() = user_id)
- `notifications` (RLS: auth.uid() = user_id)
- `telegram_pairing_codes` (no RLS, service-role access)

### Modified table
- `tasks`: add `reminder_before` interval column

### New env vars
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

---

## Out of Scope (v1)

- Supabase Realtime for in-app notifications — polling is sufficient for v1
- Notification preferences sync to offline/local-db — settings are online-only
- Email notifications — not needed for single-user PWA
- Extended Telegram interactions beyond /done, /mood, /energy, /snooze (e.g., creating tasks, updating goals)
- Telegram inline keyboards / callback queries — text commands are sufficient for v1
