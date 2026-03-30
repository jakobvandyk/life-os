import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (key === "status" && value === "done") {
      fields.push('status = ?', 'completed_at = datetime("now")');
      values.push("done");
    } else if (key === "status") {
      fields.push("status = ?", "completed_at = NULL");
      values.push(value as string);
    } else {
      fields.push(`${key} = ?`);
      values.push(value as string | number | null);
    }
  }

  values.push(parseInt(id));
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values
  );
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(parseInt(id));
  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM tasks WHERE id = ?").run(parseInt(id));
  return NextResponse.json({ success: true });
}