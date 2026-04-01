"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ExchangeRate {
  id: number;
  pair: string;
  rate: number;
}

const INTEGRATIONS = [
  { name: "Apple Health", description: "Sync sleep, HRV, and activity data", icon: "♥" },
  { name: "Cronometer", description: "Import nutrition and micronutrient logs", icon: "🥗" },
  { name: "myBOQ", description: "Auto-sync bank transactions", icon: "🏦" },
  { name: "Binance", description: "Track crypto portfolio balances", icon: "₿" },
  { name: "iCal", description: "Sync calendar events and schedules", icon: "📅" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const { data: ratesData } = await supabase
        .from("finance_exchange_rates")
        .select("*");

      setRates(ratesData || []);
      setLoading(false);
    };

    load();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="bg-desert-bg min-h-screen p-6 relative z-10">
        <p className="text-desert-text-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-pixel text-lg text-desert-text">⚙ Settings</h1>
        <p className="text-desert-text-3 mt-1">Account, integrations, and data</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Profile Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Profile
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-desert-text-3 text-xs font-mono uppercase tracking-wider mb-1">
                  Email
                </p>
                <p className="text-desert-text font-mono text-sm">{email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-desert-danger text-desert-danger font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-danger hover:text-desert-bg transition-colors duration-150"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Integrations
          </h2>
          <div className="space-y-2">
            {INTEGRATIONS.map((integration) => (
              <div
                key={integration.name}
                className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center justify-between hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{integration.icon}</span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">
                      {integration.name}
                    </p>
                    <p className="text-desert-text-3 text-xs">{integration.description}</p>
                  </div>
                </div>
                <span className="text-desert-text-3 font-mono text-xs uppercase tracking-wider">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Exchange Rates Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Exchange Rates
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
            {rates.length === 0 ? (
              <p className="text-desert-text-3 text-sm">No exchange rates configured</p>
            ) : (
              <div className="space-y-3">
                {rates.map((rate) => (
                  <div key={rate.id} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-desert-text-2">{rate.pair}</span>
                    <span className="font-mono text-sm text-desert-text font-medium">
                      {rate.rate.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Data Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Data
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-desert-text text-sm">Export all data</p>
                <p className="text-desert-text-3 text-xs">Download a JSON backup of your Life OS data</p>
              </div>
              <button
                disabled
                className="px-4 py-2 bg-desert-surface-hover border border-desert-border-strong text-desert-text-3 font-mono font-semibold uppercase tracking-wider text-sm rounded-sm cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
