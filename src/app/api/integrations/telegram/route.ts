import { getServiceClient } from "@/lib/supabase-service";
import { replyTelegram, answerCallbackQuery, editMessageReplyMarkup } from "@/lib/notifications/channels";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.log("Telegram auth failed. Got:", JSON.stringify(secret), "Expected:", JSON.stringify(process.env.TELEGRAM_WEBHOOK_SECRET?.slice(0, 4) + "..."));
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  let update: Record<string, unknown>;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Handle callback queries (inline keyboard button presses) ---
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (update.callback_query) {
    const cq = update.callback_query as any;
    const chatId = cq.message.chat.id;
    const callbackData = cq.data as string;

    const { data: pref } = await (db.from("notification_preferences") as any)
      .select("user_id").eq("telegram_chat_id", String(chatId)).maybeSingle();
    if (!pref) {
      await answerCallbackQuery(cq.id, "Not connected to Life OS");
      return Response.json({ ok: true });
    }

    if (callbackData.startsWith("habit_done:")) {
      const habitId = parseInt(callbackData.split(":")[1]);
      const today = new Date().toISOString().substring(0, 10);

      await (db.from("habit_logs") as any).upsert(
        { user_id: pref.user_id, habit_id: habitId, date: today, value: 1 },
        { onConflict: "habit_id,date" }
      );

      const { data: habit } = await (db.from("habits") as any)
        .select("name").eq("id", habitId).single();

      await answerCallbackQuery(cq.id, `✓ ${habit?.name || "Habit"} logged!`);

      const existingMarkup = cq.message.reply_markup as { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> } | undefined;
      if (existingMarkup?.inline_keyboard) {
        const updatedKeyboard = existingMarkup.inline_keyboard.map((row: Array<{ text: string; callback_data: string }>) =>
          row.map((btn) =>
            btn.callback_data === callbackData
              ? { text: `✅ ${habit?.name || "Done"}`, callback_data: "noop" }
              : btn
          )
        );
        await editMessageReplyMarkup(chatId, cq.message.message_id, { inline_keyboard: updatedKeyboard });
      }
    }

    return Response.json({ ok: true });
  }

  // --- Handle text messages ---
  const message = update.message as any;
  if (!message?.text) return Response.json({ ok: true });

  const chatId = message.chat.id;
  const text = (message.text as string).trim();

  if (text === "/start") {
    await replyTelegram(chatId, "Welcome to Life OS Bot!\n\nTo connect, go to Life OS Settings → Notifications → Connect Telegram, then send me the pairing code with:\n`/pair <code>`");
    return Response.json({ ok: true });
  }

  if (text.startsWith("/pair ")) {
    const code = text.substring(6).trim();
    const { data: pairing } = await (db.from("telegram_pairing_codes") as any)
      .select("user_id, expires_at").eq("code", code).maybeSingle();

    if (!pairing) {
      await replyTelegram(chatId, "Invalid or expired pairing code. Get a new one from Life OS Settings.");
      return Response.json({ ok: true });
    }

    if (new Date(pairing.expires_at) < new Date()) {
      await (db.from("telegram_pairing_codes") as any).delete().eq("code", code);
      await replyTelegram(chatId, "That code has expired. Get a new one from Life OS Settings.");
      return Response.json({ ok: true });
    }

    await (db.from("notification_preferences") as any)
      .update({ telegram_chat_id: String(chatId), telegram_enabled: true })
      .eq("user_id", pairing.user_id);
    await (db.from("telegram_pairing_codes") as any).delete().eq("code", code);

    await replyTelegram(chatId, "✓ Connected to Life OS! You'll receive notifications here.");
    return Response.json({ ok: true });
  }

  // --- Authenticated commands ---
  const { data: pref } = await (db.from("notification_preferences") as any)
    .select("user_id").eq("telegram_chat_id", String(chatId)).maybeSingle();

  if (!pref) {
    await replyTelegram(chatId, "Not connected. Send /start for setup instructions.");
    return Response.json({ ok: true });
  }

  const userId = pref.user_id;
  const today = new Date().toISOString().substring(0, 10);

  if (text.startsWith("/done ")) {
    const query = text.substring(6).trim().toLowerCase();
    const { data: habits } = await (db.from("habits") as any)
      .select("id, name").eq("user_id", userId).eq("active", true);

    const matches = (habits || []).filter((h: { id: number; name: string }) =>
      h.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      await replyTelegram(chatId, `No habit found matching "${query}"`);
    } else if (matches.length === 1) {
      await (db.from("habit_logs") as any).upsert(
        { user_id: userId, habit_id: matches[0].id, date: today, value: 1 },
        { onConflict: "habit_id,date" }
      );
      const { data: logs } = await (db.from("habit_logs") as any)
        .select("date").eq("habit_id", matches[0].id).order("date", { ascending: false }).limit(30);
      const streak = countStreak(logs || []);
      await replyTelegram(chatId, `✓ *${matches[0].name}* logged! (${streak} day streak)`);
    } else {
      const list = matches.map((h: { id: number; name: string }, i: number) => `${i + 1}. ${h.name}`).join("\n");
      await replyTelegram(chatId, `Multiple matches:\n${list}\n\nBe more specific.`);
    }
    return Response.json({ ok: true });
  }

  if (text.startsWith("/mood ")) {
    const val = parseInt(text.substring(6).trim());
    if (isNaN(val) || val < 1 || val > 5) {
      await replyTelegram(chatId, "Usage: /mood <1-5>");
      return Response.json({ ok: true });
    }
    await (db.from("journal_entries") as any).upsert(
      { user_id: userId, date: today, mood: val },
      { onConflict: "user_id,date" }
    );
    await replyTelegram(chatId, `✓ Mood set to ${val}/5`);
    return Response.json({ ok: true });
  }

  if (text.startsWith("/energy ")) {
    const val = parseInt(text.substring(8).trim());
    if (isNaN(val) || val < 1 || val > 5) {
      await replyTelegram(chatId, "Usage: /energy <1-5>");
      return Response.json({ ok: true });
    }
    await (db.from("journal_entries") as any).upsert(
      { user_id: userId, date: today, energy: val },
      { onConflict: "user_id,date" }
    );
    await replyTelegram(chatId, `✓ Energy set to ${val}/5`);
    return Response.json({ ok: true });
  }

  if (text.startsWith("/snooze ")) {
    if (!message.reply_to_message) {
      await replyTelegram(chatId, "Reply to a notification message with /snooze <duration>\nExamples: /snooze 30m, /snooze 1h, /snooze 2h");
      return Response.json({ ok: true });
    }
    const durationStr = text.substring(8).trim().toLowerCase();
    const minutes = parseDuration(durationStr);
    if (!minutes) {
      await replyTelegram(chatId, "Invalid duration. Examples: 30m, 1h, 2h");
      return Response.json({ ok: true });
    }
    const replyMsgId = message.reply_to_message.message_id;
    const { data: notif } = await (db.from("notifications") as any)
      .select("id").eq("user_id", userId).eq("telegram_message_id", replyMsgId).maybeSingle();
    if (!notif) {
      await replyTelegram(chatId, "Couldn't find that notification. Make sure you're replying to a Life OS notification.");
      return Response.json({ ok: true });
    }
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await (db.from("notifications") as any)
      .update({ snoozed_until: snoozedUntil, read: false }).eq("id", notif.id);
    await replyTelegram(chatId, `✓ Snoozed for ${durationStr}`);
    return Response.json({ ok: true });
  }

  if (text === "/help") {
    await replyTelegram(chatId, [
      "*Life OS Bot Commands*\n",
      "/done <habit> — Log a habit as done",
      "/mood <1-5> — Set today's mood",
      "/energy <1-5> — Set today's energy",
      "/snooze <duration> — Reply to a notification to snooze it (e.g. 30m, 1h, 2h)",
      "/help — Show this message",
    ].join("\n"));
    return Response.json({ ok: true });
  }

  await replyTelegram(chatId, "Unknown command. Send /help for available commands.");
  return Response.json({ ok: true });
}

function countStreak(logs: Array<{ date: string }>): number {
  if (logs.length === 0) return 0;
  const dates = logs.map((l) => l.date).sort().reverse();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function parseDuration(s: string): number | null {
  const hMatch = s.match(/^(\d+)h$/);
  if (hMatch) return parseInt(hMatch[1]) * 60;
  const mMatch = s.match(/^(\d+)m$/);
  if (mMatch) return parseInt(mMatch[1]);
  return null;
}
