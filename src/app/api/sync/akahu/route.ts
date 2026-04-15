import { getServiceClient } from "@/lib/supabase-service";
import { createClient } from "@/lib/supabase-server";

const AKAHU_BASE = "https://api.akahu.io/v1";

async function getUserId(request: Request): Promise<string | null> {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return process.env.HEALTH_USER_ID || null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

function akahuHeaders() {
  return {
    Authorization: `Bearer ${process.env.AKAHU_USER_TOKEN}`,
    "X-Akahu-Id": process.env.AKAHU_APP_TOKEN!,
    Accept: "application/json",
  };
}

interface AkahuAccount {
  _id: string;
  connection: { name: string };
  name: string;
  status: string;
  type: string;
  balance: { currency: string; current: number; available?: number };
}

interface AkahuTransaction {
  _id: string;
  _account: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category?: { name: string; groups?: Record<string, { name: string }> };
  merchant?: { name: string };
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.AKAHU_USER_TOKEN || !process.env.AKAHU_APP_TOKEN) {
    return Response.json(
      { error: "Akahu credentials not configured" },
      { status: 500 }
    );
  }

  const db = getServiceClient();

  // --- Sync accounts ---
  const accountsRes = await fetch(`${AKAHU_BASE}/accounts`, {
    headers: akahuHeaders(),
  });

  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    await db.from("integration_syncs").insert({
      user_id: userId,
      source: "akahu",
      status: "error",
      error_message: err.slice(0, 200),
    });
    return Response.json(
      { error: "Akahu API error", details: err },
      { status: 502 }
    );
  }

  const { items: accounts }: { items: AkahuAccount[] } =
    await accountsRes.json();
  let accountsUpdated = 0;

  for (const acc of accounts) {
    if (acc.status !== "ACTIVE") continue;

    const balanceCents = Math.round(acc.balance.current * 100);
    const institution = acc.connection.name;
    const accountType = mapAccountType(acc.type);
    const assetClass = mapAssetClass(acc.type);
    const liquidityTier = mapLiquidity(acc.type);
    const currency = acc.balance.currency || "NZD";

    // Match by institution + account name from Akahu
    const { data: existing } = await db
      .from("finance_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("institution", institution)
      .eq("name", acc.name)
      .single();

    if (existing) {
      await db
        .from("finance_accounts")
        .update({ balance: balanceCents, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await db.from("finance_accounts").insert({
        user_id: userId,
        name: acc.name,
        institution,
        currency,
        account_type: accountType,
        asset_class: assetClass,
        liquidity_tier: liquidityTier,
        tax_advantaged: acc.type === "KIWISAVER",
        balance: balanceCents,
        notes: `Akahu ID: ${acc._id}`,
      });
    }
    accountsUpdated++;
  }

  // --- Sync transactions ---
  // Fetch last sync time to only get new transactions
  const { data: lastSync } = await db
    .from("integration_syncs")
    .select("created_at")
    .eq("user_id", userId)
    .eq("source", "akahu")
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Default to 90 days back on first sync
  const since = lastSync
    ? lastSync.created_at
    : new Date(Date.now() - 90 * 86400000).toISOString();

  let transactionsImported = 0;
  let cursor: string | undefined;

  // Paginate through transactions
  do {
    const params = new URLSearchParams({ start: since });
    if (cursor) params.set("cursor", cursor);

    const txRes = await fetch(`${AKAHU_BASE}/transactions?${params}`, {
      headers: akahuHeaders(),
    });

    if (!txRes.ok) break;

    const txData = await txRes.json();
    const transactions: AkahuTransaction[] = txData.items || [];
    cursor = txData.cursor?.next;

    for (const tx of transactions) {
      const amountCents = Math.round(Math.abs(tx.amount) * 100);
      const txType = tx.amount >= 0 ? "income" : "expense";
      const txDate = tx.date.slice(0, 10); // YYYY-MM-DD

      // Derive category from Akahu enrichment
      const category =
        tx.category?.name ||
        tx.merchant?.name ||
        null;

      const { error } = await db.from("finance_transactions").upsert(
        {
          user_id: userId,
          date: txDate,
          amount: amountCents,
          currency: "NZD",
          description: tx.description,
          type: txType,
          category,
          import_source: "akahu",
          external_id: tx._id,
        },
        { onConflict: "import_source,external_id" }
      );

      if (!error) transactionsImported++;
    }
  } while (cursor);

  await db.from("integration_syncs").insert({
    user_id: userId,
    source: "akahu",
    status: "ok",
    records_imported: accountsUpdated + transactionsImported,
  });

  return Response.json({
    ok: true,
    accounts_updated: accountsUpdated,
    transactions_imported: transactionsImported,
  });
}

function mapAccountType(
  akahuType: string
): string {
  const map: Record<string, string> = {
    CHECKING: "cash",
    SAVINGS: "savings",
    CREDITCARD: "credit",
    LOAN: "credit",
    KIWISAVER: "kiwisaver",
    INVESTMENT: "investment",
    TERMDEPOSIT: "savings",
    WALLET: "cash",
  };
  return map[akahuType] || "cash";
}

function mapAssetClass(akahuType: string): string {
  if (akahuType === "KIWISAVER" || akahuType === "INVESTMENT")
    return "equities";
  return "cash_equivalents";
}

function mapLiquidity(akahuType: string): string {
  if (akahuType === "KIWISAVER") return "illiquid";
  if (akahuType === "TERMDEPOSIT") return "short_term";
  return "immediate";
}
