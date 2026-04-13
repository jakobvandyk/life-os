import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notification_id: number; duration_minutes: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { notification_id, duration_minutes } = body;
  if (!notification_id || !duration_minutes) {
    return Response.json({ error: "notification_id and duration_minutes required" }, { status: 400 });
  }

  const snoozedUntil = new Date(Date.now() + duration_minutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({ snoozed_until: snoozedUntil, read: false })
    .eq("id", notification_id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, snoozed_until: snoozedUntil });
}
