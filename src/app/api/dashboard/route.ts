import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export function GET() {
  const db = getDb();

  const taskStats = db.prepare(
      `SELECT 
        COUNT(CASE WHEN status != 'done' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'done' AND completed_at >= date('now', '-7 days') THEN 1 END) as completed_this_week,
        COUNT(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 END) as overdue
      FROM tasks`
    ).get();

  const todayTasks = db.prepare(
      `SELECT * FROM tasks 
       WHERE (due_date <= date('now') OR due_date IS NULL) AND status != 'done'
       ORDER BY CASE priority 
         WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 
         WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END
       LIMIT 10`
    ).all();

  const habits = db.prepare(
      `SELECT h.name, h.icon,
        (SELECT COUNT(*) FROM habit_logs hl 
         WHERE hl.habit_id = h.id AND hl.date = date('now')) as done_today
      FROM habits h WHERE h.active = 1`
    ).all();

  // Use new finance tables for spending summary
  const spending = db.prepare(
      `SELECT 
        COALESCE((SELECT SUM(amount) FROM finance_expenses), 0) as month_expenses,
        COALESCE((SELECT SUM(amount) FROM finance_income), 0) as month_income
      `
    ).get();

  const goals = db.prepare(
      `SELECT g.title,
        COALESCE(AVG(CASE WHEN kr.target > 0 THEN (kr.current / kr.target * 100) ELSE 0 END), 0) as progress
      FROM goals g
      LEFT JOIN key_results kr ON kr.goal_id = g.id
      WHERE g.status = 'active'
      GROUP BY g.id`
    ).all();

  const recentJournal = db.prepare(
      `SELECT date, mood, energy FROM journal_entries ORDER BY date DESC LIMIT 7`
    ).all();

  return NextResponse.json({
    taskStats,
    todayTasks,
    habits,
    spending,
    goals,
    recentJournal,
  });
}