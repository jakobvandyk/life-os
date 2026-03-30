import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const habitId = parseInt(id);

  const existing = db.prepare("SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?").get(habitId, today);

  if (existing) {
    db.prepare("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?").run(
      habitId,
      today
    );
    return NextResponse.json({ completed: false });
  } else {
    db.prepare("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)").run(
      habitId,
      today
    );
    return NextResponse.json({ completed: true });
  }
}