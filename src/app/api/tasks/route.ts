import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = `
    SELECT t.*, p.name as project_name, p.color as project_color 
    FROM tasks t 
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (status && status !== "all") {
    query += ` AND t.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY 
    CASE t.status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'done' THEN 3 END,
    CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
    t.due_date ASC`;

  const tasks = db.prepare(query).all(...params);
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, description, project_id, priority, due_date } = body;

  const result = db.prepare(
      `INSERT INTO tasks (title, description, project_id, priority, due_date) VALUES (?, ?, ?, ?, ?)`
    ).run(
      title,
      description || "",
      project_id || null,
      priority || "medium",
      due_date || null
    );

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(task, { status: 201 });
}