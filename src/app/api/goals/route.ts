import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export function GET() {
  const db = getDb();

  const goals = db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC").all() as Record<string, unknown>[];

  const goalsWithKRs = goals.map((goal) => {
    const keyResults = db.prepare("SELECT * FROM key_results WHERE goal_id = ?").all(goal.id as number);
    return {...goal, key_results: keyResults };
  });

  return NextResponse.json(goalsWithKRs);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, description, timeframe, key_results } = body;

  const result = db.prepare(
      `INSERT INTO goals (title, description, timeframe) VALUES (?, ?, ?)`
    ).run(title, description || "", timeframe || "quarterly");

  const goalId = result.lastInsertRowid;

  if (key_results && Array.isArray(key_results)) {
    const insertKR = db.prepare(
      `INSERT INTO key_results (goal_id, title, target, unit) VALUES (?, ?, ?, ?)`
    );
    for (const kr of key_results) {
      insertKR.run(goalId, kr.title, kr.target, kr.unit || "");
    }
  }

  const goal = db.prepare("SELECT * FROM goals WHERE id = ?").get(goalId);
  const krs = db.prepare("SELECT * FROM key_results WHERE goal_id = ?").all(goalId);
  return NextResponse.json({...goal as Record<string, unknown>, key_results: krs }, { status: 201 });
}