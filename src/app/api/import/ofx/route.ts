import { createClient } from "@/lib/supabase-server";
import { createHash } from "crypto";

// ofx-js is CommonJS, import dynamically
async function parseOFXv2(text: string) {
  const ofx = await import("ofx-js");
  return ofx.parse(text);
}

// SGML OFX (v1) parser — handles CommBank-style files without closing tags
function parseOFXv1(text: string) {
  const transactions: {
    TRNTYPE?: string;
    DTPOSTED?: string;
    TRNAMT?: string;
    FITID?: string;
    NAME?: string;
    MEMO?: string;
  }[] = [];

  let curdef = "AUD";
  let org = "";
  let acctId = "";

  // Extract header fields
  const curdefMatch = text.match(/<CURDEF>([^\n<]+)/);
  if (curdefMatch) curdef = curdefMatch[1].trim();

  const orgMatch = text.match(/<ORG>([^\n<]+)/);
  if (orgMatch) org = orgMatch[1].trim();

  const acctMatch =
    text.match(/<ACCTID>([^\n<]+)/) ||
    text.match(/<BANKID>([^\n<]+)/);
  if (acctMatch) acctId = acctMatch[1].trim();

  // Extract transactions
  const txnBlocks = text.split(/<STMTTRN>/);
  for (let i = 1; i < txnBlocks.length; i++) {
    const block = txnBlocks[i].split(/<\/STMTTRN>/)[0];
    const txn: Record<string, string> = {};

    for (const field of [
      "TRNTYPE",
      "DTPOSTED",
      "TRNAMT",
      "FITID",
      "NAME",
      "MEMO",
    ]) {
      const match = block.match(new RegExp(`<${field}>([^\\n<]*)`));
      if (match) txn[field] = match[1].trim();
    }

    transactions.push(txn);
  }

  return { transactions, curdef, org, acctId };
}

function isSGML(text: string): boolean {
  return text.trimStart().startsWith("OFXHEADER:");
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

  let transactions: {
    TRNTYPE?: string;
    DTPOSTED?: string;
    TRNAMT?: string;
    FITID?: string;
    NAME?: string;
    MEMO?: string;
  }[];
  let currency = "AUD";
  let importSource = "ofx";

  if (isSGML(text)) {
    // OFX v1 (SGML) — CommBank, some older banks
    const result = parseOFXv1(text);
    transactions = result.transactions;
    currency = result.curdef;
    importSource = result.org
      ? `${result.org.toLowerCase().replace(/\s+/g, "_")}_ofx`
      : "ofx";
  } else {
    // OFX v2 (XML) — BOQ, modern banks
    let parsed: Record<string, unknown>;
    try {
      parsed = await parseOFXv2(text);
    } catch {
      return Response.json(
        { error: "Failed to parse OFX file" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ofx = parsed?.OFX as any;
    const stmtrs =
      ofx?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS ||
      ofx?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;

    if (!stmtrs) {
      return Response.json(
        { error: "No statement found in OFX file" },
        { status: 400 }
      );
    }

    const org = ofx?.SIGNONMSGSRSV1?.SONRS?.FI?.ORG || "";
    importSource = org
      ? `${org.toLowerCase().replace(/\s+/g, "_")}_ofx`
      : "ofx";
    currency = stmtrs?.CURDEF || "AUD";

    const tranList = stmtrs?.BANKTRANLIST?.STMTTRN || [];
    transactions = Array.isArray(tranList) ? tranList : [tranList];
  }

  let imported = 0;
  let skipped = 0;
  let totalValue = 0;

  for (const txn of transactions) {
    if (!txn || !txn.DTPOSTED || !txn.TRNAMT) {
      skipped++;
      continue;
    }

    const rawDate = txn.DTPOSTED;
    const dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const amountCents = Math.round(parseFloat(txn.TRNAMT) * 100);
    const type = amountCents >= 0 ? "income" : "expense";
    const description = txn.NAME || txn.MEMO || "";

    // Use FITID if available, otherwise generate a synthetic ID
    const externalId =
      txn.FITID ||
      createHash("sha256")
        .update(`${dateStr}|${amountCents}|${description}`)
        .digest("hex")
        .slice(0, 16);

    const { error } = await supabase.from("finance_transactions").upsert(
      {
        user_id: user.id,
        date: dateStr,
        amount: amountCents,
        currency,
        description,
        type,
        import_source: importSource,
        external_id: externalId,
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
    source: importSource,
    status: "ok",
    records_imported: imported,
  });

  return Response.json({
    imported,
    skipped,
    total_value: (totalValue / 100).toFixed(2),
  });
}
