import { type Channel, type NotificationPayload, type NotificationPreferences } from "./types";

async function getWebPush() {
  const wp = await import("web-push");
  wp.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
  return wp;
}

export async function sendPush(
  subscription: Record<string, unknown>,
  payload: NotificationPayload,
  notificationId?: number
): Promise<void> {
  const wp = await getWebPush();
  await wp.sendNotification(
    subscription as unknown as import("web-push").PushSubscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link,
      notificationId,
    })
  );
}

export async function sendTelegram(
  chatId: string,
  payload: NotificationPayload,
  replyMarkup?: Record<string, unknown>
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: payload.body,
    parse_mode: "Markdown",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.result?.message_id ?? null;
}

export async function replyTelegram(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup: Record<string, unknown>
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
  });
}

export async function writeInApp(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: { id: number } | null }> } } } },
  userId: string,
  payload: NotificationPayload
): Promise<number | null> {
  const { data } = await supabase.from("notifications")
    .insert({
      user_id: userId,
      rule_type: payload.rule_type,
      channel: "inapp" as const,
      title: payload.title,
      body: payload.body,
      link: payload.link || null,
      entity_id: payload.entity_id || null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function dispatch(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: { id: number } | null }> } } } },
  prefs: NotificationPreferences,
  enabledChannels: Channel[],
  payload: NotificationPayload,
  isQuietHours: boolean,
  replyMarkup?: Record<string, unknown>
): Promise<void> {
  let telegramMsgId: number | null = null;
  let inappId: number | null = null;

  for (const channel of enabledChannels) {
    if (isQuietHours && (channel === "push" || channel === "telegram")) continue;
    if (channel === "push" && (!prefs.push_enabled || !prefs.push_subscription)) continue;
    if (channel === "telegram" && (!prefs.telegram_enabled || !prefs.telegram_chat_id)) continue;
    if (channel === "inapp" && !prefs.inapp_enabled) continue;

    if (channel === "inapp") {
      inappId = await writeInApp(supabase, prefs.user_id, payload);
    } else if (channel === "telegram" && prefs.telegram_chat_id) {
      telegramMsgId = await sendTelegram(prefs.telegram_chat_id, payload, replyMarkup);
      await (supabase.from("notifications") as unknown as { insert: (data: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: unknown }> } } })
        .insert({
          user_id: prefs.user_id,
          rule_type: payload.rule_type,
          channel: "telegram",
          title: payload.title,
          body: payload.body,
          link: payload.link || null,
          entity_id: payload.entity_id || null,
          telegram_message_id: telegramMsgId,
        })
        .select("id")
        .single();
    } else if (channel === "push" && prefs.push_subscription) {
      if (!inappId) {
        inappId = await writeInApp(supabase, prefs.user_id, payload);
      }
      await sendPush(prefs.push_subscription, payload, inappId ?? undefined).catch(() => {});
      await (supabase.from("notifications") as unknown as { insert: (data: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: unknown }> } } })
        .insert({
          user_id: prefs.user_id,
          rule_type: payload.rule_type,
          channel: "push",
          title: payload.title,
          body: payload.body,
          link: payload.link || null,
          entity_id: payload.entity_id || null,
        })
        .select("id")
        .single();
    }
  }
}
