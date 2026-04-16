#!/usr/bin/env node
// Local Binance sync — runs from your Mac to avoid Vercel geo-restrictions.
// Usage: node ~/life-os/dashboard/scripts/sync-binance.js

const { createClient } = require("@supabase/supabase-js");
const { createHmac } = require("crypto");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envFile = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BINANCE_API_KEY = env.BINANCE_API_KEY;
const BINANCE_SECRET = env.BINANCE_SECRET;
const USER_ID = env.HEALTH_USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!BINANCE_API_KEY || !BINANCE_SECRET) {
  console.error("Missing BINANCE_API_KEY or BINANCE_SECRET in .env.local");
  process.exit(1);
}
if (!USER_ID) {
  console.error("Missing HEALTH_USER_ID in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function sign(queryString) {
  return createHmac("sha256", BINANCE_SECRET).update(queryString).digest("hex");
}

async function refreshExchangeRates() {
  const now = new Date().toISOString();
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=NZD&symbols=AUD,USD"
    );
    if (res.ok) {
      const data = await res.json();
      const pairs = [
        { pair: "NZDAUD", rate: data.rates.AUD, updated_at: now },
        { pair: "NZDUSD", rate: data.rates.USD, updated_at: now },
        { pair: "USDNZD", rate: 1 / data.rates.USD, updated_at: now },
      ];
      for (const p of pairs) {
        const { data: existing } = await sb
          .from("finance_exchange_rates")
          .select("id")
          .eq("pair", p.pair)
          .single();
        if (existing) {
          await sb
            .from("finance_exchange_rates")
            .update({ rate: p.rate, updated_at: now })
            .eq("id", existing.id);
        } else {
          await sb.from("finance_exchange_rates").insert(p);
        }
      }
      console.log(
        `✓ Exchange rates updated: NZDAUD=${data.rates.AUD.toFixed(4)}, NZDUSD=${data.rates.USD.toFixed(4)}`
      );
      return 1 / data.rates.USD;
    }
  } catch {}

  const { data: usdRate } = await sb
    .from("finance_exchange_rates")
    .select("rate")
    .eq("pair", "USDNZD")
    .single();
  console.log("⚠ Using cached exchange rate");
  return usdRate?.rate || 1.6667;
}

async function main() {
  console.log("Syncing Binance...\n");

  const usdToNzd = await refreshExchangeRates();

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = sign(queryString);

  const accountRes = await fetch(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
    { headers: { "X-MBX-APIKEY": BINANCE_API_KEY } }
  );

  if (!accountRes.ok) {
    const err = await accountRes.text();
    console.error("Binance API error:", err);
    await sb.from("integration_syncs").insert({
      user_id: USER_ID,
      source: "binance",
      status: "error",
      error_message: err.slice(0, 200),
    });
    process.exit(1);
  }

  const account = await accountRes.json();
  const balances = (account.balances || []).filter(
    (b) => parseFloat(b.free) + parseFloat(b.locked) > 0.001
  );

  let updated = 0;

  for (const bal of balances) {
    const symbol = bal.asset;
    const amount = parseFloat(bal.free) + parseFloat(bal.locked);
    let nzdValue;

    if (symbol === "USDT" || symbol === "BUSD" || symbol === "USD") {
      nzdValue = amount * usdToNzd;
    } else {
      try {
        const priceRes = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`
        );
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          nzdValue = amount * parseFloat(priceData.price) * usdToNzd;
        } else {
          continue;
        }
      } catch {
        continue;
      }
    }

    // Skip dust (under NZ$1)
    if (nzdValue < 1) continue;

    const balanceCents = Math.round(nzdValue * 100);

    const { data: existing } = await sb
      .from("finance_accounts")
      .select("id")
      .eq("user_id", USER_ID)
      .eq("institution", "Binance")
      .eq("name", symbol)
      .single();

    if (existing) {
      await sb
        .from("finance_accounts")
        .update({ balance: balanceCents, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await sb.from("finance_accounts").insert({
        user_id: USER_ID,
        name: symbol,
        institution: "Binance",
        currency: "NZD",
        account_type: "investment",
        asset_class: "crypto",
        liquidity_tier: "short_term",
        balance: balanceCents,
      });
    }

    const nzdDisplay = (nzdValue).toFixed(2);
    console.log(`  ${symbol}: ${amount} → NZ$${nzdDisplay}`);
    updated++;
  }

  await sb.from("integration_syncs").insert({
    user_id: USER_ID,
    source: "binance",
    status: "ok",
    records_imported: updated,
  });

  console.log(`\n✓ Synced ${updated} assets`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
