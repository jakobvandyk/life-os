import { getServiceClient } from "@/lib/supabase-service";
import { createClient } from "@/lib/supabase-server";
import { createHmac } from "crypto";

export const preferredRegion = "sin1";

async function getUserId(request: Request): Promise<string | null> {
  // Check for cron secret first
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return process.env.HEALTH_USER_ID || null;
  }

  // Fall back to session auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

function sign(queryString: string): string {
  return createHmac("sha256", process.env.BINANCE_SECRET!)
    .update(queryString)
    .digest("hex");
}

async function refreshExchangeRates(): Promise<{ usdToNzd: number }> {
  const db = getServiceClient();
  const now = new Date().toISOString();

  try {
    // frankfurter.app uses ECB rates, free, no key needed
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=NZD&symbols=AUD,USD");
    if (res.ok) {
      const data = await res.json();
      const nzdAud = data.rates.AUD; // 1 NZD = X AUD
      const nzdUsd = data.rates.USD; // 1 NZD = X USD
      const usdNzd = 1 / nzdUsd;    // 1 USD = X NZD

      const pairs = [
        { pair: "NZDAUD", rate: nzdAud, updated_at: now },
        { pair: "NZDUSD", rate: nzdUsd, updated_at: now },
        { pair: "USDNZD", rate: usdNzd, updated_at: now },
      ];

      for (const p of pairs) {
        const { data: existing } = await db
          .from("finance_exchange_rates")
          .select("id")
          .eq("pair", p.pair)
          .single();

        if (existing) {
          await db.from("finance_exchange_rates").update({ rate: p.rate, updated_at: now }).eq("id", existing.id);
        } else {
          await db.from("finance_exchange_rates").insert(p);
        }
      }

      return { usdToNzd: usdNzd };
    }
  } catch {
    // Fall through to DB fallback
  }

  // Fallback: read existing rate from DB
  const { data: usdRate } = await db
    .from("finance_exchange_rates")
    .select("rate")
    .eq("pair", "USDNZD")
    .single();

  return { usdToNzd: usdRate?.rate || 1.6667 };
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_SECRET) {
    return Response.json({ error: "Binance credentials not configured" }, { status: 500 });
  }

  // Refresh exchange rates from ECB (writes to DB for all components)
  const { usdToNzd } = await refreshExchangeRates();

  // Fetch Binance account
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = sign(queryString);

  const accountRes = await fetch(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
    {
      headers: { "X-MBX-APIKEY": process.env.BINANCE_API_KEY! },
    }
  );

  if (!accountRes.ok) {
    const err = await accountRes.text();
    await getServiceClient().from("integration_syncs").insert({
      user_id: userId,
      source: "binance",
      status: "error",
      error_message: err.slice(0, 200),
    });
    return Response.json({ error: "Binance API error", details: err }, { status: 502 });
  }

  const account = await accountRes.json();
  const balances = (account.balances || []).filter(
    (b: { free: string; locked: string }) =>
      parseFloat(b.free) + parseFloat(b.locked) > 0.001
  );

  let updated = 0;

  for (const bal of balances) {
    const symbol: string = bal.asset;
    const amount = parseFloat(bal.free) + parseFloat(bal.locked);

    let nzdValue: number;

    if (symbol === "USDT" || symbol === "BUSD" || symbol === "USD") {
      nzdValue = amount * usdToNzd;
    } else {
      // Get price in USDT
      try {
        const priceRes = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`
        );
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          const usdtPrice = parseFloat(priceData.price);
          nzdValue = amount * usdtPrice * usdToNzd;
        } else {
          // Skip assets without USDT pair
          continue;
        }
      } catch {
        continue;
      }
    }

    // Skip dust (under NZ$1)
    if (nzdValue < 1) continue;

    const balanceCents = Math.round(nzdValue * 100);

    // Find or create account
    const { data: existing } = await getServiceClient()
      .from("finance_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("institution", "Binance")
      .eq("name", symbol)
      .single();

    if (existing) {
      await getServiceClient()
        .from("finance_accounts")
        .update({
          balance: balanceCents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await getServiceClient().from("finance_accounts").insert({
        user_id: userId,
        name: symbol,
        institution: "Binance",
        currency: "NZD",
        account_type: "investment",
        asset_class: "crypto",
        liquidity_tier: "short_term",
        balance: balanceCents,
      });
    }

    updated++;
  }

  await getServiceClient().from("integration_syncs").insert({
    user_id: userId,
    source: "binance",
    status: "ok",
    records_imported: updated,
  });

  return Response.json({ ok: true, updated });
}
