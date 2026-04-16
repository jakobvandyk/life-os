#!/usr/bin/env node
// Backfill rate_nzdaud for all existing finance_transactions.
// Fetches historical NZDAUD rate per unique date from frankfurter.app.

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env.local");
const envFile = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: txns } = await sb
    .from("finance_transactions")
    .select("date")
    .is("rate_nzdaud", null);

  if (!txns || txns.length === 0) {
    console.log("No transactions need backfilling.");
    return;
  }

  const uniqueDates = [...new Set(txns.map((t) => t.date))].sort();
  console.log(`Backfilling ${uniqueDates.length} unique dates for ${txns.length} transactions...\n`);

  const rateCache = new Map();

  for (const date of uniqueDates) {
    let rate;
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=NZD&symbols=AUD`);
      if (res.ok) {
        const data = await res.json();
        rate = data.rates.AUD;
      }
    } catch {}

    if (!rate) {
      const cached = [...rateCache.values()];
      rate = cached.length > 0 ? cached[cached.length - 1] : 0.83;
    }

    rateCache.set(date, rate);

    const { error } = await sb
      .from("finance_transactions")
      .update({ rate_nzdaud: rate })
      .eq("date", date)
      .is("rate_nzdaud", null);

    if (error) {
      console.log(`  ${date}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${date}: NZDAUD=${rate.toFixed(4)}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✓ Backfilled ${uniqueDates.length} dates`);
}

main().catch(console.error);
