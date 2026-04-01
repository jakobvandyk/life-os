import { createClient } from "@/lib/supabase-server";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const date = row["Date"] || row["date"];
    if (!date) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("raw_imports").upsert(
      {
        user_id: user.id,
        source: "cronometer",
        external_id: date,
        payload: row,
      },
      { onConflict: "source,external_id" }
    );

    if (error) {
      skipped++;
    } else {
      imported++;
    }
  }

  // Log to integration_syncs
  await supabase.from("integration_syncs").insert({
    user_id: user.id,
    source: "cronometer",
    status: "ok",
    records_imported: imported,
  });

  return Response.json({ imported, skipped });
}
