"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PixelIcon from "@/components/PixelIcon";
import SignOutButton from "@/components/SignOutButton";

interface ExchangeRate {
  id: number;
  pair: string;
  rate: number;
}

interface SyncLog {
  id: number;
  source: string;
  status: string;
  records_imported: number;
  error_message: string | null;
  synced_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [exportDays, setExportDays] = useState(14);
  const [exporting, setExporting] = useState<string | null>(null);
  const cronometerRef = useRef<HTMLInputElement>(null);
  const ofxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const [{ data: ratesData }, { data: logsData }] = await Promise.all([
        supabase.from("finance_exchange_rates").select("*"),
        supabase
          .from("integration_syncs")
          .select("*")
          .eq("user_id", user.id)
          .order("synced_at", { ascending: false })
          .limit(20),
      ]);

      setRates(ratesData || []);
      setSyncLogs(logsData || []);
      setLoading(false);
    };

    load();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getLastSync = (source: string): SyncLog | undefined =>
    syncLogs.find((l) => l.source === source);

  const formatSyncTime = (log: SyncLog | undefined): string => {
    if (!log) return "Never synced";
    const d = new Date(log.synced_at);
    return `${d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })} · ${log.records_imported} records`;
  };

  const triggerSync = async (source: string, endpoint: string) => {
    setSyncing(source);
    setUploadResult(null);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (res.ok) {
        setUploadResult(`${source}: Synced ${data.imported ?? data.updated ?? 0} records`);
      } else {
        setUploadResult(`${source}: ${data.error || "Failed"}`);
      }
    } catch {
      setUploadResult(`${source}: Connection error`);
    }
    setSyncing(null);
    // Refresh sync logs
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("integration_syncs")
        .select("*")
        .eq("user_id", user.id)
        .order("synced_at", { ascending: false })
        .limit(20);
      setSyncLogs(data || []);
    }
  };

  const uploadFile = async (source: string, endpoint: string, file: File) => {
    setSyncing(source);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        const parts = [`${source}: ${data.imported} dates imported`];
        if (data.skipped) parts.push(`${data.skipped} skipped`);
        if (data.checkins) parts.push(`${data.checkins} checkin records`);
        if (data.journal) parts.push(`${data.journal} journal updates`);
        if (data.nutrition) parts.push(`${data.nutrition} nutrition records`);
        if (data.total_value) parts.push(`$${data.total_value}`);
        setUploadResult(parts.join(", "));
      } else {
        setUploadResult(`${source}: ${data.error || "Failed"}`);
      }
    } catch {
      setUploadResult(`${source}: Upload error`);
    }
    setSyncing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 relative z-10">
        <p className="text-desert-text-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-desert-border">
        <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="settings" size={22} className="text-desert-accent" /> Settings</h1>
        <p className="text-desert-text-3 mt-1">Account, integrations, and data</p>
      </div>

      {/* Upload result banner */}
      {uploadResult && (
        <div className="mb-6 bg-desert-surface border border-desert-border rounded-sm p-3 flex items-center justify-between">
          <p className="text-desert-text text-sm font-mono">{uploadResult}</p>
          <button
            onClick={() => setUploadResult(null)}
            className="text-desert-text-3 hover:text-desert-text text-xs"
          >
            ✕
          </button>
        </div>
      )}

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
            {/* Apple Health */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_health" size={20} className="text-desert-danger" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Apple Health</p>
                    <p className="text-desert-text-3 text-xs">
                      Webhook for iOS Shortcut — POST /api/integrations/health
                    </p>
                  </div>
                </div>
                <span className="text-desert-text-3 font-mono text-[10px]">
                  {formatSyncTime(getLastSync("apple_health"))}
                </span>
              </div>
            </div>

            {/* Cronometer */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_nutrition" size={20} className="text-desert-success" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Cronometer</p>
                    <p className="text-desert-text-3 text-xs">Upload CSV — nutrition or biometrics export</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("cronometer"))}
                  </span>
                  <input
                    ref={cronometerRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("Cronometer", "/api/import/cronometer", file);
                    }}
                  />
                  <button
                    onClick={() => cronometerRef.current?.click()}
                    disabled={syncing === "Cronometer"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "Cronometer" ? "..." : "Upload CSV"}
                  </button>
                </div>
              </div>
            </div>

            {/* myBOQ */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_bank" size={20} className="text-desert-celestial" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">myBOQ</p>
                    <p className="text-desert-text-3 text-xs">Upload OFX bank export</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("boq_ofx"))}
                  </span>
                  <input
                    ref={ofxRef}
                    type="file"
                    accept=".ofx,.qfx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("myBOQ", "/api/import/ofx", file);
                    }}
                  />
                  <button
                    onClick={() => ofxRef.current?.click()}
                    disabled={syncing === "myBOQ"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "myBOQ" ? "..." : "Upload OFX"}
                  </button>
                </div>
              </div>
            </div>

            {/* Binance */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_crypto" size={20} className="text-desert-warning" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Binance</p>
                    <p className="text-desert-text-3 text-xs">Sync crypto portfolio balances</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("binance"))}
                  </span>
                  <button
                    onClick={() => triggerSync("Binance", "/api/sync/binance")}
                    disabled={syncing === "Binance"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "Binance" ? "..." : "Sync Now"}
                  </button>
                </div>
              </div>
            </div>

            {/* iCal */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_ical" size={20} className="text-desert-accent" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">iCal</p>
                    <p className="text-desert-text-3 text-xs">
                      Sync calendar feeds (set ICAL_URL_1 in env)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("ical"))}
                  </span>
                  <button
                    onClick={() => triggerSync("iCal", "/api/sync/ical")}
                    disabled={syncing === "iCal"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "iCal" ? "..." : "Sync Now"}
                  </button>
                </div>
              </div>
            </div>
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

        {/* Data Export */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Data Export
          </h2>
          <div className="space-y-3">
            {/* Export for Analysis */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
              <div className="mb-3">
                <p className="text-desert-text text-sm font-medium">Export for Analysis</p>
                <p className="text-desert-text-3 text-xs">
                  JSON bundle for AI analysis — checkins, nutrition, journal, habits, workouts, goals, tasks, reviews
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1.5">
                  {[7, 14, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setExportDays(d)}
                      className={`px-2.5 py-1 font-mono text-xs rounded-sm transition-colors duration-150 ${
                        exportDays === d
                          ? "bg-desert-accent text-desert-bg"
                          : "bg-desert-bg border border-desert-border-strong text-desert-text-2 hover:text-desert-text hover:border-desert-accent"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    setExporting("analysis");
                    try {
                      const res = await fetch(`/api/export/analysis?days=${exportDays}`, { credentials: "include" });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `life-os-export-${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } finally {
                      setExporting(null);
                    }
                  }}
                  disabled={exporting === "analysis"}
                  className="px-4 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-xs rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                >
                  {exporting === "analysis" ? "Exporting..." : "Download JSON"}
                </button>
              </div>
            </div>

            {/* Full Data Backup */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-desert-text text-sm font-medium">Full Data Backup</p>
                  <p className="text-desert-text-3 text-xs">
                    Download all data across all tables — no date filter
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setExporting("full");
                    try {
                      const res = await fetch("/api/export/analysis?days=9999", { credentials: "include" });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `life-os-backup-${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } finally {
                      setExporting(null);
                    }
                  }}
                  disabled={exporting === "full"}
                  className="px-4 py-2 bg-desert-surface-hover border border-desert-border-strong text-desert-text font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:border-desert-accent hover:text-desert-accent transition-colors duration-150 disabled:opacity-50"
                >
                  {exporting === "full" ? "Exporting..." : "Backup All"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">Account</h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-desert-text text-sm">{email}</p>
                <p className="text-desert-text-3 text-xs">Signed in</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
