import Dexie, { type EntityTable } from "dexie";

// Local mirror types (subset of Supabase schema)
export interface LocalTask {
  localId?: number;
  id?: number;
  user_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface LocalHabit {
  localId?: number;
  id?: number;
  user_id: string;
  name: string;
  icon: string;
  active: boolean;
}

export interface LocalHabitLog {
  localId?: number;
  id?: number;
  user_id: string;
  habit_id: number;
  date: string;
  value: number;
}

export interface LocalJournalEntry {
  localId?: number;
  id?: number;
  user_id: string;
  date: string;
  mood: number | null;
  energy: number | null;
  gratitude: string;
  reflection: string;
  wins: string;
}

export interface LocalGoal {
  localId?: number;
  id?: number;
  user_id: string;
  title: string;
  status: string;
  percent_complete: number;
}

export interface LocalWorkoutSession {
  localId?: number;
  id?: number;
  user_id: string;
  type: string;
  label: string;
  date: string;
  notes: string;
}

export interface LocalWorkoutCheckin {
  localId?: number;
  id?: number;
  user_id: string;
  date: string;
  weight: number | null;
  sleep: number | null;
  hrv: number | null;
  readiness: number | null;
  shin: number | null;
  waist: number | null;
}

export interface SyncQueueItem {
  localId?: number;
  table_name: string;
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  created_at: string;
  status: "pending" | "synced" | "error";
  error_message?: string;
}

const db = new Dexie("life-os-local") as Dexie & {
  tasks: EntityTable<LocalTask, "localId">;
  habits: EntityTable<LocalHabit, "localId">;
  habit_logs: EntityTable<LocalHabitLog, "localId">;
  journal_entries: EntityTable<LocalJournalEntry, "localId">;
  goals: EntityTable<LocalGoal, "localId">;
  workout_sessions: EntityTable<LocalWorkoutSession, "localId">;
  workout_checkins: EntityTable<LocalWorkoutCheckin, "localId">;
  sync_queue: EntityTable<SyncQueueItem, "localId">;
};

db.version(1).stores({
  tasks: "++localId, id, user_id, status, due_date",
  habits: "++localId, id, user_id, active",
  habit_logs: "++localId, id, habit_id, date",
  journal_entries: "++localId, id, user_id, date",
  goals: "++localId, id, user_id, status",
  workout_sessions: "++localId, id, user_id, date",
  workout_checkins: "++localId, id, user_id, date",
  sync_queue: "++localId, table_name, status, created_at",
});

export { db };
