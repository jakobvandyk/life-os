import { createClient } from "@/lib/supabase-server";

// ofx-js is CommonJS, import dynamically
async function parseOFX(text: string) {
  const ofx = await import("ofx-js");
  return ofx.parse(text);
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

  let parsed: Record<string, unknown>;
  try {
    parsed = await parseOFX(text);
  } catch {
    return Response.json({ error: "Failed to parse OFX file" }, { status: 400 });
  }

  // Navigate OFX structure to find transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ofx = parsed?.OFX as any;
  const stmtrs =
    ofx?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS ||
    ofx?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;

  if (!stmtrs) {
    return Response.json({ error: "No statement found in OFX file" }, { status: 400 });
  }

  const tranList = stmtrs?.BANKTRANLIST?.STMTTRN || [];
  const transactions = Array.isArray(tranList) ? tranList : [tranList];

  let imported = 0;
  let skipped = 0;
  let totalValue = 0;

  for (const txn of transactions) {
    if (!txn || !txn.FITID) {
      skipped++;
      continue;
    }

    // Parse OFX date format: YYYYMMDD or YYYYMMDDHHMMSS
    const rawDate = txn.DTPOSTED || "";
    const dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const amountCents = Math.round(parseFloat(txn.TRNAMT || "0") * 100);
    const type = amountCents >= 0 ? "income" : "expense";

    const { error } = await supabase.from("finance_transactions").upsert(
      {
        user_id: user.id,
        date: dateStr,
        amount: amountCents,
        currency: "AUD",
        description: txn.NAME || txn.MEMO || "",
        type,
        import_source: "boq_ofx",
        external_id: txn.FITID,
      },
      { onConflict: "import_source,external_id" }
    );

    if (error) {
      skipped++;
    } else {
      imported++;
      totalValue += Math.abs(amountCents);
    }
  }

  await supabase.from("integration_syncs").insert({
    user_id: user.id,
    source: "boq_ofx",
    status: "ok",
    records_imported: imported,
  });

  return Response.json({
    imported,
    skipped,
    total_value: `$${(totalValue / 100).toFixed(2)}`,
  });
}
