import { db, type SyncQueueItem } from "./local-db";
import { supabase } from "./supabase";

export async function queueWrite(
  tableName: string,
  operation: "insert" | "update" | "delete",
  payload: Record<string, unknown>
) {
  await db.sync_queue.add({
    table_name: tableName,
    operation,
    payload,
    created_at: new Date().toISOString(),
    status: "pending",
  });
}

export async function processSyncQueue(): Promise<{
  synced: number;
  errors: number;
}> {
  const pending = await db.sync_queue
    .where("status")
    .equals("pending")
    .toArray();

  let synced = 0;
  let errors = 0;

  for (const item of pending) {
    try {
      await replayOperation(item);
      await db.sync_queue.update(item.localId!, { status: "synced" });
      synced++;
    } catch (err) {
      await db.sync_queue.update(item.localId!, {
        status: "error",
        error_message: err instanceof Error ? err.message : "Unknown error",
      });
      errors++;
    }
  }

  // Clean up synced items older than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await db.sync_queue
    .where("status")
    .equals("synced")
    .filter((item) => item.created_at < oneHourAgo)
    .delete();

  return { synced, errors };
}

async function replayOperation(item: SyncQueueItem) {
  const { table_name, operation, payload } = item;

  switch (operation) {
    case "insert": {
      const { error } = await supabase.from(table_name).insert(payload);
      if (error) throw new Error(error.message);
      break;
    }
    case "update": {
      const { id, ...fields } = payload;
      const { error } = await supabase
        .from(table_name)
        .update(fields)
        .eq("id", id);
      if (error) throw new Error(error.message);
      break;
    }
    case "delete": {
      const { error } = await supabase
        .from(table_name)
        .delete()
        .eq("id", payload.id);
      if (error) throw new Error(error.message);
      break;
    }
  }
}

export async function seedLocalCache(userId: string) {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const [
    { data: tasks },
    { data: habits },
    { data: habitLogs },
    { data: journal },
    { data: goals },
    { data: sessions },
    { data: checkins },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "done"),
    supabase
      .from("habits")
      .select("id, user_id, name, icon, active")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("habit_logs")
      .select("id, user_id, habit_id, date, value")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo),
    supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("date", fourteenDaysAgo),
    supabase
      .from("goals")
      .select("id, user_id, title, status, percent_complete")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("workout_sessions")
      .select("id, user_id, type, label, date, notes")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo),
    supabase
      .from("workout_checkins")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo),
  ]);

  // Bulk put (upsert by id) — clear and repopulate
  await Promise.all([
    tasks && db.tasks.bulkPut(tasks),
    habits && db.habits.bulkPut(habits),
    habitLogs && db.habit_logs.bulkPut(habitLogs),
    journal && db.journal_entries.bulkPut(journal),
    goals && db.goals.bulkPut(goals),
    sessions && db.workout_sessions.bulkPut(sessions),
    checkins && db.workout_checkins.bulkPut(checkins),
  ]);
}
