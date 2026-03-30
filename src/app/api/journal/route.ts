import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (date) {
    const entry = db.prepare("SELECT * FROM journal_entries WHERE date = ?").get(date);
    return NextResponse.json(entry || null);
  }

  const entries = db.prepare("SELECT * FROM journal_entries ORDER BY date DESC LIMIT 30").all();
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { date, mood, energy, gratitude, reflection, wins } = body;

  const existing = db.prepare("SELECT * FROM journal_entries WHERE date = ?").get(date);

  if (existing) {
    db.prepare(
      `UPDATE journal_entries SET mood=?, energy=?, gratitude=?, reflection=?, wins=? WHERE date=?`
    ).run(mood, energy, gratitude || "", reflection || "", wins || "", date);
  } else {
    db.prepare(
      `INSERT INTO journal_entries (date, mood, energy, gratitude, reflection, wins) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(date, mood, energy, gratitude || "", reflection || "", wins || "");
  }

  const entry = db.prepare("SELECT * FROM journal_entries WHERE date = ?").get(date);
  return NextResponse.json(entry);
}