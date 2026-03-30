import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const TABLE_MAP: Record<string, string> = {
  account: "finance_accounts",
  income: "finance_income",
  expense: "finance_expenses",
  liability: "finance_liabilities",
  tax_flag: "finance_tax_flags",
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");

  const dbTable = TABLE_MAP[table || ""];
  if (!dbTable) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  db.prepare(`DELETE FROM ${dbTable} WHERE id = ?`).run(parseInt(id));
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");

  if (table === "account" && body.balance !== undefined) {
    db.prepare(
      `UPDATE finance_accounts SET balance = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(body.balance, parseInt(id));
    const row = db.prepare("SELECT * FROM finance_accounts WHERE id = ?").get(parseInt(id));
    return NextResponse.json(row);
  }

  if (table === "tax_flag" && body.resolve) {
    db.prepare(
      `UPDATE finance_tax_flags SET resolved_at = datetime('now') WHERE id = ?`
    ).run(parseInt(id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown update" }, { status: 400 });
}