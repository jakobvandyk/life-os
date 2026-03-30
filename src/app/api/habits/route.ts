import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export function GET() {
  const db = getDb();

  const habits = db.prepare(
      `
    SELECT h.*,
      (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.date = date('now')) as completed_today
    FROM habits h
    WHERE h.active = 1
    ORDER BY h.created_at ASC
  `
    ).all() as Record<string, unknown>[];

  const habitsWithStreaks = habits.map((habit) => {
    const logs = db.prepare(
        `SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC`
      ).all(habit.id as number) as { date: string }[];

    let streak = 0;
    const checkDate = new Date();

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      const found = logs.find((l) => l.date === dateStr);
      if (found) {
        streak++;
      } else if (i === 0) {
        // Today not logged yet is ok
      } else {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {...habit, streak };
  });

  return NextResponse.json(habitsWithStreaks);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { name, icon, target_frequency } = body;

  const result = db.prepare(
      `INSERT INTO habits (name, icon, target_frequency) VALUES (?, ?, ?)`
    ).run(name, icon || "✅", target_frequency || "daily");

  const habit = db.prepare("SELECT * FROM habits WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(habit, { status: 201 });
}